"""
Multi-Channel Notification Delivery Service

Orchestrates notification delivery across all enabled channels:
- Email
- Microsoft Teams (Power Automate)
- System (In-App)
"""

from typing import List, Optional, Dict, Any
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.channels.base_channel import (
    NotificationPayload,
    NotificationPriority,
    DeliveryResult
)
from app.services.channels.email_channel import EmailChannel
from app.services.channels.teams_channel import TeamsChannel
from app.services.channels.system_channel import SystemChannel
from app.services.config_service import ConfigService


class NotificationDeliveryService:
    """
    Multi-channel notification delivery service.
    
    Delivers notifications to all enabled channels based on system configuration.
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.email_channel = EmailChannel(db)
        self.teams_channel = TeamsChannel(db)
        self.system_channel = SystemChannel(db)
    
    async def deliver(
        self,
        title: str,
        message: str,
        user_id: Optional[int] = None,
        recipient_email: Optional[str] = None,
        recipient_name: Optional[str] = None,
        priority: NotificationPriority = NotificationPriority.MEDIUM,
        action_url: Optional[str] = None,
        action_label: Optional[str] = None,
        case_id: Optional[int] = None,
        variable_id: Optional[int] = None,
        extra_data: Optional[Dict[str, Any]] = None,
        channels: Optional[List[str]] = None
    ) -> Dict[str, DeliveryResult]:
        """
        Deliver notification to all enabled channels.
        
        Args:
            title: Notification title
            message: Notification body
            user_id: Target user ID (for system notifications)
            recipient_email: Target email address (for email notifications)
            recipient_name: Target user name
            priority: Notification priority level
            action_url: Optional URL for action button
            action_label: Optional label for action button
            case_id: Related case ID
            variable_id: Related variable ID
            extra_data: Additional data for channels
            channels: Optional list of specific channels to use (None = all enabled)
        
        Returns:
            Dict mapping channel names to their delivery results
        """
        payload = NotificationPayload(
            title=title,
            message=message,
            priority=priority,
            recipient_email=recipient_email,
            recipient_name=recipient_name,
            action_url=action_url,
            action_label=action_label,
            case_id=case_id,
            variable_id=variable_id,
            extra_data=extra_data
        )
        
        results: Dict[str, DeliveryResult] = {}
        
        # System channel
        if channels is None or "system" in channels:
            if await self.system_channel.is_enabled() and user_id:
                self.system_channel.user_id = user_id
                results["system"] = await self.system_channel.send(payload)
        
        # Email channel
        if channels is None or "email" in channels:
            if await self.email_channel.is_enabled() and recipient_email:
                results["email"] = await self.email_channel.send(payload)
        
        # Teams channel
        if channels is None or "teams" in channels:
            if await self.teams_channel.is_enabled():
                results["teams"] = await self.teams_channel.send(payload)
        
        # Log summary
        success_count = sum(1 for r in results.values() if r.success)
        total_count = len(results)
        logger.info(f"Notification delivered: {success_count}/{total_count} channels successful for '{title}'")
        
        return results
    
    async def test_channel(self, channel_name: str) -> DeliveryResult:
        """
        Test a specific channel's connectivity.
        
        Args:
            channel_name: 'email', 'teams', or 'system'
        
        Returns:
            DeliveryResult with test status
        """
        channel_map = {
            "email": self.email_channel,
            "teams": self.teams_channel,
            "system": self.system_channel
        }
        
        channel = channel_map.get(channel_name)
        if not channel:
            return DeliveryResult(
                success=False,
                channel=channel_name,
                error=f"Unknown channel: {channel_name}"
            )
        
        return await channel.test_connection()
    
    async def get_channels_status(self) -> Dict[str, bool]:
        """Get enabled status of all channels"""
        return {
            "email": await self.email_channel.is_enabled(),
            "teams": await self.teams_channel.is_enabled(),
            "system": await self.system_channel.is_enabled()
        }


# Convenience function for quick access
async def deliver_notification(
    db: AsyncSession,
    title: str,
    message: str,
    user_id: Optional[int] = None,
    recipient_email: Optional[str] = None,
    **kwargs
) -> Dict[str, DeliveryResult]:
    """
    Convenience function to deliver a notification through all channels.
    """
    service = NotificationDeliveryService(db)
    return await service.deliver(
        title=title,
        message=message,
        user_id=user_id,
        recipient_email=recipient_email,
        **kwargs
    )
