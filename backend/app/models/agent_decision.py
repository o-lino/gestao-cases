"""
Agent Decision Models

Models for tracking AI agent decisions and enabling reuse:
- AgentDecision: Individual decision made by an agent
- DecisionContext: Context that led to a decision (hashable for matching)
- DecisionConsensus: Collective validation of decisions
- ConsensusVote: Individual vote in a consensus decision
"""

from datetime import datetime
from enum import Enum
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, Boolean
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import relationship
import hashlib
import json

from app.db.base import Base


class DecisionType(str, Enum):
    """Types of decisions agents can make"""
    VARIABLE_MATCH = "VARIABLE_MATCH"  # Match variable to table
    CASE_CLASSIFICATION = "CASE_CLASSIFICATION"  # Classify case type
    RISK_ASSESSMENT = "RISK_ASSESSMENT"  # Assess risk level
    RECOMMENDATION = "RECOMMENDATION"  # General recommendation
    APPROVAL = "APPROVAL"  # Approve/reject something


class DecisionStatus(str, Enum):
    """Status of a decision"""
    PENDING = "PENDING"  # Awaiting validation
    CONSENSUS_REQUIRED = "CONSENSUS_REQUIRED"  # Needs collective approval
    APPROVED = "APPROVED"  # Validated and reusable
    REJECTED = "REJECTED"  # Rejected, not reusable


class ConsensusStatus(str, Enum):
    """Status of consensus voting"""
    VOTING = "VOTING"  # Votes being collected
    APPROVED = "APPROVED"  # Consensus reached - approved
    REJECTED = "REJECTED"  # Consensus reached - rejected
    EXPIRED = "EXPIRED"  # Voting period ended without quorum


# Thresholds for decision reuse
MIN_APPROVAL_RATE = 0.7  # 70% approval rate to auto-reuse
MIN_DECISIONS_FOR_REUSE = 3  # Minimum history before auto-reuse
HIGH_CONFIDENCE_THRESHOLD = 0.85  # Above this, skip consensus
CONSENSUS_VOTING_DAYS = 3  # Days to collect votes
DEFAULT_REQUIRED_APPROVALS = 2  # Minimum approvals needed for consensus


class DecisionContext(Base):
    """
    Context that led to a decision.
    Used for matching similar contexts to reuse decisions.
    """
    __tablename__ = "decision_contexts"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Context identification
    context_hash = Column(String(64), nullable=False, index=True, unique=True)
    context_type = Column(String(50), nullable=False, index=True)  # e.g., "variable_matching"
    
    # Serialized context data
    context_data = Column(JSON, nullable=False)  # Full context for reference
    
    # Normalized key fields for matching (extracted from context)
    domain = Column(String(100), nullable=True, index=True)
    entity_type = Column(String(100), nullable=True, index=True)
    concept = Column(String(255), nullable=True, index=True)
    
    # Statistics
    total_decisions = Column(Integer, default=0)
    approved_decisions = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    last_used_at = Column(DateTime, nullable=True)
    
    @staticmethod
    def generate_hash(context_type: str, context_data: dict) -> str:
        """Generate deterministic hash for context matching"""
        # Sort keys for deterministic hashing
        normalized = json.dumps(context_data, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(f"{context_type}:{normalized}".encode()).hexdigest()
    
    @property
    def approval_rate(self) -> float:
        """Calculate approval rate for this context"""
        if self.total_decisions == 0:
            return 0.5  # Neutral if no history
        return self.approved_decisions / self.total_decisions
    
    def __repr__(self):
        return f"<DecisionContext {self.context_type} hash={self.context_hash[:8]}...>"


class AgentDecision(Base):
    """
    Record of a decision made by an AI agent.
    Can be reused if similar context is encountered.
    """
    __tablename__ = "agent_decisions"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Agent identification
    agent_id = Column(String(100), nullable=False, index=True)  # Agent identifier
    agent_version = Column(String(50), nullable=True)  # Agent version for tracking
    
    # Decision type and context
    decision_type = Column(SQLEnum(DecisionType), nullable=False, index=True)
    context_id = Column(Integer, ForeignKey("decision_contexts.id"), nullable=False, index=True)
    context = relationship("DecisionContext", backref="decisions")
    
    # Decision details
    decision_value = Column(JSON, nullable=False)  # The actual decision
    confidence_score = Column(Float, default=0.0)  # Agent's confidence (0-1)
    reasoning = Column(Text, nullable=True)  # Explanation of decision
    
    # Status
    status = Column(SQLEnum(DecisionStatus), default=DecisionStatus.PENDING, index=True)
    
    # Validation
    validated_by_id = Column(Integer, ForeignKey("collaborators.id"), nullable=True)
    validated_by = relationship("Collaborator", foreign_keys=[validated_by_id], backref="validated_decisions")
    validated_at = Column(DateTime, nullable=True)
    
    # Related entities (polymorphic references)
    related_case_id = Column(Integer, ForeignKey("cases.id"), nullable=True)
    related_case = relationship("Case", backref="agent_decisions")
    related_variable_id = Column(Integer, ForeignKey("case_variables.id"), nullable=True)
    related_table_id = Column(Integer, ForeignKey("data_tables.id"), nullable=True)
    
    # Reuse tracking
    is_reused = Column(Boolean, default=False)  # Was this decision reused from history?
    source_decision_id = Column(Integer, ForeignKey("agent_decisions.id"), nullable=True)
    reuse_count = Column(Integer, default=0)  # How many times this was reused
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Self-referential relationship for decision reuse chain
    source_decision = relationship("AgentDecision", remote_side=[id], backref="derived_decisions")
    
    @property
    def is_reusable(self) -> bool:
        """Can this decision be reused for similar contexts?"""
        return self.status == DecisionStatus.APPROVED and self.confidence_score >= 0.7
    
    def __repr__(self):
        return f"<AgentDecision {self.id} type={self.decision_type.value} status={self.status.value}>"


class DecisionConsensus(Base):
    """
    Collective validation of a decision.
    Multiple stakeholders vote to approve/reject.
    """
    __tablename__ = "decision_consensus"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Link to decision
    decision_id = Column(Integer, ForeignKey("agent_decisions.id"), nullable=False, unique=True)
    decision = relationship("AgentDecision", backref="consensus")
    
    # Voting configuration
    required_approvals = Column(Integer, default=DEFAULT_REQUIRED_APPROVALS)
    voting_deadline = Column(DateTime, nullable=False)
    
    # Vote tracking
    approval_votes = Column(Integer, default=0)
    rejection_votes = Column(Integer, default=0)
    
    # Status
    status = Column(SQLEnum(ConsensusStatus), default=ConsensusStatus.VOTING, index=True)
    resolved_at = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    @property
    def total_votes(self) -> int:
        return self.approval_votes + self.rejection_votes
    
    @property
    def has_quorum(self) -> bool:
        return self.total_votes >= self.required_approvals
    
    @property
    def is_active(self) -> bool:
        return self.status == ConsensusStatus.VOTING and datetime.utcnow() < self.voting_deadline
    
    def __repr__(self):
        return f"<DecisionConsensus {self.id} status={self.status.value} votes={self.total_votes}>"


class ConsensusVote(Base):
    """Individual vote in a consensus decision"""
    __tablename__ = "consensus_votes"
    
    id = Column(Integer, primary_key=True, index=True)
    
    consensus_id = Column(Integer, ForeignKey("decision_consensus.id"), nullable=False, index=True)
    consensus = relationship("DecisionConsensus", backref="votes")
    
    voter_id = Column(Integer, ForeignKey("collaborators.id"), nullable=False, index=True)
    voter = relationship("Collaborator", backref="consensus_votes")
    
    vote = Column(Boolean, nullable=False)  # True = approve, False = reject
    comment = Column(Text, nullable=True)
    
    voted_at = Column(DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        vote_str = "approve" if self.vote else "reject"
        return f"<ConsensusVote {self.id} {vote_str} by voter={self.voter_id}>"
