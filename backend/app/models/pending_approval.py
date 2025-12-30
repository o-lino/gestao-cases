"""
Pending Approval Model
Tracks case approvals through the organizational hierarchy
"""

from enum import Enum
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class ApprovalStatus(str, Enum):
    """Status of a pending approval request"""
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    ESCALATED = "ESCALATED"
    CANCELLED = "CANCELLED"


class PendingApproval(Base):
    """
    Tracks approval requests for cases.
    When a case is submitted, an approval request is created for the submitter's manager.
    If not resolved within SLA, it escalates to the next level in hierarchy.
    """
    __tablename__ = "pending_approvals"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id", ondelete="CASCADE"), nullable=False)
    
    # Who needs to approve
    approver_id = Column(Integer, ForeignKey("collaborators.id"), nullable=False)
    
    # Original requester (for reference)
    requester_id = Column(Integer, ForeignKey("collaborators.id"), nullable=False)
    
    # Escalation tracking
    escalation_level = Column(Integer, default=0)  # 0 = direct manager, 1 = manager's manager, etc.
    previous_approval_id = Column(Integer, ForeignKey("pending_approvals.id"), nullable=True)
    
    # Status and timing
    status = Column(String(20), default=ApprovalStatus.PENDING, nullable=False, index=True)
    requested_at = Column(DateTime(timezone=True), server_default=func.now())
    sla_deadline = Column(DateTime(timezone=True), nullable=True)
    responded_at = Column(DateTime(timezone=True), nullable=True)
    escalated_at = Column(DateTime(timezone=True), nullable=True)
    
    # Response details
    response_notes = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    
    # Reminder tracking
    reminder_sent_at = Column(DateTime(timezone=True), nullable=True)
    reminder_count = Column(Integer, default=0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    case = relationship("Case", backref="approval_requests")
    approver = relationship("Collaborator", foreign_keys=[approver_id])
    requester = relationship("Collaborator", foreign_keys=[requester_id])
    previous_approval = relationship("PendingApproval", remote_side=[id])
    
    @property
    def is_overdue(self) -> bool:
        """Check if this approval has exceeded SLA"""
        from datetime import datetime, timezone
        if self.sla_deadline and self.status == ApprovalStatus.PENDING:
            return datetime.now(timezone.utc) > self.sla_deadline
        return False
    
    @property
    def hours_until_deadline(self) -> float:
        """Get hours remaining until SLA deadline"""
        from datetime import datetime, timezone
        if self.sla_deadline:
            delta = self.sla_deadline - datetime.now(timezone.utc)
            return delta.total_seconds() / 3600
        return float('inf')

    def approve(self, notes: str = None):
        """Mark this approval as approved"""
        from datetime import datetime, timezone
        self.status = ApprovalStatus.APPROVED
        self.responded_at = datetime.now(timezone.utc)
        self.response_notes = notes

    def reject(self, reason: str):
        """Mark this approval as rejected"""
        from datetime import datetime, timezone
        self.status = ApprovalStatus.REJECTED
        self.responded_at = datetime.now(timezone.utc)
        self.rejection_reason = reason

    def escalate(self):
        """Mark this approval as escalated"""
        from datetime import datetime, timezone
        self.status = ApprovalStatus.ESCALATED
        self.escalated_at = datetime.now(timezone.utc)
