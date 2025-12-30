"""
Tests for Agent Decision Service

Tests the core logic for:
- Recording decisions
- Finding reusable decisions
- Consensus voting
- Statistics
"""

import pytest
import pytest_asyncio
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent_decision import (
    AgentDecision, DecisionContext, DecisionConsensus, ConsensusVote,
    DecisionType, DecisionStatus, ConsensusStatus,
    MIN_DECISIONS_FOR_REUSE, MIN_APPROVAL_RATE, HIGH_CONFIDENCE_THRESHOLD
)
from app.services.agent_decision_service import AgentDecisionService, AgentDecisionError


class TestDecisionContext:
    """Tests for DecisionContext model"""
    
    def test_generate_hash_deterministic(self):
        """Same context data should produce same hash"""
        context_type = "variable_matching"
        context_data = {"domain": "vendas", "concept": "faturamento"}
        
        hash1 = DecisionContext.generate_hash(context_type, context_data)
        hash2 = DecisionContext.generate_hash(context_type, context_data)
        
        assert hash1 == hash2
        assert len(hash1) == 64  # SHA256 hex digest
    
    def test_generate_hash_different_data(self):
        """Different context data should produce different hash"""
        context_type = "variable_matching"
        
        hash1 = DecisionContext.generate_hash(context_type, {"domain": "vendas"})
        hash2 = DecisionContext.generate_hash(context_type, {"domain": "clientes"})
        
        assert hash1 != hash2
    
    def test_generate_hash_order_independent(self):
        """Key order should not affect hash"""
        context_type = "test"
        
        hash1 = DecisionContext.generate_hash(context_type, {"a": 1, "b": 2})
        hash2 = DecisionContext.generate_hash(context_type, {"b": 2, "a": 1})
        
        assert hash1 == hash2
    
    def test_approval_rate_no_decisions(self):
        """Approval rate should be 0.5 (neutral) with no decisions"""
        context = DecisionContext(
            context_hash="test",
            context_type="test",
            context_data={},
            total_decisions=0,
            approved_decisions=0
        )
        
        assert context.approval_rate == 0.5
    
    def test_approval_rate_with_decisions(self):
        """Approval rate should be calculated correctly"""
        context = DecisionContext(
            context_hash="test",
            context_type="test",
            context_data={},
            total_decisions=10,
            approved_decisions=7
        )
        
        assert context.approval_rate == 0.7


class TestAgentDecision:
    """Tests for AgentDecision model"""
    
    def test_is_reusable_approved_high_confidence(self):
        """Approved decision with high confidence should be reusable"""
        decision = AgentDecision(
            agent_id="test",
            decision_type=DecisionType.VARIABLE_MATCH,
            decision_value={},
            confidence_score=0.8,
            status=DecisionStatus.APPROVED
        )
        
        assert decision.is_reusable is True
    
    def test_is_reusable_not_approved(self):
        """Non-approved decision should not be reusable"""
        decision = AgentDecision(
            agent_id="test",
            decision_type=DecisionType.VARIABLE_MATCH,
            decision_value={},
            confidence_score=0.9,
            status=DecisionStatus.PENDING
        )
        
        assert decision.is_reusable is False
    
    def test_is_reusable_low_confidence(self):
        """Low confidence decision should not be reusable"""
        decision = AgentDecision(
            agent_id="test",
            decision_type=DecisionType.VARIABLE_MATCH,
            decision_value={},
            confidence_score=0.5,
            status=DecisionStatus.APPROVED
        )
        
        assert decision.is_reusable is False


class TestDecisionConsensus:
    """Tests for DecisionConsensus model"""
    
    def test_total_votes(self):
        """Total votes should be sum of approvals and rejections"""
        consensus = DecisionConsensus(
            voting_deadline=datetime.utcnow() + timedelta(days=3),
            approval_votes=2,
            rejection_votes=1
        )
        
        assert consensus.total_votes == 3
    
    def test_has_quorum_not_reached(self):
        """Quorum not reached with insufficient votes"""
        consensus = DecisionConsensus(
            voting_deadline=datetime.utcnow() + timedelta(days=3),
            required_approvals=2,
            approval_votes=1,
            rejection_votes=0
        )
        
        assert consensus.has_quorum is False
    
    def test_has_quorum_reached(self):
        """Quorum reached with sufficient votes"""
        consensus = DecisionConsensus(
            voting_deadline=datetime.utcnow() + timedelta(days=3),
            required_approvals=2,
            approval_votes=1,
            rejection_votes=1
        )
        
        assert consensus.has_quorum is True
    
    def test_is_active_voting(self):
        """Consensus is active when voting and before deadline"""
        consensus = DecisionConsensus(
            voting_deadline=datetime.utcnow() + timedelta(days=3),
            status=ConsensusStatus.VOTING
        )
        
        assert consensus.is_active is True
    
    def test_is_active_expired(self):
        """Consensus is not active after deadline"""
        consensus = DecisionConsensus(
            voting_deadline=datetime.utcnow() - timedelta(days=1),
            status=ConsensusStatus.VOTING
        )
        
        assert consensus.is_active is False


@pytest.mark.asyncio
class TestAgentDecisionService:
    """Tests for AgentDecisionService"""
    
    async def test_record_decision_high_confidence_auto_approve(self, db: AsyncSession):
        """High confidence decision should be auto-approved"""
        decision = await AgentDecisionService.record_decision(
            db=db,
            agent_id="test-agent",
            decision_type=DecisionType.VARIABLE_MATCH,
            context_type="variable_matching",
            context_data={"domain": "vendas", "concept": "faturamento"},
            decision_value={"matched_table_id": 123},
            confidence_score=0.90,  # Above HIGH_CONFIDENCE_THRESHOLD
            reasoning="High confidence match"
        )
        
        assert decision.id is not None
        assert decision.status == DecisionStatus.APPROVED
        assert decision.is_reused is False
    
    async def test_record_decision_low_confidence_consensus(self, db: AsyncSession):
        """Low confidence decision should require consensus"""
        decision = await AgentDecisionService.record_decision(
            db=db,
            agent_id="test-agent",
            decision_type=DecisionType.VARIABLE_MATCH,
            context_type="variable_matching",
            context_data={"domain": "vendas", "concept": "receita"},
            decision_value={"matched_table_id": 456},
            confidence_score=0.60,  # Below threshold
            reasoning="Low confidence match"
        )
        
        assert decision.id is not None
        assert decision.status == DecisionStatus.CONSENSUS_REQUIRED
        assert decision.is_reused is False
    
    async def test_find_reusable_decision_no_history(self, db: AsyncSession):
        """No reusable decision when context has no history"""
        result = await AgentDecisionService.find_reusable_decision(
            db=db,
            context_type="variable_matching",
            context_data={"domain": "novo", "concept": "teste"}
        )
        
        assert result is None
    
    async def test_get_or_create_context_creates_new(self, db: AsyncSession):
        """Should create new context if not exists"""
        context = await AgentDecisionService.get_or_create_context(
            db=db,
            context_type="test_type",
            context_data={"key": "value"}
        )
        
        assert context.id is not None
        assert context.context_type == "test_type"
        assert context.total_decisions == 0
    
    async def test_get_or_create_context_returns_existing(self, db: AsyncSession):
        """Should return existing context if hash matches"""
        context_data = {"key": "reuse_test"}
        
        context1 = await AgentDecisionService.get_or_create_context(
            db=db,
            context_type="test_type",
            context_data=context_data
        )
        
        context2 = await AgentDecisionService.get_or_create_context(
            db=db,
            context_type="test_type",
            context_data=context_data
        )
        
        assert context1.id == context2.id
    
    async def test_get_decision_statistics_empty(self, db: AsyncSession):
        """Statistics should work with no decisions"""
        stats = await AgentDecisionService.get_decision_statistics(db=db)
        
        assert stats["total_decisions"] == 0
        assert stats["reused_count"] == 0
        assert stats["reuse_rate"] == 0.0
    
    async def test_vote_on_decision_not_found(self, db: AsyncSession):
        """Should raise error for non-existent decision"""
        with pytest.raises(AgentDecisionError, match="not found"):
            await AgentDecisionService.vote_on_decision(
                db=db,
                decision_id=99999,
                voter_id=1,
                approve=True
            )


@pytest.mark.asyncio
class TestAgentDecisionServiceIntegration:
    """Integration tests for complete workflows"""
    
    async def test_consensus_workflow(self, db: AsyncSession):
        """Test complete consensus workflow: create -> vote -> resolve"""
        # 1. Create decision requiring consensus
        decision = await AgentDecisionService.record_decision(
            db=db,
            agent_id="test-agent",
            decision_type=DecisionType.CASE_CLASSIFICATION,
            context_type="classification",
            context_data={"domain": "test"},
            decision_value={"category": "A"},
            confidence_score=0.50,
            require_consensus=True  # Force consensus
        )
        
        assert decision.status == DecisionStatus.CONSENSUS_REQUIRED
        
        # 2. Get pending decisions
        pending = await AgentDecisionService.get_pending_decisions(db=db)
        assert len(pending) >= 1
        assert any(d.id == decision.id for d in pending)
        
        # 3. First vote (approve)
        consensus = await AgentDecisionService.vote_on_decision(
            db=db,
            decision_id=decision.id,
            voter_id=1,
            approve=True,
            comment="Looks good"
        )
        
        assert consensus.approval_votes == 1
        assert consensus.status == ConsensusStatus.VOTING  # Not yet resolved
        
        # 4. Create second user and vote
        from app.models.collaborator import Collaborator
        user2 = Collaborator(id=2, email="user2@example.com", name="User 2", role="MANAGER")
        db.add(user2)
        await db.commit()
        
        consensus = await AgentDecisionService.vote_on_decision(
            db=db,
            decision_id=decision.id,
            voter_id=2,
            approve=True,
            comment="Agree"
        )
        
        # 5. Verify consensus resolved
        assert consensus.approval_votes == 2
        assert consensus.status == ConsensusStatus.APPROVED
        
        # 6. Verify decision status updated
        updated_decision = await AgentDecisionService.get_decision_by_id(db, decision.id)
        assert updated_decision.status == DecisionStatus.APPROVED
    
    async def test_reuse_workflow(self, db: AsyncSession):
        """Test decision reuse workflow"""
        context_data = {"domain": "reuse_test", "concept": "demo"}
        
        # 1. Create context with enough history for reuse
        context = await AgentDecisionService.get_or_create_context(
            db=db,
            context_type="reuse_test",
            context_data=context_data
        )
        
        # Manually set history to enable reuse
        context.total_decisions = 5
        context.approved_decisions = 4  # 80% approval rate
        await db.commit()
        
        # 2. Create an approved decision
        original = await AgentDecisionService.record_decision(
            db=db,
            agent_id="original-agent",
            decision_type=DecisionType.RECOMMENDATION,
            context_type="reuse_test",
            context_data=context_data,
            decision_value={"recommendation": "use_table_X"},
            confidence_score=0.85,
            require_consensus=False
        )
        
        # Ensure it's approved
        original.status = DecisionStatus.APPROVED
        await db.commit()
        
        # 3. Try to find reusable decision
        reusable = await AgentDecisionService.find_reusable_decision(
            db=db,
            context_type="reuse_test",
            context_data=context_data
        )
        
        assert reusable is not None
        assert reusable.id == original.id
        assert reusable.decision_value == {"recommendation": "use_table_X"}
