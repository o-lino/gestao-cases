"""
V2 State Definitions

Hierarchical state with Domain → Owner → Table structure.
Supports multiple output modes and feedback-driven learning.
"""

from typing import TypedDict, Optional, Annotated, Literal
from pydantic import BaseModel, Field
from enum import Enum
import operator


# ============== Enums ==============

class ConfidenceLevel(str, Enum):
    HIGH = "HIGH"       # >= 0.85
    MEDIUM = "MEDIUM"   # >= 0.60
    LOW = "LOW"         # < 0.60


class DataExistence(str, Enum):
    EXISTS = "EXISTS"
    UNCERTAIN = "UNCERTAIN"
    NEEDS_CREATION = "NEEDS_CREATION"


class OutputMode(str, Enum):
    SINGLE = "SINGLE"       # 1 best match for system integration
    RANKING = "RANKING"     # Top 5 for chatbot
    DETAIL = "DETAIL"       # Full details for debugging


class UseCase(str, Enum):
    OPERATIONAL = "operational"   # Realtime, freshness priority
    ANALYTICAL = "analytical"     # Reports, quality priority
    REGULATORY = "regulatory"     # Compliance, consistency priority
    DEFAULT = "default"           # Balanced


# ============== Domain/Owner Models ==============

class DomainInfo(BaseModel):
    """Domain/área de negócio."""
    id: str
    name: str
    description: Optional[str] = None
    keywords: list[str] = Field(default_factory=list)
    chief_id: Optional[int] = None
    chief_name: Optional[str] = None
    
    class Config:
        frozen = True


class OwnerInfo(BaseModel):
    """Data owner/responsável."""
    id: int
    name: str
    email: Optional[str] = None
    domain_id: str
    domain_name: str
    tables_count: int = 0
    approval_rate: float = 0.5  # Historical approval rate
    
    class Config:
        frozen = True


class TableInfo(BaseModel):
    """Table metadata (summarized)."""
    id: int
    name: str
    display_name: str
    summary: str  # LLM-generated summary (50 words max)
    domain_id: str
    domain_name: str
    owner_id: int
    owner_name: str
    keywords: list[str] = Field(default_factory=list)
    granularity: Optional[str] = None  # diária, mensal, transação
    main_entities: list[str] = Field(default_factory=list)  # cliente, produto, etc
    
    # Certification & Quality (new)
    data_layer: Optional[Literal["SoR", "SoT", "Spec"]] = None
    is_golden_source: bool = False
    is_visao_cliente: bool = False
    update_frequency: Optional[str] = None  # realtime, daily, weekly, monthly
    inferred_product: Optional[str] = None
    
    class Config:
        frozen = True


# ============== Search Results ==============

class DomainMatch(BaseModel):
    """Domain match with score."""
    domain: DomainInfo
    score: float
    reasoning: str


class OwnerMatch(BaseModel):
    """Owner match with score."""
    owner: OwnerInfo
    score: float
    reasoning: str


class TableMatch(BaseModel):
    """Table match with full scoring breakdown."""
    table: TableInfo
    score: float
    semantic_score: float = 0.0
    historical_score: float = 0.0
    context_score: float = 0.0
    
    # Disambiguation scores (new)
    certification_score: float = 0.0
    freshness_score: float = 0.0
    quality_score: float = 0.0
    
    reasoning: str
    matched_entities: list[str] = Field(default_factory=list)
    is_double_certified: bool = False
    has_product_match: bool = False


# ============== Canonical Intent ==============

class CanonicalIntent(BaseModel):
    """
    Normalized intent from user query.
    Maps varied inputs to canonical form.
    """
    # Core need
    data_need: str  # What data is being requested
    data_type: Optional[str] = None  # currency, count, text, etc
    
    # Context extracted
    target_entity: Optional[str] = None  # cliente, produto, transação
    target_segment: Optional[str] = None  # varejo, corporate, PF, PJ
    target_product: Optional[str] = None  # consignado, imobiliário
    target_audience: Optional[str] = None  # público específico
    
    # Temporal
    granularity: Optional[str] = None  # diária, mensal, anual
    time_reference: Optional[str] = None  # últimos 12 meses, YTD
    
    # Inferred domain
    inferred_domains: list[str] = Field(default_factory=list)
    
    # Original query preserved
    original_query: str = ""
    
    # Confidence in intent extraction
    extraction_confidence: float = 0.0


# ============== Final Output Models ==============

class SingleMatchOutput(BaseModel):
    """Output for system integration (1 best match)."""
    # Always present: Domain + Owner
    domain: DomainInfo
    owner: OwnerInfo
    
    # Optional: Table (may not exist)
    table: Optional[TableInfo] = None
    
    # Scores
    domain_confidence: float
    owner_confidence: float
    table_confidence: Optional[float] = None
    
    # Status
    data_existence: DataExistence
    
    # Action hint
    action: Literal["USE_TABLE", "CONFIRM_WITH_OWNER", "CREATE_INVOLVEMENT"]
    reasoning: str


class RankingOutput(BaseModel):
    """Output for chatbot (top 5 options)."""
    # Top domain matches
    domains: list[DomainMatch]
    
    # Top owner matches
    owners: list[OwnerMatch]
    
    # Top table matches
    tables: list[TableMatch]
    
    # Overall summary for user
    summary: str
    
    # Suggested question if uncertain
    clarifying_question: Optional[str] = None


# ============== Main State ==============

class TableSearchStateV2(TypedDict):
    """
    LangGraph state for V2 agent.
    
    Flow:
    START → normalize_intent → search_domains → search_owners → 
    → search_tables → decide → record_feedback → END
    """
    # Request
    request_id: str
    output_mode: OutputMode
    
    # Raw input
    raw_query: str
    variable_name: Optional[str]
    variable_type: Optional[str]
    context: dict  # produto, segmento, público, etc
    
    # Normalized intent (from LLM)
    canonical_intent: Optional[CanonicalIntent]
    
    # Search results (hierarchical)
    matched_domains: list[DomainMatch]
    matched_owners: list[OwnerMatch]
    matched_tables: list[TableMatch]
    
    # Final decision
    best_domain: Optional[DomainInfo]
    best_owner: Optional[OwnerInfo]
    best_table: Optional[TableInfo]
    data_existence: DataExistence
    overall_confidence: float
    
    # Output (depends on mode)
    single_output: Optional[SingleMatchOutput]
    ranking_output: Optional[RankingOutput]
    
    # Control
    current_step: str
    error_message: Optional[str]


def create_initial_state_v2(
    request_id: str,
    raw_query: str,
    output_mode: OutputMode = OutputMode.SINGLE,
    variable_name: Optional[str] = None,
    variable_type: Optional[str] = None,
    context: Optional[dict] = None,
) -> TableSearchStateV2:
    """Create initial state for V2 agent."""
    return TableSearchStateV2(
        request_id=request_id,
        output_mode=output_mode,
        raw_query=raw_query,
        variable_name=variable_name,
        variable_type=variable_type,
        context=context or {},
        canonical_intent=None,
        matched_domains=[],
        matched_owners=[],
        matched_tables=[],
        best_domain=None,
        best_owner=None,
        best_table=None,
        data_existence=DataExistence.UNCERTAIN,
        overall_confidence=0.0,
        single_output=None,
        ranking_output=None,
        current_step="start",
        error_message=None,
    )
