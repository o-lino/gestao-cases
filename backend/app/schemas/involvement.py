"""
Involvement Schemas

Pydantic schemas for Involvement API requests and responses.
"""

from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field

from app.models.involvement import InvolvementStatus


class InvolvementCreate(BaseModel):
    """Schema for creating a new involvement"""
    case_variable_id: int = Field(..., description="ID of the variable needing data creation")
    external_request_number: str = Field(..., min_length=1, max_length=100, description="External request/ticket number")
    external_system: Optional[str] = Field(None, max_length=100, description="Name of external system (e.g., ServiceNow)")
    notes: Optional[str] = Field(None, description="Additional notes")


class InvolvementSetDate(BaseModel):
    """Schema for owner setting expected completion date"""
    expected_completion_date: date = Field(..., description="Expected date for data creation completion")
    notes: Optional[str] = Field(None, description="Optional notes about the timeline")


class InvolvementComplete(BaseModel):
    """Schema for owner completing the involvement"""
    created_table_name: str = Field(..., min_length=1, max_length=255, description="Name of the created table")
    created_concept: str = Field(..., min_length=1, description="Description/concept of the created data")
    notes: Optional[str] = Field(None, description="Additional notes about the creation")


class InvolvementUpdate(BaseModel):
    """Schema for general updates to involvement"""
    notes: Optional[str] = None
    external_request_number: Optional[str] = Field(None, min_length=1, max_length=100)
    external_system: Optional[str] = Field(None, max_length=100)


class InvolvementResponse(BaseModel):
    """Schema for involvement response"""
    id: int
    case_variable_id: int
    external_request_number: str
    external_system: Optional[str] = None
    
    # Participants
    requester_id: int
    requester_name: Optional[str] = None
    owner_id: int
    owner_name: Optional[str] = None
    
    # Status
    status: InvolvementStatus
    
    # Timeline
    expected_completion_date: Optional[date] = None
    actual_completion_date: Optional[date] = None
    
    # Result
    created_table_name: Optional[str] = None
    created_concept: Optional[str] = None
    
    # Computed fields
    is_overdue: bool = False
    days_overdue: int = 0
    days_until_due: int = 0
    
    # Metadata
    notes: Optional[str] = None
    reminder_count: int = 0
    last_reminder_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    # Related data
    variable_name: Optional[str] = None
    case_id: Optional[int] = None
    case_title: Optional[str] = None

    class Config:
        from_attributes = True


class InvolvementListResponse(BaseModel):
    """Schema for paginated involvement list"""
    items: list[InvolvementResponse]
    total: int
    page: int = 1
    size: int = 20
    pages: int = 1


class InvolvementStats(BaseModel):
    """Schema for involvement statistics"""
    total: int = 0
    pending: int = 0
    in_progress: int = 0
    overdue: int = 0
    completed: int = 0
    avg_completion_days: Optional[float] = None
