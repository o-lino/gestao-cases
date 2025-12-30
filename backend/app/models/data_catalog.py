"""
Data Catalog Models

Models for data table catalog and variable matching:
- DataTable: Tables available in data lake
- VariableMatch: Match between case variable and data table
- ApprovalHistory: Historical approvals to reuse decisions
"""

from datetime import datetime
from enum import Enum
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float, JSON
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import relationship

from app.db.base import Base


class MatchStatus(str, Enum):
    """Status of a variable match"""
    SUGGESTED = "SUGGESTED"      # System suggested this match
    SELECTED = "SELECTED"        # Selected as the match for variable
    PENDING_OWNER = "PENDING_OWNER"  # Waiting for owner validation
    PENDING_REQUESTER = "PENDING_REQUESTER"  # Owner approved, waiting for requester confirmation
    APPROVED = "APPROVED"        # Fully approved (owner + requester)
    REJECTED = "REJECTED"        # Owner rejected
    REJECTED_BY_REQUESTER = "REJECTED_BY_REQUESTER"  # Requester rejected, back to owner
    REDIRECTED = "REDIRECTED"    # Redirected to another owner/area
    PENDING_VALIDATION = "PENDING_VALIDATION"  # Owner response under validation


class VariableSearchStatus(str, Enum):
    """Status of variable search process"""
    PENDING = "PENDING"          # Not searched yet
    AI_SEARCHING = "AI_SEARCHING"  # Being processed by AI agent (future integration)
    SEARCHING = "SEARCHING"      # Currently searching
    MATCHED = "MATCHED"          # Found matches
    NO_MATCH = "NO_MATCH"        # No matches found
    OWNER_REVIEW = "OWNER_REVIEW"  # Waiting for owner
    REQUESTER_REVIEW = "REQUESTER_REVIEW"  # Owner approved, waiting for requester
    APPROVED = "APPROVED"        # Final approval received (requester confirmed)
    IN_USE = "IN_USE"            # Requester confirmed data is being used
    CANCELLED = "CANCELLED"      # Variable was cancelled
    PENDING_INVOLVEMENT = "PENDING_INVOLVEMENT"  # Waiting for data creation via involvement



class DataTable(Base):
    """
    Represents a table in the data catalog.
    Each table has an owner who must approve usage requests.
    """
    __tablename__ = "data_tables"

    id = Column(Integer, primary_key=True, index=True)
    
    # Table identification
    name = Column(String(255), nullable=False, index=True)  # Technical name
    display_name = Column(String(255), nullable=False)  # Friendly name
    description = Column(Text, nullable=True)
    
    # Location and schema
    schema_name = Column(String(100), nullable=True)  # e.g., "bronze", "silver", "gold"
    database_name = Column(String(100), nullable=True)  # e.g., "datalake"
    full_path = Column(String(500), nullable=True)  # Full path in data lake
    
    # Classification
    domain = Column(String(100), nullable=True, index=True)  # e.g., "vendas", "clientes", "produtos"
    keywords = Column(JSON, default=list)  # Tags for search
    
    # Schema information
    columns = Column(JSON, default=list)  # [{name, type, description}]
    row_count = Column(Integer, nullable=True)
    
    # Ownership
    owner_id = Column(Integer, ForeignKey("collaborators.id"), nullable=True)
    owner = relationship("Collaborator", foreign_keys=[owner_id], backref="owned_tables")
    
    # Status
    is_active = Column(Boolean, default=True)
    is_sensitive = Column(Boolean, default=False)  # Requires extra approval
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<DataTable {self.name}>"


class VariableMatch(Base):
    """
    Match between a case variable and a data table.
    Created when system finds potential matches for a variable.
    """
    __tablename__ = "variable_matches"

    id = Column(Integer, primary_key=True, index=True)
    
    # Links
    case_variable_id = Column(Integer, ForeignKey("case_variables.id"), nullable=False, index=True)
    data_table_id = Column(Integer, ForeignKey("data_tables.id"), nullable=False, index=True)
    
    # Match quality
    score = Column(Float, nullable=False, default=0.0)  # 0.0 to 1.0
    match_reason = Column(Text, nullable=True)  # Explanation of why matched
    
    # Status workflow
    status = Column(SQLEnum(MatchStatus), default=MatchStatus.SUGGESTED, nullable=False, index=True)
    
    # When selected as final match
    is_selected = Column(Boolean, default=False)
    selected_at = Column(DateTime, nullable=True)
    selected_by_id = Column(Integer, ForeignKey("collaborators.id"), nullable=True)
    
    # Owner validation
    owner_validated_at = Column(DateTime, nullable=True)
    owner_id = Column(Integer, ForeignKey("collaborators.id"), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    
    # Column mapping (which column matches the variable)
    matched_column = Column(String(255), nullable=True)  # Column in table that matches
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    data_table = relationship("DataTable", backref="matches")

    def approve(self, owner_id: int) -> None:
        """Owner approves this match"""
        self.status = MatchStatus.APPROVED
        self.owner_validated_at = datetime.utcnow()
        self.owner_id = owner_id
    
    def reject(self, owner_id: int, reason: str = None) -> None:
        """Owner rejects this match"""
        self.status = MatchStatus.REJECTED
        self.owner_validated_at = datetime.utcnow()
        self.owner_id = owner_id
        self.rejection_reason = reason

    def __repr__(self):
        return f"<VariableMatch var={self.case_variable_id} table={self.data_table_id} score={self.score}>"


class ApprovalHistory(Base):
    """
    Historical record of approvals for reusing decisions.
    Tracks how often a table was approved/rejected for a given concept.
    """
    __tablename__ = "approval_history"

    id = Column(Integer, primary_key=True, index=True)
    
    # Concept identification (hash of normalized variable name + type)
    concept_hash = Column(String(64), nullable=False, index=True)
    concept_name = Column(String(255), nullable=False)  # Human readable
    concept_type = Column(String(50), nullable=True)  # Variable type
    
    # Table reference
    data_table_id = Column(Integer, ForeignKey("data_tables.id"), nullable=False, index=True)
    
    # Statistics
    approved_count = Column(Integer, default=0)
    rejected_count = Column(Integer, default=0)
    
    # Last usage
    last_used_at = Column(DateTime, nullable=True)
    
    # Relationships
    data_table = relationship("DataTable", backref="approval_history")
    
    @property
    def approval_rate(self) -> float:
        """Calculate approval rate for this concept+table combination"""
        total = self.approved_count + self.rejected_count
        if total == 0:
            return 0.5  # Neutral if no history
        return self.approved_count / total
    
    @property
    def total_uses(self) -> int:
        return self.approved_count + self.rejected_count

    def __repr__(self):
        return f"<ApprovalHistory concept={self.concept_name} table={self.data_table_id} rate={self.approval_rate:.2f}>"
