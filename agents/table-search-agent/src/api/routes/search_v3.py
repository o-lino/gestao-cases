"""
V3 Search Routes

API endpoints for the V3 agent with disambiguation scoring.
Adds use_case parameter for context-aware ranking.
"""

import uuid
import time
from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel, Field

from src.agent.graph_v3 import get_agent_v3
from src.agent.state_v2 import (
    create_initial_state_v2,
    OutputMode,
    SingleMatchOutput,
    RankingOutput,
)


router = APIRouter(prefix="/v3/search", tags=["Search V3"])


# ============== Request Models ==============

class SearchRequestV3(BaseModel):
    """V3 search request with use_case support."""
    # Query
    raw_query: Optional[str] = Field(None, description="Natural language query")
    variable_name: Optional[str] = Field(None, description="Variable name")
    variable_type: Optional[str] = Field(None, description="Variable type")
    
    # Context
    produto: Optional[str] = Field(None, description="Produto específico")
    segmento: Optional[str] = Field(None, description="Segmento de negócio")
    publico: Optional[str] = Field(None, description="Público alvo")
    granularidade: Optional[str] = Field(None, description="Granularidade temporal")
    
    # Use case (affects scoring weights)
    use_case: str = Field(
        default="default",
        description="Use case: operational, analytical, regulatory, default"
    )
    
    # Output mode
    mode: str = Field(default="single", description="Output mode: single or ranking")


class ScoreBreakdownResponse(BaseModel):
    """Detailed score breakdown."""
    total: float
    semantic: float
    certification: float
    freshness: float
    quality: float
    context: float


class TableResponseV3(BaseModel):
    """Table response with full breakdown."""
    id: int
    name: str
    display_name: str
    summary: str
    domain_name: str
    owner_name: str
    
    # Certification info
    data_layer: Optional[str] = None
    is_golden_source: bool = False
    is_visao_cliente: bool = False
    
    # Scores
    score: float
    score_breakdown: ScoreBreakdownResponse
    reasoning: str
    
    # Flags
    is_double_certified: bool = False
    has_product_match: bool = False


class OwnerResponseV3(BaseModel):
    id: int
    name: str
    email: Optional[str] = None
    domain_name: str
    score: float
    reasoning: str


class DomainResponseV3(BaseModel):
    id: str
    name: str
    chief_name: Optional[str] = None
    score: float
    reasoning: str


class SingleMatchResponseV3(BaseModel):
    """Response for system integration."""
    request_id: str
    use_case: str
    
    # Always present
    domain: DomainResponseV3
    owner: OwnerResponseV3
    
    # Optional
    table: Optional[TableResponseV3] = None
    
    # Status
    data_exists: str
    action: str
    reasoning: str
    
    processing_time_ms: int


class RankingResponseV3(BaseModel):
    """Response for chatbot with rankings."""
    request_id: str
    use_case: str
    
    domains: list[DomainResponseV3]
    owners: list[OwnerResponseV3]
    tables: list[TableResponseV3]
    
    summary: str
    clarifying_question: Optional[str] = None
    
    processing_time_ms: int


# ============== Endpoints ==============

@router.post("/single", response_model=SingleMatchResponseV3)
async def search_single_v3(request: SearchRequestV3) -> SingleMatchResponseV3:
    """
    Search with V3 disambiguation scoring.
    
    Use-case affects weight distribution:
    - operational: freshness (40%), quality (35%), cert (25%)
    - analytical: quality (55%), cert (30%), freshness (15%)
    - regulatory: quality (50%), cert (40%), freshness (10%)
    """
    start_time = time.time()
    request_id = str(uuid.uuid4())[:8]
    
    # Build context with use_case
    context = {"use_case": request.use_case}
    if request.produto:
        context["produto"] = request.produto
    if request.segmento:
        context["segmento"] = request.segmento
    if request.publico:
        context["publico"] = request.publico
    if request.granularidade:
        context["granularidade"] = request.granularidade
    
    # Create state
    state = create_initial_state_v2(
        request_id=request_id,
        raw_query=request.raw_query or request.variable_name or "",
        output_mode=OutputMode.SINGLE,
        variable_name=request.variable_name,
        variable_type=request.variable_type,
        context=context,
    )
    
    # Run agent
    agent = get_agent_v3()
    result = await agent.ainvoke(
        state,
        config={"configurable": {"thread_id": request_id}}
    )
    
    processing_time = int((time.time() - start_time) * 1000)
    output: SingleMatchOutput = result.get("single_output")
    
    if output:
        # Build table response if present
        table_resp = None
        if output.table:
            # Get the TableMatch for score breakdown
            table_match = result.get("matched_tables", [{}])[0] if result.get("matched_tables") else None
            
            table_resp = TableResponseV3(
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
                score_breakdown=ScoreBreakdownResponse(
                    total=table_match.score if table_match else 0,
                    semantic=table_match.semantic_score if table_match else 0,
                    certification=table_match.certification_score if table_match else 0,
                    freshness=table_match.freshness_score if table_match else 0,
                    quality=table_match.quality_score if table_match else 0,
                    context=table_match.context_score if table_match else 0,
                ),
                reasoning=table_match.reasoning if table_match else "",
                is_double_certified=table_match.is_double_certified if table_match else False,
                has_product_match=table_match.has_product_match if table_match else False,
            )
        
        return SingleMatchResponseV3(
            request_id=request_id,
            use_case=request.use_case,
            domain=DomainResponseV3(
                id=output.domain.id,
                name=output.domain.name,
                chief_name=output.domain.chief_name,
                score=output.domain_confidence,
                reasoning="Domínio identificado"
            ),
            owner=OwnerResponseV3(
                id=output.owner.id,
                name=output.owner.name,
                email=output.owner.email,
                domain_name=output.owner.domain_name,
                score=output.owner_confidence,
                reasoning="Responsável identificado"
            ),
            table=table_resp,
            data_exists=output.data_existence.value,
            action=output.action,
            reasoning=output.reasoning,
            processing_time_ms=processing_time,
        )
    
    # Fallback
    return SingleMatchResponseV3(
        request_id=request_id,
        use_case=request.use_case,
        domain=DomainResponseV3(id="unknown", name="Não identificado", score=0, reasoning=""),
        owner=OwnerResponseV3(id=0, name="Não identificado", domain_name="", score=0, reasoning=""),
        table=None,
        data_exists="UNCERTAIN",
        action="CONFIRM_WITH_OWNER",
        reasoning="Não foi possível processar a solicitação",
        processing_time_ms=processing_time,
    )


@router.post("/ranking", response_model=RankingResponseV3)
async def search_ranking_v3(request: SearchRequestV3) -> RankingResponseV3:
    """Search with V3 scoring, returning top 5 options."""
    start_time = time.time()
    request_id = str(uuid.uuid4())[:8]
    
    context = {"use_case": request.use_case}
    if request.produto:
        context["produto"] = request.produto
    if request.segmento:
        context["segmento"] = request.segmento
    
    state = create_initial_state_v2(
        request_id=request_id,
        raw_query=request.raw_query or request.variable_name or "",
        output_mode=OutputMode.RANKING,
        variable_name=request.variable_name,
        variable_type=request.variable_type,
        context=context,
    )
    
    agent = get_agent_v3()
    result = await agent.ainvoke(
        state,
        config={"configurable": {"thread_id": request_id}}
    )
    
    processing_time = int((time.time() - start_time) * 1000)
    output: RankingOutput = result.get("ranking_output")
    
    if output:
        return RankingResponseV3(
            request_id=request_id,
            use_case=request.use_case,
            domains=[
                DomainResponseV3(
                    id=d.domain.id,
                    name=d.domain.name,
                    chief_name=d.domain.chief_name,
                    score=d.score,
                    reasoning=d.reasoning
                ) for d in output.domains
            ],
            owners=[
                OwnerResponseV3(
                    id=o.owner.id,
                    name=o.owner.name,
                    email=o.owner.email,
                    domain_name=o.owner.domain_name,
                    score=o.score,
                    reasoning=o.reasoning
                ) for o in output.owners
            ],
            tables=[
                TableResponseV3(
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
                    score_breakdown=ScoreBreakdownResponse(
                        total=t.score,
                        semantic=t.semantic_score,
                        certification=t.certification_score,
                        freshness=t.freshness_score,
                        quality=t.quality_score,
                        context=t.context_score,
                    ),
                    reasoning=t.reasoning,
                    is_double_certified=t.is_double_certified,
                    has_product_match=t.has_product_match,
                ) for t in output.tables
            ],
            summary=output.summary,
            clarifying_question=output.clarifying_question,
            processing_time_ms=processing_time,
        )
    
    return RankingResponseV3(
        request_id=request_id,
        use_case=request.use_case,
        domains=[],
        owners=[],
        tables=[],
        summary="Não foi possível processar",
        clarifying_question="Descreva melhor o dado buscado",
        processing_time_ms=processing_time,
    )
