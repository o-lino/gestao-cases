"""
Involvement API Endpoints

Endpoints for managing involvement requests (data creation requests).
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.models.collaborator import Collaborator
from app.models.involvement import InvolvementStatus
from app.schemas.involvement import (
    InvolvementCreate,
    InvolvementSetDate,
    InvolvementComplete,
    InvolvementResponse,
    InvolvementListResponse,
    InvolvementStats,
)
from app.services.involvement_service import involvement_service, InvolvementError

router = APIRouter()


@router.post("/", response_model=InvolvementResponse, status_code=status.HTTP_201_CREATED)
async def create_involvement(
    *,
    db: AsyncSession = Depends(deps.get_db),
    data: InvolvementCreate,
    current_user: Collaborator = Depends(deps.get_current_user),
):
    """
    Create a new involvement request.
    
    Called by the requester after owner rejects a match indicating data doesn't exist.
    The requester provides the external request number from their external system.
    """
    try:
        # Get the variable to find the owner
        from app.models.case import CaseVariable
        from app.models.data_catalog import VariableMatch, DataTable
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload
        
        # Find the selected match to get the owner
        result = await db.execute(
            select(CaseVariable)
            .options(selectinload(CaseVariable.case))
            .where(CaseVariable.id == data.case_variable_id)
        )
        variable = result.scalars().first()
        
        if not variable:
            raise HTTPException(status_code=404, detail="Variable not found")
        
        # Get the last rejected match to find the owner
        result = await db.execute(
            select(VariableMatch)
            .options(selectinload(VariableMatch.data_table).selectinload(DataTable.owner))
            .where(VariableMatch.case_variable_id == data.case_variable_id)
            .order_by(VariableMatch.owner_validated_at.desc())
        )
        match = result.scalars().first()
        
        if not match or not match.data_table or not match.data_table.owner_id:
            raise HTTPException(
                status_code=400, 
                detail="No rejected match found with owner information"
            )
        
        owner_id = match.data_table.owner_id
        
        involvement = await involvement_service.create_involvement(
            db=db,
            data=data,
            requester_id=current_user.id,
            owner_id=owner_id
        )
        
        return involvement_service.to_response(involvement)
        
    except InvolvementError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=InvolvementListResponse)
async def list_involvements(
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.get_current_user),
    owner_id: Optional[int] = Query(None, description="Filter by owner ID"),
    requester_id: Optional[int] = Query(None, description="Filter by requester ID"),
    status_filter: Optional[InvolvementStatus] = Query(None, alias="status", description="Filter by status"),
    include_completed: bool = Query(False, description="Include completed involvements"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    """
    List involvement requests with optional filters.
    """
    involvements, total = await involvement_service.list_involvements(
        db=db,
        owner_id=owner_id,
        requester_id=requester_id,
        status=status_filter,
        include_completed=include_completed,
        skip=skip,
        limit=limit
    )
    
    return InvolvementListResponse(
        items=[involvement_service.to_response(inv) for inv in involvements],
        total=total,
        page=(skip // limit) + 1,
        size=limit,
        pages=(total + limit - 1) // limit if limit > 0 else 1
    )


@router.get("/my-pending", response_model=List[InvolvementResponse])
async def get_my_pending_involvements(
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.get_current_user),
):
    """
    Get all pending involvements where the current user is the owner.
    
    Returns involvements that need action:
    - PENDING: Owner needs to set expected date
    - IN_PROGRESS: Work in progress (may be nearing due date)
    - OVERDUE: Past expected date, needs completion
    """
    involvements = await involvement_service.get_pending_for_owner(
        db=db,
        owner_id=current_user.id
    )
    
    return [involvement_service.to_response(inv) for inv in involvements]


@router.get("/my-requests", response_model=List[InvolvementResponse])
async def get_my_requested_involvements(
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.get_current_user),
    include_completed: bool = Query(False),
):
    """
    Get all involvements requested by the current user.
    """
    involvements, _ = await involvement_service.list_involvements(
        db=db,
        requester_id=current_user.id,
        include_completed=include_completed,
        limit=100
    )
    
    return [involvement_service.to_response(inv) for inv in involvements]


@router.get("/stats", response_model=InvolvementStats)
async def get_involvement_stats(
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.get_current_user),
    owner_id: Optional[int] = Query(None, description="Filter stats by owner"),
):
    """
    Get involvement statistics.
    """
    return await involvement_service.get_stats(db=db, owner_id=owner_id)


@router.get("/variable/{variable_id}", response_model=Optional[InvolvementResponse])
async def get_involvement_for_variable(
    variable_id: int,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.get_current_user),
):
    """
    Get active involvement for a specific variable.
    Returns null if no active involvement exists.
    """
    involvement = await involvement_service.get_involvement_for_variable(
        db=db,
        variable_id=variable_id
    )
    
    if not involvement:
        return None
    
    return involvement_service.to_response(involvement)


@router.get("/{involvement_id}", response_model=InvolvementResponse)
async def get_involvement(
    involvement_id: int,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.get_current_user),
):
    """
    Get involvement details by ID.
    """
    involvement = await involvement_service.get_involvement(
        db=db,
        involvement_id=involvement_id
    )
    
    if not involvement:
        raise HTTPException(status_code=404, detail="Involvement not found")
    
    return involvement_service.to_response(involvement)


@router.patch("/{involvement_id}/set-date", response_model=InvolvementResponse)
async def set_involvement_date(
    involvement_id: int,
    data: InvolvementSetDate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.get_current_user),
):
    """
    Set the expected completion date for an involvement.
    
    Only the owner can set/update the expected date.
    This transitions the involvement from PENDING to IN_PROGRESS.
    """
    try:
        involvement = await involvement_service.set_expected_date(
            db=db,
            involvement_id=involvement_id,
            data=data,
            owner_id=current_user.id
        )
        
        return involvement_service.to_response(involvement)
        
    except InvolvementError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{involvement_id}/complete", response_model=InvolvementResponse)
async def complete_involvement(
    involvement_id: int,
    data: InvolvementComplete,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.get_current_user),
):
    """
    Complete an involvement by providing the created table and concept.
    
    Only the owner can complete the involvement.
    This transitions the involvement to COMPLETED and updates the variable
    status so the requester can continue with match selection.
    """
    try:
        involvement = await involvement_service.complete_involvement(
            db=db,
            involvement_id=involvement_id,
            data=data,
            owner_id=current_user.id
        )
        
        return involvement_service.to_response(involvement)
        
    except InvolvementError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/send-overdue-reminders", status_code=status.HTTP_200_OK)
async def trigger_overdue_reminders(
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.get_current_user),
):
    """
    Manually trigger overdue reminders (admin only).
    
    This is normally done by a scheduled task, but can be triggered manually.
    """
    if current_user.role not in ["ADMIN", "MANAGER"]:
        raise HTTPException(
            status_code=403,
            detail="Only admins can trigger reminders"
        )
    
    count = await involvement_service.send_overdue_reminders(db=db)
    
    return {"message": f"Sent {count} overdue reminders"}
