"""
Matching Service

Handles the data matching workflow:
1. Search tables in catalog for a variable
2. Calculate relevance score
3. Select best match (one table per variable)
4. Coordinate owner approval workflow
"""

import hashlib
from datetime import datetime
from typing import List, Optional, Tuple
from sqlalchemy import select, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.data_catalog import (
    DataTable, 
    VariableMatch, 
    ApprovalHistory, 
    MatchStatus,
    VariableSearchStatus
)
from app.models.case import CaseVariable, Case
from app.models.collaborator import Collaborator
from app.models.notification import Notification, NotificationType, NotificationPriority


class MatchingError(Exception):
    """Custom exception for matching operations"""
    pass


class MatchingService:
    """Service for matching case variables to data tables"""
    
    # Score weights
    WEIGHT_SEMANTIC = 0.40
    WEIGHT_HISTORY = 0.30
    WEIGHT_KEYWORD = 0.20
    WEIGHT_DOMAIN = 0.10
    
    # Minimum score to consider a match
    MIN_MATCH_SCORE = 0.3
    
    @staticmethod
    def generate_concept_hash(variable_name: str, variable_type: str) -> str:
        """Generate a hash for concept-based caching"""
        normalized = f"{variable_name.lower().strip()}:{variable_type.lower()}"
        return hashlib.sha256(normalized.encode()).hexdigest()[:32]
    
    @classmethod
    async def search_matches(
        cls,
        db: AsyncSession,
        variable_id: int,
        max_results: int = 5
    ) -> List[VariableMatch]:
        """
        Search for matching tables for a variable.
        Creates VariableMatch records for found matches.
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
        concept_hash = cls.generate_concept_hash(variable.variable_name, variable.variable_type)
        
        for table in all_tables:
            score, reason = await cls._calculate_score(
                db, variable, table, case, concept_hash
            )
            if score >= cls.MIN_MATCH_SCORE:
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
    
    @classmethod
    async def _calculate_score(
        cls,
        db: AsyncSession,
        variable: CaseVariable,
        table: DataTable,
        case: Case,
        concept_hash: str
    ) -> Tuple[float, str]:
        """Calculate matching score between variable and table"""
        scores = []
        reasons = []
        
        # 1. Semantic similarity (name/description matching)
        semantic_score = cls._calculate_semantic_similarity(
            variable.variable_name,
            variable.concept or "",
            table.name,
            table.description or "",
            table.display_name
        )
        scores.append(semantic_score * cls.WEIGHT_SEMANTIC)
        if semantic_score > 0.5:
            reasons.append(f"Nome similar ({int(semantic_score*100)}%)")
        
        # 2. Historical approval rate
        history_score = await cls._get_approval_rate(db, concept_hash, table.id)
        scores.append(history_score * cls.WEIGHT_HISTORY)
        if history_score > 0.5:
            reasons.append(f"Histórico positivo ({int(history_score*100)}%)")
        
        # 3. Keyword matching
        keyword_score = cls._calculate_keyword_match(
            variable.variable_name,
            table.keywords or []
        )
        scores.append(keyword_score * cls.WEIGHT_KEYWORD)
        if keyword_score > 0.5:
            reasons.append("Keywords compatíveis")
        
        # 4. Domain matching
        domain_score = 0.5  # Neutral default
        if case and hasattr(case, 'macro_case') and case.macro_case:
            if table.domain and table.domain.lower() in case.macro_case.lower():
                domain_score = 1.0
                reasons.append("Mesmo domínio")
        scores.append(domain_score * cls.WEIGHT_DOMAIN)
        
        total_score = sum(scores)
        reason_text = "; ".join(reasons) if reasons else "Match baseado em análise geral"
        
        return total_score, reason_text
    
    @staticmethod
    def _calculate_semantic_similarity(
        var_name: str,
        var_concept: str,
        table_name: str,
        table_desc: str,
        table_display: str
    ) -> float:
        """Calculate semantic similarity using word overlap"""
        # Normalize and tokenize
        var_words = set((var_name + " " + var_concept).lower().split())
        table_words = set((table_name + " " + table_desc + " " + table_display).lower().split())
        
        # Remove common stopwords
        stopwords = {'de', 'da', 'do', 'e', 'para', 'com', 'em', 'a', 'o', 'os', 'as', 'um', 'uma'}
        var_words -= stopwords
        table_words -= stopwords
        
        if not var_words or not table_words:
            return 0.0
        
        # Jaccard similarity
        intersection = len(var_words & table_words)
        union = len(var_words | table_words)
        
        return intersection / union if union > 0 else 0.0
    
    @staticmethod
    async def _get_approval_rate(
        db: AsyncSession,
        concept_hash: str,
        table_id: int
    ) -> float:
        """Get historical approval rate for concept+table combination"""
        result = await db.execute(
            select(ApprovalHistory).where(
                ApprovalHistory.concept_hash == concept_hash,
                ApprovalHistory.data_table_id == table_id
            )
        )
        history = result.scalars().first()
        
        if not history:
            return 0.5  # Neutral if no history
        
        return history.approval_rate
    
    @staticmethod
    def _calculate_keyword_match(var_name: str, table_keywords: List[str]) -> float:
        """Calculate keyword match score"""
        if not table_keywords:
            return 0.0
        
        var_name_lower = var_name.lower()
        matches = sum(1 for kw in table_keywords if kw.lower() in var_name_lower or var_name_lower in kw.lower())
        
        return min(1.0, matches / max(1, len(table_keywords)))
    
    @classmethod
    async def select_best_match(
        cls,
        db: AsyncSession,
        variable_id: int,
        match_id: int,
        selected_by_id: int
    ) -> VariableMatch:
        """
        Select a match as the final choice for a variable.
        Notifies the table owner for validation.
        """
        # Get the match
        result = await db.execute(
            select(VariableMatch)
            .where(VariableMatch.id == match_id)
            .where(VariableMatch.case_variable_id == variable_id)
        )
        match = result.scalars().first()
        
        if not match:
            raise MatchingError("Match not found")
        
        # Mark as selected
        match.is_selected = True
        match.selected_at = datetime.utcnow()
        match.selected_by_id = selected_by_id
        match.status = MatchStatus.PENDING_OWNER
        
        # Deselect other matches for same variable
        await db.execute(
            select(VariableMatch)
            .where(VariableMatch.case_variable_id == variable_id)
            .where(VariableMatch.id != match_id)
        )
        
        # Update variable status
        result = await db.execute(
            select(CaseVariable).where(CaseVariable.id == variable_id)
        )
        variable = result.scalars().first()
        variable.search_status = VariableSearchStatus.OWNER_REVIEW.value
        variable.selected_match_id = match_id
        
        # Get table for owner notification
        result = await db.execute(
            select(DataTable).where(DataTable.id == match.data_table_id)
        )
        table = result.scalars().first()
        
        # Create notification for owner
        if table and table.owner_id:
            notification = Notification(
                collaborator_id=table.owner_id,
                type=NotificationType.OWNER_VALIDATION_REQUEST,
                priority=NotificationPriority.HIGH,
                title="Solicitação de Validação de Dados",
                message=f"A variável '{variable.variable_name}' foi associada à tabela '{table.display_name}'. Valide se esta associação é apropriada.",
                data={
                    "match_id": match_id,
                    "variable_id": variable_id,
                    "table_id": table.id
                }
            )
            db.add(notification)
        
        await db.commit()
        return match
    
    @classmethod
    async def owner_approve(
        cls,
        db: AsyncSession,
        match_id: int,
        owner_id: int
    ) -> VariableMatch:
        """Owner approves the matched table"""
        result = await db.execute(
            select(VariableMatch).where(VariableMatch.id == match_id)
        )
        match = result.scalars().first()
        
        if not match:
            raise MatchingError("Match not found")
        
        if match.status != MatchStatus.PENDING_OWNER:
            raise MatchingError("Match is not pending owner approval")
        
        # Approve
        match.approve(owner_id)
        
        # Update variable status
        result = await db.execute(
            select(CaseVariable).where(CaseVariable.id == match.case_variable_id)
        )
        variable = result.scalars().first()
        variable.search_status = VariableSearchStatus.APPROVED.value
        
        # Update approval history
        await cls._update_approval_history(
            db, variable, match.data_table_id, approved=True
        )
        
        # Notify requester
        result = await db.execute(
            select(Case).where(Case.id == variable.case_id)
        )
        case = result.scalars().first()
        
        if case and case.created_by:
            result = await db.execute(
                select(DataTable).where(DataTable.id == match.data_table_id)
            )
            table = result.scalars().first()
            
            notification = Notification(
                collaborator_id=case.created_by,
                type=NotificationType.VARIABLE_APPROVED,
                priority=NotificationPriority.NORMAL,
                title="Variável Aprovada",
                message=f"A variável '{variable.variable_name}' foi aprovada e associada à tabela '{table.display_name}'.",
                data={
                    "match_id": match_id,
                    "variable_id": variable.id,
                    "case_id": case.id
                }
            )
            db.add(notification)
        
        await db.commit()
        return match
    
    @classmethod
    async def owner_reject(
        cls,
        db: AsyncSession,
        match_id: int,
        owner_id: int,
        reason: str = None
    ) -> VariableMatch:
        """Owner rejects the matched table"""
        result = await db.execute(
            select(VariableMatch).where(VariableMatch.id == match_id)
        )
        match = result.scalars().first()
        
        if not match:
            raise MatchingError("Match not found")
        
        # Reject
        match.reject(owner_id, reason)
        match.is_selected = False
        
        # Update approval history
        result = await db.execute(
            select(CaseVariable).where(CaseVariable.id == match.case_variable_id)
        )
        variable = result.scalars().first()
        
        await cls._update_approval_history(
            db, variable, match.data_table_id, approved=False
        )
        
        # Check if there are other matches to try
        result = await db.execute(
            select(VariableMatch).where(
                VariableMatch.case_variable_id == match.case_variable_id,
                VariableMatch.status == MatchStatus.SUGGESTED
            ).order_by(VariableMatch.score.desc())
        )
        next_match = result.scalars().first()
        
        if next_match:
            # Update variable to show it needs new selection
            variable.search_status = VariableSearchStatus.MATCHED.value
            variable.selected_match_id = None
        else:
            # No more options
            variable.search_status = VariableSearchStatus.NO_MATCH.value
            variable.selected_match_id = None
        
        await db.commit()
        return match
    
    @classmethod
    async def _update_approval_history(
        cls,
        db: AsyncSession,
        variable: CaseVariable,
        table_id: int,
        approved: bool
    ):
        """Update approval history for future matching"""
        concept_hash = cls.generate_concept_hash(
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
            if approved:
                history.approved_count += 1
            else:
                history.rejected_count += 1
            history.last_used_at = datetime.utcnow()
        else:
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
    
    @classmethod
    async def get_case_progress(
        cls,
        db: AsyncSession,
        case_id: int
    ) -> dict:
        """Get matching progress for all variables in a case"""
        result = await db.execute(
            select(CaseVariable).where(CaseVariable.case_id == case_id)
        )
        variables = result.scalars().all()
        
        total = len(variables)
        if total == 0:
            return {
                "total": 0,
                "pending": 0,
                "searching": 0,
                "matched": 0,
                "owner_review": 0,
                "approved": 0,
                "no_match": 0,
                "progress_percent": 0
            }
        
        status_counts = {
            "PENDING": 0,
            "SEARCHING": 0,
            "MATCHED": 0,
            "OWNER_REVIEW": 0,
            "APPROVED": 0,
            "NO_MATCH": 0
        }
        
        for var in variables:
            status = var.search_status or "PENDING"
            if status in status_counts:
                status_counts[status] += 1
        
        # Progress = approved / total * 100
        progress = (status_counts["APPROVED"] / total) * 100 if total > 0 else 0
        
        return {
            "total": total,
            "pending": status_counts["PENDING"],
            "searching": status_counts["SEARCHING"],
            "matched": status_counts["MATCHED"],
            "owner_review": status_counts["OWNER_REVIEW"],
            "approved": status_counts["APPROVED"],
            "no_match": status_counts["NO_MATCH"],
            "progress_percent": round(progress, 1)
        }
