"""
Curator API Endpoints

Handles curator operations for correcting table suggestions:
- List variables for review
- Apply table corrections
- View correction history
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_curator_or_above
from app.models.collaborator import Collaborator
from app.services.curator_service import CuratorService, CuratorError


router = APIRouter()


# ============== Schemas ==============

class TableCorrectionRequest(BaseModel):
    """Request to correct a table suggestion"""
    new_table_id: int = Field(..., description="ID of the correct table")
    reason: Optional[str] = Field(None, description="Reason for the correction")


class CorrectionResponse(BaseModel):
    """Response after applying a correction"""
    id: int
    variable_id: int
    original_table_id: Optional[int]
    corrected_table_id: int
    curator_id: int
    correction_reason: Optional[str]
    created_at: str
    
    class Config:
        from_attributes = True


class VariableForReviewResponse(BaseModel):
    """Variable with match information for curator review"""
    id: int
    variable_name: str
    variable_type: str
    concept: Optional[str]
    case_id: int
    search_status: str
    match_count: int
    selected_table: Optional[dict]
    other_matches: List[dict]


class CuratorStatsResponse(BaseModel):
    """Curator statistics"""
    total_corrections: int
    corrections_this_month: int
    corrected_approved: int
    corrected_before_approval: int


# ============== Endpoints ==============

@router.get("/variables", response_model=List[VariableForReviewResponse])
async def list_variables_for_review(
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(require_curator_or_above)
):
    """
    List variables that have matches and could benefit from curator review.
    Returns variables with their current match and alternatives.
    """
    variables = await CuratorService.list_variables_for_review(
        db, status_filter=status, limit=limit, offset=offset
    )
    return variables


@router.post("/variables/{variable_id}/correct", response_model=CorrectionResponse)
async def correct_table_suggestion(
    variable_id: int,
    request: TableCorrectionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(require_curator_or_above)
):
    """
    Apply a correction to a variable's table suggestion.
    This will update the selected match and notify the table owner.
    """
    try:
        correction = await CuratorService.correct_table_suggestion(
            db=db,
            variable_id=variable_id,
            new_table_id=request.new_table_id,
            curator_id=current_user.id,
            reason=request.reason
        )
        
        return CorrectionResponse(
            id=correction.id,
            variable_id=correction.variable_id,
            original_table_id=correction.original_table_id,
            corrected_table_id=correction.corrected_table_id,
            curator_id=correction.curator_id,
            correction_reason=correction.correction_reason,
            created_at=correction.created_at.isoformat() if correction.created_at else ""
        )
    except CuratorError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/corrections", response_model=List[CorrectionResponse])
async def get_correction_history(
    my_corrections: bool = Query(False, description="Only show my corrections"),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(require_curator_or_above)
):
    """
    Get history of table corrections.
    Can filter to show only the current user's corrections.
    """
    curator_id = current_user.id if my_corrections else None
    
    corrections = await CuratorService.get_correction_history(
        db=db,
        curator_id=curator_id,
        limit=limit,
        offset=offset
    )
    
    return [
        CorrectionResponse(
            id=c.id,
            variable_id=c.variable_id,
            original_table_id=c.original_table_id,
            corrected_table_id=c.corrected_table_id,
            curator_id=c.curator_id,
            correction_reason=c.correction_reason,
            created_at=c.created_at.isoformat() if c.created_at else ""
        )
        for c in corrections
    ]


@router.get("/corrections/{correction_id}", response_model=CorrectionResponse)
async def get_correction_details(
    correction_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(require_curator_or_above)
):
    """Get details of a specific correction."""
    correction = await CuratorService.get_correction_by_id(db, correction_id)
    
    if not correction:
        raise HTTPException(status_code=404, detail="Correction not found")
    
    return CorrectionResponse(
        id=correction.id,
        variable_id=correction.variable_id,
        original_table_id=correction.original_table_id,
        corrected_table_id=correction.corrected_table_id,
        curator_id=correction.curator_id,
        correction_reason=correction.correction_reason,
        created_at=correction.created_at.isoformat() if correction.created_at else ""
    )


@router.get("/stats", response_model=CuratorStatsResponse)
async def get_my_stats(
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(require_curator_or_above)
):
    """Get statistics for the current curator's corrections."""
    stats = await CuratorService.get_curator_stats(db, current_user.id)
    return CuratorStatsResponse(**stats)
