"""
Search Routes

Main search API endpoints for table recommendations.
"""

import uuid
import time
from fastapi import APIRouter, HTTPException

from ..schemas import (
    TableSearchRequest,
    TableSearchResponse,
    TableRecommendationResponse,
    TableCandidateResponse,
    TableScoreResponse,
    ConfidenceLevelResponse,
)
from src.agent import get_agent, create_initial_state


router = APIRouter(prefix="/search", tags=["Search"])


@router.post("", response_model=TableSearchResponse)
async def search_tables(request: TableSearchRequest) -> TableSearchResponse:
    """
    Search for matching tables for a variable.
    
    This endpoint runs the LangGraph agent workflow to find the best
    matching tables based on semantic similarity, historical patterns,
    and domain context.
    
    Returns ranked recommendations with confidence levels.
    """
    start_time = time.time()
    request_id = str(uuid.uuid4())[:8]
    
    try:
        # Create initial state
        state = create_initial_state(
            request_id=request_id,
            variable_name=request.variable_name,
            variable_type=request.variable_type,
            concept=request.concept,
            domain=request.domain,
            product=request.product,
            case_context=request.case_context,
            case_id=request.case_id,
            variable_id=request.variable_id,
            max_results=request.max_results,
        )
        
        # Run the agent
        agent = get_agent()
        result = await agent.ainvoke(
            state,
            config={"configurable": {"thread_id": request_id}}
        )
        
        # Convert to response models
        recommendations = []
        for rec in result.get("recommendations", []):
            recommendations.append(TableRecommendationResponse(
                table=TableCandidateResponse(
                    id=rec.table.id,
                    name=rec.table.name,
                    display_name=rec.table.display_name,
                    description=rec.table.description,
                    domain=rec.table.domain,
                    schema_name=rec.table.schema_name,
                    keywords=rec.table.keywords,
                    owner_id=rec.table.owner_id,
                    owner_name=rec.table.owner_name,
                ),
                score=TableScoreResponse(
                    total_score=rec.score.total_score,
                    semantic_score=rec.score.semantic_score,
                    historical_score=rec.score.historical_score,
                    keyword_score=rec.score.keyword_score,
                    domain_score=rec.score.domain_score,
                    freshness_score=rec.score.freshness_score,
                    owner_trust_score=rec.score.owner_trust_score,
                ),
                rank=rec.rank,
                reasoning=rec.reasoning,
                confidence_level=ConfidenceLevelResponse(rec.confidence_level.value),
                match_reason=rec.match_reason,
                matched_column=rec.matched_column,
            ))
        
        # Top recommendation
        top_rec = None
        if recommendations:
            top_rec = recommendations[0]
        
        processing_time = int((time.time() - start_time) * 1000)
        
        return TableSearchResponse(
            request_id=request_id,
            recommendations=recommendations,
            top_recommendation=top_rec,
            overall_confidence=result.get("overall_confidence", 0.0),
            confidence_level=ConfidenceLevelResponse(result.get("confidence_level", "LOW").value),
            overall_reasoning=result.get("overall_reasoning", ""),
            processing_time_ms=processing_time,
        )
        
    except Exception as e:
        processing_time = int((time.time() - start_time) * 1000)
        raise HTTPException(
            status_code=500,
            detail={
                "message": f"Search failed: {str(e)}",
                "request_id": request_id,
                "processing_time_ms": processing_time,
            }
        )
