"""
Notification Model

Handles notifications for:
- Match suggestions pending review
- Owner/Requester review requests
- Approval/Rejection notifications
"""

from datetime import datetime
from enum import Enum
from typing import Optional
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Enum as SQLEnum
from sqlalchemy.orm import relationship

from app.db.base import Base


class NotificationType(str, Enum):
    """Types of notifications"""
    MATCH_SUGGESTED = "MATCH_SUGGESTED"         # New match needs review
    OWNER_REVIEW_REQUEST = "OWNER_REVIEW_REQUEST"   # Owner needs to review
    OWNER_APPROVED = "OWNER_APPROVED"           # Owner approved match
    OWNER_REJECTED = "OWNER_REJECTED"           # Owner rejected match
    REQUESTER_REVIEW_REQUEST = "REQUESTER_REVIEW_REQUEST"  # Requester needs to confirm
    MATCH_CONFIRMED = "MATCH_CONFIRMED"         # Match fully confirmed
    MATCH_DISCARDED = "MATCH_DISCARDED"         # Match was discarded
    SYNC_COMPLETED = "SYNC_COMPLETED"           # Catalog sync finished
    SYSTEM_ALERT = "SYSTEM_ALERT"               # General system notification
    
    # Matching workflow notifications
    OWNER_VALIDATION_REQUEST = "OWNER_VALIDATION_REQUEST"  # Table owner needs to validate match
    VARIABLE_APPROVED = "VARIABLE_APPROVED"                # Variable was approved by owner
    
    # Variable management notifications
    VARIABLE_ADDED = "VARIABLE_ADDED"                      # Variable added to case
    VARIABLE_CANCELLED = "VARIABLE_CANCELLED"              # Variable cancelled in case
    
    # Moderation notifications
    MODERATION_REQUEST = "MODERATION_REQUEST"           # Moderator requested to moderate user
    MODERATION_APPROVED = "MODERATION_APPROVED"         # User approved moderation request
    MODERATION_REJECTED = "MODERATION_REJECTED"         # User rejected moderation request
    MODERATION_CANCELLED = "MODERATION_CANCELLED"       # Moderator cancelled request
    MODERATION_STARTED = "MODERATION_STARTED"           # Association started
    MODERATION_EXPIRING = "MODERATION_EXPIRING"         # 15 days before expiration warning
    MODERATION_EXPIRED = "MODERATION_EXPIRED"           # Association expired
    MODERATION_REVOKED = "MODERATION_REVOKED"           # Association manually revoked
    
    # Agent decision notifications
    AGENT_DECISION_CONSENSUS = "AGENT_DECISION_CONSENSUS"  # Agent decision needs consensus vote
    AGENT_DECISION_APPROVED = "AGENT_DECISION_APPROVED"    # Agent decision was approved by consensus
    AGENT_DECISION_REJECTED = "AGENT_DECISION_REJECTED"    # Agent decision was rejected by consensus
    MATCH_REQUEST = "MATCH_REQUEST"                        # Generic match request (reused for agent)
    
    # Involvement notifications
    INVOLVEMENT_CREATED = "INVOLVEMENT_CREATED"              # New involvement created
    INVOLVEMENT_DATE_SET = "INVOLVEMENT_DATE_SET"            # Owner set expected date
    INVOLVEMENT_DUE_REMINDER = "INVOLVEMENT_DUE_REMINDER"    # Reminder before due date
    INVOLVEMENT_OVERDUE = "INVOLVEMENT_OVERDUE"              # Past due - collection notice
    INVOLVEMENT_COMPLETED = "INVOLVEMENT_COMPLETED"          # Completed successfully


class NotificationPriority(str, Enum):
    """Priority levels"""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"


class Notification(Base):
    """
    Notification entity for user alerts.
    """
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    
    # Recipient
    user_id = Column(Integer, ForeignKey("collaborators.id"), nullable=False, index=True)
    user = relationship("Collaborator", foreign_keys=[user_id])
    
    # Type and priority
    type = Column(SQLEnum(NotificationType), nullable=False)
    priority = Column(SQLEnum(NotificationPriority), default=NotificationPriority.MEDIUM)
    
    # Content
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=True)
    
    # Link to related entities
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=True)
    variable_id = Column(Integer, ForeignKey("case_variables.id"), nullable=True)
    match_id = Column(Integer, nullable=True)  # Reference to match (FK removed - table may not exist)
    table_id = Column(Integer, nullable=True)  # Reference to table (FK removed - table may not exist)
    
    # Action URL (optional)
    action_url = Column(String(500), nullable=True)
    action_label = Column(String(100), nullable=True)
    
    # Status
    is_read = Column(Boolean, default=False, index=True)
    read_at = Column(DateTime, nullable=True)
    is_archived = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)  # Auto-cleanup after this
    
    def mark_as_read(self):
        """Mark notification as read"""
        self.is_read = True
        self.read_at = datetime.utcnow()
    
    def __repr__(self):
        return f"<Notification {self.id} type={self.type} user={self.user_id}>"
