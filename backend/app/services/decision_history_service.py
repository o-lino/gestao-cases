"""
Decision History Service

Records all workflow decisions for AI training purposes.
Provides methods to log decisions and export training data.
"""

from datetime import datetime
from typing import Dict, List, Optional, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload

from app.models.decision_history import DecisionHistory, DecisionType, DecisionOutcome
from app.models.case import CaseVariable, Case
from app.models.data_catalog import VariableMatch, DataTable
from app.models.collaborator import Collaborator


class DecisionHistoryService:
    """Service for recording and querying decision history"""
    
    @classmethod
    async def record_decision(
        cls,
        db: AsyncSession,
        case_id: int,
        variable_id: int,
        decision_type: DecisionType,
        outcome: DecisionOutcome,
        actor_id: int,
        actor_role: str,
        match_id: Optional[int] = None,
        decision_reason: Optional[str] = None,
        decision_details: Optional[Dict] = None,
        previous_status: Optional[str] = None,
        new_status: Optional[str] = None,
        owner_response_id: Optional[int] = None,
        requester_response_id: Optional[int] = None,
        loop_count: int = 0
    ) -> DecisionHistory:
        """
        Record a decision in the workflow.
        Automatically captures context for AI training.
        """
        # Gather context
        variable_context = await cls._get_variable_context(db, variable_id)
        table_context = None
        match_context = None
        
        if match_id:
            table_context, match_context = await cls._get_match_context(db, match_id)
        
        # Create decision record
        decision = DecisionHistory(
            case_id=case_id,
            variable_id=variable_id,
            match_id=match_id,
            decision_type=decision_type,
            outcome=outcome,
            actor_id=actor_id,
            actor_role=actor_role,
            variable_context=variable_context,
            table_context=table_context,
            match_context=match_context,
            decision_reason=decision_reason,
            decision_details=decision_details,
            previous_status=previous_status,
            new_status=new_status,
            owner_response_id=owner_response_id,
            requester_response_id=requester_response_id,
            loop_count=loop_count
        )
        
        db.add(decision)
        await db.flush()
        
        return decision
    
    @classmethod
    async def _get_variable_context(cls, db: AsyncSession, variable_id: int) -> Dict:
        """Extract variable context for AI training"""
        result = await db.execute(
            select(CaseVariable)
            .where(CaseVariable.id == variable_id)
        )
        variable = result.scalars().first()
        
        if not variable:
            return {}
        
        return {
            "variable_name": variable.variable_name,
            "variable_type": variable.variable_type,
            "concept": getattr(variable, 'concept', None),
            "desired_lag": getattr(variable, 'desired_lag', None),
            "search_status": variable.search_status,
            "is_cancelled": getattr(variable, 'is_cancelled', False)
        }
    
    @classmethod
    async def _get_match_context(cls, db: AsyncSession, match_id: int) -> tuple:
        """Extract match and table context for AI training"""
        result = await db.execute(
            select(VariableMatch)
            .options(selectinload(VariableMatch.data_table).selectinload(DataTable.owner))
            .where(VariableMatch.id == match_id)
        )
        match = result.scalars().first()
        
        if not match:
            return {}, {}
        
        table = match.data_table
        table_context = {}
        if table:
            table_context = {
                "table_id": table.id,
                "table_name": table.name,
                "display_name": table.display_name,
                "domain": table.domain,
                "description": table.description,
                "owner_id": table.owner_id,
                "owner_name": table.owner.name if table.owner else None
            }
        
        match_context = {
            "match_id": match.id,
            "score": match.score,
            "justification": match.justification,
            "status": match.status.value if hasattr(match.status, 'value') else str(match.status),
            "is_selected": match.is_selected
        }
        
        return table_context, match_context
    
    @classmethod
    async def get_variable_decision_history(
        cls,
        db: AsyncSession,
        variable_id: int
    ) -> List[DecisionHistory]:
        """Get all decisions for a variable, ordered chronologically"""
        result = await db.execute(
            select(DecisionHistory)
            .options(selectinload(DecisionHistory.actor))
            .where(DecisionHistory.variable_id == variable_id)
            .order_by(DecisionHistory.created_at.asc())
        )
        return result.scalars().all()
    
    @classmethod
    async def get_case_decision_history(
        cls,
        db: AsyncSession,
        case_id: int
    ) -> List[DecisionHistory]:
        """Get all decisions for a case, ordered chronologically"""
        result = await db.execute(
            select(DecisionHistory)
            .options(
                selectinload(DecisionHistory.actor),
                selectinload(DecisionHistory.variable)
            )
            .where(DecisionHistory.case_id == case_id)
            .order_by(DecisionHistory.created_at.asc())
        )
        return result.scalars().all()
    
    @classmethod
    async def export_training_data(
        cls,
        db: AsyncSession,
        decision_types: Optional[List[DecisionType]] = None,
        outcome: Optional[DecisionOutcome] = None,
        limit: int = 10000,
        offset: int = 0
    ) -> List[Dict]:
        """
        Export decision history as training data for AI agent.
        
        Args:
            decision_types: Filter by specific decision types
            outcome: Filter by outcome (POSITIVE, NEGATIVE, NEUTRAL)
            limit: Max records to return
            offset: Pagination offset
        
        Returns:
            List of decisions in training-friendly format
        """
        query = select(DecisionHistory)
        
        conditions = []
        if decision_types:
            conditions.append(DecisionHistory.decision_type.in_(decision_types))
        if outcome:
            conditions.append(DecisionHistory.outcome == outcome)
        
        if conditions:
            query = query.where(and_(*conditions))
        
        query = query.order_by(DecisionHistory.created_at.desc())
        query = query.limit(limit).offset(offset)
        
        result = await db.execute(query)
        decisions = result.scalars().all()
        
        return [d.to_training_dict() for d in decisions]
    
    @classmethod
    async def get_decision_statistics(
        cls,
        db: AsyncSession,
        case_id: Optional[int] = None
    ) -> Dict:
        """Get statistics about decisions for analysis"""
        base_query = select(
            DecisionHistory.decision_type,
            DecisionHistory.outcome,
            func.count(DecisionHistory.id).label('count')
        )
        
        if case_id:
            base_query = base_query.where(DecisionHistory.case_id == case_id)
        
        base_query = base_query.group_by(
            DecisionHistory.decision_type,
            DecisionHistory.outcome
        )
        
        result = await db.execute(base_query)
        rows = result.all()
        
        stats = {
            'by_type': {},
            'by_outcome': {'POSITIVE': 0, 'NEGATIVE': 0, 'NEUTRAL': 0},
            'total': 0
        }
        
        for row in rows:
            type_key = row.decision_type.value if hasattr(row.decision_type, 'value') else str(row.decision_type)
            outcome_key = row.outcome.value if hasattr(row.outcome, 'value') else str(row.outcome)
            
            if type_key not in stats['by_type']:
                stats['by_type'][type_key] = {'POSITIVE': 0, 'NEGATIVE': 0, 'NEUTRAL': 0}
            
            stats['by_type'][type_key][outcome_key] = row.count
            stats['by_outcome'][outcome_key] += row.count
            stats['total'] += row.count
        
        return stats


decision_history_service = DecisionHistoryService()
