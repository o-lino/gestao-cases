"""
System (In-App) Notification Channel

Creates notifications in the database for display in the application UI.
"""

from typing import Optional
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.channels.base_channel import (
    BaseNotificationChannel,
    NotificationPayload,
    DeliveryResult,
    NotificationPriority
)
from app.services.config_service import ConfigService
from app.models.notification import (
    Notification,
    NotificationType as DBNotificationType,
    NotificationPriority as DBNotificationPriority
)


class SystemChannel(BaseNotificationChannel):
    """
    System (in-app) notification channel.
    
    Creates notifications in the database that are displayed
    in the application's notification center.
    
    Configuration keys:
    - notification_system_enabled: Enable/disable channel
    """
    
    channel_name = "system"
    
    def __init__(self, db: AsyncSession, user_id: Optional[int] = None):
        self.db = db
        self.user_id = user_id
        self._enabled: Optional[bool] = None
    
    async def is_enabled(self) -> bool:
        """Check if system notifications are enabled"""
        if self._enabled is None:
            self._enabled = await ConfigService.get_config_value(
                self.db, "notification_system_enabled", True
            )
        return bool(self._enabled)
    
    def _map_priority(self, priority: NotificationPriority) -> DBNotificationPriority:
        """Map channel priority to database model priority"""
        priority_map = {
            NotificationPriority.LOW: DBNotificationPriority.LOW,
            NotificationPriority.MEDIUM: DBNotificationPriority.MEDIUM,
            NotificationPriority.HIGH: DBNotificationPriority.HIGH,
            NotificationPriority.URGENT: DBNotificationPriority.URGENT,
        }
        return priority_map.get(priority, DBNotificationPriority.MEDIUM)
    
    async def send(self, payload: NotificationPayload, user_id: Optional[int] = None) -> DeliveryResult:
        """
        Create a notification in the database.
        
        Args:
            payload: Notification data
            user_id: Override the user_id set in constructor
        """
        if not await self.is_enabled():
            return self._create_error_result("System notifications are disabled")
        
        target_user_id = user_id or self.user_id
        if not target_user_id:
            return self._create_error_result("No user_id provided for system notification")
        
        try:
            from datetime import datetime, timedelta
            
            notification = Notification(
                user_id=target_user_id,
                type=DBNotificationType.SYSTEM_ALERT,
                priority=self._map_priority(payload.priority),
                title=payload.title,
                message=payload.message,
                case_id=payload.case_id,
                variable_id=payload.variable_id,
                action_url=payload.action_url,
                action_label=payload.action_label,
                expires_at=datetime.utcnow() + timedelta(days=7)
            )
            
            self.db.add(notification)
            await self.db.commit()
            await self.db.refresh(notification)
            
            logger.info(f"System notification created: {notification.id} for user {target_user_id}")
            
            return self._create_success_result(
                message=f"System notification created",
                details={"notification_id": notification.id, "user_id": target_user_id}
            )
            
        except Exception as e:
            await self.db.rollback()
            error_msg = f"Failed to create system notification: {str(e)}"
            logger.exception(error_msg)
            return self._create_error_result(error=error_msg)
    
    async def test_connection(self) -> DeliveryResult:
        """Test system channel - just verify database connection"""
        try:
            # Simple query to verify database is working
            from sqlalchemy import text
            await self.db.execute(text("SELECT 1"))
            
            enabled = await self.is_enabled()
            return self._create_success_result(
                message="System notification channel is operational",
                details={"enabled": enabled}
            )
            
        except Exception as e:
            return self._create_error_result(
                error=f"Database connection failed: {str(e)}"
            )
