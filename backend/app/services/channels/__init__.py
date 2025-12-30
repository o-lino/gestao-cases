"""
Notification Channels Module

Provides delivery mechanisms for notifications:
- Email (SMTP)
- Microsoft Teams (Power Automate webhook)
- System (In-app database notifications)
"""

from app.services.channels.base_channel import BaseNotificationChannel
from app.services.channels.email_channel import EmailChannel
from app.services.channels.teams_channel import TeamsChannel
from app.services.channels.system_channel import SystemChannel

__all__ = [
    "BaseNotificationChannel",
    "EmailChannel",
    "TeamsChannel",
    "SystemChannel",
]
