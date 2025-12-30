"""
Pydantic Schemas for Pending Approval
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

from app.schemas.hierarchy import CollaboratorBrief


class PendingApprovalBase(BaseModel):
    """Base schema for pending approval"""
    case_id: int
    approver_id: int
    requester_id: int


class PendingApprovalCreate(PendingApprovalBase):
    """Schema for creating a pending approval"""
    sla_hours: Optional[int] = 72  # Will be used to calculate sla_deadline


class ApprovalAction(BaseModel):
    """Schema for approval/rejection action"""
    notes: Optional[str] = Field(None, max_length=1000)


class RejectionAction(BaseModel):
    """Schema for rejection action"""
    reason: str = Field(..., min_length=10, max_length=1000)


class CaseBrief(BaseModel):
    """Brief case info for approval responses"""
    id: int
    title: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class PendingApprovalResponse(BaseModel):
    """Response schema for pending approval"""
    id: int
    case_id: int
    approver_id: int
    requester_id: int
    escalation_level: int
    status: str
    requested_at: datetime
    sla_deadline: Optional[datetime]
    responded_at: Optional[datetime]
    escalated_at: Optional[datetime]
    response_notes: Optional[str]
    rejection_reason: Optional[str]
    reminder_count: int
    is_overdue: bool
    hours_until_deadline: float
    
    # Nested info
    case: Optional[CaseBrief] = None
    approver: Optional[CollaboratorBrief] = None
    requester: Optional[CollaboratorBrief] = None

    class Config:
        from_attributes = True


class PendingApprovalListResponse(BaseModel):
    """Response for listing pending approvals"""
    items: List[PendingApprovalResponse]
    total: int
    pending_count: int
    overdue_count: int


class ApprovalStats(BaseModel):
    """Statistics about approvals"""
    total_pending: int
    total_overdue: int
    approved_today: int
    rejected_today: int
    average_response_hours: float
    escalated_count: int


class EscalationInfo(BaseModel):
    """Information about an escalation event"""
    approval_id: int
    case_id: int
    from_approver: CollaboratorBrief
    to_approver: CollaboratorBrief
    escalation_level: int
    reason: str  # "SLA exceeded" or manual
    escalated_at: datetime
