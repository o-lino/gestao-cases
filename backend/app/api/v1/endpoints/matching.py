"""
Matching API Endpoints

Handles data matching workflow:
- Search for variable matches
- Select and approve matches
- Owner validation
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_moderator_or_above
from app.models.collaborator import Collaborator
from app.models.data_catalog import DataTable, VariableMatch, MatchStatus
from app.models.case import CaseVariable
from app.models.owner_response import OwnerResponseType, OwnerResponse, RequesterResponseType, RequesterResponse
from app.models.decision_history import DecisionHistory, DecisionType, DecisionOutcome
from app.services.matching_service import MatchingService, MatchingError
from app.services.decision_history_service import DecisionHistoryService
from sqlalchemy import select


router = APIRouter()


# ============== Schemas ==============

class MatchResponse(BaseModel):
    id: int
    case_variable_id: int
    data_table_id: int
    table_name: Optional[str] = None
    table_display_name: Optional[str] = None
    table_description: Optional[str] = None
    score: float
    match_reason: Optional[str]
    status: str
    is_selected: bool
    matched_column: Optional[str]
    
    class Config:
        from_attributes = True


class VariableProgressResponse(BaseModel):
    id: int
    variable_name: str
    variable_type: str
    concept: Optional[str] = None
    desired_lag: Optional[str] = None
    search_status: str
    match_count: int = 0
    top_score: Optional[float] = None
    selected_table: Optional[str] = None
    # Additional table details
    selected_table_id: Optional[int] = None
    selected_table_domain: Optional[str] = None
    selected_table_owner_name: Optional[str] = None
    selected_table_description: Optional[str] = None
    selected_table_full_path: Optional[str] = None
    match_status: Optional[str] = None  # SUGGESTED, PENDING_OWNER, APPROVED, REJECTED
    is_pending_owner: bool = False
    is_approved: bool = False


class CaseProgressResponse(BaseModel):
    total: int
    pending: int
    searching: int
    matched: int
    owner_review: int
    approved: int
    no_match: int
    progress_percent: float
    variables: List[VariableProgressResponse] = []


class SelectMatchRequest(BaseModel):
    match_id: int


class RejectMatchRequest(BaseModel):
    reason: Optional[str] = None


# ============== Owner Response Schemas ==============

class OwnerResponseRequest(BaseModel):
    """Request for structured owner response"""
    response_type: str = Field(..., description="CORRECT_TABLE, DATA_NOT_EXIST, DELEGATE_PERSON, DELEGATE_AREA, CONFIRM_MATCH")
    suggested_table_id: Optional[int] = None  # For CORRECT_TABLE
    delegate_to_funcional: Optional[str] = None  # For DELEGATE_PERSON
    delegate_to_id: Optional[int] = None  # For DELEGATE_PERSON
    delegate_area_id: Optional[int] = None  # For DELEGATE_AREA
    delegate_area_name: Optional[str] = None  # For DELEGATE_AREA
    usage_criteria: Optional[str] = None  # For CONFIRM_MATCH
    attention_points: Optional[str] = None  # For CONFIRM_MATCH
    notes: Optional[str] = None  # Common


class OwnerResponseResult(BaseModel):
    """Response after owner submits structured response"""
    match_id: int
    response_id: int
    response_type: str
    is_validated: bool
    validation_result: Optional[str]
    match_status: str
    variable_status: str
    message: str


class CollaboratorMinimal(BaseModel):
    """Minimal collaborator info for autocomplete"""
    id: int
    name: str
    email: str


class AreaMinimal(BaseModel):
    """Minimal area info for autocomplete"""
    id: int
    department: str
    cost_center: Optional[str] = None


# ============== Requester Response Schemas ==============

class RequesterResponseRequest(BaseModel):
    """Request for requester response after owner validates"""
    response_type: str = Field(..., description="APPROVE, REJECT_WRONG_DATA, REJECT_INCOMPLETE, REJECT_WRONG_GRANULARITY, REJECT_WRONG_PERIOD, REJECT_OTHER")
    rejection_reason: Optional[str] = None  # Required for all REJECT_* types
    expected_data_description: Optional[str] = None  # What the requester expected
    improvement_suggestions: Optional[str] = None  # What would make it acceptable


class RequesterResponseResult(BaseModel):
    """Response after requester submits response"""
    match_id: int
    response_id: int
    response_type: str
    is_validated: bool
    match_status: str
    variable_status: str
    loop_count: int
    message: str

class DataTableCreate(BaseModel):
    name: str = Field(..., min_length=2)
    display_name: str = Field(..., min_length=2)
    description: Optional[str] = None
    schema_name: Optional[str] = None
    database_name: Optional[str] = None
    domain: Optional[str] = None
    keywords: List[str] = []
    owner_id: Optional[int] = None


class DataTableResponse(BaseModel):
    id: int
    name: str
    display_name: str
    description: Optional[str]
    domain: Optional[str]
    owner_id: Optional[int]
    owner_name: Optional[str] = None
    is_active: bool
    
    class Config:
        from_attributes = True


# ============== Pending Owner Actions ==============

class PendingOwnerActionItem(BaseModel):
    """Item representing a variable pending owner action"""
    match_id: int
    variable_id: Optional[int]
    variable_name: Optional[str]
    product: Optional[str]
    concept: Optional[str]
    priority: Optional[str]
    case_id: Optional[int]
    case_title: Optional[str]
    case_client: Optional[str]
    requester_email: Optional[str]
    table_id: Optional[int]
    table_name: Optional[str]
    table_display_name: Optional[str]
    match_score: float
    created_at: Optional[str]


@router.get("/pending-owner-actions", response_model=List[PendingOwnerActionItem])
async def get_pending_owner_actions(
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(get_current_user)
):
    """
    Get all variables with matches pending the current user's action as data owner.
    
    Returns variables where:
    - The user is the owner of the suggested data table
    - The match status is PENDING_OWNER (awaiting owner decision)
    - The variable is not cancelled
    
    Use this to show data owners which suggestions need their approval/rejection.
    """
    pending = await MatchingService.get_pending_for_owner(db, current_user.id)
    return pending


# ============== Variable Matching Endpoints ==============

@router.post("/variables/{variable_id}/search", response_model=List[MatchResponse])
async def search_matches_for_variable(
    variable_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(get_current_user)
):
    """
    Start a search for matching tables for a variable.
    Creates VariableMatch records for found matches.
    """
    try:
        await MatchingService.search_matches(db, variable_id)
        # Use service to get enriched matches
        matches = await MatchingService.get_matches_for_variable(db, variable_id)
        return _convert_to_response(matches)
    except MatchingError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/variables/{variable_id}/matches", response_model=List[MatchResponse])
async def get_variable_matches(
    variable_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(get_current_user)
):
    """Get all matches for a variable"""
    matches = await MatchingService.get_matches_for_variable(db, variable_id)
    return _convert_to_response(matches)


@router.post("/variables/{variable_id}/select", response_model=MatchResponse)
async def select_match_for_variable(
    variable_id: int,
    request: SelectMatchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(get_current_user)
):
    """Select a match as the final choice for a variable"""
    try:
        match = await MatchingService.select_best_match(
            db, variable_id, request.match_id, current_user.id
        )
        # Re-fetch with details for response
        matches = await MatchingService.get_matches_for_variable(db, variable_id)
        selected = next((m for m in matches if m.id == match.id), None)
        return _convert_to_response([selected])[0] if selected else None
    except MatchingError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/matches/{match_id}/approve", response_model=MatchResponse)
async def owner_approve_match(
    match_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(get_current_user)
):
    """Owner approves the matched table"""
    try:
        match = await MatchingService.owner_approve(db, match_id, current_user.id)
        
        # We need the table info for response
        table = await MatchingService.get_table(db, match.data_table_id)
        match.data_table = table
        return _convert_to_response([match])[0]
    except MatchingError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/matches/{match_id}/reject", response_model=MatchResponse)
async def owner_reject_match(
    match_id: int,
    request: RejectMatchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(get_current_user)
):
    """Owner rejects the matched table"""
    try:
        match = await MatchingService.owner_reject(
            db, match_id, current_user.id, request.reason
        )
        # We need the table info for response
        table = await MatchingService.get_table(db, match.data_table_id)
        match.data_table = table
        return _convert_to_response([match])[0]
    except MatchingError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============== Structured Owner Response Endpoint ==============

@router.post("/matches/{match_id}/respond", response_model=OwnerResponseResult)
async def owner_respond_to_match(
    match_id: int,
    request: OwnerResponseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(get_current_user)
):
    """
    Owner responds to a matched table suggestion with structured response.
    
    Response types:
    - CORRECT_TABLE: Owner suggests a different table (requires suggested_table_id)
    - DATA_NOT_EXIST: Data doesn't exist, triggers involvement flow
    - DELEGATE_PERSON: Delegate to another person (requires delegate_to_funcional or delegate_to_id)
    - DELEGATE_AREA: Delegate to another area (requires delegate_area_id or delegate_area_name)
    - CONFIRM_MATCH: Perfect match, approve with usage criteria (requires usage_criteria)
    """
    try:
        # Convert string response_type to enum
        try:
            response_type = OwnerResponseType(request.response_type)
        except ValueError:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid response_type: {request.response_type}. Valid options: {[t.value for t in OwnerResponseType]}"
            )
        
        # Prepare response data
        response_data = {
            'suggested_table_id': request.suggested_table_id,
            'delegate_to_funcional': request.delegate_to_funcional,
            'delegate_to_id': request.delegate_to_id,
            'delegate_area_id': request.delegate_area_id,
            'delegate_area_name': request.delegate_area_name,
            'usage_criteria': request.usage_criteria,
            'attention_points': request.attention_points,
            'notes': request.notes
        }
        
        match, owner_response = await MatchingService.owner_respond(
            db, match_id, current_user.id, response_type, response_data
        )
        
        # Get variable status for response
        result = await db.execute(
            select(CaseVariable).where(CaseVariable.id == match.case_variable_id)
        )
        variable = result.scalars().first()
        
        # Determine message based on response type
        messages = {
            OwnerResponseType.CONFIRM_MATCH: "Match aprovado com critérios de uso registrados.",
            OwnerResponseType.CORRECT_TABLE: "Redirecionado para a tabela correta.",
            OwnerResponseType.DATA_NOT_EXIST: "Marcado para criação de envolvimento.",
            OwnerResponseType.DELEGATE_PERSON: "Delegado para outro colaborador.",
            OwnerResponseType.DELEGATE_AREA: "Redirecionado para outra área."
        }
        
        return OwnerResponseResult(
            match_id=match.id,
            response_id=owner_response.id,
            response_type=response_type.value,
            is_validated=owner_response.is_validated,
            validation_result=owner_response.validation_result,
            match_status=match.status.value if hasattr(match.status, 'value') else str(match.status),
            variable_status=variable.search_status if variable else "UNKNOWN",
            message=messages.get(response_type, "Resposta registrada.")
        )
    except MatchingError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============== Autocomplete Search Endpoints ==============

@router.get("/search/collaborators", response_model=List[CollaboratorMinimal])
async def search_collaborators(
    q: str,
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(get_current_user)
):
    """Search collaborators by name or email for autocomplete"""
    collaborators = await MatchingService.search_collaborators(db, q, limit)
    return [
        CollaboratorMinimal(id=c.id, name=c.name, email=c.email)
        for c in collaborators
    ]


@router.get("/search/areas", response_model=List[AreaMinimal])
async def search_organizational_areas(
    q: str,
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(get_current_user)
):
    """Search organizational areas by department name for autocomplete"""
    areas = await MatchingService.search_areas(db, q, limit)
    return [
        AreaMinimal(id=a['id'], department=a['department'], cost_center=a.get('cost_center'))
        for a in areas
    ]


# ============== Requester Response Endpoint ==============

@router.post("/matches/{match_id}/requester-respond", response_model=RequesterResponseResult)
async def requester_respond_to_match(
    match_id: int,
    request: RequesterResponseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(get_current_user)
):
    """
    Requester responds to owner-validated match.
    
    Response types:
    - APPROVE: Requester confirms the match is perfect
    - REJECT_WRONG_DATA: Data doesn't match what was requested
    - REJECT_INCOMPLETE: Data is missing fields/columns
    - REJECT_WRONG_GRANULARITY: Wrong level of detail
    - REJECT_WRONG_PERIOD: Wrong time range or frequency
    - REJECT_OTHER: Other reason (requires detailed explanation)
    
    All REJECT_* types require rejection_reason (min 10 chars).
    On rejection, match loops back to owner for new response.
    """
    try:
        # Convert string response_type to enum
        try:
            response_type = RequesterResponseType(request.response_type)
        except ValueError:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid response_type: {request.response_type}. Valid options: {[t.value for t in RequesterResponseType]}"
            )
        
        # Prepare response data
        response_data = {
            'rejection_reason': request.rejection_reason,
            'expected_data_description': request.expected_data_description,
            'improvement_suggestions': request.improvement_suggestions
        }
        
        match, requester_response = await MatchingService.requester_respond(
            db, match_id, current_user.id, response_type, response_data
        )
        
        # Get variable status for response
        result = await db.execute(
            select(CaseVariable).where(CaseVariable.id == match.case_variable_id)
        )
        variable = result.scalars().first()
        
        # Determine message based on response type
        if response_type == RequesterResponseType.APPROVE:
            message = "Match confirmado! A variável foi aprovada."
        else:
            message = "Rejeitado. O dono dos dados será notificado para reavaliar."
        
        return RequesterResponseResult(
            match_id=match.id,
            response_id=requester_response.id,
            response_type=response_type.value,
            is_validated=requester_response.is_validated,
            match_status=match.status.value if hasattr(match.status, 'value') else str(match.status),
            variable_status=variable.search_status if variable else "UNKNOWN",
            loop_count=requester_response.loop_count,
            message=message
        )
    except MatchingError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============== Case Progress Endpoints ==============

@router.get("/cases/{case_id}/progress", response_model=CaseProgressResponse)
async def get_case_matching_progress(
    case_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(get_current_user)
):
    """Get matching progress for all variables in a case"""
    progress = await MatchingService.get_case_matching_progress_details(db, case_id)
    return CaseProgressResponse(**progress)


# ============== Variable In Use Endpoint ==============

@router.post("/variables/{variable_id}/mark-in-use")
async def mark_variable_in_use(
    variable_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(get_current_user)
):
    """
    Mark an approved variable as 'in use'.
    Only the case requester can perform this action.
    Required before case can be closed.
    """
    try:
        variable = await MatchingService.mark_variable_in_use(db, variable_id, current_user.id)
        return {
            "variable_id": variable.id,
            "search_status": variable.search_status,
            "message": "Variável marcada como 'Em Uso'"
        }
    except MatchingError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============== Catalog CRUD Endpoints ==============

@router.get("/catalog/tables", response_model=List[DataTableResponse])
async def list_data_tables(
    domain: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(get_current_user)
):
    """List all data tables in catalog"""
    tables = await MatchingService.list_tables(db, domain)
    
    responses = []
    for table in tables:
        responses.append(DataTableResponse(
            id=table.id,
            name=table.name,
            display_name=table.display_name,
            description=table.description,
            domain=table.domain,
            owner_id=table.owner_id,
            owner_name=table.owner.name if table.owner else None,
            is_active=table.is_active
        ))
    
    return responses


@router.post("/catalog/tables", response_model=DataTableResponse)
async def create_data_table(
    data: DataTableCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(require_moderator_or_above)
):
    """Create a new data table in catalog (moderator only)"""
    # Prepare data dict, setting owner to current user if not provided
    data_dict = data.dict()
    if not data_dict.get('owner_id'):
        data_dict['owner_id'] = current_user.id
        
    table = await MatchingService.create_table(db, data_dict)
    
    return DataTableResponse(
        id=table.id,
        name=table.name,
        display_name=table.display_name,
        description=table.description,
        domain=table.domain,
        owner_id=table.owner_id,
        owner_name=current_user.name if table.owner_id == current_user.id else None,
        is_active=table.is_active
    )


@router.get("/catalog/tables/{table_id}", response_model=DataTableResponse)
async def get_data_table(
    table_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(get_current_user)
):
    """Get details of a specific data table"""
    table = await MatchingService.get_table(db, table_id)
    
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    return DataTableResponse(
        id=table.id,
        name=table.name,
        display_name=table.display_name,
        description=table.description,
        domain=table.domain,
        owner_id=table.owner_id,
        owner_name=table.owner.name if table.owner else None,
        is_active=table.is_active
    )


# ============== Helper Functions ==============

def _convert_to_response(matches: List[VariableMatch]) -> List[MatchResponse]:
    """Convert variable matches to response model"""
    responses = []
    for match in matches:
        table = match.data_table
        
        responses.append(MatchResponse(
            id=match.id,
            case_variable_id=match.case_variable_id,
            data_table_id=match.data_table_id,
            table_name=table.name if table else None,
            table_display_name=table.display_name if table else None,
            table_description=table.description if table else None,
            score=match.score,
            match_reason=match.match_reason,
            status=match.status.value if isinstance(match.status, MatchStatus) else match.status,
            is_selected=match.is_selected,
            matched_column=match.matched_column
        ))
    
    return responses


# ============== Decision History Endpoints (for AI Training) ==============

@router.get("/variables/{variable_id}/decision-history")
async def get_variable_decision_history(
    variable_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(get_current_user)
):
    """
    Get complete decision history for a variable.
    Includes all owner/requester decisions with motivators.
    """
    decisions = await DecisionHistoryService.get_variable_decision_history(db, variable_id)
    return [
        {
            "id": d.id,
            "decision_type": d.decision_type.value if hasattr(d.decision_type, 'value') else str(d.decision_type),
            "outcome": d.outcome.value if hasattr(d.outcome, 'value') else str(d.outcome),
            "actor_role": d.actor_role,
            "actor_name": d.actor.name if d.actor else None,
            "decision_reason": d.decision_reason,
            "previous_status": d.previous_status,
            "new_status": d.new_status,
            "loop_count": d.loop_count,
            "created_at": d.created_at.isoformat() if d.created_at else None
        }
        for d in decisions
    ]


@router.get("/cases/{case_id}/decision-history")
async def get_case_decision_history(
    case_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(get_current_user)
):
    """
    Get complete decision history for a case.
    Includes all decisions for all variables.
    """
    decisions = await DecisionHistoryService.get_case_decision_history(db, case_id)
    return [
        {
            "id": d.id,
            "variable_id": d.variable_id,
            "variable_name": d.variable.variable_name if d.variable else None,
            "decision_type": d.decision_type.value if hasattr(d.decision_type, 'value') else str(d.decision_type),
            "outcome": d.outcome.value if hasattr(d.outcome, 'value') else str(d.outcome),
            "actor_role": d.actor_role,
            "actor_name": d.actor.name if d.actor else None,
            "decision_reason": d.decision_reason,
            "new_status": d.new_status,
            "created_at": d.created_at.isoformat() if d.created_at else None
        }
        for d in decisions
    ]


@router.get("/decisions/export")
async def export_training_data(
    decision_type: Optional[str] = None,
    outcome: Optional[str] = None,
    limit: int = 10000,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(require_moderator_or_above)
):
    """
    Export decision history for AI training.
    Returns decisions with full context in training-friendly format.
    
    Query params:
    - decision_type: Filter by type (e.g., OWNER_CONFIRM, REQUESTER_REJECT_WRONG_DATA)
    - outcome: Filter by POSITIVE, NEGATIVE, or NEUTRAL
    - limit: Max records (default 10000)
    - offset: Pagination offset
    """
    # Convert string filters to enums
    decision_types = None
    if decision_type:
        try:
            decision_types = [DecisionType(decision_type)]
        except ValueError:
            pass
    
    outcome_filter = None
    if outcome:
        try:
            outcome_filter = DecisionOutcome(outcome)
        except ValueError:
            pass
    
    data = await DecisionHistoryService.export_training_data(
        db, decision_types, outcome_filter, limit, offset
    )
    
    return {
        "count": len(data),
        "limit": limit,
        "offset": offset,
        "data": data
    }


@router.get("/decisions/statistics")
async def get_decision_statistics(
    case_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(get_current_user)
):
    """
    Get decision statistics for analysis.
    Returns counts by type and outcome.
    """
    stats = await DecisionHistoryService.get_decision_statistics(db, case_id)
    return stats

