"""
Agent Decision Service

Handles:
- Recording agent decisions
- Finding reusable decisions for similar contexts
- Managing consensus voting
- Updating decision statistics
"""

from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload

from app.models.agent_decision import (
    AgentDecision, DecisionContext, DecisionConsensus, ConsensusVote,
    DecisionType, DecisionStatus, ConsensusStatus,
    MIN_APPROVAL_RATE, MIN_DECISIONS_FOR_REUSE, HIGH_CONFIDENCE_THRESHOLD,
    CONSENSUS_VOTING_DAYS, DEFAULT_REQUIRED_APPROVALS
)
from app.models.notification import NotificationType, NotificationPriority
from app.services.notification_service import NotificationService


class AgentDecisionError(Exception):
    """Custom exception for agent decision errors"""
    pass


class AgentDecisionService:
    """Service for managing agent decisions and consensus"""
    
    @classmethod
    async def find_reusable_decision(
        cls,
        db: AsyncSession,
        context_type: str,
        context_data: Dict[str, Any]
    ) -> Optional[AgentDecision]:
        """
        Find a reusable decision for a similar context.
        Returns the best matching approved decision if available.
        """
        # Generate context hash
        context_hash = DecisionContext.generate_hash(context_type, context_data)
        
        # Look for existing context
        context_result = await db.execute(
            select(DecisionContext)
            .where(DecisionContext.context_hash == context_hash)
        )
        context = context_result.scalar_one_or_none()
        
        if not context:
            return None
        
        # Check if context has enough history for auto-reuse
        if context.total_decisions < MIN_DECISIONS_FOR_REUSE:
            return None
        
        if context.approval_rate < MIN_APPROVAL_RATE:
            return None
        
        # Find best approved decision for this context
        decision_result = await db.execute(
            select(AgentDecision)
            .where(
                and_(
                    AgentDecision.context_id == context.id,
                    AgentDecision.status == DecisionStatus.APPROVED,
                    AgentDecision.confidence_score >= 0.7
                )
            )
            .order_by(AgentDecision.confidence_score.desc())
            .limit(1)
        )
        
        return decision_result.scalar_one_or_none()
    
    @classmethod
    async def get_or_create_context(
        cls,
        db: AsyncSession,
        context_type: str,
        context_data: Dict[str, Any]
    ) -> DecisionContext:
        """Get existing context or create a new one"""
        context_hash = DecisionContext.generate_hash(context_type, context_data)
        
        context_result = await db.execute(
            select(DecisionContext)
            .where(DecisionContext.context_hash == context_hash)
        )
        context = context_result.scalar_one_or_none()
        
        if not context:
            # Extract key fields for easier querying
            context = DecisionContext(
                context_hash=context_hash,
                context_type=context_type,
                context_data=context_data,
                domain=context_data.get("domain"),
                entity_type=context_data.get("entity_type"),
                concept=context_data.get("concept")
            )
            db.add(context)
            await db.flush()
        
        return context
    
    @classmethod
    async def record_decision(
        cls,
        db: AsyncSession,
        agent_id: str,
        decision_type: DecisionType,
        context_type: str,
        context_data: Dict[str, Any],
        decision_value: Dict[str, Any],
        confidence_score: float,
        reasoning: str = None,
        related_case_id: int = None,
        related_variable_id: int = None,
        related_table_id: int = None,
        agent_version: str = None,
        require_consensus: bool = None
    ) -> AgentDecision:
        """
        Record a new agent decision.
        
        If require_consensus is None, decides based on confidence:
        - High confidence (>85%): Auto-approve
        - Low confidence or first occurrence: Require consensus
        """
        # Get or create context
        context = await cls.get_or_create_context(db, context_type, context_data)
        
        # Try to find reusable decision
        existing_decision = await cls.find_reusable_decision(db, context_type, context_data)
        
        is_reused = False
        source_decision_id = None
        final_decision_value = decision_value
        final_confidence = confidence_score
        
        if existing_decision:
            # Reuse existing decision
            is_reused = True
            source_decision_id = existing_decision.id
            final_decision_value = existing_decision.decision_value
            final_confidence = min(confidence_score, existing_decision.confidence_score)
            
            # Increment reuse count on source
            existing_decision.reuse_count += 1
        
        # Determine if consensus is required
        if require_consensus is None:
            require_consensus = (
                final_confidence < HIGH_CONFIDENCE_THRESHOLD and
                context.total_decisions < MIN_DECISIONS_FOR_REUSE
            )
        
        # Determine initial status
        status = DecisionStatus.PENDING
        if is_reused and existing_decision.status == DecisionStatus.APPROVED:
            status = DecisionStatus.APPROVED
        elif require_consensus:
            status = DecisionStatus.CONSENSUS_REQUIRED
        elif final_confidence >= HIGH_CONFIDENCE_THRESHOLD:
            status = DecisionStatus.APPROVED
        
        # Create decision record
        decision = AgentDecision(
            agent_id=agent_id,
            agent_version=agent_version,
            decision_type=decision_type,
            context_id=context.id,
            decision_value=final_decision_value,
            confidence_score=final_confidence,
            reasoning=reasoning,
            status=status,
            is_reused=is_reused,
            source_decision_id=source_decision_id,
            related_case_id=related_case_id,
            related_variable_id=related_variable_id,
            related_table_id=related_table_id
        )
        
        db.add(decision)
        await db.flush()
        
        # Update context statistics
        context.total_decisions += 1
        context.last_used_at = datetime.utcnow()
        
        if status == DecisionStatus.APPROVED:
            context.approved_decisions += 1
        
        # Create consensus if required
        if status == DecisionStatus.CONSENSUS_REQUIRED:
            consensus = DecisionConsensus(
                decision_id=decision.id,
                required_approvals=DEFAULT_REQUIRED_APPROVALS,
                voting_deadline=datetime.utcnow() + timedelta(days=CONSENSUS_VOTING_DAYS)
            )
            db.add(consensus)
            await db.flush()
            
            # Notify stakeholders (async, fire and forget)
            await cls._notify_consensus_required(db, decision)
        
        await db.commit()
        await db.refresh(decision)
        return decision
    
    @classmethod
    async def _notify_consensus_required(
        cls,
        db: AsyncSession,
        decision: AgentDecision
    ):
        """Notify stakeholders that a decision needs consensus"""
        # For now, we'll create notifications for admins/managers
        # In production, this would identify specific stakeholders
        from app.models.collaborator import Collaborator
        
        try:
            # Get all active managers/admins
            result = await db.execute(
                select(Collaborator)
                .where(
                    and_(
                        Collaborator.is_active == True,
                        Collaborator.role.in_(["ADMIN", "MANAGER"])
                    )
                )
            )
            stakeholders = result.scalars().all()
            
            notification_service = NotificationService()
            
            for stakeholder in stakeholders:
                await notification_service.create_notification(
                    db=db,
                    user_id=stakeholder.id,
                    notification_type=NotificationType.MATCH_REQUEST,  # Reusing existing type
                    title="Decisão de Agente Requer Validação",
                    message=f"Uma decisão do tipo '{decision.decision_type.value}' precisa de sua aprovação.",
                    priority=NotificationPriority.NORMAL,
                    data={
                        "decision_id": decision.id,
                        "decision_type": decision.decision_type.value,
                        "agent_id": decision.agent_id
                    }
                )
        except Exception as e:
            # Log but don't fail the main operation
            print(f"Warning: Failed to send consensus notifications: {e}")
    
    @classmethod
    async def vote_on_decision(
        cls,
        db: AsyncSession,
        decision_id: int,
        voter_id: int,
        approve: bool,
        comment: str = None
    ) -> DecisionConsensus:
        """Submit a vote for a decision requiring consensus"""
        
        # Get decision with consensus
        decision_result = await db.execute(
            select(AgentDecision)
            .options(selectinload(AgentDecision.consensus))
            .options(selectinload(AgentDecision.context))
            .where(AgentDecision.id == decision_id)
        )
        decision = decision_result.scalar_one_or_none()
        
        if not decision:
            raise AgentDecisionError(f"Decision {decision_id} not found")
        
        if decision.status != DecisionStatus.CONSENSUS_REQUIRED:
            raise AgentDecisionError("Decision does not require consensus")
        
        consensus = decision.consensus[0] if decision.consensus else None
        if not consensus:
            raise AgentDecisionError("Consensus record not found")
        
        if consensus.status != ConsensusStatus.VOTING:
            raise AgentDecisionError(f"Voting is {consensus.status.value}")
        
        if datetime.utcnow() > consensus.voting_deadline:
            raise AgentDecisionError("Voting period has ended")
        
        # Check if already voted
        existing_vote_result = await db.execute(
            select(ConsensusVote)
            .where(
                and_(
                    ConsensusVote.consensus_id == consensus.id,
                    ConsensusVote.voter_id == voter_id
                )
            )
        )
        if existing_vote_result.scalar_one_or_none():
            raise AgentDecisionError("Already voted on this decision")
        
        # Record vote
        vote = ConsensusVote(
            consensus_id=consensus.id,
            voter_id=voter_id,
            vote=approve,
            comment=comment
        )
        db.add(vote)
        
        # Update counts
        if approve:
            consensus.approval_votes += 1
        else:
            consensus.rejection_votes += 1
        
        # Check if consensus reached
        if consensus.has_quorum:
            if consensus.approval_votes > consensus.rejection_votes:
                consensus.status = ConsensusStatus.APPROVED
                decision.status = DecisionStatus.APPROVED
                decision.context.approved_decisions += 1
            else:
                consensus.status = ConsensusStatus.REJECTED
                decision.status = DecisionStatus.REJECTED
            
            consensus.resolved_at = datetime.utcnow()
            decision.validated_at = datetime.utcnow()
            decision.validated_by_id = voter_id  # Last voter that reached quorum
        
        await db.commit()
        await db.refresh(consensus)
        return consensus
    
    @classmethod
    async def get_pending_decisions(
        cls,
        db: AsyncSession,
        voter_id: int = None,
        decision_type: DecisionType = None
    ) -> List[AgentDecision]:
        """Get decisions pending consensus vote"""
        
        query = (
            select(AgentDecision)
            .options(selectinload(AgentDecision.consensus))
            .options(selectinload(AgentDecision.context))
            .where(AgentDecision.status == DecisionStatus.CONSENSUS_REQUIRED)
            .order_by(AgentDecision.created_at.desc())
        )
        
        if decision_type:
            query = query.where(AgentDecision.decision_type == decision_type)
        
        result = await db.execute(query)
        decisions = result.scalars().all()
        
        # Filter out already voted if voter_id provided
        if voter_id:
            # Get consensus IDs the voter has already voted on
            vote_result = await db.execute(
                select(ConsensusVote.consensus_id)
                .where(ConsensusVote.voter_id == voter_id)
            )
            voted_consensus_ids = {r for r in vote_result.scalars().all()}
            
            decisions = [
                d for d in decisions 
                if d.consensus and d.consensus[0].id not in voted_consensus_ids
            ]
        
        return list(decisions)
    
    @classmethod
    async def get_decision_by_id(
        cls,
        db: AsyncSession,
        decision_id: int
    ) -> Optional[AgentDecision]:
        """Get a decision by ID with related data"""
        result = await db.execute(
            select(AgentDecision)
            .options(selectinload(AgentDecision.consensus))
            .options(selectinload(AgentDecision.context))
            .where(AgentDecision.id == decision_id)
        )
        return result.scalar_one_or_none()
    
    @classmethod
    async def get_decisions_by_context(
        cls,
        db: AsyncSession,
        context_type: str,
        context_data: Dict[str, Any] = None,
        status: DecisionStatus = None,
        limit: int = 10
    ) -> List[AgentDecision]:
        """Get decisions for a context type, optionally filtered"""
        
        query = (
            select(AgentDecision)
            .join(DecisionContext)
            .where(DecisionContext.context_type == context_type)
        )
        
        if context_data:
            context_hash = DecisionContext.generate_hash(context_type, context_data)
            query = query.where(DecisionContext.context_hash == context_hash)
        
        if status:
            query = query.where(AgentDecision.status == status)
        
        query = query.order_by(AgentDecision.created_at.desc()).limit(limit)
        
        result = await db.execute(query)
        return list(result.scalars().all())
    
    @classmethod
    async def get_decision_statistics(
        cls,
        db: AsyncSession,
        context_type: str = None,
        agent_id: str = None
    ) -> Dict[str, Any]:
        """Get statistics about agent decisions"""
        
        # Build base conditions
        conditions = []
        if context_type:
            conditions.append(DecisionContext.context_type == context_type)
        if agent_id:
            conditions.append(AgentDecision.agent_id == agent_id)
        
        # Total count and status breakdown
        if conditions:
            base_query = (
                select(AgentDecision.status, func.count(AgentDecision.id))
                .join(DecisionContext)
                .where(and_(*conditions))
                .group_by(AgentDecision.status)
            )
        else:
            base_query = (
                select(AgentDecision.status, func.count(AgentDecision.id))
                .group_by(AgentDecision.status)
            )
        
        result = await db.execute(base_query)
        status_counts = {row[0].value: row[1] for row in result.all()}
        
        total_decisions = sum(status_counts.values())
        
        # Count reused decisions
        reused_conditions = conditions + [AgentDecision.is_reused == True]
        if context_type:
            reused_query = (
                select(func.count(AgentDecision.id))
                .join(DecisionContext)
                .where(and_(*reused_conditions))
            )
        else:
            reused_query = (
                select(func.count(AgentDecision.id))
                .where(AgentDecision.is_reused == True)
            )
            if agent_id:
                reused_query = reused_query.where(AgentDecision.agent_id == agent_id)
        
        reused_result = await db.execute(reused_query)
        reused_count = reused_result.scalar() or 0
        
        # Average confidence
        if conditions:
            confidence_query = (
                select(func.avg(AgentDecision.confidence_score))
                .join(DecisionContext)
                .where(and_(*conditions))
            )
        else:
            confidence_query = select(func.avg(AgentDecision.confidence_score))
        
        confidence_result = await db.execute(confidence_query)
        avg_confidence = confidence_result.scalar() or 0
        
        return {
            "total_decisions": total_decisions,
            "status_counts": status_counts,
            "reused_count": reused_count,
            "average_confidence": round(float(avg_confidence), 3),
            "reuse_rate": round(reused_count / max(total_decisions, 1), 3)
        }
    
    @classmethod
    async def expire_pending_votes(cls, db: AsyncSession) -> int:
        """
        Mark expired consensus votes as EXPIRED.
        Returns number of consensus records expired.
        Called by scheduled task.
        """
        now = datetime.utcnow()
        
        # Find expired voting periods
        result = await db.execute(
            select(DecisionConsensus)
            .options(selectinload(DecisionConsensus.decision))
            .where(
                and_(
                    DecisionConsensus.status == ConsensusStatus.VOTING,
                    DecisionConsensus.voting_deadline < now
                )
            )
        )
        expired_consensus = result.scalars().all()
        
        count = 0
        for consensus in expired_consensus:
            consensus.status = ConsensusStatus.EXPIRED
            consensus.resolved_at = now
            
            # Also update the decision status
            if consensus.decision:
                consensus.decision.status = DecisionStatus.REJECTED
            
            count += 1
        
        if count > 0:
            await db.commit()
        
        return count


# Singleton instance
agent_decision_service = AgentDecisionService()
