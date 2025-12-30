"""
Email Notification Channel

Sends notifications via SMTP email.
"""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.channels.base_channel import (
    BaseNotificationChannel,
    NotificationPayload,
    DeliveryResult
)
from app.services.config_service import ConfigService


class EmailChannel(BaseNotificationChannel):
    """
    Email notification channel using SMTP.
    
    Configuration keys:
    - notification_email_enabled: Enable/disable channel
    - notification_email_smtp_host: SMTP server hostname
    - notification_email_smtp_port: SMTP server port
    - notification_email_from: Sender email address
    - notification_email_use_tls: Use TLS encryption
    """
    
    channel_name = "email"
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self._config_loaded = False
        self._enabled: bool = False
        self._smtp_host: str = ""
        self._smtp_port: int = 587
        self._from_email: str = ""
        self._use_tls: bool = True
    
    async def _load_config(self) -> None:
        """Load configuration from database"""
        if self._config_loaded:
            return
            
        self._enabled = await ConfigService.get_config_value(
            self.db, "notification_email_enabled", False
        )
        self._smtp_host = await ConfigService.get_config_value(
            self.db, "notification_email_smtp_host", ""
        )
        self._smtp_port = await ConfigService.get_config_value(
            self.db, "notification_email_smtp_port", 587
        )
        self._from_email = await ConfigService.get_config_value(
            self.db, "notification_email_from", ""
        )
        self._use_tls = await ConfigService.get_config_value(
            self.db, "notification_email_use_tls", True
        )
        self._config_loaded = True
    
    async def is_enabled(self) -> bool:
        """Check if email notifications are enabled and configured"""
        await self._load_config()
        return bool(self._enabled and self._smtp_host and self._from_email)
    
    def _build_html_body(self, payload: NotificationPayload) -> str:
        """Build HTML email body"""
        action_button = ""
        if payload.action_url:
            action_button = f'''
            <div style="margin-top: 20px;">
                <a href="{payload.action_url}" 
                   style="display: inline-block; padding: 12px 24px; 
                          background-color: #f97316; color: white; 
                          text-decoration: none; border-radius: 6px;
                          font-weight: 600;">
                    {payload.action_label or "Ver Detalhes"}
                </a>
            </div>
            '''
        
        priority_color = {
            "LOW": "#6b7280",
            "MEDIUM": "#3b82f6",
            "HIGH": "#f97316",
            "URGENT": "#ef4444"
        }.get(str(payload.priority.value if hasattr(payload.priority, 'value') else payload.priority), "#3b82f6")
        
        return f'''
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                     max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); 
                        padding: 20px; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 20px;">
                    📋 Gestão Cases 2.0
                </h1>
            </div>
            <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; 
                        border-top: none; border-radius: 0 0 12px 12px;">
                <div style="display: inline-block; padding: 4px 12px; 
                            background-color: {priority_color}; color: white;
                            border-radius: 20px; font-size: 12px; margin-bottom: 16px;">
                    {payload.priority.value if hasattr(payload.priority, 'value') else payload.priority}
                </div>
                <h2 style="color: #111827; margin: 0 0 12px 0; font-size: 18px;">
                    {payload.title}
                </h2>
                <p style="color: #4b5563; line-height: 1.6; margin: 0;">
                    {payload.message}
                </p>
                {action_button}
            </div>
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
                Esta é uma notificação automática do sistema Gestão Cases 2.0
            </p>
        </body>
        </html>
        '''
    
    async def send(self, payload: NotificationPayload) -> DeliveryResult:
        """Send notification via email"""
        await self._load_config()
        
        if not self._enabled:
            return self._create_error_result("Email notifications are disabled")
        
        if not self._smtp_host or not self._from_email:
            return self._create_error_result("Email SMTP configuration incomplete")
        
        if not payload.recipient_email:
            return self._create_error_result("No recipient email address provided")
        
        try:
            # Build email
            msg = MIMEMultipart("alternative")
            msg["Subject"] = f"[Gestão Cases] {payload.title}"
            msg["From"] = self._from_email
            msg["To"] = payload.recipient_email
            
            # Plain text fallback
            text_body = f"{payload.title}\n\n{payload.message}"
            if payload.action_url:
                text_body += f"\n\nAcesse: {payload.action_url}"
            
            # HTML body
            html_body = self._build_html_body(payload)
            
            msg.attach(MIMEText(text_body, "plain"))
            msg.attach(MIMEText(html_body, "html"))
            
            logger.info(f"Sending email notification to {payload.recipient_email}: {payload.title}")
            
            # Send email
            # Note: In production, consider using aiosmtplib for async support
            with smtplib.SMTP(self._smtp_host, self._smtp_port, timeout=30) as server:
                if self._use_tls:
                    server.starttls()
                # Note: Authentication would be added here for production
                # server.login(username, password)
                server.send_message(msg)
            
            logger.info(f"Email sent successfully to {payload.recipient_email}")
            return self._create_success_result(
                message=f"Email sent to {payload.recipient_email}",
                details={"recipient": payload.recipient_email}
            )
            
        except smtplib.SMTPException as e:
            error_msg = f"SMTP error: {str(e)}"
            logger.error(error_msg)
            return self._create_error_result(error=error_msg)
            
        except Exception as e:
            error_msg = f"Failed to send email: {str(e)}"
            logger.exception(error_msg)
            return self._create_error_result(error=error_msg)
    
    async def test_connection(self) -> DeliveryResult:
        """Test SMTP connection"""
        await self._load_config()
        
        if not self._enabled:
            return self._create_error_result("Email notifications are disabled")
        
        if not self._smtp_host:
            return self._create_error_result("SMTP host not configured")
        
        try:
            with smtplib.SMTP(self._smtp_host, self._smtp_port, timeout=10) as server:
                if self._use_tls:
                    server.starttls()
                # Just test the connection, don't send
                server.noop()
            
            return self._create_success_result(
                message=f"SMTP connection successful to {self._smtp_host}:{self._smtp_port}",
                details={"host": self._smtp_host, "port": self._smtp_port}
            )
            
        except Exception as e:
            return self._create_error_result(
                error=f"SMTP connection failed: {str(e)}",
                details={"host": self._smtp_host, "port": self._smtp_port}
            )
