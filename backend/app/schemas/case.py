
from typing import Optional, Dict, Any, List
from datetime import date, datetime
from enum import Enum
from pydantic import BaseModel, Field, field_validator, ConfigDict

# Audit Log schema for history endpoint
class AuditLogResponse(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    actor_id: Optional[int] = None
    actor_name: Optional[str] = None  # Added for display
    action_type: str
    changes: Dict[str, Any]
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class CaseStatus(str, Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    REVIEW = "REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CLOSED = "CLOSED"
    CANCELLED = "CANCELLED"

class CaseVariableSchema(BaseModel):
    variable_name: str
    variable_value: Optional[Any] = None
    variable_type: str
    is_required: bool = False
    product: Optional[str] = None
    concept: Optional[str] = None
    min_history: Optional[str] = None
    priority: Optional[str] = None
    desired_lag: Optional[str] = None
    options: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class CaseVariableCreate(CaseVariableSchema):
    """Schema for creating a new variable in an existing case"""
    pass

class CaseVariableResponse(CaseVariableSchema):
    """Schema for variable response with id and status fields"""
    id: int
    search_status: Optional[str] = "PENDING"
    is_cancelled: bool = False
    cancelled_at: Optional[datetime] = None
    cancellation_reason: Optional[str] = None

class CaseVariableCancel(BaseModel):
    """Schema for cancelling a variable"""
    reason: Optional[str] = Field(None, max_length=500, description="Motivo do cancelamento")

class CaseBase(BaseModel):
    title: str = Field(..., min_length=5, max_length=255, description="Título descritivo do case")
    description: Optional[str] = Field(None, description="Detalhamento do escopo")
    client_name: Optional[str] = Field(None, max_length=255)
    requester_email: Optional[str] = None
    macro_case: Optional[str] = None
    context: Optional[str] = None
    impact: Optional[str] = None
    necessity: Optional[str] = None
    impacted_journey: Optional[str] = None
    impacted_segment: Optional[str] = None
    impacted_customers: Optional[str] = None
    
    estimated_use_date: Optional[date] = None

class CaseCreate(CaseBase):
    variables: Optional[List[CaseVariableSchema]] = []

class CaseUpdate(CaseBase):
    title: Optional[str] = Field(None, min_length=5, max_length=255)
    status: Optional[CaseStatus] = None

class CaseResponse(CaseBase):
    id: int
    status: CaseStatus
    created_by: int
    assigned_to_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    variables: List[CaseVariableResponse] = []

    model_config = ConfigDict(from_attributes=True)

