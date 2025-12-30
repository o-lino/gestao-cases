"""
Feedback Routes

Endpoints for recording decision feedback.
"""

from fastapi import APIRouter

from ..schemas import FeedbackRequest, FeedbackResponse, FeedbackOutcome
from src.agent.memory.long_term import record_decision_outcome


router = APIRouter(prefix="/feedback", tags=["Feedback"])


@router.post("", response_model=FeedbackResponse)
async def record_feedback(request: FeedbackRequest) -> FeedbackResponse:
    """
    Record feedback on a recommendation.
    
    This endpoint is called when a user approves, rejects, or modifies
    a table recommendation. The feedback is used to improve future
    recommendations through the learning system.
    """
    try:
        # Determine if approved based on outcome
        approved = request.outcome == FeedbackOutcome.APPROVED
        
        # If modified, also record the actual table as approved
        if request.outcome == FeedbackOutcome.MODIFIED and request.actual_table_id:
            # Record rejection of original
            await record_decision_outcome(
                concept_hash=request.request_id,  # Simplified, would use actual hash
                table_id=request.recommendation_table_id,
                approved=False,
            )
            # Record approval of actual
            await record_decision_outcome(
                concept_hash=request.request_id,
                table_id=request.actual_table_id,
                approved=True,
            )
        else:
            await record_decision_outcome(
                concept_hash=request.request_id,
                table_id=request.recommendation_table_id,
                approved=approved,
            )
        
        return FeedbackResponse(
            success=True,
            message=f"Feedback recorded: {request.outcome.value}"
        )
        
    except Exception as e:
        return FeedbackResponse(
            success=False,
            message=f"Failed to record feedback: {str(e)}"
        )
