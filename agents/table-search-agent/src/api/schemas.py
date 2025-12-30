"""
API Schemas

Pydantic models for API request/response validation.
"""

from typing import Optional
from pydantic import BaseModel, Field
from enum import Enum


class ConfidenceLevelResponse(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


# ============== Search Endpoint ==============

class TableSearchRequest(BaseModel):
    """Request for table search."""
    variable_name: str = Field(..., description="Name of the variable to search for")
    variable_type: str = Field(default="unknown", description="Type of the variable")
    concept: Optional[str] = Field(None, description="Variable concept/description")
    domain: Optional[str] = Field(None, description="Data domain (e.g., vendas, clientes)")
    product: Optional[str] = Field(None, description="Related product")
    case_context: Optional[str] = Field(None, description="Case context/description")
    case_id: Optional[int] = Field(None, description="Case ID for tracking")
    variable_id: Optional[int] = Field(None, description="Variable ID for tracking")
    max_results: int = Field(default=5, ge=1, le=20, description="Maximum results to return")


class TableScoreResponse(BaseModel):
    """Score breakdown for a table."""
    total_score: float
    semantic_score: float
    historical_score: float
    keyword_score: float
    domain_score: float
    freshness_score: float
    owner_trust_score: float


class TableCandidateResponse(BaseModel):
    """A table candidate in the response."""
    id: int
    name: str
    display_name: str
    description: Optional[str] = None
    domain: Optional[str] = None
    schema_name: Optional[str] = None
    keywords: list[str] = Field(default_factory=list)
    owner_id: Optional[int] = None
    owner_name: Optional[str] = None


class TableRecommendationResponse(BaseModel):
    """A table recommendation with full context."""
    table: TableCandidateResponse
    score: TableScoreResponse
    rank: int
    reasoning: str
    confidence_level: ConfidenceLevelResponse
    match_reason: str
    matched_column: Optional[str] = None


class TableSearchResponse(BaseModel):
    """Response for table search."""
    request_id: str
    recommendations: list[TableRecommendationResponse]
    top_recommendation: Optional[TableRecommendationResponse] = None
    overall_confidence: float
    confidence_level: ConfidenceLevelResponse
    overall_reasoning: str
    processing_time_ms: int


# ============== Feedback Endpoint ==============

class FeedbackOutcome(str, Enum):
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    MODIFIED = "MODIFIED"


class FeedbackRequest(BaseModel):
    """Request to record feedback on a recommendation."""
    request_id: str = Field(..., description="Original request ID")
    recommendation_table_id: int = Field(..., description="Table ID that was recommended")
    outcome: FeedbackOutcome = Field(..., description="Outcome of the recommendation")
    actual_table_id: Optional[int] = Field(None, description="Actual table used (if different)")
    reason: Optional[str] = Field(None, description="Reason for the outcome")
    actor_id: Optional[int] = Field(None, description="ID of the user providing feedback")


class FeedbackResponse(BaseModel):
    """Response for feedback recording."""
    success: bool
    message: str


# ============== Catalog Sync Endpoint ==============

class TableSyncData(BaseModel):
    """Data for syncing a table."""
    id: int
    name: str
    display_name: str
    description: Optional[str] = None
    domain: Optional[str] = None
    schema_name: Optional[str] = None
    database_name: Optional[str] = None
    full_path: Optional[str] = None
    keywords: list[str] = Field(default_factory=list)
    columns: list[dict] = Field(default_factory=list)
    owner_id: Optional[int] = None
    owner_name: Optional[str] = None
    is_active: bool = True
    is_sensitive: bool = False


class CatalogSyncRequest(BaseModel):
    """Request to sync table catalog."""
    tables: list[TableSyncData]
    source: str = Field(default="gestao-cases-2.0", description="Source system")


class CatalogSyncResponse(BaseModel):
    """Response for catalog sync."""
    success: bool
    tables_synced: int
    tables_failed: int
    message: str


# ============== Health Check ==============

class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    version: str
    components: dict[str, str]
