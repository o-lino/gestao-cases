"""
Base Notification Channel

Abstract base class for all notification delivery channels.
"""

from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
from dataclasses import dataclass
from enum import Enum


class NotificationPriority(str, Enum):
    """Priority levels for notifications"""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"


@dataclass
class NotificationPayload:
    """Standard notification payload for all channels"""
    title: str
    message: str
    priority: NotificationPriority = NotificationPriority.MEDIUM
    recipient_email: Optional[str] = None
    recipient_name: Optional[str] = None
    action_url: Optional[str] = None
    action_label: Optional[str] = None
    case_id: Optional[int] = None
    variable_id: Optional[int] = None
    extra_data: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            "title": self.title,
            "message": self.message,
            "priority": self.priority.value if isinstance(self.priority, NotificationPriority) else self.priority,
            "recipient_email": self.recipient_email,
            "recipient_name": self.recipient_name,
            "action_url": self.action_url,
            "action_label": self.action_label,
            "case_id": self.case_id,
            "variable_id": self.variable_id,
            "extra_data": self.extra_data or {}
        }


@dataclass
class DeliveryResult:
    """Result of a notification delivery attempt"""
    success: bool
    channel: str
    message: Optional[str] = None
    error: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class BaseNotificationChannel(ABC):
    """
    Abstract base class for notification channels.
    
    All channels must implement:
    - send(): Deliver a notification
    - is_enabled(): Check if channel is enabled
    - test_connection(): Verify channel connectivity
    """
    
    channel_name: str = "base"
    
    @abstractmethod
    async def send(self, payload: NotificationPayload) -> DeliveryResult:
        """
        Send a notification through this channel.
        
        Args:
            payload: The notification data to send
            
        Returns:
            DeliveryResult with success/failure status
        """
        pass
    
    @abstractmethod
    async def is_enabled(self) -> bool:
        """
        Check if this channel is enabled in system configuration.
        
        Returns:
            True if channel is enabled, False otherwise
        """
        pass
    
    @abstractmethod
    async def test_connection(self) -> DeliveryResult:
        """
        Test the channel's connectivity/configuration.
        
        Returns:
            DeliveryResult indicating if channel is working
        """
        pass
    
    def _create_success_result(self, message: str = "Sent successfully", details: Dict = None) -> DeliveryResult:
        """Helper to create a success result"""
        return DeliveryResult(
            success=True,
            channel=self.channel_name,
            message=message,
            details=details
        )
    
    def _create_error_result(self, error: str, details: Dict = None) -> DeliveryResult:
        """Helper to create an error result"""
        return DeliveryResult(
            success=False,
            channel=self.channel_name,
            error=error,
            details=details
        )
