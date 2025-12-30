"""
Standalone tests for Agent Decision models
These tests don't require database or app configuration
"""

import sys
import os

# Add the app directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from datetime import datetime, timedelta
from app.models.agent_decision import (
    DecisionContext, AgentDecision, DecisionConsensus,
    DecisionType, DecisionStatus, ConsensusStatus
)


def test_context_hash_deterministic():
    """Same context data should produce same hash"""
    context_type = "variable_matching"
    context_data = {"domain": "vendas", "concept": "faturamento"}
    
    hash1 = DecisionContext.generate_hash(context_type, context_data)
    hash2 = DecisionContext.generate_hash(context_type, context_data)
    
    assert hash1 == hash2, "Hash should be deterministic"
    assert len(hash1) == 64, "Should be SHA256 hex digest (64 chars)"
    print("✓ test_context_hash_deterministic passed")


def test_context_hash_different_data():
    """Different context data should produce different hash"""
    context_type = "variable_matching"
    
    hash1 = DecisionContext.generate_hash(context_type, {"domain": "vendas"})
    hash2 = DecisionContext.generate_hash(context_type, {"domain": "clientes"})
    
    assert hash1 != hash2, "Different data should produce different hashes"
    print("✓ test_context_hash_different_data passed")


def test_context_hash_order_independent():
    """Key order should not affect hash"""
    context_type = "test"
    
    hash1 = DecisionContext.generate_hash(context_type, {"a": 1, "b": 2})
    hash2 = DecisionContext.generate_hash(context_type, {"b": 2, "a": 1})
    
    assert hash1 == hash2, "Key order should not affect hash"
    print("✓ test_context_hash_order_independent passed")


def test_context_approval_rate_no_decisions():
    """Approval rate should be 0.5 (neutral) with no decisions"""
    context = DecisionContext(
        context_hash="test",
        context_type="test",
        context_data={},
        total_decisions=0,
        approved_decisions=0
    )
    
    assert context.approval_rate == 0.5, "Should be neutral (0.5) with no history"
    print("✓ test_context_approval_rate_no_decisions passed")


def test_context_approval_rate_with_history():
    """Approval rate should be calculated correctly"""
    context = DecisionContext(
        context_hash="test",
        context_type="test",
        context_data={},
        total_decisions=10,
        approved_decisions=7
    )
    
    assert context.approval_rate == 0.7, f"Expected 0.7, got {context.approval_rate}"
    print("✓ test_context_approval_rate_with_history passed")


def test_decision_is_reusable_approved_high_confidence():
    """Approved decision with high confidence should be reusable"""
    decision = AgentDecision(
        agent_id="test",
        decision_type=DecisionType.VARIABLE_MATCH,
        decision_value={},
        confidence_score=0.8,
        status=DecisionStatus.APPROVED
    )
    
    assert decision.is_reusable is True, "Approved with 0.8 confidence should be reusable"
    print("✓ test_decision_is_reusable_approved_high_confidence passed")


def test_decision_not_reusable_pending():
    """Pending decision should not be reusable"""
    decision = AgentDecision(
        agent_id="test",
        decision_type=DecisionType.VARIABLE_MATCH,
        decision_value={},
        confidence_score=0.9,
        status=DecisionStatus.PENDING
    )
    
    assert decision.is_reusable is False, "Pending should not be reusable"
    print("✓ test_decision_not_reusable_pending passed")


def test_decision_not_reusable_low_confidence():
    """Low confidence approved decision should not be reusable"""
    decision = AgentDecision(
        agent_id="test",
        decision_type=DecisionType.VARIABLE_MATCH,
        decision_value={},
        confidence_score=0.5,
        status=DecisionStatus.APPROVED
    )
    
    assert decision.is_reusable is False, "Low confidence should not be reusable"
    print("✓ test_decision_not_reusable_low_confidence passed")


def test_consensus_total_votes():
    """Total votes should be sum of approvals and rejections"""
    consensus = DecisionConsensus(
        voting_deadline=datetime.utcnow() + timedelta(days=3),
        approval_votes=2,
        rejection_votes=1
    )
    
    assert consensus.total_votes == 3, f"Expected 3, got {consensus.total_votes}"
    print("✓ test_consensus_total_votes passed")


def test_consensus_quorum_not_reached():
    """Quorum not reached with insufficient votes"""
    consensus = DecisionConsensus(
        voting_deadline=datetime.utcnow() + timedelta(days=3),
        required_approvals=2,
        approval_votes=1,
        rejection_votes=0
    )
    
    assert consensus.has_quorum is False, "Should not have quorum with 1 vote"
    print("✓ test_consensus_quorum_not_reached passed")


def test_consensus_quorum_reached():
    """Quorum reached with sufficient votes"""
    consensus = DecisionConsensus(
        voting_deadline=datetime.utcnow() + timedelta(days=3),
        required_approvals=2,
        approval_votes=1,
        rejection_votes=1
    )
    
    assert consensus.has_quorum is True, "Should have quorum with 2 votes"
    print("✓ test_consensus_quorum_reached passed")


def test_consensus_is_active():
    """Consensus is active when voting and before deadline"""
    consensus = DecisionConsensus(
        voting_deadline=datetime.utcnow() + timedelta(days=3),
        status=ConsensusStatus.VOTING
    )
    
    assert consensus.is_active is True, "Should be active during voting period"
    print("✓ test_consensus_is_active passed")


def test_consensus_not_active_after_deadline():
    """Consensus is not active after deadline"""
    consensus = DecisionConsensus(
        voting_deadline=datetime.utcnow() - timedelta(days=1),
        status=ConsensusStatus.VOTING
    )
    
    assert consensus.is_active is False, "Should not be active after deadline"
    print("✓ test_consensus_not_active_after_deadline passed")


def test_decision_types():
    """All decision types should be valid"""
    types = [
        DecisionType.VARIABLE_MATCH,
        DecisionType.CASE_CLASSIFICATION,
        DecisionType.RISK_ASSESSMENT,
        DecisionType.RECOMMENDATION,
        DecisionType.APPROVAL
    ]
    
    for t in types:
        assert t.value is not None, f"Type {t} should have a value"
    
    print("✓ test_decision_types passed")


def run_all_tests():
    """Run all tests and report results"""
    print("\n" + "="*60)
    print("Running Agent Decision Model Tests")
    print("="*60 + "\n")
    
    tests = [
        test_context_hash_deterministic,
        test_context_hash_different_data,
        test_context_hash_order_independent,
        test_context_approval_rate_no_decisions,
        test_context_approval_rate_with_history,
        test_decision_is_reusable_approved_high_confidence,
        test_decision_not_reusable_pending,
        test_decision_not_reusable_low_confidence,
        test_consensus_total_votes,
        test_consensus_quorum_not_reached,
        test_consensus_quorum_reached,
        test_consensus_is_active,
        test_consensus_not_active_after_deadline,
        test_decision_types,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            test()
            passed += 1
        except AssertionError as e:
            print(f"✗ {test.__name__} FAILED: {e}")
            failed += 1
        except Exception as e:
            print(f"✗ {test.__name__} ERROR: {e}")
            failed += 1
    
    print("\n" + "="*60)
    print(f"Results: {passed} passed, {failed} failed")
    print("="*60)
    
    return failed == 0


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
