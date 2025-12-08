
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api import deps
from app.models.case import Case
from app.models.collaborator import Collaborator
from app.services.ai_service import ai_service

router = APIRouter()

@router.post("/{case_id}/summarize")
async def summarize_case(
    *,
    db: AsyncSession = Depends(deps.get_db),
    case_id: int,
    current_user: Collaborator = Depends(deps.get_current_user),
) -> Any:
    """
    Generate AI summary for a case.
    """
    result = await db.execute(
        select(Case)
        .options(selectinload(Case.variables))
        .where(Case.id == case_id)
    )
    case = result.scalars().first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    # Prepare data for AI
    case_data = {
        "title": case.title,
        "description": case.description,
        "budget": str(case.budget),
        "variables": [{"name": v.variable_name, "value": v.variable_value} for v in case.variables]
    }
    
    summary = await ai_service.summarize_case(case_data)
    return {"summary": summary}

@router.post("/{case_id}/risk-assessment")
async def assess_risk(
    *,
    db: AsyncSession = Depends(deps.get_db),
    case_id: int,
    current_user: Collaborator = Depends(deps.get_current_user),
) -> Any:
    """
    Generate AI risk assessment for a case.
    """
    result = await db.execute(
        select(Case)
        .options(selectinload(Case.variables))
        .where(Case.id == case_id)
    )
    case = result.scalars().first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    
    case_data = {
        "title": case.title,
        "description": case.description,
        "budget": str(case.budget),
        "variables": [{"name": v.variable_name, "value": v.variable_value} for v in case.variables]
    }
    
    assessment = await ai_service.assess_risk(case_data)
    return assessment
