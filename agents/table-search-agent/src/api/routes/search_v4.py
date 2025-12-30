"""
V4 Search Routes

API endpoints with column search capability.
"""

import uuid
import time
from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel, Field

from src.agent.graph_v4 import get_agent_v4
from src.agent.state_v2 import (
    create_initial_state_v2,
    OutputMode,
    SingleMatchOutput,
    RankingOutput,
)


router = APIRouter(prefix="/v4/search", tags=["Search V4"])


class SearchRequestV4(BaseModel):
    """V4 search request."""
    raw_query: Optional[str] = None
    variable_name: Optional[str] = None
    variable_type: Optional[str] = None
    
    # Context
    produto: Optional[str] = None
    segmento: Optional[str] = None
    publico: Optional[str] = None
    granularidade: Optional[str] = None
    use_case: str = "default"
    
    # V4: Search mode
    search_mode: str = Field(
        default="auto",
        description="auto, table_only, column_only, or hybrid"
    )


class ColumnMatchResponse(BaseModel):
    """Column match in response."""
    column_name: str
    column_display_name: str
    table_name: str
    table_id: int
    domain: str
    score: float


class TableResponseV4(BaseModel):
    """Table response with column matches."""
    id: int
    name: str
    display_name: str
    summary: str
    domain_name: str
    owner_name: str
    
    # Scores
    score: float
    semantic_score: float
    historical_score: float
    
    # Certifications
    data_layer: Optional[str] = None
    is_golden_source: bool = False
    is_visao_cliente: bool = False
    
    # V4: Matched columns
    matched_columns: list[str] = Field(default_factory=list)
    
    reasoning: str


class SingleMatchResponseV4(BaseModel):
    """V4 single match response."""
    request_id: str
    search_mode: str
    
    domain_id: str
    domain_name: str
    owner_id: int
    owner_name: str
    
    table: Optional[TableResponseV4] = None
    
    # V4: Column matches if any
    column_matches: list[ColumnMatchResponse] = Field(default_factory=list)
    
    data_exists: str
    action: str
    reasoning: str
    processing_time_ms: int


@router.post("/single", response_model=SingleMatchResponseV4)
async def search_single_v4(request: SearchRequestV4) -> SingleMatchResponseV4:
    """
    V4 Search with column-level support.
    
    Search modes:
    - auto: Detect if query is about fields and search appropriately
    - table_only: Only search tables (like V3)
    - column_only: Only search by column names
    - hybrid: Always do both and merge
    """
    start_time = time.time()
    request_id = str(uuid.uuid4())[:8]
    
    context = {
        "use_case": request.use_case,
        "search_mode": request.search_mode,
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
    
    agent = get_agent_v4()
    result = await agent.ainvoke(
        state,
        config={"configurable": {"thread_id": request_id}}
    )
    
    processing_time = int((time.time() - start_time) * 1000)
    output: SingleMatchOutput = result.get("single_output")
    
    # Get column matches if any
    column_results = result.get("column_search_results", [])
    column_matches = []
    for cm in column_results[:5]:
        for entity in cm.matched_entities:
            column_matches.append(ColumnMatchResponse(
                column_name=entity,
                column_display_name=entity,
                table_name=cm.table.name,
                table_id=cm.table.id,
                domain=cm.table.domain_name,
                score=cm.score,
            ))
    
    if output:
        table_resp = None
        if output.table:
            table_match = result.get("matched_tables", [{}])[0] if result.get("matched_tables") else None
            
            table_resp = TableResponseV4(
                id=output.table.id,
                name=output.table.name,
                display_name=output.table.display_name,
                summary=output.table.summary,
                domain_name=output.table.domain_name,
                owner_name=output.table.owner_name,
                score=output.table_confidence or 0,
                semantic_score=table_match.semantic_score if table_match else 0,
                historical_score=table_match.historical_score if table_match else 0.5,
                data_layer=output.table.data_layer,
                is_golden_source=output.table.is_golden_source,
                is_visao_cliente=output.table.is_visao_cliente,
                matched_columns=table_match.matched_entities if table_match else [],
                reasoning=table_match.reasoning if table_match else "",
            )
        
        return SingleMatchResponseV4(
            request_id=request_id,
            search_mode=request.search_mode,
            domain_id=output.domain.id,
            domain_name=output.domain.name,
            owner_id=output.owner.id,
            owner_name=output.owner.name,
            table=table_resp,
            column_matches=column_matches,
            data_exists=output.data_existence.value,
            action=output.action,
            reasoning=output.reasoning,
            processing_time_ms=processing_time,
        )
    
    return SingleMatchResponseV4(
        request_id=request_id,
        search_mode=request.search_mode,
        domain_id="unknown",
        domain_name="Não identificado",
        owner_id=0,
        owner_name="Não identificado",
        table=None,
        column_matches=column_matches,
        data_exists="UNCERTAIN",
        action="CONFIRM_WITH_OWNER",
        reasoning="Não foi possível processar",
        processing_time_ms=processing_time,
    )
