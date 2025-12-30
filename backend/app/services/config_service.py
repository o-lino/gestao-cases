"""
System Configuration Service
Business logic for managing system-wide configuration parameters
"""

from typing import Optional, List, Dict, Any
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.hierarchy import SystemConfiguration
from app.schemas.system_config import (
    SystemConfigCreate,
    SystemConfigUpdate,
    SystemConfigResponse,
    ApprovalConfig,
    EscalationConfig,
    ConfigSummary
)


class ConfigService:
    """Service for managing system configuration"""

    @staticmethod
    async def get_config(
        db: AsyncSession,
        key: str
    ) -> Optional[SystemConfiguration]:
        """Get a configuration by key"""
        result = await db.execute(
            select(SystemConfiguration).where(SystemConfiguration.config_key == key)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_config_value(
        db: AsyncSession,
        key: str,
        default: Any = None
    ) -> Any:
        """Get a configuration value, parsed to its proper type"""
        config = await ConfigService.get_config(db, key)
        
        if not config:
            # Return default from CONFIG_KEYS if not in DB
            default_val = SystemConfiguration.get_default_value(key)
            if default_val:
                return ConfigService._parse_value(default_val, "string")
            return default
        
        return ConfigService._parse_value(config.config_value, config.config_type)

    @staticmethod
    def _parse_value(value: str, config_type: str) -> Any:
        """Parse string value to proper type"""
        if config_type == "boolean":
            return value.lower() in ("true", "1", "yes")
        elif config_type == "number":
            try:
                if "." in value:
                    return float(value)
                return int(value)
            except ValueError:
                return 0
        elif config_type == "json":
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return {}
        return value

    @staticmethod
    async def set_config(
        db: AsyncSession,
        key: str,
        value: Any,
        config_type: str = "string",
        description: str = None,
        category: str = "general",
        updated_by: int = None
    ) -> SystemConfiguration:
        """Set a configuration value"""
        # Convert value to string for storage
        if isinstance(value, bool):
            str_value = "true" if value else "false"
        elif isinstance(value, dict):
            str_value = json.dumps(value)
        else:
            str_value = str(value)
        
        config = await ConfigService.get_config(db, key)
        
        if config:
            config.config_value = str_value
            config.config_type = config_type
            if description:
                config.description = description
            if category:
                config.category = category
            config.updated_by = updated_by
        else:
            config = SystemConfiguration(
                config_key=key,
                config_value=str_value,
                config_type=config_type,
                description=description,
                category=category,
                updated_by=updated_by
            )
            db.add(config)
        
        await db.commit()
        await db.refresh(config)
        return config

    @staticmethod
    async def list_configs(
        db: AsyncSession,
        category: Optional[str] = None
    ) -> List[SystemConfiguration]:
        """List all configurations, optionally filtered by category"""
        query = select(SystemConfiguration)
        
        if category:
            query = query.where(SystemConfiguration.category == category)
        
        query = query.order_by(SystemConfiguration.category, SystemConfiguration.config_key)
        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def initialize_defaults(db: AsyncSession) -> int:
        """Initialize default configuration values if not present"""
        created = 0
        
        for key, config_info in SystemConfiguration.CONFIG_KEYS.items():
            existing = await ConfigService.get_config(db, key)
            if not existing:
                await ConfigService.set_config(
                    db,
                    key=key,
                    value=config_info["default"],
                    config_type=config_info["type"],
                    description=config_info["description"],
                    category=config_info["category"]
                )
                created += 1
        
        return created

    @staticmethod
    async def get_approval_config(db: AsyncSession) -> ApprovalConfig:
        """Get approval-related configuration"""
        case_approval_required = await ConfigService.get_config_value(
            db, "case_approval_required", True
        )
        approval_sla_hours = await ConfigService.get_config_value(
            db, "approval_sla_hours", 72
        )
        
        return ApprovalConfig(
            case_approval_required=case_approval_required,
            approval_sla_hours=approval_sla_hours
        )

    @staticmethod
    async def get_escalation_config(db: AsyncSession) -> EscalationConfig:
        """Get escalation-related configuration"""
        return EscalationConfig(
            escalation_enabled=await ConfigService.get_config_value(
                db, "escalation_enabled", True
            ),
            escalation_sla_hours=await ConfigService.get_config_value(
                db, "escalation_sla_hours", 48
            ),
            escalation_max_level=await ConfigService.get_config_value(
                db, "escalation_max_level", 6
            ),
            escalation_reminder_hours=await ConfigService.get_config_value(
                db, "escalation_reminder_hours", 24
            )
        )

    @staticmethod
    async def get_config_summary(db: AsyncSession) -> ConfigSummary:
        """Get summary of all relevant configurations"""
        return ConfigSummary(
            approval=await ConfigService.get_approval_config(db),
            escalation=await ConfigService.get_escalation_config(db)
        )

    @staticmethod
    def to_response(config: SystemConfiguration) -> SystemConfigResponse:
        """Convert model to response schema"""
        parsed_value = ConfigService._parse_value(
            config.config_value, 
            config.config_type
        )
        
        return SystemConfigResponse(
            id=config.id,
            config_key=config.config_key,
            config_value=config.config_value,
            config_type=config.config_type,
            description=config.description,
            category=config.category,
            updated_by=config.updated_by,
            updated_at=config.updated_at,
            created_at=config.created_at,
            parsed_value=parsed_value
        )
