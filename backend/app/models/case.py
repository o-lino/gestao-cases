
from sqlalchemy import Column, Integer, String, Text, Date, Numeric, ForeignKey, DateTime, Boolean, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base

class Case(Base):
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text)
    client_name = Column(String, nullable=True)
    requester_email = Column(String, nullable=True) # New
    macro_case = Column(String, nullable=True) # New
    context = Column(Text, nullable=True) # New
    impact = Column(Text, nullable=True) # New
    necessity = Column(Text, nullable=True) # New
    impacted_journey = Column(String, nullable=True) # New
    impacted_segment = Column(String, nullable=True) # New
    impacted_customers = Column(String, nullable=True) # New
    
    status = Column(String, default="DRAFT", nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("collaborators.id"))
    assigned_to_id = Column(Integer, ForeignKey("collaborators.id"), nullable=True)
    estimated_use_date = Column(Date)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    version = Column(Integer, default=1)

    # Relationships
    author = relationship("Collaborator", foreign_keys=[created_by])
    assignee = relationship("Collaborator", foreign_keys=[assigned_to_id])
    variables = relationship("CaseVariable", back_populates="case", cascade="all, delete-orphan")
    documents = relationship("CaseDocument", back_populates="case", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="case", cascade="all, delete-orphan")

class CaseVariable(Base):
    __tablename__ = "case_variables"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id", ondelete="CASCADE"))
    variable_name = Column(String, nullable=False)
    variable_value = Column(JSONB, nullable=True) # Changed to nullable as value might be computed or empty initially
    variable_type = Column(String, nullable=False)
    is_required = Column(Boolean, default=False)
    
    # New fields from legacy system
    product = Column(String, nullable=True)
    concept = Column(Text, nullable=True)
    min_history = Column(String, nullable=True)
    priority = Column(String, nullable=True)
    desired_lag = Column(String, nullable=True)
    options = Column(String, nullable=True) # For select type
    
    # Data search/matching status
    search_status = Column(String, default="PENDING", index=True)  # PENDING, SEARCHING, MATCHED, NO_MATCH, OWNER_REVIEW, APPROVED
    search_started_at = Column(DateTime(timezone=True), nullable=True)
    search_completed_at = Column(DateTime(timezone=True), nullable=True)
    selected_match_id = Column(Integer, ForeignKey("variable_matches.id", ondelete="SET NULL", use_alter=True), nullable=True)

    case = relationship("Case", back_populates="variables")
    matches = relationship("VariableMatch", foreign_keys="VariableMatch.case_variable_id", backref="case_variable", lazy="dynamic")

    __table_args__ = (
        UniqueConstraint('case_id', 'variable_name', name='idx_case_var_unique'),
    )

