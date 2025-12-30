"""
Suggestion Correction Model

Records corrections made by curators to table suggestions.
Used for tracking and improving future matching quality.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship

from app.db.base import Base


class SuggestionCorrection(Base):
    """
    Records corrections made by curators to table suggestions.
    Used for tracking and improving future matching.
    """
    __tablename__ = "suggestion_corrections"

    id = Column(Integer, primary_key=True, index=True)
    
    # Variable that was corrected
    variable_id = Column(Integer, ForeignKey("case_variables.id"), nullable=False, index=True)
    
    # Original suggestion (the table that was incorrectly suggested)
    original_table_id = Column(Integer, ForeignKey("data_tables.id"), nullable=True)
    original_score = Column(Float, nullable=True)
    
    # Corrected table (the correct table selected by curator)
    corrected_table_id = Column(Integer, ForeignKey("data_tables.id"), nullable=False)
    
    # Curator who made the correction
    curator_id = Column(Integer, ForeignKey("collaborators.id"), nullable=False, index=True)
    
    # Reason/justification for the correction
    correction_reason = Column(Text, nullable=True)
    
    # Impact indicator - was the original approved before correction?
    was_original_approved = Column(Integer, default=0)  # 0=no, 1=yes
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    variable = relationship("CaseVariable", backref="corrections")
    original_table = relationship("DataTable", foreign_keys=[original_table_id])
    corrected_table = relationship("DataTable", foreign_keys=[corrected_table_id])
    curator = relationship("Collaborator", backref="corrections_made")

    def __repr__(self):
        return f"<SuggestionCorrection var={self.variable_id} original={self.original_table_id} corrected={self.corrected_table_id}>"
