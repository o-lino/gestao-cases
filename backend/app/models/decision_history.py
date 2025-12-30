"""
Decision History Model

Comprehensive logging of all decisions made in the variable matching workflow.
This data will be used to train the external AI agent for better recommendations.
"""

from datetime import datetime
from enum import Enum
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float, JSON
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import relationship

from app.db.base import Base


class DecisionType(str, Enum):
    """Types of decisions in the workflow"""
    # Search/Match decisions
    MATCH_SUGGESTED = "MATCH_SUGGESTED"          # System suggested a match
    MATCH_SELECTED = "MATCH_SELECTED"            # Best match was selected
    
    # Owner decisions
    OWNER_CONFIRM = "OWNER_CONFIRM"              # Owner confirmed match
    OWNER_CORRECT_TABLE = "OWNER_CORRECT_TABLE"  # Owner suggested different table
    OWNER_DATA_NOT_EXIST = "OWNER_DATA_NOT_EXIST"  # Owner said data doesn't exist
    OWNER_DELEGATE_PERSON = "OWNER_DELEGATE_PERSON"  # Owner delegated to person
    OWNER_DELEGATE_AREA = "OWNER_DELEGATE_AREA"  # Owner delegated to area
    
    # Requester decisions
    REQUESTER_APPROVE = "REQUESTER_APPROVE"      # Requester confirmed match
    REQUESTER_REJECT_WRONG_DATA = "REQUESTER_REJECT_WRONG_DATA"
    REQUESTER_REJECT_INCOMPLETE = "REQUESTER_REJECT_INCOMPLETE"
    REQUESTER_REJECT_WRONG_GRANULARITY = "REQUESTER_REJECT_WRONG_GRANULARITY"
    REQUESTER_REJECT_WRONG_PERIOD = "REQUESTER_REJECT_WRONG_PERIOD"
    REQUESTER_REJECT_OTHER = "REQUESTER_REJECT_OTHER"
    
    # Final status decisions
    VARIABLE_IN_USE = "VARIABLE_IN_USE"          # Requester marked as in use
    VARIABLE_CANCELLED = "VARIABLE_CANCELLED"    # Variable was cancelled


class DecisionOutcome(str, Enum):
    """Outcome of the decision"""
    POSITIVE = "POSITIVE"    # Decision advanced the workflow
    NEGATIVE = "NEGATIVE"    # Decision rejected/redirected
    NEUTRAL = "NEUTRAL"      # Status update without judgment


class DecisionHistory(Base):
    """
    Comprehensive decision log for training AI recommendation agents.
    
    Records all decisions with:
    - Who made the decision
    - What type of decision it was
    - What the outcome was (positive/negative)
    - The complete context at decision time
    - All motivators/justifications
    """
    __tablename__ = "decision_history"

    id = Column(Integer, primary_key=True, index=True)
    
    # What was the decision about
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False, index=True)
    variable_id = Column(Integer, ForeignKey("case_variables.id"), nullable=False, index=True)
    match_id = Column(Integer, ForeignKey("variable_matches.id"), nullable=True, index=True)
    
    # Decision classification
    decision_type = Column(SQLEnum(DecisionType), nullable=False, index=True)
    outcome = Column(SQLEnum(DecisionOutcome), nullable=False, index=True)
    
    # Who made the decision
    actor_id = Column(Integer, ForeignKey("collaborators.id"), nullable=False, index=True)
    actor_role = Column(String(50), nullable=True)  # OWNER, REQUESTER, SYSTEM, CURATOR
    
    # Context at decision time (for AI training)
    variable_context = Column(JSON, nullable=True)  # Variable name, type, concept, lag, etc.
    table_context = Column(JSON, nullable=True)     # Table info, domain, owner, columns
    match_context = Column(JSON, nullable=True)     # Score, justification, matched columns
    
    # Decision details
    decision_reason = Column(Text, nullable=True)   # Main motivator/justification
    decision_details = Column(JSON, nullable=True)  # All additional details
    
    # Links to detailed response records
    owner_response_id = Column(Integer, ForeignKey("owner_responses.id"), nullable=True)
    requester_response_id = Column(Integer, ForeignKey("requester_responses.id"), nullable=True)
    
    # Status transitions
    previous_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=True)
    
    # Loop tracking (for iterative decisions)
    loop_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    case = relationship("Case", backref="decision_history")
    variable = relationship("CaseVariable", backref="decision_history")
    match = relationship("VariableMatch", backref="decision_history")
    actor = relationship("Collaborator", backref="decisions_made")
    owner_response = relationship("OwnerResponse")
    requester_response = relationship("RequesterResponse")

    def __repr__(self):
        return f"<DecisionHistory {self.id} type={self.decision_type.value} outcome={self.outcome.value}>"

    def to_training_dict(self) -> dict:
        """
        Export decision as a dictionary optimized for AI training.
        Includes all relevant context and labeled outcome.
        """
        return {
            # Identifiers
            "decision_id": self.id,
            "case_id": self.case_id,
            "variable_id": self.variable_id,
            "match_id": self.match_id,
            
            # Labels
            "decision_type": self.decision_type.value,
            "outcome": self.outcome.value,
            "actor_role": self.actor_role,
            
            # Context (features)
            "variable_context": self.variable_context,
            "table_context": self.table_context,
            "match_context": self.match_context,
            
            # Reasoning (for supervised learning)
            "decision_reason": self.decision_reason,
            "decision_details": self.decision_details,
            
            # Workflow state
            "previous_status": self.previous_status,
            "new_status": self.new_status,
            "loop_count": self.loop_count,
            
            # Timestamp
            "timestamp": self.created_at.isoformat() if self.created_at else None
        }
