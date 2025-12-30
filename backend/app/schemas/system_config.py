"""
Pydantic Schemas for System Configuration
"""

from datetime import datetime
from typing import Optional, List, Any, Union
from pydantic import BaseModel, Field, field_validator
import json


class ConfigValueType(BaseModel):
    """Wrapper for typed configuration values"""
    string_value: Optional[str] = None
    number_value: Optional[float] = None
    boolean_value: Optional[bool] = None
    json_value: Optional[dict] = None


class SystemConfigBase(BaseModel):
    """Base schema for system configuration"""
    config_key: str = Field(..., max_length=100)
    config_value: str
    config_type: str = Field(default="string", pattern="^(string|number|boolean|json)$")
    description: Optional[str] = None
    category: str = Field(default="general", max_length=50)


class SystemConfigCreate(SystemConfigBase):
    """Schema for creating a configuration entry"""
    pass


class SystemConfigUpdate(BaseModel):
    """Schema for updating a configuration entry"""
    config_value: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None


class SystemConfigResponse(SystemConfigBase):
    """Response schema for configuration entry"""
    id: int
    updated_by: Optional[int]
    updated_at: datetime
    created_at: datetime
    
    # Parsed value based on type
    parsed_value: Optional[Any] = None

    class Config:
        from_attributes = True

    @field_validator('parsed_value', mode='before')
    @classmethod
    def parse_config_value(cls, v, info):
        """Parse the stored string value to its proper type"""
        if v is not None:
            return v
        # This will be populated by the service layer
        return None


class SystemConfigListResponse(BaseModel):
    """Response for listing configurations"""
    items: List[SystemConfigResponse]
    total: int


class ConfigByCategory(BaseModel):
    """Configurations grouped by category"""
    category: str
    configs: List[SystemConfigResponse]


class AllConfigsResponse(BaseModel):
    """All configurations grouped by category"""
    categories: List[ConfigByCategory]


# Convenience classes for specific config types
class ApprovalConfig(BaseModel):
    """Approval-related configurations"""
    case_approval_required: bool = True
    approval_sla_hours: int = 72


class EscalationConfig(BaseModel):
    """Escalation-related configurations"""
    escalation_enabled: bool = True
    escalation_sla_hours: int = 48
    escalation_max_level: int = 6
    escalation_reminder_hours: int = 24


class ConfigSummary(BaseModel):
    """Summary of all relevant configurations"""
    approval: ApprovalConfig
    escalation: EscalationConfig
