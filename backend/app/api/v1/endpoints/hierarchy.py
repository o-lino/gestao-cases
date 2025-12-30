"""
Hierarchy API Endpoints
Manage organizational hierarchy
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.models.collaborator import Collaborator
from app.models.hierarchy import JobLevel
from app.services.hierarchy_service import HierarchyService
from app.schemas.hierarchy import (
    HierarchyCreate,
    HierarchyUpdate,
    HierarchyResponse,
    HierarchyListResponse,
    HierarchyChain,
    JobLevelInfo,
    BulkHierarchyCreate,
    BulkHierarchyResult
)

router = APIRouter()


@router.get("/job-levels", response_model=List[JobLevelInfo])
async def get_job_levels():
    """Get all available job levels"""
    return [
        JobLevelInfo(level=level.value, label=JobLevel.get_label(level.value))
        for level in JobLevel
    ]


@router.post("/", response_model=HierarchyResponse, status_code=status.HTTP_201_CREATED)
async def create_hierarchy(
    *,
    db: AsyncSession = Depends(deps.get_db),
    data: HierarchyCreate,
    current_user: Collaborator = Depends(deps.get_current_user),
):
    """Create a new hierarchy entry (Admin only)"""
    if current_user.role not in ["ADMIN", "MANAGER"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can manage hierarchy"
        )
    
    try:
        hierarchy = await HierarchyService.create_hierarchy(db, data)
        return HierarchyService.to_response(hierarchy)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/", response_model=HierarchyListResponse)
async def list_hierarchy(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.get_current_user),
    department: Optional[str] = None,
    job_level: Optional[int] = None,
    is_active: bool = True,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    """List hierarchy entries with filters"""
    items, total = await HierarchyService.list_hierarchy(
        db,
        department=department,
        job_level=job_level,
        is_active=is_active,
        skip=skip,
        limit=limit
    )
    
    return HierarchyListResponse(
        items=[HierarchyService.to_response(h) for h in items],
        total=total
    )


@router.get("/my-hierarchy", response_model=Optional[HierarchyResponse])
async def get_my_hierarchy(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.get_current_user),
):
    """Get current user's hierarchy information"""
    hierarchy = await HierarchyService.get_hierarchy_for_collaborator(
        db, current_user.id
    )
    
    if not hierarchy:
        return None
    
    return HierarchyService.to_response(hierarchy)


@router.get("/my-chain", response_model=List[HierarchyResponse])
async def get_my_hierarchy_chain(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.get_current_user),
):
    """Get current user's full hierarchy chain up to director level"""
    chain = await HierarchyService.get_hierarchy_chain(db, current_user.id)
    return [HierarchyService.to_response(h) for h in chain]


@router.get("/my-direct-reports", response_model=List[HierarchyResponse])
async def get_my_direct_reports(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.get_current_user),
):
    """Get current user's direct reports"""
    reports = await HierarchyService.get_direct_reports(db, current_user.id)
    return [HierarchyService.to_response(h) for h in reports]


@router.get("/collaborator/{collaborator_id}", response_model=Optional[HierarchyResponse])
async def get_hierarchy_for_collaborator(
    collaborator_id: int,
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.get_current_user),
):
    """Get hierarchy for a specific collaborator"""
    hierarchy = await HierarchyService.get_hierarchy_for_collaborator(
        db, collaborator_id
    )
    
    if not hierarchy:
        return None
    
    return HierarchyService.to_response(hierarchy)


@router.patch("/collaborator/{collaborator_id}", response_model=HierarchyResponse)
async def update_hierarchy(
    collaborator_id: int,
    *,
    db: AsyncSession = Depends(deps.get_db),
    data: HierarchyUpdate,
    current_user: Collaborator = Depends(deps.get_current_user),
):
    """Update a hierarchy entry (Admin only)"""
    if current_user.role not in ["ADMIN", "MANAGER"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can manage hierarchy"
        )
    
    hierarchy = await HierarchyService.update_hierarchy(db, collaborator_id, data)
    
    if not hierarchy:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hierarchy entry not found"
        )
    
    return HierarchyService.to_response(hierarchy)


@router.delete("/collaborator/{collaborator_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_hierarchy(
    collaborator_id: int,
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.get_current_user),
):
    """Deactivate a hierarchy entry (Admin only)"""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete hierarchy entries"
        )
    
    success = await HierarchyService.delete_hierarchy(db, collaborator_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Hierarchy entry not found"
        )


@router.post("/bulk", response_model=BulkHierarchyResult)
async def bulk_create_hierarchy(
    *,
    db: AsyncSession = Depends(deps.get_db),
    data: BulkHierarchyCreate,
    current_user: Collaborator = Depends(deps.get_current_user),
):
    """Bulk create hierarchy entries (Admin only)"""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can bulk manage hierarchy"
        )
    
    created = 0
    updated = 0
    errors = []
    
    for entry in data.entries:
        try:
            existing = await HierarchyService.get_hierarchy_for_collaborator(
                db, entry.collaborator_id
            )
            
            if existing:
                await HierarchyService.update_hierarchy(
                    db,
                    entry.collaborator_id,
                    HierarchyUpdate(
                        supervisor_id=entry.supervisor_id,
                        job_level=entry.job_level,
                        job_title=entry.job_title,
                        department=entry.department,
                        cost_center=entry.cost_center
                    )
                )
                updated += 1
            else:
                await HierarchyService.create_hierarchy(db, entry)
                created += 1
        except Exception as e:
            errors.append({
                "collaborator_id": entry.collaborator_id,
                "error": str(e)
            })
    
    return BulkHierarchyResult(
        created=created,
        updated=updated,
        errors=errors
    )
