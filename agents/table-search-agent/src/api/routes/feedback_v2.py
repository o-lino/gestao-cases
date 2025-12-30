"""
Feedback Routes V2

Enhanced endpoints for recording and querying decision feedback.
V4: Uses the new feedback store with learning capabilities.
"""

from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel, Field

from src.agent.memory.feedback_store import get_feedback_store
from src.agent.disambiguation.historical_scorer import record_decision_feedback
from src.agent.state_v2 import CanonicalIntent


router = APIRouter(prefix="/v2/feedback", tags=["Feedback V2"])


# ============== Request/Response Models ==============

class FeedbackRequestV2(BaseModel):
    """V2 Feedback request with full context."""
    
    # Request identification
    request_id: str = Field(..., description="Original request ID")
    
    # What was recommended
    table_id: int = Field(..., description="Recommended table ID")
    table_name: Optional[str] = Field(None, description="Table name for reference")
    domain_id: Optional[str] = None
    owner_id: Optional[int] = None
    
    # Outcome
    outcome: str = Field(..., description="APPROVED, REJECTED, or MODIFIED")
    actual_table_id: Optional[int] = Field(None, description="Correct table if MODIFIED")
    
    # Context at decision time
    confidence_at_decision: float = Field(0.0, description="Score when recommended")
    use_case: str = Field("default", description="Use case type")
    
    # Intent reconstruction (optional, for better learning)
    data_need: Optional[str] = None
    target_entity: Optional[str] = None
    target_product: Optional[str] = None
    target_segment: Optional[str] = None
    granularity: Optional[str] = None


class FeedbackResponseV2(BaseModel):
    """V2 Feedback response."""
    success: bool
    record_id: Optional[int] = None
    message: str


class HistoricalScoreRequest(BaseModel):
    """Request to check historical score."""
    data_need: str
    target_entity: Optional[str] = None
    target_product: Optional[str] = None
    target_segment: Optional[str] = None
    granularity: Optional[str] = None
    table_id: int


class HistoricalScoreResponse(BaseModel):
    """Historical score response."""
    table_id: int
    approval_rate: float
    sample_count: int
    is_reliable: bool


class FeedbackStatsResponse(BaseModel):
    """Feedback store statistics."""
    total_records: int
    unique_concepts: int
    unique_pairs: int
    cache_size: int
    storage: str


# ============== Endpoints ==============

@router.post("", response_model=FeedbackResponseV2)
async def record_feedback_v2(request: FeedbackRequestV2) -> FeedbackResponseV2:
    """
    Record feedback on a recommendation (V2).
    
    This endpoint records the decision outcome and uses it for future learning.
    The feedback is stored and influences historical_score for similar queries.
    """
    try:
        # Build intent from request (if provided)
        intent = None
        if request.data_need:
            intent = CanonicalIntent(
                data_need=request.data_need,
                target_entity=request.target_entity,
                target_product=request.target_product,
                target_segment=request.target_segment,
                granularity=request.granularity,
                original_query="",
            )
        
        # Record the feedback
        record_id = await record_decision_feedback(
            intent=intent,
            table_id=request.table_id,
            outcome=request.outcome,
            actual_table_id=request.actual_table_id,
            confidence=request.confidence_at_decision,
            use_case=request.use_case,
            request_id=request.request_id,
            domain_id=request.domain_id,
            owner_id=request.owner_id,
        )
        
        # If MODIFIED, also record the correct table as approved
        if request.outcome == "MODIFIED" and request.actual_table_id:
            await record_decision_feedback(
                intent=intent,
                table_id=request.actual_table_id,
                outcome="APPROVED",
                confidence=1.0,  # User explicitly chose this
                use_case=request.use_case,
                request_id=f"{request.request_id}_correction",
                domain_id=request.domain_id,
                owner_id=request.owner_id,
            )
        
        return FeedbackResponseV2(
            success=True,
            record_id=record_id,
            message=f"Feedback recorded: {request.outcome}",
        )
        
    except Exception as e:
        return FeedbackResponseV2(
            success=False,
            message=f"Failed to record: {str(e)}",
        )


@router.post("/check", response_model=HistoricalScoreResponse)
async def check_historical_score(request: HistoricalScoreRequest) -> HistoricalScoreResponse:
    """
    Check historical approval rate for a concept+table pair.
    
    Useful for debugging and understanding why a table was ranked.
    """
    from src.agent.disambiguation.historical_scorer import get_historical_score_for_table
    
    intent = CanonicalIntent(
        data_need=request.data_need,
        target_entity=request.target_entity,
        target_product=request.target_product,
        target_segment=request.target_segment,
        granularity=request.granularity,
        original_query="",
    )
    
    score, is_reliable = await get_historical_score_for_table(
        intent=intent,
        table_id=request.table_id,
    )
    
    # Get sample count from store
    from src.agent.memory.feedback_store import generate_concept_hash
    concept_hash = generate_concept_hash({
        "data_need": request.data_need,
        "target_entity": request.target_entity,
        "target_product": request.target_product,
        "target_segment": request.target_segment,
        "granularity": request.granularity,
    })
    
    store = get_feedback_store()
    _, count = await store.get_historical_score(concept_hash, request.table_id)
    
    return HistoricalScoreResponse(
        table_id=request.table_id,
        approval_rate=score,
        sample_count=count if count != -1 else 0,
        is_reliable=is_reliable,
    )


@router.get("/stats", response_model=FeedbackStatsResponse)
async def get_feedback_stats() -> FeedbackStatsResponse:
    """Get feedback store statistics."""
    store = get_feedback_store()
    stats = store.stats
    
    return FeedbackStatsResponse(**stats)
