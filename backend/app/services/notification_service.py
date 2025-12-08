"""
Notification Service

Business logic for creating and managing notifications.
"""

from datetime import datetime, timedelta
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from loguru import logger

from app.models.notification import Notification, NotificationType, NotificationPriority


class NotificationService:
    """Service for managing notifications"""
    
    # Confidence thresholds for automatic actions
    THRESHOLD_AUTO_SUGGEST = 0.7  # Auto-suggest matches above this score
    THRESHOLD_HIGH_CONFIDENCE = 0.85  # Highlight as high confidence
    THRESHOLD_LOW_CONFIDENCE = 0.4  # Warn about low confidence
    
    @staticmethod
    async def create_notification(
        db: AsyncSession,
        user_id: int,
        type: NotificationType,
        title: str,
        message: str = None,
        priority: NotificationPriority = NotificationPriority.MEDIUM,
        case_id: int = None,
        variable_id: int = None,
        match_id: int = None,
        table_id: int = None,
        action_url: str = None,
        action_label: str = None,
        expires_days: int = 7
    ) -> Notification:
        """Create a new notification"""
        notification = Notification(
            user_id=user_id,
            type=type,
            priority=priority,
            title=title,
            message=message,
            case_id=case_id,
            variable_id=variable_id,
            match_id=match_id,
            table_id=table_id,
            action_url=action_url,
            action_label=action_label,
            expires_at=datetime.utcnow() + timedelta(days=expires_days)
        )
        
        db.add(notification)
        await db.commit()
        await db.refresh(notification)
        
        logger.info(f"Created notification {notification.id} for user {user_id}")
        return notification
    
    @staticmethod
    async def get_user_notifications(
        db: AsyncSession,
        user_id: int,
        unread_only: bool = False,
        limit: int = 50,
        include_archived: bool = False
    ) -> List[Notification]:
        """Get notifications for a user"""
        conditions = [Notification.user_id == user_id]
        
        if unread_only:
            conditions.append(Notification.is_read == False)
        
        if not include_archived:
            conditions.append(Notification.is_archived == False)
        
        result = await db.execute(
            select(Notification)
            .where(*conditions)
            .order_by(Notification.created_at.desc())
            .limit(limit)
        )
        return result.scalars().all()
    
    @staticmethod
    async def get_unread_count(db: AsyncSession, user_id: int) -> int:
        """Get count of unread notifications"""
        from sqlalchemy import func
        result = await db.execute(
            select(func.count(Notification.id)).where(
                Notification.user_id == user_id,
                Notification.is_read == False,
                Notification.is_archived == False
            )
        )
        return result.scalar() or 0
    
    @staticmethod
    async def mark_as_read(db: AsyncSession, notification_id: int, user_id: int) -> bool:
        """Mark a notification as read"""
        result = await db.execute(
            select(Notification).where(
                Notification.id == notification_id,
                Notification.user_id == user_id
            )
        )
        notification = result.scalars().first()
        
        if notification:
            notification.mark_as_read()
            await db.commit()
            return True
        return False
    
    @staticmethod
    async def mark_all_as_read(db: AsyncSession, user_id: int) -> int:
        """Mark all notifications as read"""
        result = await db.execute(
            update(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.is_read == False
            )
            .values(
                is_read=True,
                read_at=datetime.utcnow()
            )
        )
        await db.commit()
        return result.rowcount
    
    @classmethod
    async def notify_match_suggestion(
        cls,
        db: AsyncSession,
        user_id: int,
        case_id: int,
        variable_id: int,
        variable_name: str,
        match_count: int,
        top_score: float
    ) -> Notification:
        """Create notification for match suggestions"""
        if top_score >= cls.THRESHOLD_HIGH_CONFIDENCE:
            priority = NotificationPriority.HIGH
            title = f"✓ Match de alta confiança"
        elif top_score >= cls.THRESHOLD_AUTO_SUGGEST:
            priority = NotificationPriority.MEDIUM
            title = f"{match_count} match(es) encontrado(s)"
        else:
            priority = NotificationPriority.LOW
            title = f"Matches de baixa confiança"
        
        return await cls.create_notification(
            db=db,
            user_id=user_id,
            type=NotificationType.MATCH_SUGGESTED,
            title=title,
            message=f"'{variable_name}': {match_count} tabela(s) ({int(top_score*100)}% max)",
            priority=priority,
            case_id=case_id,
            variable_id=variable_id,
            action_url=f"/cases/{case_id}?tab=variables",
            action_label="Ver sugestões"
        )
    
    @classmethod
    async def notify_owner_review_request(
        cls,
        db: AsyncSession,
        owner_id: int,
        match_id: int,
        requester_name: str,
        variable_name: str,
        table_name: str,
        case_id: int
    ) -> Notification:
        """Notify owner that their review is needed"""
        return await cls.create_notification(
            db=db,
            user_id=owner_id,
            type=NotificationType.OWNER_REVIEW_REQUEST,
            title="Validação necessária",
            message=f"{requester_name} solicita '{table_name}' para '{variable_name}'",
            priority=NotificationPriority.HIGH,
            case_id=case_id,
            match_id=match_id,
            action_url=f"/pending-reviews",
            action_label="Revisar",
            expires_days=3
        )
    
    # Legacy compatibility methods
    async def send_email(self, to_email: str, subject: str, body: str):
        """Mock email sending for legacy compatibility"""
        logger.info(f"mock_send_email: To={to_email}, Subject={subject}")
        return True

    async def notify_status_change(self, case_id: int, old_status: str, new_status: str, recipient_email: str):
        subject = f"Case {case_id}: {new_status}"
        body = f"Status changed from {old_status} to {new_status}."
        await self.send_email(recipient_email, subject, body)


notification_service = NotificationService()
