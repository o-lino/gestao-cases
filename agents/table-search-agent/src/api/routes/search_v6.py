"""
V6 Search Routes (Final)

API endpoints with all features:
- Column search
- LLM reranking
- Ambiguity detection
"""

import uuid
import time
from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel, Field

from src.agent.graph_v6 import get_agent_v6
from src.agent.state_v2 import (
    create_initial_state_v2,
    OutputMode,
    SingleMatchOutput,
    RankingOutput,
)


router = APIRouter(prefix="/v6/search", tags=["Search V6 (Final)"])


class SearchRequestV6(BaseModel):
    """V6 search request with all options."""
    raw_query: Optional[str] = None
    variable_name: Optional[str] = None
    variable_type: Optional[str] = None
    
    # Context
    produto: Optional[str] = None
    segmento: Optional[str] = None
    use_case: str = "default"
    
    # Search options
    search_mode: str = Field(default="auto", description="auto/table_only/column_only/hybrid")
    enable_rerank: bool = Field(default=True, description="Enable LLM reranking")


class ClarifyingOptionResponse(BaseModel):
    id: str
    label: str
    description: str
    table_id: Optional[int] = None


class AmbiguityResponse(BaseModel):
    type: str
    is_ambiguous: bool
    clarifying_question: Optional[str] = None
    options: list[ClarifyingOptionResponse] = Field(default_factory=list)
    provisional_table_id: Optional[int] = None


class ScoreBreakdown(BaseModel):
    total: float
    semantic: float
    historical: float
    certification: float
    freshness: float
    quality: float
    context: float


class TableResponseV6(BaseModel):
    id: int
    name: str
    display_name: str
    summary: str
    domain_name: str
    owner_name: str
    
    # Certifications
    data_layer: Optional[str] = None
    is_golden_source: bool = False
    is_visao_cliente: bool = False
    
    # Scores
    score: float
    score_breakdown: ScoreBreakdown
    
    # Flags
    is_double_certified: bool = False
    has_product_match: bool = False
    
    reasoning: str


class SingleMatchResponseV6(BaseModel):
    """V6 response - complete."""
    request_id: str
    
    # Domain/Owner
    domain_id: str
    domain_name: str
    owner_id: int
    owner_name: str
    
    # Table
    table: Optional[TableResponseV6] = None
    
    # Status
    data_exists: str
    action: str
    reasoning: str
    
    # V6: Full metadata
    ambiguity: AmbiguityResponse
    llm_reranked: bool
    
    processing_time_ms: int


class RankingResponseV6(BaseModel):
    """V6 ranking response."""
    request_id: str
    
    tables: list[TableResponseV6]
    
    summary: str
    clarifying_question: Optional[str] = None
    
    ambiguity: AmbiguityResponse
    llm_reranked: bool
    
    processing_time_ms: int


@router.post("/single", response_model=SingleMatchResponseV6)
async def search_single_v6(request: SearchRequestV6) -> SingleMatchResponseV6:
    """
    V6 Search - Full featured.
    
    Features:
    - Multi-dimensional scoring
    - Column search
    - LLM reranking (if enabled and scores are close)
    - Ambiguity detection
    - Historical learning
    """
    start_time = time.time()
    request_id = str(uuid.uuid4())[:8]
    
    context = {
        "use_case": request.use_case,
        "search_mode": request.search_mode,
        "skip_rerank": not request.enable_rerank,
    }
    if request.produto:
        context["produto"] = request.produto
    if request.segmento:
        context["segmento"] = request.segmento
    
    state = create_initial_state_v2(
        request_id=request_id,
        raw_query=request.raw_query or request.variable_name or "",
        output_mode=OutputMode.SINGLE,
        variable_name=request.variable_name,
        variable_type=request.variable_type,
        context=context,
    )
    
    agent = get_agent_v6()
    result = await agent.ainvoke(
        state,
        config={"configurable": {"thread_id": request_id}}
    )
    
    processing_time = int((time.time() - start_time) * 1000)
    output: SingleMatchOutput = result.get("single_output")
    ambiguity_data = result.get("ambiguity", {})
    llm_reranked = result.get("llm_reranked", False)
    
    ambiguity = AmbiguityResponse(
        type=ambiguity_data.get("type", "NONE"),
        is_ambiguous=ambiguity_data.get("is_ambiguous", False),
        clarifying_question=ambiguity_data.get("clarifying_question"),
        options=[
            ClarifyingOptionResponse(
                id=o.get("id", ""),
                label=o.get("label", ""),
                description=o.get("description", ""),
                table_id=o.get("table_id"),
            )
            for o in ambiguity_data.get("options", [])
        ],
        provisional_table_id=ambiguity_data.get("provisional_table_id"),
    )
    
    if output:
        table_resp = None
        if output.table:
            table_match = result.get("matched_tables", [{}])[0] if result.get("matched_tables") else None
            
            table_resp = TableResponseV6(
                id=output.table.id,
                name=output.table.name,
                display_name=output.table.display_name,
                summary=output.table.summary,
                domain_name=output.table.domain_name,
                owner_name=output.table.owner_name,
                data_layer=output.table.data_layer,
                is_golden_source=output.table.is_golden_source,
                is_visao_cliente=output.table.is_visao_cliente,
                score=output.table_confidence or 0,
                score_breakdown=ScoreBreakdown(
                    total=table_match.score if table_match else 0,
                    semantic=table_match.semantic_score if table_match else 0,
                    historical=table_match.historical_score if table_match else 0.5,
                    certification=table_match.certification_score if table_match else 0,
                    freshness=table_match.freshness_score if table_match else 0,
                    quality=table_match.quality_score if table_match else 0,
                    context=table_match.context_score if table_match else 0,
                ),
                is_double_certified=table_match.is_double_certified if table_match else False,
                has_product_match=table_match.has_product_match if table_match else False,
                reasoning=table_match.reasoning if table_match else "",
            )
        
        return SingleMatchResponseV6(
            request_id=request_id,
            domain_id=output.domain.id,
            domain_name=output.domain.name,
            owner_id=output.owner.id,
            owner_name=output.owner.name,
            table=table_resp,
            data_exists=output.data_existence.value,
            action=output.action,
            reasoning=output.reasoning,
            ambiguity=ambiguity,
            llm_reranked=llm_reranked,
            processing_time_ms=processing_time,
        )
    
    return SingleMatchResponseV6(
        request_id=request_id,
        domain_id="unknown",
        domain_name="Não identificado",
        owner_id=0,
        owner_name="Não identificado",
        table=None,
        data_exists="UNCERTAIN",
        action="CONFIRM_WITH_OWNER",
        reasoning="Não foi possível processar",
        ambiguity=ambiguity,
        llm_reranked=llm_reranked,
        processing_time_ms=processing_time,
    )


@router.post("/ranking", response_model=RankingResponseV6)
async def search_ranking_v6(request: SearchRequestV6) -> RankingResponseV6:
    """V6 Search with full ranking."""
    start_time = time.time()
    request_id = str(uuid.uuid4())[:8]
    
    context = {
        "use_case": request.use_case,
        "search_mode": request.search_mode,
        "skip_rerank": not request.enable_rerank,
    }
    if request.produto:
        context["produto"] = request.produto
    
    state = create_initial_state_v2(
        request_id=request_id,
        raw_query=request.raw_query or request.variable_name or "",
        output_mode=OutputMode.RANKING,
        variable_name=request.variable_name,
        context=context,
    )
    
    agent = get_agent_v6()
    result = await agent.ainvoke(
        state,
        config={"configurable": {"thread_id": request_id}}
    )
    
    processing_time = int((time.time() - start_time) * 1000)
    output: RankingOutput = result.get("ranking_output")
    ambiguity_data = result.get("ambiguity", {})
    llm_reranked = result.get("llm_reranked", False)
    
    ambiguity = AmbiguityResponse(
        type=ambiguity_data.get("type", "NONE"),
        is_ambiguous=ambiguity_data.get("is_ambiguous", False),
        clarifying_question=ambiguity_data.get("clarifying_question"),
        options=[
            ClarifyingOptionResponse(**o) for o in ambiguity_data.get("options", [])
        ],
        provisional_table_id=ambiguity_data.get("provisional_table_id"),
    )
    
    if output:
        tables = [
            TableResponseV6(
                id=t.table.id,
                name=t.table.name,
                display_name=t.table.display_name,
                summary=t.table.summary,
                domain_name=t.table.domain_name,
                owner_name=t.table.owner_name,
                data_layer=t.table.data_layer,
                is_golden_source=t.table.is_golden_source,
                is_visao_cliente=t.table.is_visao_cliente,
                score=t.score,
                score_breakdown=ScoreBreakdown(
                    total=t.score,
                    semantic=t.semantic_score,
                    historical=t.historical_score,
                    certification=t.certification_score,
                    freshness=t.freshness_score,
                    quality=t.quality_score,
                    context=t.context_score,
                ),
                is_double_certified=t.is_double_certified,
                has_product_match=t.has_product_match,
                reasoning=t.reasoning,
            )
            for t in output.tables
        ]
        
        return RankingResponseV6(
            request_id=request_id,
            tables=tables,
            summary=output.summary,
            clarifying_question=output.clarifying_question,
            ambiguity=ambiguity,
            llm_reranked=llm_reranked,
            processing_time_ms=processing_time,
        )
    
    return RankingResponseV6(
        request_id=request_id,
        tables=[],
        summary="Não foi possível processar",
        clarifying_question=None,
        ambiguity=ambiguity,
        llm_reranked=llm_reranked,
        processing_time_ms=processing_time,
    )
