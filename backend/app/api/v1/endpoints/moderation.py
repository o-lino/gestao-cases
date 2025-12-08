"""
Moderation API Endpoints

Handles moderator-user association workflow:
- Moderator creates request
- User approves/rejects
- Association management
"""

from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_current_user, require_moderator_or_above, get_db
from app.models.collaborator import Collaborator
from app.models.moderation import (
    ModerationRequest,
    ModerationAssociation,
    ModerationRequestStatus,
    ModerationDuration,
    ModerationAssociationStatus,
)
from app.services.moderation_service import ModerationService, ModerationError


router = APIRouter()


# ============== Pydantic Schemas ==============

class ModerationRequestCreate(BaseModel):
    """Schema for creating a moderation request"""
    user_id: int = Field(..., description="ID of the user to moderate")
    duration: ModerationDuration = Field(
        default=ModerationDuration.THREE_MONTHS,
        description="Duration of the association"
    )
    message: Optional[str] = Field(None, description="Optional message to the user")
    is_renewal: bool = Field(default=False, description="Whether this is a renewal request")
    previous_association_id: Optional[int] = Field(None, description="Previous association ID if renewal")


class ModerationRequestResponse(BaseModel):
    """Schema for moderation request response"""
    id: int
    moderator_id: int
    moderator_name: Optional[str] = None
    moderator_email: Optional[str] = None
    user_id: int
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    duration: str
    duration_label: str
    status: str
    message: Optional[str]
    rejection_reason: Optional[str]
    is_renewal: bool
    requested_at: datetime
    responded_at: Optional[datetime]
    expires_at: datetime
    is_pending: bool
    
    class Config:
        from_attributes = True


class ModerationAssociationResponse(BaseModel):
    """Schema for moderation association response"""
    id: int
    moderator_id: int
    moderator_name: Optional[str] = None
    moderator_email: Optional[str] = None
    user_id: int
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    status: str
    started_at: datetime
    expires_at: datetime
    days_remaining: int
    is_active: bool
    
    class Config:
        from_attributes = True


class RejectRequestBody(BaseModel):
    """Schema for rejecting a request"""
    reason: Optional[str] = Field(None, description="Reason for rejection")


class UserSummary(BaseModel):
    """Summary of a user"""
    id: int
    name: str
    email: str
    role: str


# ============== Helper Functions ==============

async def request_to_response(request: ModerationRequest, db: AsyncSession) -> ModerationRequestResponse:
    """Convert a ModerationRequest to ModerationRequestResponse"""
    mod_result = await db.execute(select(Collaborator).where(Collaborator.id == request.moderator_id))
    moderator = mod_result.scalars().first()
    
    user_result = await db.execute(select(Collaborator).where(Collaborator.id == request.user_id))
    user = user_result.scalars().first()
    
    return ModerationRequestResponse(
        id=request.id,
        moderator_id=request.moderator_id,
        moderator_name=moderator.name if moderator else None,
        moderator_email=moderator.email if moderator else None,
        user_id=request.user_id,
        user_name=user.name if user else None,
        user_email=user.email if user else None,
        duration=request.duration.value,
        duration_label=request.duration.label,
        status=request.status.value,
        message=request.message,
        rejection_reason=request.rejection_reason,
        is_renewal=request.is_renewal,
        requested_at=request.requested_at,
        responded_at=request.responded_at,
        expires_at=request.expires_at,
        is_pending=request.is_pending
    )


async def association_to_response(association: ModerationAssociation, db: AsyncSession) -> ModerationAssociationResponse:
    """Convert a ModerationAssociation to ModerationAssociationResponse"""
    mod_result = await db.execute(select(Collaborator).where(Collaborator.id == association.moderator_id))
    moderator = mod_result.scalars().first()
    
    user_result = await db.execute(select(Collaborator).where(Collaborator.id == association.user_id))
    user = user_result.scalars().first()
    
    return ModerationAssociationResponse(
        id=association.id,
        moderator_id=association.moderator_id,
        moderator_name=moderator.name if moderator else None,
        moderator_email=moderator.email if moderator else None,
        user_id=association.user_id,
        user_name=user.name if user else None,
        user_email=user.email if user else None,
        status=association.status.value,
        started_at=association.started_at,
        expires_at=association.expires_at,
        days_remaining=association.days_remaining,
        is_active=association.is_active
    )


# ============== Request Endpoints ==============

@router.post("/requests", response_model=ModerationRequestResponse)
async def create_moderation_request(
    data: ModerationRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(require_moderator_or_above)
):
    """
    Create a moderation request (moderator only).
    The user must approve for association to be created.
    """
    try:
        request = await ModerationService.create_request(
            db=db,
            moderator_id=current_user.id,
            user_id=data.user_id,
            duration=data.duration,
            message=data.message,
            is_renewal=data.is_renewal,
            previous_association_id=data.previous_association_id
        )
        return await request_to_response(request, db)
    except ModerationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/requests", response_model=List[ModerationRequestResponse])
async def list_moderation_requests(
    type: str = "all",  # "sent", "received", or "all"
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(get_current_user)
):
    """
    List moderation requests.
    - type=sent: Requests sent by current user (as moderator)
    - type=received: Requests received by current user (as user)
    - type=all: Both
    """
    requests = []
    
    if type in ["sent", "all"]:
        sent = await ModerationService.get_sent_requests(db, current_user.id)
        requests.extend(sent)
    
    if type in ["received", "all"]:
        received = await ModerationService.get_pending_requests_for_user(db, current_user.id)
        # Also get historical received requests
        result = await db.execute(
            select(ModerationRequest).where(ModerationRequest.user_id == current_user.id)
        )
        all_received = result.scalars().all()
        for req in all_received:
            if req not in requests:
                requests.append(req)
    
    # Sort by date
    requests.sort(key=lambda r: r.requested_at, reverse=True)
    
    responses = []
    for r in requests:
        responses.append(await request_to_response(r, db))
    return responses


@router.get("/requests/{request_id}", response_model=ModerationRequestResponse)
async def get_moderation_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(get_current_user)
):
    """Get details of a specific moderation request"""
    result = await db.execute(
        select(ModerationRequest).where(ModerationRequest.id == request_id)
    )
    request = result.scalars().first()
    
    if not request:
        raise HTTPException(status_code=404, detail="Solicitação não encontrada")
    
    # Only involved parties can view
    if request.moderator_id != current_user.id and request.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Sem permissão para visualizar esta solicitação")
    
    return await request_to_response(request, db)


@router.post("/requests/{request_id}/approve", response_model=ModerationAssociationResponse)
async def approve_moderation_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(get_current_user)
):
    """User approves a moderation request"""
    try:
        association = await ModerationService.approve_request(
            db=db,
            request_id=request_id,
            user_id=current_user.id
        )
        return await association_to_response(association, db)
    except ModerationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/requests/{request_id}/reject")
async def reject_moderation_request(
    request_id: int,
    body: RejectRequestBody = None,
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(get_current_user)
):
    """User rejects a moderation request"""
    try:
        reason = body.reason if body else None
        await ModerationService.reject_request(
            db=db,
            request_id=request_id,
            user_id=current_user.id,
            reason=reason
        )
        return {"message": "Solicitação rejeitada com sucesso"}
    except ModerationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/requests/{request_id}/cancel")
async def cancel_moderation_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(get_current_user)
):
    """Moderator cancels their own request"""
    try:
        await ModerationService.cancel_request(
            db=db,
            request_id=request_id,
            moderator_id=current_user.id
        )
        return {"message": "Solicitação cancelada com sucesso"}
    except ModerationError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============== Association Endpoints ==============

@router.get("/associations", response_model=List[ModerationAssociationResponse])
async def list_associations(
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(get_current_user)
):
    """
    List associations for current user.
    Returns both where user is moderator and where user is being moderated.
    """
    # Associations where current user is moderator
    result = await db.execute(
        select(ModerationAssociation).where(ModerationAssociation.moderator_id == current_user.id)
    )
    as_moderator = result.scalars().all()
    
    # Associations where current user is being moderated
    result = await db.execute(
        select(ModerationAssociation).where(ModerationAssociation.user_id == current_user.id)
    )
    as_user = result.scalars().all()
    
    all_associations = list(as_moderator) + [a for a in as_user if a not in as_moderator]
    all_associations.sort(key=lambda a: a.started_at, reverse=True)
    
    responses = []
    for a in all_associations:
        responses.append(await association_to_response(a, db))
    return responses


@router.post("/associations/{association_id}/revoke")
async def revoke_association(
    association_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(get_current_user)
):
    """Revoke an active association"""
    try:
        await ModerationService.revoke_association(
            db=db,
            association_id=association_id,
            user_id=current_user.id
        )
        return {"message": "Associação revogada com sucesso"}
    except ModerationError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============== Convenience Endpoints ==============

@router.get("/my-moderator", response_model=Optional[UserSummary])
async def get_my_moderator(
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(get_current_user)
):
    """Get the current user's active moderator (if any)"""
    moderator = await ModerationService.get_user_moderator(db, current_user.id)
    
    if moderator:
        return UserSummary(
            id=moderator.id,
            name=moderator.name,
            email=moderator.email,
            role=moderator.role
        )
    return None


@router.get("/my-users", response_model=List[dict])
async def get_my_moderated_users(
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(require_moderator_or_above)
):
    """Get users currently being moderated by the current user (moderator only)"""
    users_with_associations = await ModerationService.get_moderated_users(db, current_user.id)
    
    result = []
    for user, assoc in users_with_associations:
        result.append({
            "user": UserSummary(
                id=user.id,
                name=user.name,
                email=user.email,
                role=user.role
            ),
            "association": await association_to_response(assoc, db)
        })
    return result


@router.get("/available-users", response_model=List[UserSummary])
async def get_available_users_for_moderation(
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(require_moderator_or_above)
):
    """
    Get users available for moderation (not already associated with current moderator).
    Only returns users with role=USER.
    """
    # Get IDs of users already associated or with pending requests
    result = await db.execute(
        select(ModerationAssociation.user_id).where(
            ModerationAssociation.moderator_id == current_user.id,
            ModerationAssociation.status == ModerationAssociationStatus.ACTIVE
        )
    )
    associated_ids = [row[0] for row in result.all()]
    
    result = await db.execute(
        select(ModerationRequest.user_id).where(
            ModerationRequest.moderator_id == current_user.id,
            ModerationRequest.status == ModerationRequestStatus.PENDING
        )
    )
    pending_ids = [row[0] for row in result.all()]
    
    excluded_ids = set(associated_ids + pending_ids + [current_user.id])
    
    # Get available users
    result = await db.execute(
        select(Collaborator).where(
            Collaborator.active == True,
            Collaborator.role == "USER",
            Collaborator.id.notin_(excluded_ids) if excluded_ids else True
        )
    )
    users = result.scalars().all()
    
    return [
        UserSummary(id=u.id, name=u.name, email=u.email, role=u.role)
        for u in users
    ]


# ============== Duration Options Endpoint ==============

@router.get("/duration-options")
def get_duration_options():
    """Get available duration options"""
    return [
        {"value": d.value, "label": d.label, "days": d.days}
        for d in ModerationDuration
    ]
