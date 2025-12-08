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
from app.services.matching_service import MatchingService, MatchingError
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
    search_status: str
    match_count: int = 0
    top_score: Optional[float] = None
    selected_table: Optional[str] = None


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
        matches = await MatchingService.search_matches(db, variable_id)
        return await _enrich_matches(db, matches)
    except MatchingError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/variables/{variable_id}/matches", response_model=List[MatchResponse])
async def get_variable_matches(
    variable_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(get_current_user)
):
    """Get all matches for a variable"""
    result = await db.execute(
        select(VariableMatch)
        .where(VariableMatch.case_variable_id == variable_id)
        .order_by(VariableMatch.score.desc())
    )
    matches = result.scalars().all()
    return await _enrich_matches(db, matches)


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
        return (await _enrich_matches(db, [match]))[0]
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
        return (await _enrich_matches(db, [match]))[0]
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
        return (await _enrich_matches(db, [match]))[0]
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
    progress = await MatchingService.get_case_progress(db, case_id)
    
    # Get variable details
    result = await db.execute(
        select(CaseVariable).where(CaseVariable.case_id == case_id)
    )
    variables = result.scalars().all()
    
    variable_details = []
    for var in variables:
        # Get matches for this variable
        result = await db.execute(
            select(VariableMatch)
            .where(VariableMatch.case_variable_id == var.id)
            .order_by(VariableMatch.score.desc())
        )
        matches = result.scalars().all()
        
        top_score = matches[0].score if matches else None
        selected_table = None
        
        if var.selected_match_id:
            result = await db.execute(
                select(VariableMatch).where(VariableMatch.id == var.selected_match_id)
            )
            selected_match = result.scalars().first()
            if selected_match:
                result = await db.execute(
                    select(DataTable).where(DataTable.id == selected_match.data_table_id)
                )
                table = result.scalars().first()
                selected_table = table.display_name if table else None
        
        variable_details.append(VariableProgressResponse(
            id=var.id,
            variable_name=var.variable_name,
            variable_type=var.variable_type,
            search_status=var.search_status or "PENDING",
            match_count=len(matches),
            top_score=top_score,
            selected_table=selected_table
        ))
    
    progress["variables"] = variable_details
    return CaseProgressResponse(**progress)


# ============== Catalog CRUD Endpoints ==============

@router.get("/catalog/tables", response_model=List[DataTableResponse])
async def list_data_tables(
    domain: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Collaborator = Depends(get_current_user)
):
    """List all data tables in catalog"""
    query = select(DataTable).where(DataTable.is_active == True)
    if domain:
        query = query.where(DataTable.domain == domain)
    
    result = await db.execute(query.order_by(DataTable.display_name))
    tables = result.scalars().all()
    
    responses = []
    for table in tables:
        owner_name = None
        if table.owner_id:
            result = await db.execute(
                select(Collaborator).where(Collaborator.id == table.owner_id)
            )
            owner = result.scalars().first()
            owner_name = owner.name if owner else None
        
        responses.append(DataTableResponse(
            id=table.id,
            name=table.name,
            display_name=table.display_name,
            description=table.description,
            domain=table.domain,
            owner_id=table.owner_id,
            owner_name=owner_name,
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
    table = DataTable(
        name=data.name,
        display_name=data.display_name,
        description=data.description,
        schema_name=data.schema_name,
        database_name=data.database_name,
        domain=data.domain,
        keywords=data.keywords,
        owner_id=data.owner_id or current_user.id,
        is_active=True
    )
    db.add(table)
    await db.commit()
    await db.refresh(table)
    
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
    result = await db.execute(
        select(DataTable).where(DataTable.id == table_id)
    )
    table = result.scalars().first()
    
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    
    owner_name = None
    if table.owner_id:
        result = await db.execute(
            select(Collaborator).where(Collaborator.id == table.owner_id)
        )
        owner = result.scalars().first()
        owner_name = owner.name if owner else None
    
    return DataTableResponse(
        id=table.id,
        name=table.name,
        display_name=table.display_name,
        description=table.description,
        domain=table.domain,
        owner_id=table.owner_id,
        owner_name=owner_name,
        is_active=table.is_active
    )


# ============== Helper Functions ==============

async def _enrich_matches(
    db: AsyncSession, 
    matches: List[VariableMatch]
) -> List[MatchResponse]:
    """Enrich match objects with table information"""
    responses = []
    for match in matches:
        result = await db.execute(
            select(DataTable).where(DataTable.id == match.data_table_id)
        )
        table = result.scalars().first()
        
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
