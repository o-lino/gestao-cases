"""
V2 Search Routes

API endpoints for the V2 hierarchical search agent.
Supports both single match (for system) and ranking (for chatbot).
"""

import uuid
import time
from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel, Field

from src.agent.graph_v2 import get_agent_v2
from src.agent.state_v2 import (
    create_initial_state_v2,
    OutputMode,
    SingleMatchOutput,
    RankingOutput,
)


router = APIRouter(prefix="/v2/search", tags=["Search V2"])


# ============== Request Models ==============

class SearchRequestV2(BaseModel):
    """V2 search request with context support."""
    # Query (at least one required)
    raw_query: Optional[str] = Field(None, description="Natural language query")
    variable_name: Optional[str] = Field(None, description="Variable name")
    variable_type: Optional[str] = Field(None, description="Variable type")
    
    # Context (optional, improves results)
    produto: Optional[str] = Field(None, description="Produto específico")
    segmento: Optional[str] = Field(None, description="Segmento de negócio")
    publico: Optional[str] = Field(None, description="Público alvo")
    granularidade: Optional[str] = Field(None, description="Granularidade temporal")
    
    # Output mode
    mode: str = Field(default="single", description="Output mode: single or ranking")


class DomainResponse(BaseModel):
    id: str
    name: str
    chief_name: Optional[str] = None
    score: float
    reasoning: str


class OwnerResponse(BaseModel):
    id: int
    name: str
    email: Optional[str] = None
    domain_name: str
    score: float
    reasoning: str


class TableResponse(BaseModel):
    id: int
    name: str
    display_name: str
    summary: str
    domain_name: str
    owner_name: str
    score: float
    reasoning: str


class SingleMatchResponse(BaseModel):
    """Response for system integration."""
    request_id: str
    
    # Always present
    domain: DomainResponse
    owner: OwnerResponse
    
    # Optional
    table: Optional[TableResponse] = None
    
    # Confidence
    domain_confidence: float
    owner_confidence: float
    table_confidence: Optional[float] = None
    
    # Status
    data_exists: str  # EXISTS, UNCERTAIN, NEEDS_CREATION
    action: str  # USE_TABLE, CONFIRM_WITH_OWNER, CREATE_INVOLVEMENT
    reasoning: str
    
    processing_time_ms: int


class RankingResponse(BaseModel):
    """Response for chatbot with multiple options."""
    request_id: str
    
    # Top matches
    domains: list[DomainResponse]
    owners: list[OwnerResponse]
    tables: list[TableResponse]
    
    # Summary for user
    summary: str
    clarifying_question: Optional[str] = None
    
    processing_time_ms: int


# ============== Endpoints ==============

@router.post("/single", response_model=SingleMatchResponse)
async def search_single(request: SearchRequestV2) -> SingleMatchResponse:
    """
    Search for best single match.
    
    Returns Domain + Owner always.
    Returns Table if confidence is high enough.
    
    Use this for system integration with gestao-cases-2.0.
    """
    start_time = time.time()
    request_id = str(uuid.uuid4())[:8]
    
    # Build context
    context = {}
    if request.produto:
        context["produto"] = request.produto
    if request.segmento:
        context["segmento"] = request.segmento
    if request.publico:
        context["publico"] = request.publico
    if request.granularidade:
        context["granularidade"] = request.granularidade
    
    # Create initial state
    state = create_initial_state_v2(
        request_id=request_id,
        raw_query=request.raw_query or request.variable_name or "",
        output_mode=OutputMode.SINGLE,
        variable_name=request.variable_name,
        variable_type=request.variable_type,
        context=context,
    )
    
    # Run agent
    agent = get_agent_v2()
    result = await agent.ainvoke(
        state,
        config={"configurable": {"thread_id": request_id}}
    )
    
    output: SingleMatchOutput = result.get("single_output")
    processing_time = int((time.time() - start_time) * 1000)
    
    if output:
        return SingleMatchResponse(
            request_id=request_id,
            domain=DomainResponse(
                id=output.domain.id,
                name=output.domain.name,
                chief_name=output.domain.chief_name,
                score=output.domain_confidence,
                reasoning="Domínio identificado pela análise de intent"
            ),
            owner=OwnerResponse(
                id=output.owner.id,
                name=output.owner.name,
                email=output.owner.email,
                domain_name=output.owner.domain_name,
                score=output.owner_confidence,
                reasoning="Responsável do domínio identificado"
            ),
            table=TableResponse(
                id=output.table.id,
                name=output.table.name,
                display_name=output.table.display_name,
                summary=output.table.summary,
                domain_name=output.table.domain_name,
                owner_name=output.table.owner_name,
                score=output.table_confidence or 0,
                reasoning="Tabela sugerida com base em similaridade"
            ) if output.table else None,
            domain_confidence=output.domain_confidence,
            owner_confidence=output.owner_confidence,
            table_confidence=output.table_confidence,
            data_exists=output.data_existence.value,
            action=output.action,
            reasoning=output.reasoning,
            processing_time_ms=processing_time,
        )
    
    # Fallback response when no output
    return SingleMatchResponse(
        request_id=request_id,
        domain=DomainResponse(id="unknown", name="Não identificado", score=0, reasoning=""),
        owner=OwnerResponse(id=0, name="Não identificado", domain_name="", score=0, reasoning=""),
        table=None,
        domain_confidence=0,
        owner_confidence=0,
        table_confidence=None,
        data_exists="UNCERTAIN",
        action="CONFIRM_WITH_OWNER",
        reasoning="Não foi possível processar a solicitação",
        processing_time_ms=processing_time,
    )


@router.post("/ranking", response_model=RankingResponse)
async def search_ranking(request: SearchRequestV2) -> RankingResponse:
    """
    Search with ranking of top 5 options.
    
    Returns multiple domains, owners, and tables.
    Includes summary and clarifying question if needed.
    
    Use this for chatbot interface.
    """
    start_time = time.time()
    request_id = str(uuid.uuid4())[:8]
    
    # Build context
    context = {}
    if request.produto:
        context["produto"] = request.produto
    if request.segmento:
        context["segmento"] = request.segmento
    if request.publico:
        context["publico"] = request.publico
    if request.granularidade:
        context["granularidade"] = request.granularidade
    
    # Create initial state
    state = create_initial_state_v2(
        request_id=request_id,
        raw_query=request.raw_query or request.variable_name or "",
        output_mode=OutputMode.RANKING,
        variable_name=request.variable_name,
        variable_type=request.variable_type,
        context=context,
    )
    
    # Run agent
    agent = get_agent_v2()
    result = await agent.ainvoke(
        state,
        config={"configurable": {"thread_id": request_id}}
    )
    
    output: RankingOutput = result.get("ranking_output")
    processing_time = int((time.time() - start_time) * 1000)
    
    if output:
        return RankingResponse(
            request_id=request_id,
            domains=[
                DomainResponse(
                    id=d.domain.id,
                    name=d.domain.name,
                    chief_name=d.domain.chief_name,
                    score=d.score,
                    reasoning=d.reasoning
                ) for d in output.domains
            ],
            owners=[
                OwnerResponse(
                    id=o.owner.id,
                    name=o.owner.name,
                    email=o.owner.email,
                    domain_name=o.owner.domain_name,
                    score=o.score,
                    reasoning=o.reasoning
                ) for o in output.owners
            ],
            tables=[
                TableResponse(
                    id=t.table.id,
                    name=t.table.name,
                    display_name=t.table.display_name,
                    summary=t.table.summary,
                    domain_name=t.table.domain_name,
                    owner_name=t.table.owner_name,
                    score=t.score,
                    reasoning=t.reasoning
                ) for t in output.tables
            ],
            summary=output.summary,
            clarifying_question=output.clarifying_question,
            processing_time_ms=processing_time,
        )
    
    # Fallback
    return RankingResponse(
        request_id=request_id,
        domains=[],
        owners=[],
        tables=[],
        summary="Não foi possível processar a solicitação",
        clarifying_question="Pode descrever melhor qual tipo de dado está buscando?",
        processing_time_ms=processing_time,
    )
