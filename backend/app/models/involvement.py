"""
Involvement Model

Represents a data creation request when an owner rejects a match 
indicating that they are the owner but the data doesn't exist yet.

Workflow:
1. Owner rejects match with "data doesn't exist" flag
2. Requester opens external request and registers the number here
3. Owner sets expected completion date
4. After date passes, owner receives daily reminder notifications
5. Owner completes by informing created table and concept
"""

from datetime import datetime, date
from enum import Enum
from sqlalchemy import Column, Integer, String, Text, DateTime, Date, ForeignKey, Boolean
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import relationship

from app.db.base import Base


class InvolvementStatus(str, Enum):
    """Status of an involvement request"""
    PENDING = "PENDING"           # Waiting for owner to set expected date
    IN_PROGRESS = "IN_PROGRESS"   # Date set, work in progress
    COMPLETED = "COMPLETED"       # Owner informed created table/concept
    OVERDUE = "OVERDUE"           # Past expected date, pending completion


class Involvement(Base):
    """
    Represents a data creation request (envolvimento).
    Created when owner confirms they own the domain but data doesn't exist.
    """
    __tablename__ = "involvements"

    id = Column(Integer, primary_key=True, index=True)
    
    # Link to the variable that needs this data
    case_variable_id = Column(Integer, ForeignKey("case_variables.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # External request information
    external_request_number = Column(String(100), nullable=False)
    external_system = Column(String(100), nullable=True)  # e.g., "ServiceNow", "Jira", "ITSM"
    
    # Participants
    requester_id = Column(Integer, ForeignKey("collaborators.id"), nullable=False)
    owner_id = Column(Integer, ForeignKey("collaborators.id"), nullable=False)
    
    # Timeline
    expected_completion_date = Column(Date, nullable=True)
    actual_completion_date = Column(Date, nullable=True)
    
    # Result - what was created
    created_table_name = Column(String(255), nullable=True)
    created_concept = Column(Text, nullable=True)
    
    # Status
    status = Column(SQLEnum(InvolvementStatus), default=InvolvementStatus.PENDING, nullable=False, index=True)
    notes = Column(Text, nullable=True)
    
    # Reminder tracking
    last_reminder_at = Column(DateTime, nullable=True)
    reminder_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    case_variable = relationship("CaseVariable", backref="involvement", uselist=False)
    requester = relationship("Collaborator", foreign_keys=[requester_id], backref="requested_involvements")
    owner = relationship("Collaborator", foreign_keys=[owner_id], backref="owned_involvements")
    
    @property
    def is_overdue(self) -> bool:
        """Check if involvement is past expected date"""
        if not self.expected_completion_date:
            return False
        if self.status == InvolvementStatus.COMPLETED:
            return False
        return date.today() > self.expected_completion_date
    
    @property
    def days_until_due(self) -> int:
        """Days until expected completion (negative if overdue)"""
        if not self.expected_completion_date:
            return 0
        delta = self.expected_completion_date - date.today()
        return delta.days
    
    @property
    def days_overdue(self) -> int:
        """Number of days past expected date (0 if not overdue)"""
        if not self.is_overdue:
            return 0
        return abs(self.days_until_due)
    
    def set_expected_date(self, expected_date: date) -> None:
        """Owner sets the expected completion date"""
        self.expected_completion_date = expected_date
        self.status = InvolvementStatus.IN_PROGRESS
        self.updated_at = datetime.utcnow()
    
    def complete(self, table_name: str, concept: str) -> None:
        """Owner completes the involvement with created data info"""
        self.created_table_name = table_name
        self.created_concept = concept
        self.actual_completion_date = date.today()
        self.status = InvolvementStatus.COMPLETED
        self.updated_at = datetime.utcnow()
    
    def mark_overdue(self) -> None:
        """Mark as overdue (called by scheduler)"""
        if self.is_overdue and self.status != InvolvementStatus.COMPLETED:
            self.status = InvolvementStatus.OVERDUE
            self.updated_at = datetime.utcnow()
    
    def record_reminder(self) -> None:
        """Record that a reminder was sent"""
        self.last_reminder_at = datetime.utcnow()
        self.reminder_count += 1
    
    def __repr__(self):
        return f"<Involvement id={self.id} var={self.case_variable_id} status={self.status}>"
