"""
Notification API Endpoints

REST API for managing user notifications.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from pydantic import BaseModel
from datetime import datetime

from app.api.deps import get_db, get_current_active_user
from app.models.collaborator import Collaborator
from app.models.notification import Notification, NotificationType, NotificationPriority

router = APIRouter()


# ============ Schemas ============

class NotificationResponse(BaseModel):
    id: int
    type: str
    priority: str
    title: str
    message: str | None
    case_id: int | None
    variable_id: int | None
    match_id: int | None
    action_url: str | None
    action_label: str | None
    is_read: bool
    read_at: datetime | None
    created_at: datetime
    
    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    notifications: List[NotificationResponse]
    unread_count: int
    total: int


class MarkReadRequest(BaseModel):
    notification_ids: List[int] | None = None  # None = mark all


# ============ Endpoints ============

@router.get("", response_model=NotificationListResponse)
async def get_my_notifications(
    unread_only: bool = False,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(get_current_active_user),
):
    """Get notifications for current user"""
    try:
        query = select(Notification).where(
            Notification.user_id == current_user.id,
            Notification.is_archived == False
        )
        
        if unread_only:
            query = query.where(Notification.is_read == False)
        
        query = query.order_by(Notification.created_at.desc()).limit(limit)
        
        result = await db.execute(query)
        notifications = result.scalars().all()
        
        # Get unread count
        count_query = select(func.count(Notification.id)).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
            Notification.is_archived == False
        )
        count_result = await db.execute(count_query)
        unread_count = count_result.scalar() or 0
        
        return NotificationListResponse(
            notifications=notifications,
            unread_count=unread_count,
            total=len(notifications)
        )
    except Exception:
        # Table might not exist yet
        return NotificationListResponse(
            notifications=[],
            unread_count=0,
            total=0
        )


@router.get("/count")
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(get_current_active_user),
):
    """Get count of unread notifications"""
    try:
        count_query = select(func.count(Notification.id)).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
            Notification.is_archived == False
        )
        result = await db.execute(count_query)
        count = result.scalar() or 0
        return {"unread_count": count}
    except Exception:
        # Table might not exist yet
        return {"unread_count": 0}


@router.post("/{notification_id}/read")
async def mark_notification_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(get_current_active_user),
):
    """Mark a notification as read"""
    query = select(Notification).where(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    )
    result = await db.execute(query)
    notification = result.scalars().first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    notification.is_read = True
    notification.read_at = datetime.utcnow()
    await db.commit()
    
    return {"success": True}


@router.post("/read-all")
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(get_current_active_user),
):
    """Mark all notifications as read"""
    stmt = update(Notification).where(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).values(is_read=True, read_at=datetime.utcnow())
    
    result = await db.execute(stmt)
    await db.commit()
    
    return {"marked_read": result.rowcount}


@router.delete("/{notification_id}")
async def archive_notification(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(get_current_active_user),
):
    """Archive (soft delete) a notification"""
    query = select(Notification).where(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    )
    result = await db.execute(query)
    notification = result.scalars().first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    notification.is_archived = True
    await db.commit()
    
    return {"success": True}
