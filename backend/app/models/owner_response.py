"""
Owner Response Model

Stores structured responses from data owners when they review table suggestions.
Each response type has specific validation requirements.
"""

from datetime import datetime
from enum import Enum
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import relationship

from app.db.base import Base


class OwnerResponseType(str, Enum):
    """Types of owner responses to table suggestions"""
    CORRECT_TABLE = "CORRECT_TABLE"       # Owner suggests a different table
    DATA_NOT_EXIST = "DATA_NOT_EXIST"     # Data doesn't exist -> involvement flow
    DELEGATE_PERSON = "DELEGATE_PERSON"   # Delegate to another person in same area
    DELEGATE_AREA = "DELEGATE_AREA"       # Delegate to another area entirely
    CONFIRM_MATCH = "CONFIRM_MATCH"       # Perfect match - approve with criteria


class OwnerResponse(Base):
    """
    Records structured owner responses to table suggestions.
    
    Each response type requires specific fields:
    - CORRECT_TABLE: suggested_table_id (validated against catalog)
    - DATA_NOT_EXIST: notes (triggers involvement creation flow)
    - DELEGATE_PERSON: delegate_to_funcional, delegate_to_id (autocomplete search)
    - DELEGATE_AREA: delegate_area_id, delegate_area_name (autocomplete search)
    - CONFIRM_MATCH: usage_criteria, attention_points (approval with details)
    """
    __tablename__ = "owner_responses"

    id = Column(Integer, primary_key=True, index=True)
    
    # Link to the variable match being responded to
    variable_match_id = Column(Integer, ForeignKey("variable_matches.id"), nullable=False, index=True)
    
    # Response type
    response_type = Column(SQLEnum(OwnerResponseType), nullable=False, index=True)
    
    # Who made this response
    responder_id = Column(Integer, ForeignKey("collaborators.id"), nullable=False, index=True)
    
    # For CORRECT_TABLE: suggests a different table
    suggested_table_id = Column(Integer, ForeignKey("data_tables.id"), nullable=True)
    
    # For DELEGATE_PERSON: delegate to another person
    delegate_to_funcional = Column(String(100), nullable=True)  # Employee ID / funcional
    delegate_to_id = Column(Integer, ForeignKey("collaborators.id"), nullable=True)
    
    # For DELEGATE_AREA: delegate to another organizational area
    delegate_area_id = Column(Integer, nullable=True)  # References external area structure
    delegate_area_name = Column(String(255), nullable=True)  # Denormalized for display
    
    # For CONFIRM_MATCH: usage criteria and attention points
    usage_criteria = Column(Text, nullable=True)  # Rules for using this data
    attention_points = Column(Text, nullable=True)  # Important considerations
    
    # Common fields
    notes = Column(Text, nullable=True)  # Additional notes/justification
    
    # Validation status
    is_validated = Column(Boolean, default=False)  # Was the response validated?
    validation_result = Column(Text, nullable=True)  # Result of validation
    validation_error = Column(Text, nullable=True)  # Error message if validation failed
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    validated_at = Column(DateTime, nullable=True)
    
    # Relationships
    variable_match = relationship("VariableMatch", backref="owner_responses")
    responder = relationship("Collaborator", foreign_keys=[responder_id], backref="owner_responses")
    suggested_table = relationship("DataTable", foreign_keys=[suggested_table_id])
    delegate_to = relationship("Collaborator", foreign_keys=[delegate_to_id])

    def __repr__(self):
        return f"<OwnerResponse match={self.variable_match_id} type={self.response_type.value}>"

    def validate(self) -> bool:
        """
        Basic validation of required fields per response type.
        Returns True if valid, False otherwise.
        """
        if self.response_type == OwnerResponseType.CORRECT_TABLE:
            return self.suggested_table_id is not None
        
        elif self.response_type == OwnerResponseType.DATA_NOT_EXIST:
            return True  # Notes are optional, just need to indicate data doesn't exist
        
        elif self.response_type == OwnerResponseType.DELEGATE_PERSON:
            return bool(self.delegate_to_funcional or self.delegate_to_id)
        
        elif self.response_type == OwnerResponseType.DELEGATE_AREA:
            return bool(self.delegate_area_id or self.delegate_area_name)
        
        elif self.response_type == OwnerResponseType.CONFIRM_MATCH:
            return bool(self.usage_criteria)
        
        return False


class RequesterResponseType(str, Enum):
    """Types of requester responses after owner validates"""
    APPROVE = "APPROVE"                   # Requester confirms the match is perfect
    REJECT_WRONG_DATA = "REJECT_WRONG_DATA"  # Data doesn't match what was requested
    REJECT_INCOMPLETE = "REJECT_INCOMPLETE"  # Data is missing fields/columns
    REJECT_WRONG_GRANULARITY = "REJECT_WRONG_GRANULARITY"  # Wrong level of detail
    REJECT_WRONG_PERIOD = "REJECT_WRONG_PERIOD"  # Wrong time range or frequency
    REJECT_OTHER = "REJECT_OTHER"         # Other reason (requires detailed explanation)


class RequesterResponse(Base):
    """
    Records structured requester responses after owner validation.
    
    Response types:
    - APPROVE: Requester confirms the match, workflow complete
    - REJECT_*: Requester rejects with specific reason, loops back to owner
    
    All rejections require a detailed reason to ensure plausibility.
    """
    __tablename__ = "requester_responses"

    id = Column(Integer, primary_key=True, index=True)
    
    # Link to the variable match being responded to
    variable_match_id = Column(Integer, ForeignKey("variable_matches.id"), nullable=False, index=True)
    
    # Link to the owner response that was being evaluated
    owner_response_id = Column(Integer, ForeignKey("owner_responses.id"), nullable=True, index=True)
    
    # Response type
    response_type = Column(SQLEnum(RequesterResponseType), nullable=False, index=True)
    
    # Who made this response (the requester)
    responder_id = Column(Integer, ForeignKey("collaborators.id"), nullable=False, index=True)
    
    # Required reason for rejection (mandatory for all REJECT_* types)
    rejection_reason = Column(Text, nullable=True)
    
    # Additional details about what was expected vs what was offered
    expected_data_description = Column(Text, nullable=True)
    
    # Notes about what would make this match acceptable
    improvement_suggestions = Column(Text, nullable=True)
    
    # Validation status
    is_validated = Column(Boolean, default=False)
    validation_error = Column(Text, nullable=True)
    
    # How many times has this variable looped back to owner?
    loop_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    variable_match = relationship("VariableMatch", backref="requester_responses")
    owner_response = relationship("OwnerResponse", backref="requester_feedback")
    responder = relationship("Collaborator", foreign_keys=[responder_id], backref="requester_responses")

    def __repr__(self):
        return f"<RequesterResponse match={self.variable_match_id} type={self.response_type.value}>"

    def validate(self) -> bool:
        """
        Validate required fields based on response type.
        Rejection types MUST have a rejection_reason.
        """
        if self.response_type == RequesterResponseType.APPROVE:
            return True
        
        # All rejection types require a reason
        if not self.rejection_reason or len(self.rejection_reason.strip()) < 10:
            return False
        
        return True

