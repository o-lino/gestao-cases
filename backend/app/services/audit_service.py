from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit import AuditLog
from typing import Any, Dict

class AuditService:
    async def log_action(
        self,
        db: AsyncSession,
        entity_type: str,
        entity_id: int,
        actor_id: int,
        action_type: str,
        changes: Dict[str, Any]
    ) -> AuditLog:
        audit_log = AuditLog(
            entity_type=entity_type,
            entity_id=entity_id,
            actor_id=actor_id,
            action_type=action_type,
            changes=changes
        )
        db.add(audit_log)
        return audit_log

audit_service = AuditService()
