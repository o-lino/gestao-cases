"""
Curator Service

Service for curator operations - correcting table suggestions
made by the matching system.
"""

from datetime import datetime
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from app.models.case import CaseVariable
from app.models.data_catalog import DataTable, VariableMatch, MatchStatus, VariableSearchStatus
from app.models.suggestion_correction import SuggestionCorrection
from app.models.collaborator import Collaborator
from app.models.notification import Notification, NotificationType, NotificationPriority


class CuratorError(Exception):
    """Custom exception for curator operations"""
    pass


class CuratorService:
    """Service for curator operations on table suggestions"""
    
    @classmethod
    async def correct_table_suggestion(
        cls,
        db: AsyncSession,
        variable_id: int,
        new_table_id: int,
        curator_id: int,
        reason: str = None
    ) -> SuggestionCorrection:
        """
        Correct a table suggestion for a variable.
        
        This will:
        1. Record the correction in suggestion_corrections table
        2. Update the variable's selected match to the corrected table
        3. Update approval history for learning
        """
        # Get the variable
        result = await db.execute(
            select(CaseVariable).where(CaseVariable.id == variable_id)
        )
        variable = result.scalar_one_or_none()
        
        if not variable:
            raise CuratorError(f"Variable {variable_id} not found")
        
        # Get the new table
        result = await db.execute(
            select(DataTable).where(DataTable.id == new_table_id)
        )
        new_table = result.scalar_one_or_none()
        
        if not new_table:
            raise CuratorError(f"Table {new_table_id} not found")
        
        # Get current selected match (if any)
        original_table_id = None
        original_score = None
        was_approved = 0
        
        if variable.selected_match_id:
            result = await db.execute(
                select(VariableMatch).where(VariableMatch.id == variable.selected_match_id)
            )
            current_match = result.scalar_one_or_none()
            if current_match:
                original_table_id = current_match.data_table_id
                original_score = current_match.score
                was_approved = 1 if current_match.status == MatchStatus.APPROVED else 0
        
        # Create correction record
        correction = SuggestionCorrection(
            variable_id=variable_id,
            original_table_id=original_table_id,
            original_score=original_score,
            corrected_table_id=new_table_id,
            curator_id=curator_id,
            correction_reason=reason,
            was_original_approved=was_approved,
            created_at=datetime.utcnow()
        )
        db.add(correction)
        
        # Create or update match for the new table
        result = await db.execute(
            select(VariableMatch).where(
                VariableMatch.case_variable_id == variable_id,
                VariableMatch.data_table_id == new_table_id
            )
        )
        new_match = result.scalar_one_or_none()
        
        if not new_match:
            # Create new match
            new_match = VariableMatch(
                case_variable_id=variable_id,
                data_table_id=new_table_id,
                score=1.0,  # Manual correction = perfect score
                match_reason="Correção manual por curador",
                status=MatchStatus.SELECTED,
                is_selected=True,
                selected_at=datetime.utcnow(),
                selected_by_id=curator_id
            )
            db.add(new_match)
            await db.flush()
        else:
            # Update existing match
            new_match.is_selected = True
            new_match.selected_at = datetime.utcnow()
            new_match.selected_by_id = curator_id
            new_match.status = MatchStatus.SELECTED
        
        # Deselect old match if different
        if variable.selected_match_id and variable.selected_match_id != new_match.id:
            result = await db.execute(
                select(VariableMatch).where(VariableMatch.id == variable.selected_match_id)
            )
            old_match = result.scalar_one_or_none()
            if old_match:
                old_match.is_selected = False
                old_match.status = MatchStatus.SUGGESTED
        
        # Update variable
        variable.selected_match_id = new_match.id
        variable.search_status = VariableSearchStatus.OWNER_REVIEW.value
        
        # Notify table owner if exists
        if new_table.owner_id:
            new_match.status = MatchStatus.PENDING_OWNER
            notification = Notification(
                collaborator_id=new_table.owner_id,
                type=NotificationType.VARIABLE_NEEDS_REVIEW,
                priority=NotificationPriority.HIGH,
                title="Nova atribuição de tabela para revisão",
                message=f"A tabela '{new_table.display_name or new_table.name}' foi atribuída à variável '{variable.variable_name}' por um curador. Por favor, revise.",
                data={
                    "match_id": new_match.id,
                    "variable_id": variable_id,
                    "corrected_by_curator": True
                }
            )
            db.add(notification)
        
        await db.commit()
        await db.refresh(correction)
        
        return correction
    
    @classmethod
    async def get_correction_history(
        cls,
        db: AsyncSession,
        curator_id: int = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[SuggestionCorrection]:
        """Get history of corrections, optionally filtered by curator"""
        query = select(SuggestionCorrection).order_by(desc(SuggestionCorrection.created_at))
        
        if curator_id:
            query = query.where(SuggestionCorrection.curator_id == curator_id)
        
        query = query.limit(limit).offset(offset)
        
        result = await db.execute(query)
        return result.scalars().all()
    
    @classmethod
    async def get_correction_by_id(
        cls,
        db: AsyncSession,
        correction_id: int
    ) -> Optional[SuggestionCorrection]:
        """Get a specific correction by ID"""
        result = await db.execute(
            select(SuggestionCorrection).where(SuggestionCorrection.id == correction_id)
        )
        return result.scalar_one_or_none()
    
    @classmethod
    async def list_variables_for_review(
        cls,
        db: AsyncSession,
        status_filter: str = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[dict]:
        """
        List variables that have matches and could benefit from curator review.
        Returns variables with their current match information.
        """
        # Get variables that have matches
        query = select(CaseVariable).where(
            CaseVariable.search_status.in_([
                VariableSearchStatus.MATCHED.value,
                VariableSearchStatus.OWNER_REVIEW.value,
                VariableSearchStatus.APPROVED.value
            ])
        )
        
        if status_filter:
            query = query.where(CaseVariable.search_status == status_filter)
        
        query = query.order_by(CaseVariable.id.desc()).limit(limit).offset(offset)
        
        result = await db.execute(query)
        variables = result.scalars().all()
        
        # Enrich with match information
        variable_details = []
        for var in variables:
            # Get matches for this variable
            matches_result = await db.execute(
                select(VariableMatch)
                .where(VariableMatch.case_variable_id == var.id)
                .options(selectinload(VariableMatch.data_table))
            )
            matches = matches_result.scalars().all()
            
            selected_match = None
            for m in matches:
                if m.is_selected:
                    selected_match = m
                    break
            
            variable_details.append({
                "id": var.id,
                "variable_name": var.variable_name,
                "variable_type": var.variable_type,
                "concept": var.concept,
                "case_id": var.case_id,
                "search_status": var.search_status,
                "match_count": len(matches),
                "selected_table": {
                    "id": selected_match.data_table.id,
                    "name": selected_match.data_table.name,
                    "display_name": selected_match.data_table.display_name,
                    "score": selected_match.score,
                    "status": selected_match.status.value if hasattr(selected_match.status, 'value') else selected_match.status
                } if selected_match and selected_match.data_table else None,
                "other_matches": [
                    {
                        "id": m.data_table.id,
                        "name": m.data_table.name,
                        "display_name": m.data_table.display_name,
                        "score": m.score
                    }
                    for m in matches if not m.is_selected and m.data_table
                ][:5]  # Limit additional matches shown
            })
        
        return variable_details
    
    @classmethod
    async def get_curator_stats(
        cls,
        db: AsyncSession,
        curator_id: int
    ) -> dict:
        """Get statistics for a curator's corrections"""
        result = await db.execute(
            select(SuggestionCorrection).where(SuggestionCorrection.curator_id == curator_id)
        )
        corrections = result.scalars().all()
        
        return {
            "total_corrections": len(corrections),
            "corrections_this_month": sum(
                1 for c in corrections 
                if c.created_at and c.created_at.month == datetime.utcnow().month
            ),
            "corrected_approved": sum(1 for c in corrections if c.was_original_approved == 1),
            "corrected_before_approval": sum(1 for c in corrections if c.was_original_approved == 0)
        }
