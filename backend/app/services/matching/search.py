"""
Matching Service - Search Module

Handles searching for matching tables for variables.
"""

from datetime import datetime
from typing import List, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.data_catalog import DataTable, VariableMatch, MatchStatus, VariableSearchStatus
from app.models.case import CaseVariable, Case
from app.services.matching.scoring import (
    MIN_MATCH_SCORE,
    generate_concept_hash,
    calculate_match_score,
)


class MatchingError(Exception):
    """Custom exception for matching operations"""
    pass


async def search_matches(
    db: AsyncSession,
    variable_id: int,
    max_results: int = 5
) -> List[VariableMatch]:
    """
    Search for matching tables for a variable.
    Creates VariableMatch records for found matches.
    
    Args:
        db: Database session
        variable_id: ID of the variable to find matches for
        max_results: Maximum number of matches to return
        
    Returns:
        List of created VariableMatch records
        
    Raises:
        MatchingError: If variable not found
    """
    # Get the variable
    result = await db.execute(
        select(CaseVariable).where(CaseVariable.id == variable_id)
    )
    variable = result.scalars().first()
    
    if not variable:
        raise MatchingError(f"Variable {variable_id} not found")
    
    # Update search status
    variable.search_status = VariableSearchStatus.SEARCHING.value
    variable.search_started_at = datetime.utcnow()
    await db.commit()
    
    # Get the case for context
    result = await db.execute(
        select(Case).where(Case.id == variable.case_id)
    )
    case = result.scalars().first()
    
    # Get all active tables
    result = await db.execute(
        select(DataTable).where(DataTable.is_active == True)
    )
    all_tables = result.scalars().all()
    
    if not all_tables:
        variable.search_status = VariableSearchStatus.NO_MATCH.value
        variable.search_completed_at = datetime.utcnow()
        await db.commit()
        return []
    
    # Calculate scores for each table
    scored_tables: List[Tuple[DataTable, float, str]] = []
    
    for table in all_tables:
        score, reason = await calculate_match_score(
            db=db,
            variable_name=variable.variable_name,
            variable_type=variable.variable_type,
            variable_concept=variable.concept or "",
            table=table,
            case_macro=case.macro_case if case else None
        )
        if score >= MIN_MATCH_SCORE:
            scored_tables.append((table, score, reason))
    
    # Sort by score descending
    scored_tables.sort(key=lambda x: x[1], reverse=True)
    
    # Take top results
    top_matches = scored_tables[:max_results]
    
    # Create VariableMatch records
    matches = []
    for table, score, reason in top_matches:
        # Check if match already exists
        existing = await db.execute(
            select(VariableMatch).where(
                VariableMatch.case_variable_id == variable_id,
                VariableMatch.data_table_id == table.id
            )
        )
        if existing.scalars().first():
            continue
            
        match = VariableMatch(
            case_variable_id=variable_id,
            data_table_id=table.id,
            score=score,
            match_reason=reason,
            status=MatchStatus.SUGGESTED
        )
        db.add(match)
        matches.append(match)
    
    # Update variable status
    if matches:
        variable.search_status = VariableSearchStatus.MATCHED.value
    else:
        variable.search_status = VariableSearchStatus.NO_MATCH.value
    
    variable.search_completed_at = datetime.utcnow()
    await db.commit()
    
    return matches


async def get_matches_for_variable(
    db: AsyncSession,
    variable_id: int
) -> List[VariableMatch]:
    """Get all matches for a variable with table details"""
    result = await db.execute(
        select(VariableMatch)
        .where(VariableMatch.case_variable_id == variable_id)
        .order_by(VariableMatch.score.desc())
    )
    return result.scalars().all()
