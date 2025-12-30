"""
Approval Delegation Models

Handles delegation of approval permissions from one user to another:
- Scoped delegations (specific case, variable, or all)
- Time-limited or permanent delegations
- Audit trail for delegation activities
"""

from datetime import datetime
from enum import Enum
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Enum as SQLEnum
from sqlalchemy.orm import relationship

from app.db.base import Base


class DelegationScope(str, Enum):
    """Scope of the approval delegation"""
    CASE = "CASE"              # Delegation for a specific case
    VARIABLE = "VARIABLE"       # Delegation for a specific variable
    ALL_CASES = "ALL_CASES"    # Delegation for all cases
    ALL = "ALL"                # Full delegation


class DelegationStatus(str, Enum):
    """Status of the delegation"""
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"
    REVOKED = "REVOKED"


class ApprovalDelegation(Base):
    """
    Delegation of approval permissions from one user to another.
    Enables administrators or users to delegate their approval rights.
    """
    __tablename__ = "approval_delegations"

    id = Column(Integer, primary_key=True, index=True)
    
    # Who is delegating (the original approver)
    delegator_id = Column(Integer, ForeignKey("collaborators.id"), nullable=False, index=True)
    delegator = relationship("Collaborator", foreign_keys=[delegator_id], backref="delegations_given")
    
    # Who receives the delegation (the delegate)
    delegate_id = Column(Integer, ForeignKey("collaborators.id"), nullable=False, index=True)
    delegate = relationship("Collaborator", foreign_keys=[delegate_id], backref="delegations_received")
    
    # Scope and resource
    scope = Column(SQLEnum(DelegationScope), nullable=False, index=True)
    resource_id = Column(Integer, nullable=True)  # ID of case or variable if scope is specific
    
    # Status
    status = Column(SQLEnum(DelegationStatus), default=DelegationStatus.ACTIVE, nullable=False, index=True)
    
    # Validity
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    valid_until = Column(DateTime, nullable=True)  # Null = permanent
    revoked_at = Column(DateTime, nullable=True)
    
    # Audit trail
    created_by = Column(Integer, ForeignKey("collaborators.id"), nullable=True)
    creator = relationship("Collaborator", foreign_keys=[created_by])
    revoked_by_id = Column(Integer, ForeignKey("collaborators.id"), nullable=True)
    revoker = relationship("Collaborator", foreign_keys=[revoked_by_id])
    
    # Context
    reason = Column(Text, nullable=True)  # Reason for delegation
    revocation_reason = Column(Text, nullable=True)  # Reason for revocation
    
    @property
    def is_active(self) -> bool:
        """Check if delegation is currently active and valid"""
        if self.status != DelegationStatus.ACTIVE:
            return False
        if self.valid_until and datetime.utcnow() > self.valid_until:
            return False
        return True
    
    @property
    def days_remaining(self) -> int | None:
        """Get days remaining until expiration"""
        if not self.valid_until:
            return None  # Permanent
        delta = self.valid_until - datetime.utcnow()
        return max(0, delta.days)
    
    def revoke(self, by_user_id: int, reason: str = None) -> None:
        """Revoke the delegation"""
        self.status = DelegationStatus.REVOKED
        self.revoked_at = datetime.utcnow()
        self.revoked_by_id = by_user_id
        self.revocation_reason = reason
    
    def expire(self) -> None:
        """Mark delegation as expired"""
        self.status = DelegationStatus.EXPIRED
    
    def __repr__(self):
        return f"<ApprovalDelegation {self.id} from={self.delegator_id} to={self.delegate_id} scope={self.scope}>"


class AdminAction(Base):
    """
    Audit log for administrative actions.
    Tracks all superuser operations for compliance and review.
    """
    __tablename__ = "admin_actions"

    id = Column(Integer, primary_key=True, index=True)
    
    # Who performed the action
    admin_id = Column(Integer, ForeignKey("collaborators.id"), nullable=False, index=True)
    admin = relationship("Collaborator", foreign_keys=[admin_id])
    
    # Action details
    action_type = Column(String(100), nullable=False, index=True)
    # Types: FORCE_STATUS, FORCE_APPROVE, ASSIGN_OWNER, ASSIGN_TABLE, 
    #        UPDATE_CASE, UPDATE_VARIABLE, CREATE_DELEGATION, REVOKE_DELEGATION
    
    # Target entity
    entity_type = Column(String(50), nullable=False)  # CASE, VARIABLE, DELEGATION
    entity_id = Column(Integer, nullable=False)
    
    # Optional: On behalf of another user
    on_behalf_of_id = Column(Integer, ForeignKey("collaborators.id"), nullable=True)
    on_behalf_of = relationship("Collaborator", foreign_keys=[on_behalf_of_id])
    
    # Context
    previous_value = Column(Text, nullable=True)  # JSON of previous state
    new_value = Column(Text, nullable=True)  # JSON of new state
    reason = Column(Text, nullable=True)
    
    # Timestamp
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    def __repr__(self):
        return f"<AdminAction {self.id} type={self.action_type} by={self.admin_id}>"
