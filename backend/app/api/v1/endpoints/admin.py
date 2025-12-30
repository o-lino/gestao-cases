"""
Admin API Endpoints

Provides superuser/administrator operations for cases and variables.
All endpoints require ADMIN role.
"""

from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.models.collaborator import Collaborator
from app.schemas.case import CaseStatus, CaseResponse, CaseVariableResponse
from app.services.admin_service import admin_service
from app.core.permissions import UserRole


router = APIRouter()


# ============================================================================
# Request/Response Schemas
# ============================================================================

class AdminCaseUpdate(BaseModel):
    """Schema for admin case update"""
    title: Optional[str] = None
    description: Optional[str] = None
    client_name: Optional[str] = None
    requester_email: Optional[str] = None
    macro_case: Optional[str] = None
    context: Optional[str] = None
    impact: Optional[str] = None
    necessity: Optional[str] = None
    impacted_journey: Optional[str] = None
    impacted_segment: Optional[str] = None
    impacted_customers: Optional[str] = None
    reason: Optional[str] = Field(None, description="Reason for admin edit")


class AssignOwnerRequest(BaseModel):
    """Schema for assigning owner"""
    new_owner_id: int
    reason: Optional[str] = None


class ForceStatusRequest(BaseModel):
    """Schema for forcing status change"""
    target_status: str
    reason: str = Field(..., min_length=10, description="Reason is required and must be at least 10 characters")


class ForceApproveRequest(BaseModel):
    """Schema for forcing approval"""
    on_behalf_of_id: Optional[int] = None
    reason: Optional[str] = None


class AdminVariableUpdate(BaseModel):
    """Schema for admin variable update"""
    variable_name: Optional[str] = None
    variable_type: Optional[str] = None
    product: Optional[str] = None
    concept: Optional[str] = None
    min_history: Optional[str] = None
    priority: Optional[str] = None
    desired_lag: Optional[str] = None
    reason: Optional[str] = None


class AssignTableRequest(BaseModel):
    """Schema for assigning table to variable"""
    table_id: int
    reason: Optional[str] = None


class AdminActionResponse(BaseModel):
    """Response schema for admin actions"""
    id: int
    admin_id: int
    admin_name: Optional[str] = None
    action_type: str
    entity_type: str
    entity_id: int
    on_behalf_of_id: Optional[int] = None
    on_behalf_of_name: Optional[str] = None
    reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Case Admin Endpoints
# ============================================================================

@router.patch("/cases/{case_id}")
async def admin_update_case(
    case_id: int,
    update_data: AdminCaseUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.require_admin)
):
    """
    Update any field of a case as admin.
    Bypasses ownership checks and normal edit restrictions.
    """
    data_dict = update_data.model_dump(exclude_unset=True, exclude={'reason'})
    
    if not data_dict:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    case = await admin_service.admin_update_case(
        db, case_id, data_dict, current_user, update_data.reason
    )
    
    return {
        "message": "Case updated successfully",
        "case_id": case.id,
        "updated_fields": list(data_dict.keys())
    }


@router.post("/cases/{case_id}/assign")
async def admin_assign_case_owner(
    case_id: int,
    request: AssignOwnerRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.require_admin)
):
    """
    Assign or reassign the owner of a case.
    """
    case = await admin_service.admin_assign_case_owner(
        db, case_id, request.new_owner_id, current_user, request.reason
    )
    
    return {
        "message": "Case owner assigned successfully",
        "case_id": case.id,
        "new_owner_id": case.created_by
    }


@router.post("/cases/{case_id}/force-status")
async def admin_force_case_status(
    case_id: int,
    request: ForceStatusRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.require_admin)
):
    """
    Force a status change on a case, bypassing normal workflow rules.
    Requires a detailed reason for audit purposes.
    """
    # Validate status
    try:
        target_status = CaseStatus(request.target_status)
    except ValueError:
        valid_statuses = [s.value for s in CaseStatus]
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid status. Must be one of: {valid_statuses}"
        )
    
    case = await admin_service.admin_force_status(
        db, case_id, target_status, current_user, request.reason
    )
    
    return {
        "message": "Case status forced successfully",
        "case_id": case.id,
        "new_status": case.status
    }


@router.post("/cases/{case_id}/force-approve")
async def admin_force_approve_case(
    case_id: int,
    request: ForceApproveRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.require_admin)
):
    """
    Force approval of a case, optionally on behalf of another user.
    """
    case = await admin_service.admin_force_approve_case(
        db, case_id, current_user, request.on_behalf_of_id, request.reason
    )
    
    return {
        "message": "Case approved successfully",
        "case_id": case.id,
        "new_status": case.status,
        "on_behalf_of": request.on_behalf_of_id
    }


# ============================================================================
# Variable Admin Endpoints
# ============================================================================

@router.patch("/variables/{variable_id}")
async def admin_update_variable(
    variable_id: int,
    update_data: AdminVariableUpdate,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.require_admin)
):
    """
    Update any field of a variable as admin.
    """
    data_dict = update_data.model_dump(exclude_unset=True, exclude={'reason'})
    
    if not data_dict:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    variable = await admin_service.admin_update_variable(
        db, variable_id, data_dict, current_user, update_data.reason
    )
    
    return {
        "message": "Variable updated successfully",
        "variable_id": variable.id,
        "updated_fields": list(data_dict.keys())
    }


@router.post("/variables/{variable_id}/assign-table")
async def admin_assign_table(
    variable_id: int,
    request: AssignTableRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.require_admin)
):
    """
    Assign a data table to a variable, creating a match if needed.
    """
    variable = await admin_service.admin_assign_table(
        db, variable_id, request.table_id, current_user, request.reason
    )
    
    return {
        "message": "Table assigned successfully",
        "variable_id": variable.id,
        "table_id": request.table_id,
        "new_status": variable.search_status
    }


@router.post("/variables/{variable_id}/assign-owner")
async def admin_assign_table_owner(
    variable_id: int,
    request: AssignOwnerRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.require_admin)
):
    """
    Assign or reassign the owner of the table associated with a variable.
    """
    variable = await admin_service.admin_assign_table_owner(
        db, variable_id, request.new_owner_id, current_user, request.reason
    )
    
    return {
        "message": "Table owner assigned successfully",
        "variable_id": variable.id,
        "new_owner_id": request.new_owner_id
    }


@router.post("/variables/{variable_id}/force-approve")
async def admin_force_approve_variable(
    variable_id: int,
    request: ForceApproveRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.require_admin)
):
    """
    Force approval of a variable, optionally on behalf of another user.
    """
    variable = await admin_service.admin_force_approve_variable(
        db, variable_id, current_user, request.on_behalf_of_id, request.reason
    )
    
    return {
        "message": "Variable approved successfully",
        "variable_id": variable.id,
        "new_status": variable.search_status,
        "on_behalf_of": request.on_behalf_of_id
    }


@router.post("/variables/{variable_id}/force-status")
async def admin_force_variable_status(
    variable_id: int,
    request: ForceStatusRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.require_admin)
):
    """
    Force a status change on a variable.
    """
    variable = await admin_service.admin_force_variable_status(
        db, variable_id, request.target_status, current_user, request.reason
    )
    
    return {
        "message": "Variable status forced successfully",
        "variable_id": variable.id,
        "new_status": variable.search_status
    }


# ============================================================================
# Admin Action History
# ============================================================================

@router.get("/actions", response_model=List[AdminActionResponse])
async def get_admin_actions(
    entity_type: Optional[str] = Query(None, description="Filter by entity type (CASE, VARIABLE, DELEGATION)"),
    entity_id: Optional[int] = Query(None, description="Filter by entity ID"),
    admin_id: Optional[int] = Query(None, description="Filter by admin who performed action"),
    action_type: Optional[str] = Query(None, description="Filter by action type"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.require_admin)
):
    """
    Get admin action history with filters.
    """
    actions = await admin_service.get_admin_actions(
        db, entity_type, entity_id, admin_id, action_type, skip, limit
    )
    
    return [
        AdminActionResponse(
            id=a.id,
            admin_id=a.admin_id,
            admin_name=a.admin.name if a.admin else None,
            action_type=a.action_type,
            entity_type=a.entity_type,
            entity_id=a.entity_id,
            on_behalf_of_id=a.on_behalf_of_id,
            on_behalf_of_name=a.on_behalf_of.name if a.on_behalf_of else None,
            reason=a.reason,
            created_at=a.created_at
        )
        for a in actions
    ]
