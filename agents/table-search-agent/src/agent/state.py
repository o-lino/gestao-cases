"""
LangGraph State Definition

Defines the typed state that flows through the agent workflow.
Uses TypedDict for LangGraph compatibility and Pydantic for data models.
"""

from typing import TypedDict, Optional, Annotated
from pydantic import BaseModel, Field
from enum import Enum
import operator


class ConfidenceLevel(str, Enum):
    """Confidence level for recommendations."""
    HIGH = "HIGH"           # >= 0.90 - Auto-select
    MEDIUM = "MEDIUM"       # >= 0.70 - Suggest with explanation
    LOW = "LOW"             # < 0.70 - Multiple options, human validation


class TableCandidate(BaseModel):
    """A candidate table from the catalog."""
    id: int
    name: str
    display_name: str
    description: Optional[str] = None
    domain: Optional[str] = None
    schema_name: Optional[str] = None
    keywords: list[str] = Field(default_factory=list)
    columns: list[dict] = Field(default_factory=list)
    owner_id: Optional[int] = None
    owner_name: Optional[str] = None
    
    class Config:
        frozen = True


class TableScore(BaseModel):
    """Scoring breakdown for a table candidate."""
    table_id: int
    total_score: float
    semantic_score: float = 0.0
    historical_score: float = 0.0
    keyword_score: float = 0.0
    domain_score: float = 0.0
    freshness_score: float = 0.0
    owner_trust_score: float = 0.0
    
    class Config:
        frozen = True


class HistoricalDecision(BaseModel):
    """Historical decision for learning."""
    concept_hash: str
    table_id: int
    approved_count: int = 0
    rejected_count: int = 0
    last_used_at: Optional[str] = None
    
    @property
    def approval_rate(self) -> float:
        total = self.approved_count + self.rejected_count
        return self.approved_count / total if total > 0 else 0.5
    
    class Config:
        frozen = True


class TableRecommendation(BaseModel):
    """A table recommendation with full context."""
    table: TableCandidate
    score: TableScore
    rank: int
    reasoning: str
    confidence_level: ConfidenceLevel
    match_reason: str
    matched_column: Optional[str] = None


class TableSearchState(TypedDict):
    """
    LangGraph state for table search workflow.
    
    The state flows through nodes:
    START → analyze_context → retrieve_tables → calculate_scores → 
    → make_decision → record_history → END
    """
    # Request ID for tracking
    request_id: str
    
    # Input context from request
    variable_name: str
    variable_type: str
    concept: Optional[str]
    domain: Optional[str]
    product: Optional[str]
    case_context: Optional[str]
    case_id: Optional[int]
    variable_id: Optional[int]
    max_results: int
    
    # Extracted context (from analyze_context node)
    normalized_name: Annotated[str, operator.add]
    extracted_keywords: Annotated[list[str], operator.add]
    domain_hints: Annotated[list[str], operator.add]
    embedding_query: str
    concept_hash: str
    
    # Retrieved data (from retrieve_tables node)
    candidate_tables: list[TableCandidate]
    historical_decisions: list[HistoricalDecision]
    
    # Computed scores (from calculate_scores node)
    scores: dict[int, TableScore]
    
    # Output (from make_decision node)
    recommendations: list[TableRecommendation]
    top_recommendation: Optional[TableRecommendation]
    overall_confidence: float
    overall_reasoning: str
    confidence_level: ConfidenceLevel
    
    # Control flow
    current_step: str
    iteration: int
    max_iterations: int
    needs_more_context: bool
    error_message: Optional[str]


def create_initial_state(
    request_id: str,
    variable_name: str,
    variable_type: str,
    concept: Optional[str] = None,
    domain: Optional[str] = None,
    product: Optional[str] = None,
    case_context: Optional[str] = None,
    case_id: Optional[int] = None,
    variable_id: Optional[int] = None,
    max_results: int = 5
) -> TableSearchState:
    """Create initial state for a new search request."""
    return TableSearchState(
        # Request
        request_id=request_id,
        
        # Input
        variable_name=variable_name,
        variable_type=variable_type,
        concept=concept,
        domain=domain,
        product=product,
        case_context=case_context,
        case_id=case_id,
        variable_id=variable_id,
        max_results=max_results,
        
        # Extracted (to be filled)
        normalized_name="",
        extracted_keywords=[],
        domain_hints=[],
        embedding_query="",
        concept_hash="",
        
        # Retrieved (to be filled)
        candidate_tables=[],
        historical_decisions=[],
        
        # Scores (to be filled)
        scores={},
        
        # Output (to be filled)
        recommendations=[],
        top_recommendation=None,
        overall_confidence=0.0,
        overall_reasoning="",
        confidence_level=ConfidenceLevel.LOW,
        
        # Control
        current_step="start",
        iteration=0,
        max_iterations=3,
        needs_more_context=False,
        error_message=None,
    )
