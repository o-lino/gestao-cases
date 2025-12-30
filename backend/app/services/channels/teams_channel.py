"""
Microsoft Teams Notification Channel

Sends notifications via Power Automate webhook endpoint.
The webhook URL should point to a Power Automate flow that receives
a POST request and sends a message to a Teams channel.
"""

import httpx
from typing import Optional
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.channels.base_channel import (
    BaseNotificationChannel,
    NotificationPayload,
    DeliveryResult
)
from app.services.config_service import ConfigService


class TeamsChannel(BaseNotificationChannel):
    """
    Microsoft Teams notification channel via Power Automate webhook.
    
    Configuration keys:
    - notification_teams_enabled: Enable/disable channel
    - notification_teams_webhook_url: Power Automate webhook URL
    """
    
    channel_name = "teams"
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self._webhook_url: Optional[str] = None
        self._enabled: Optional[bool] = None
    
    async def _get_config(self) -> None:
        """Load configuration from database"""
        if self._enabled is None:
            self._enabled = await ConfigService.get_config_value(
                self.db, "notification_teams_enabled", False
            )
        if self._webhook_url is None:
            self._webhook_url = await ConfigService.get_config_value(
                self.db, "notification_teams_webhook_url", ""
            )
    
    async def is_enabled(self) -> bool:
        """Check if Teams notifications are enabled"""
        await self._get_config()
        return bool(self._enabled and self._webhook_url)
    
    async def send(self, payload: NotificationPayload) -> DeliveryResult:
        """
        Send notification to Teams via Power Automate webhook.
        
        The webhook receives a JSON POST with:
        {
            "title": "Notification Title",
            "message": "Notification body",
            "priority": "HIGH|MEDIUM|LOW",
            "action_url": "https://link-to-action.com",
            "action_label": "Ver Detalhes",
            "case_id": 123,
            "recipient_name": "User Name"
        }
        """
        await self._get_config()
        
        if not self._enabled:
            return self._create_error_result("Teams notifications are disabled")
        
        if not self._webhook_url:
            return self._create_error_result("Teams webhook URL not configured")
        
        try:
            # Build payload for Power Automate
            webhook_payload = {
                "title": payload.title,
                "message": payload.message,
                "priority": payload.priority.value if hasattr(payload.priority, 'value') else str(payload.priority),
                "action_url": payload.action_url or "",
                "action_label": payload.action_label or "Ver Detalhes",
                "case_id": payload.case_id,
                "recipient_name": payload.recipient_name or "",
                "recipient_email": payload.recipient_email or ""
            }
            
            # Add extra data if present
            if payload.extra_data:
                webhook_payload.update(payload.extra_data)
            
            logger.info(f"Sending Teams notification: {payload.title}")
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    self._webhook_url,
                    json=webhook_payload,
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code in (200, 201, 202):
                    logger.info(f"Teams notification sent successfully: {payload.title}")
                    return self._create_success_result(
                        message="Notification sent to Teams",
                        details={"status_code": response.status_code}
                    )
                else:
                    error_msg = f"Teams webhook returned {response.status_code}: {response.text[:200]}"
                    logger.warning(error_msg)
                    return self._create_error_result(
                        error=error_msg,
                        details={"status_code": response.status_code, "response": response.text[:500]}
                    )
                    
        except httpx.TimeoutException:
            error_msg = "Teams webhook request timed out"
            logger.error(error_msg)
            return self._create_error_result(error=error_msg)
            
        except httpx.RequestError as e:
            error_msg = f"Teams webhook request failed: {str(e)}"
            logger.error(error_msg)
            return self._create_error_result(error=error_msg)
            
        except Exception as e:
            error_msg = f"Unexpected error sending Teams notification: {str(e)}"
            logger.exception(error_msg)
            return self._create_error_result(error=error_msg)
    
    async def test_connection(self) -> DeliveryResult:
        """Test the Teams webhook connection"""
        await self._get_config()
        
        if not self._enabled:
            return self._create_error_result("Teams notifications are disabled")
        
        if not self._webhook_url:
            return self._create_error_result("Teams webhook URL not configured")
        
        # Send a test notification
        test_payload = NotificationPayload(
            title="🔔 Teste de Conexão",
            message="Esta é uma mensagem de teste do sistema de notificações. Se você está vendo esta mensagem, a integração com Teams está funcionando corretamente!",
            action_url="",
            action_label="Mensagem de Teste"
        )
        
        return await self.send(test_payload)
