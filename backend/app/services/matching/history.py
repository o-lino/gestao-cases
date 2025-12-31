"""
Matching Service - History Module

Handles approval history tracking for improving future match scoring.
"""

from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.data_catalog import ApprovalHistory
from app.models.case import CaseVariable
from app.services.matching.scoring import generate_concept_hash


async def update_approval_history(
    db: AsyncSession,
    variable: CaseVariable,
    table_id: int,
    approved: bool
) -> None:
    """
    Update approval history for future matching.
    
    This tracks whether a concept+table combination was approved or rejected,
    which is used by the scoring algorithm to improve match quality over time.
    
    Args:
        db: Database session
        variable: The case variable that was matched
        table_id: ID of the data table
        approved: Whether the match was approved (True) or rejected (False)
    """
    concept_hash = generate_concept_hash(
        variable.variable_name, 
        variable.variable_type
    )
    
    result = await db.execute(
        select(ApprovalHistory).where(
            ApprovalHistory.concept_hash == concept_hash,
            ApprovalHistory.data_table_id == table_id
        )
    )
    history = result.scalars().first()
    
    if history:
        # Update existing history
        if approved:
            history.approved_count += 1
        else:
            history.rejected_count += 1
        history.last_used_at = datetime.utcnow()
    else:
        # Create new history entry
        history = ApprovalHistory(
            concept_hash=concept_hash,
            concept_name=variable.variable_name,
            concept_type=variable.variable_type,
            data_table_id=table_id,
            approved_count=1 if approved else 0,
            rejected_count=0 if approved else 1,
            last_used_at=datetime.utcnow()
        )
        db.add(history)
