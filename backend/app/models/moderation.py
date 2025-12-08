"""
Moderation Models

Handles moderator-user associations with:
- Time-limited associations (1/3/6 months)
- Approval workflow (moderator requests, user approves)
- History tracking
- Expiration notifications
"""

from datetime import datetime, timedelta
from enum import Enum
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Enum as SQLEnum
from sqlalchemy.orm import relationship

from app.db.base import Base


class ModerationRequestStatus(str, Enum):
    """Status of a moderation request"""
    PENDING = "PENDING"      # Waiting for user approval
    APPROVED = "APPROVED"    # Approved by user
    REJECTED = "REJECTED"    # Rejected by user
    CANCELLED = "CANCELLED"  # Cancelled by moderator
    EXPIRED = "EXPIRED"      # Expired without response


class ModerationDuration(str, Enum):
    """Duration options for moderation association"""
    ONE_MONTH = "1_MONTH"      # 30 days
    THREE_MONTHS = "3_MONTHS"  # 90 days (default)
    SIX_MONTHS = "6_MONTHS"    # 180 days
    
    @property
    def days(self) -> int:
        """Get duration in days"""
        mapping = {
            "1_MONTH": 30,
            "3_MONTHS": 90,
            "6_MONTHS": 180,
        }
        return mapping[self.value]
    
    @property
    def label(self) -> str:
        """Get human-readable label"""
        mapping = {
            "1_MONTH": "1 mês",
            "3_MONTHS": "3 meses",
            "6_MONTHS": "6 meses",
        }
        return mapping[self.value]


class ModerationAssociationStatus(str, Enum):
    """Status of a moderation association"""
    ACTIVE = "ACTIVE"      # Currently active
    EXPIRED = "EXPIRED"    # Expired by time
    REVOKED = "REVOKED"    # Manually revoked


# Request expiration in days (time for user to respond)
REQUEST_EXPIRATION_DAYS = 7

# Days before expiration to send warning notification
EXPIRATION_WARNING_DAYS = 15

# Default duration when not specified
DEFAULT_DURATION = ModerationDuration.THREE_MONTHS


class ModerationRequest(Base):
    """
    Request from a moderator to moderate a user.
    User must approve for association to be created.
    """
    __tablename__ = "moderation_requests"

    id = Column(Integer, primary_key=True, index=True)
    
    # Participants
    moderator_id = Column(Integer, ForeignKey("collaborators.id"), nullable=False, index=True)
    moderator = relationship("Collaborator", foreign_keys=[moderator_id], backref="moderation_requests_sent")
    
    user_id = Column(Integer, ForeignKey("collaborators.id"), nullable=False, index=True)
    user = relationship("Collaborator", foreign_keys=[user_id], backref="moderation_requests_received")
    
    # Request details
    duration = Column(SQLEnum(ModerationDuration), default=DEFAULT_DURATION, nullable=False)
    status = Column(SQLEnum(ModerationRequestStatus), default=ModerationRequestStatus.PENDING, nullable=False, index=True)
    message = Column(Text, nullable=True)  # Optional message from moderator
    rejection_reason = Column(Text, nullable=True)  # Reason if rejected
    
    # Timestamps
    requested_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    responded_at = Column(DateTime, nullable=True)  # When user responded
    expires_at = Column(DateTime, nullable=False)  # Deadline for response
    
    # Flag for renewal requests
    is_renewal = Column(Boolean, default=False)
    previous_association_id = Column(Integer, ForeignKey("moderation_associations.id"), nullable=True)
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not self.expires_at:
            self.expires_at = datetime.utcnow() + timedelta(days=REQUEST_EXPIRATION_DAYS)
    
    @property
    def is_pending(self) -> bool:
        return self.status == ModerationRequestStatus.PENDING and datetime.utcnow() < self.expires_at
    
    @property
    def is_expired(self) -> bool:
        return self.status == ModerationRequestStatus.PENDING and datetime.utcnow() >= self.expires_at
    
    def approve(self) -> None:
        """Mark request as approved"""
        self.status = ModerationRequestStatus.APPROVED
        self.responded_at = datetime.utcnow()
    
    def reject(self, reason: str = None) -> None:
        """Mark request as rejected"""
        self.status = ModerationRequestStatus.REJECTED
        self.responded_at = datetime.utcnow()
        self.rejection_reason = reason
    
    def cancel(self) -> None:
        """Mark request as cancelled by moderator"""
        self.status = ModerationRequestStatus.CANCELLED
        self.responded_at = datetime.utcnow()
    
    def expire(self) -> None:
        """Mark request as expired"""
        self.status = ModerationRequestStatus.EXPIRED
    
    def __repr__(self):
        return f"<ModerationRequest {self.id} mod={self.moderator_id} user={self.user_id} status={self.status}>"


class ModerationAssociation(Base):
    """
    Active association between a moderator and a user.
    Created when user approves a moderation request.
    """
    __tablename__ = "moderation_associations"

    id = Column(Integer, primary_key=True, index=True)
    
    # Participants
    moderator_id = Column(Integer, ForeignKey("collaborators.id"), nullable=False, index=True)
    moderator = relationship("Collaborator", foreign_keys=[moderator_id], backref="moderated_users")
    
    user_id = Column(Integer, ForeignKey("collaborators.id"), nullable=False, index=True)
    user = relationship("Collaborator", foreign_keys=[user_id], backref="moderators")
    
    # Source request
    request_id = Column(Integer, ForeignKey("moderation_requests.id"), nullable=False)
    request = relationship("ModerationRequest", foreign_keys=[request_id], backref="association")
    
    # Status and timestamps
    status = Column(SQLEnum(ModerationAssociationStatus), default=ModerationAssociationStatus.ACTIVE, nullable=False, index=True)
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    revoked_by_id = Column(Integer, ForeignKey("collaborators.id"), nullable=True)
    
    # Notification flags
    expiration_warning_sent = Column(Boolean, default=False)  # 15 days warning sent
    expiration_notification_sent = Column(Boolean, default=False)  # Expiration notification sent
    
    @property
    def is_active(self) -> bool:
        return self.status == ModerationAssociationStatus.ACTIVE and datetime.utcnow() < self.expires_at
    
    @property
    def days_remaining(self) -> int:
        if self.expires_at:
            delta = self.expires_at - datetime.utcnow()
            return max(0, delta.days)
        return 0
    
    @property
    def should_warn_expiration(self) -> bool:
        """Check if expiration warning should be sent (15 days before)"""
        return (
            self.is_active and 
            not self.expiration_warning_sent and 
            self.days_remaining <= EXPIRATION_WARNING_DAYS
        )
    
    def revoke(self, by_user_id: int) -> None:
        """Revoke the association manually"""
        self.status = ModerationAssociationStatus.REVOKED
        self.revoked_at = datetime.utcnow()
        self.revoked_by_id = by_user_id
    
    def expire(self) -> None:
        """Mark association as expired"""
        self.status = ModerationAssociationStatus.EXPIRED
    
    def __repr__(self):
        return f"<ModerationAssociation {self.id} mod={self.moderator_id} user={self.user_id} status={self.status}>"
