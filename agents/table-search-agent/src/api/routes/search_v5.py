"""
V5 Search Routes

API endpoints with ambiguity detection and clarifying questions.
"""

import uuid
import time
from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel, Field

from src.agent.graph_v5 import get_agent_v5
from src.agent.state_v2 import (
    create_initial_state_v2,
    OutputMode,
    SingleMatchOutput,
)


router = APIRouter(prefix="/v5/search", tags=["Search V5"])


class SearchRequestV5(BaseModel):
    """V5 search request."""
    raw_query: Optional[str] = None
    variable_name: Optional[str] = None
    variable_type: Optional[str] = None
    
    # Context
    produto: Optional[str] = None
    segmento: Optional[str] = None
    use_case: str = "default"
    search_mode: str = "auto"


class ClarifyingOptionResponse(BaseModel):
    """Option for user to choose."""
    id: str
    label: str
    description: str
    table_id: Optional[int] = None


class AmbiguityResponse(BaseModel):
    """Ambiguity detection result."""
    type: str  # NONE, SCORE_TIE, DOMAIN_CONFLICT, etc.
    is_ambiguous: bool
    clarifying_question: Optional[str] = None
    options: list[ClarifyingOptionResponse] = Field(default_factory=list)
    provisional_table_id: Optional[int] = None


class TableResponseV5(BaseModel):
    """Table in response."""
    id: int
    name: str
    display_name: str
    summary: str
    domain_name: str
    owner_name: str
    score: float
    reasoning: str
    
    # Certifications
    data_layer: Optional[str] = None
    is_golden_source: bool = False
    is_visao_cliente: bool = False


class SingleMatchResponseV5(BaseModel):
    """V5 response with ambiguity info."""
    request_id: str
    
    # Domain/Owner (always present)
    domain_id: str
    domain_name: str
    owner_id: int
    owner_name: str
    
    # Table (may be provisional if ambiguous)
    table: Optional[TableResponseV5] = None
    
    # V5: Ambiguity detection
    ambiguity: AmbiguityResponse
    
    # Status
    data_exists: str
    action: str
    reasoning: str
    
    processing_time_ms: int


@router.post("/single", response_model=SingleMatchResponseV5)
async def search_single_v5(request: SearchRequestV5) -> SingleMatchResponseV5:
    """
    V5 Search with ambiguity detection.
    
    If ambiguity is detected, response includes:
    - clarifying_question: Question to ask user
    - options: List of choices for user
    - provisional_table_id: Best guess while waiting for clarification
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
    
    agent = get_agent_v5()
    result = await agent.ainvoke(
        state,
        config={"configurable": {"thread_id": request_id}}
    )
    
    processing_time = int((time.time() - start_time) * 1000)
    output: SingleMatchOutput = result.get("single_output")
    ambiguity_data = result.get("ambiguity", {})
    
    # Build ambiguity response
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
            
            table_resp = TableResponseV5(
                id=output.table.id,
                name=output.table.name,
                display_name=output.table.display_name,
                summary=output.table.summary,
                domain_name=output.table.domain_name,
                owner_name=output.table.owner_name,
                score=output.table_confidence or 0,
                reasoning=table_match.reasoning if table_match else "",
                data_layer=output.table.data_layer,
                is_golden_source=output.table.is_golden_source,
                is_visao_cliente=output.table.is_visao_cliente,
            )
        
        return SingleMatchResponseV5(
            request_id=request_id,
            domain_id=output.domain.id,
            domain_name=output.domain.name,
            owner_id=output.owner.id,
            owner_name=output.owner.name,
            table=table_resp,
            ambiguity=ambiguity,
            data_exists=output.data_existence.value,
            action=output.action,
            reasoning=output.reasoning,
            processing_time_ms=processing_time,
        )
    
    return SingleMatchResponseV5(
        request_id=request_id,
        domain_id="unknown",
        domain_name="Não identificado",
        owner_id=0,
        owner_name="Não identificado",
        table=None,
        ambiguity=ambiguity,
        data_exists="UNCERTAIN",
        action="CONFIRM_WITH_OWNER",
        reasoning="Não foi possível processar",
        processing_time_ms=processing_time,
    )


@router.post("/resolve", response_model=SingleMatchResponseV5)
async def resolve_ambiguity(
    request_id: str,
    selected_option_id: str,
) -> SingleMatchResponseV5:
    """
    Resolve ambiguity by user selection.
    
    After user selects an option from clarifying_question,
    use this endpoint to get the final result.
    """
    # TODO: Implement resolution logic
    # 1. Retrieve state from memory by request_id
    # 2. Apply user selection
    # 3. Return final result
    
    return SingleMatchResponseV5(
        request_id=request_id,
        domain_id="unknown",
        domain_name="Resolução pendente",
        owner_id=0,
        owner_name="Resolução pendente",
        table=None,
        ambiguity=AmbiguityResponse(type="NONE", is_ambiguous=False),
        data_exists="UNCERTAIN",
        action="CONFIRM_WITH_OWNER",
        reasoning=f"Seleção: {selected_option_id} - implementar resolução",
        processing_time_ms=0,
    )
