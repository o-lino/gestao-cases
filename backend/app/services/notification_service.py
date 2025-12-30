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
        notification_type: NotificationType = None,  # Renamed for clarity
        type: NotificationType = None,  # Keep for backwards compatibility
        title: str = "",
        message: str = None,
        priority: NotificationPriority = NotificationPriority.MEDIUM,
        case_id: int = None,
        variable_id: int = None,
        match_id: int = None,
        table_id: int = None,
        action_url: str = None,
        action_label: str = None,
        expires_days: int = 7,
        data: dict = None,  # Additional metadata
        recipient_email: str = None,  # For external channels
        recipient_name: str = None  # For external channels
    ) -> Notification:
        """Create a new notification and deliver to enabled channels"""
        # Handle both 'type' and 'notification_type' parameters
        actual_type = notification_type or type
        if not actual_type:
            raise ValueError("notification_type is required")
        
        # Create the in-system notification
        notification = Notification(
            user_id=user_id,
            type=actual_type,
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
        
        # Store additional data in action_url if provided (as query params)
        if data and not action_url:
            # For now, we'll log the data. In production, consider adding a JSON column
            logger.debug(f"Notification extra data: {data}")
        
        db.add(notification)
        await db.commit()
        await db.refresh(notification)
        
        logger.info(f"Created notification {notification.id} for user {user_id}")
        
        # Trigger multi-channel delivery asynchronously
        try:
            await NotificationService._deliver_to_channels(
                db=db,
                notification_type=actual_type,
                user_id=user_id,
                title=title,
                message=message or "",
                priority=priority,
                action_url=action_url,
                action_label=action_label,
                case_id=case_id,
                variable_id=variable_id,
                recipient_email=recipient_email,
                recipient_name=recipient_name
            )
        except Exception as e:
            # Don't fail the main notification if channel delivery fails
            logger.warning(f"Multi-channel delivery failed: {e}")
        
        return notification
    
    @staticmethod
    async def _deliver_to_channels(
        db: AsyncSession,
        notification_type: NotificationType,
        user_id: int,
        title: str,
        message: str,
        priority: NotificationPriority,
        action_url: str = None,
        action_label: str = None,
        case_id: int = None,
        variable_id: int = None,
        recipient_email: str = None,
        recipient_name: str = None
    ):
        """Deliver notification to external channels based on event configuration"""
        from app.services.config_service import ConfigService
        from app.services.notification_delivery_service import NotificationDeliveryService
        from app.services.channels.base_channel import NotificationPriority as ChannelPriority
        import json
        
        # Map NotificationType to config key
        event_config_key = NotificationService._get_event_config_key(notification_type)
        if not event_config_key:
            logger.debug(f"No config key mapped for notification type: {notification_type}")
            return
        
        # Get channel settings for this event
        channel_settings = await ConfigService.get_config_value(db, event_config_key, None)
        
        if channel_settings is None:
            # Use default: all channels enabled
            channel_settings = {"email": True, "teams": True, "system": True}
        elif isinstance(channel_settings, str):
            try:
                channel_settings = json.loads(channel_settings)
            except json.JSONDecodeError:
                # Backward compatibility: treat "true"/"false" as system-only
                channel_settings = {"email": False, "teams": False, "system": channel_settings.lower() == "true"}
        
        # Determine which channels to use
        channels_to_use = []
        if channel_settings.get("email"):
            channels_to_use.append("email")
        if channel_settings.get("teams"):
            channels_to_use.append("teams")
        # Note: system channel is already handled by creating the Notification record
        
        if not channels_to_use:
            logger.debug(f"No external channels enabled for {notification_type}")
            return
        
        # Map priority
        priority_map = {
            NotificationPriority.LOW: ChannelPriority.LOW,
            NotificationPriority.MEDIUM: ChannelPriority.MEDIUM,
            NotificationPriority.HIGH: ChannelPriority.HIGH,
            NotificationPriority.URGENT: ChannelPriority.URGENT,
        }
        
        # Deliver to external channels
        delivery_service = NotificationDeliveryService(db)
        await delivery_service.deliver(
            title=title,
            message=message,
            user_id=user_id,
            recipient_email=recipient_email,
            recipient_name=recipient_name,
            priority=priority_map.get(priority, ChannelPriority.MEDIUM),
            action_url=action_url,
            action_label=action_label,
            case_id=case_id,
            variable_id=variable_id,
            channels=channels_to_use
        )
        
        logger.info(f"Delivered notification to channels: {channels_to_use}")
    
    @staticmethod
    def _get_event_config_key(notification_type: NotificationType) -> str:
        """Map NotificationType to its configuration key"""
        type_to_key = {
            NotificationType.MATCH_SUGGESTED: "notification_on_match_suggested",
            NotificationType.OWNER_REVIEW_REQUEST: "notification_on_owner_review_request",
            NotificationType.OWNER_APPROVED: "notification_on_owner_approved",
            NotificationType.OWNER_REJECTED: "notification_on_owner_rejected",
            NotificationType.REQUESTER_REVIEW_REQUEST: "notification_on_requester_review_request",
            NotificationType.MATCH_CONFIRMED: "notification_on_match_confirmed",
            NotificationType.MATCH_DISCARDED: "notification_on_match_discarded",
            NotificationType.SYNC_COMPLETED: "notification_on_sync_completed",
            NotificationType.SYSTEM_ALERT: "notification_on_system_alert",
            NotificationType.OWNER_VALIDATION_REQUEST: "notification_on_owner_validation_request",
            NotificationType.VARIABLE_APPROVED: "notification_on_variable_approved",
            NotificationType.VARIABLE_ADDED: "notification_on_variable_added",
            NotificationType.VARIABLE_CANCELLED: "notification_on_variable_cancelled",
            NotificationType.MODERATION_REQUEST: "notification_on_moderation_request",
            NotificationType.MODERATION_APPROVED: "notification_on_moderation_approved",
            NotificationType.MODERATION_REJECTED: "notification_on_moderation_rejected",
            NotificationType.MODERATION_CANCELLED: "notification_on_moderation_cancelled",
            NotificationType.MODERATION_STARTED: "notification_on_moderation_started",
            NotificationType.MODERATION_EXPIRING: "notification_on_moderation_expiring",
            NotificationType.MODERATION_EXPIRED: "notification_on_moderation_expired",
            NotificationType.MODERATION_REVOKED: "notification_on_moderation_revoked",
            NotificationType.AGENT_DECISION_CONSENSUS: "notification_on_agent_decision_consensus",
            NotificationType.AGENT_DECISION_APPROVED: "notification_on_agent_decision_approved",
            NotificationType.AGENT_DECISION_REJECTED: "notification_on_agent_decision_rejected",
            NotificationType.MATCH_REQUEST: "notification_on_match_request",
            NotificationType.INVOLVEMENT_CREATED: "notification_on_involvement_created",
            NotificationType.INVOLVEMENT_DATE_SET: "notification_on_involvement_date_set",
            NotificationType.INVOLVEMENT_DUE_REMINDER: "notification_on_involvement_due_reminder",
            NotificationType.INVOLVEMENT_OVERDUE: "notification_on_involvement_overdue",
            NotificationType.INVOLVEMENT_COMPLETED: "notification_on_involvement_completed",
        }
        return type_to_key.get(notification_type, "")
    
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
    
    @classmethod
    async def notify_variable_added(
        cls,
        db: AsyncSession,
        approver_id: int,
        case_id: int,
        case_title: str,
        variable_id: int,
        variable_name: str,
        added_by_name: str
    ) -> Notification:
        """Notify project approver when a variable is added to a case"""
        return await cls.create_notification(
            db=db,
            user_id=approver_id,
            type=NotificationType.VARIABLE_ADDED,
            title="Variável adicionada",
            message=f"{added_by_name} adicionou '{variable_name}' ao case '{case_title}'",
            priority=NotificationPriority.MEDIUM,
            case_id=case_id,
            variable_id=variable_id,
            action_url=f"/cases/{case_id}?tab=variables",
            action_label="Ver variáveis"
        )
    
    @classmethod
    async def notify_variable_cancelled(
        cls,
        db: AsyncSession,
        recipient_id: int,
        case_id: int,
        case_title: str,
        variable_id: int,
        variable_name: str,
        cancelled_by_name: str,
        reason: Optional[str] = None
    ) -> Notification:
        """Notify involved parties when a variable is cancelled"""
        message = f"{cancelled_by_name} cancelou a variável '{variable_name}' no case '{case_title}'"
        if reason:
            message += f". Motivo: {reason}"
        
        return await cls.create_notification(
            db=db,
            user_id=recipient_id,
            type=NotificationType.VARIABLE_CANCELLED,
            title="Variável cancelada",
            message=message,
            priority=NotificationPriority.HIGH,
            case_id=case_id,
            variable_id=variable_id,
            action_url=f"/cases/{case_id}?tab=variables",
            action_label="Ver case"
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

