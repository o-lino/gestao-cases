"""
Webhook service for notifying external systems about case events.
"""
import httpx
import logging
from typing import Dict, Any, Optional
from datetime import datetime
import asyncio
import json

logger = logging.getLogger(__name__)


class WebhookEvent:
    """Webhook event types."""
    CASE_CREATED = "case.created"
    CASE_UPDATED = "case.updated"
    CASE_STATUS_CHANGED = "case.status_changed"
    CASE_APPROVED = "case.approved"
    CASE_REJECTED = "case.rejected"
    CASE_COMMENT_ADDED = "case.comment_added"
    CASE_DOCUMENT_ADDED = "case.document_added"


class WebhookService:
    """
    Service for sending webhooks to external systems.
    """
    
    def __init__(self):
        self.endpoints: list[Dict[str, Any]] = []
        self.timeout = 10.0  # seconds
        self.max_retries = 3
    
    def register_endpoint(
        self,
        url: str,
        events: list[str],
        secret: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None
    ):
        """Register a webhook endpoint."""
        self.endpoints.append({
            "url": url,
            "events": events,
            "secret": secret,
            "headers": headers or {},
            "enabled": True,
        })
        logger.info(f"Registered webhook endpoint: {url}")
    
    def _sign_payload(self, payload: str, secret: str) -> str:
        """Sign payload with HMAC-SHA256."""
        import hmac
        import hashlib
        return hmac.new(
            secret.encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()
    
    async def _send_webhook(
        self,
        endpoint: Dict[str, Any],
        event_type: str,
        payload: Dict[str, Any]
    ):
        """Send webhook to a single endpoint with retries."""
        url = endpoint["url"]
        headers = {
            "Content-Type": "application/json",
            "X-Webhook-Event": event_type,
            "X-Webhook-Timestamp": datetime.utcnow().isoformat(),
            **endpoint.get("headers", {}),
        }
        
        body = json.dumps(payload)
        
        # Add signature if secret is configured
        if endpoint.get("secret"):
            signature = self._sign_payload(body, endpoint["secret"])
            headers["X-Webhook-Signature"] = f"sha256={signature}"
        
        for attempt in range(self.max_retries):
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        url,
                        content=body,
                        headers=headers,
                        timeout=self.timeout
                    )
                    
                    if response.status_code >= 200 and response.status_code < 300:
                        logger.info(f"Webhook sent successfully to {url}")
                        return True
                    else:
                        logger.warning(f"Webhook failed with status {response.status_code}: {response.text}")
            
            except Exception as e:
                logger.error(f"Webhook error (attempt {attempt + 1}): {e}")
            
            # Exponential backoff
            if attempt < self.max_retries - 1:
                await asyncio.sleep(2 ** attempt)
        
        logger.error(f"Webhook failed after {self.max_retries} attempts: {url}")
        return False
    
    async def emit(self, event_type: str, data: Dict[str, Any]):
        """Emit an event to all registered endpoints."""
        payload = {
            "event": event_type,
            "timestamp": datetime.utcnow().isoformat(),
            "data": data,
        }
        
        # Find endpoints subscribed to this event
        subscribed = [
            ep for ep in self.endpoints
            if ep["enabled"] and (
                "*" in ep["events"] or event_type in ep["events"]
            )
        ]
        
        if not subscribed:
            return
        
        # Send to all endpoints concurrently
        tasks = [
            self._send_webhook(ep, event_type, payload)
            for ep in subscribed
        ]
        
        await asyncio.gather(*tasks, return_exceptions=True)
    
    async def emit_case_created(self, case_data: Dict[str, Any]):
        """Emit case created event."""
        await self.emit(WebhookEvent.CASE_CREATED, {
            "case_id": case_data.get("id"),
            "title": case_data.get("title"),
            "status": case_data.get("status"),
            "created_by": case_data.get("requester_email"),
        })
    
    async def emit_case_status_changed(
        self,
        case_id: int,
        old_status: str,
        new_status: str,
        changed_by: str
    ):
        """Emit case status changed event."""
        event_type = WebhookEvent.CASE_STATUS_CHANGED
        
        # Use specific event type for approval/rejection
        if new_status == "APPROVED":
            event_type = WebhookEvent.CASE_APPROVED
        elif new_status == "REJECTED":
            event_type = WebhookEvent.CASE_REJECTED
        
        await self.emit(event_type, {
            "case_id": case_id,
            "old_status": old_status,
            "new_status": new_status,
            "changed_by": changed_by,
        })


# Singleton instance
webhook_service = WebhookService()


# Example: Register Slack webhook
# webhook_service.register_endpoint(
#     url="https://hooks.slack.com/services/...",
#     events=[WebhookEvent.CASE_APPROVED, WebhookEvent.CASE_REJECTED],
#     headers={"Authorization": "Bearer ..."}
# )
