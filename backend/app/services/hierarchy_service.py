"""
Hierarchy Service
Business logic for organizational hierarchy management
"""

from typing import Optional, List, Tuple
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload

from app.models.hierarchy import OrganizationalHierarchy, JobLevel, SystemConfiguration
from app.models.collaborator import Collaborator
from app.schemas.hierarchy import (
    HierarchyCreate, 
    HierarchyUpdate, 
    HierarchyResponse,
    HierarchyChain,
    CollaboratorBrief
)


class HierarchyService:
    """Service for managing organizational hierarchy"""

    @staticmethod
    async def create_hierarchy(
        db: AsyncSession,
        data: HierarchyCreate
    ) -> OrganizationalHierarchy:
        """Create a new hierarchy entry"""
        # Check if entry already exists for collaborator
        existing = await db.execute(
            select(OrganizationalHierarchy).where(
                OrganizationalHierarchy.collaborator_id == data.collaborator_id
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError(f"Hierarchy entry already exists for collaborator {data.collaborator_id}")
        
        # Validate supervisor exists if provided
        if data.supervisor_id:
            supervisor = await db.execute(
                select(Collaborator).where(Collaborator.id == data.supervisor_id)
            )
            if not supervisor.scalar_one_or_none():
                raise ValueError(f"Supervisor with id {data.supervisor_id} not found")
        
        hierarchy = OrganizationalHierarchy(
            collaborator_id=data.collaborator_id,
            supervisor_id=data.supervisor_id,
            job_level=data.job_level,
            job_title=data.job_title,
            department=data.department,
            cost_center=data.cost_center
        )
        
        db.add(hierarchy)
        await db.commit()
        await db.refresh(hierarchy)
        return hierarchy

    @staticmethod
    async def update_hierarchy(
        db: AsyncSession,
        collaborator_id: int,
        data: HierarchyUpdate
    ) -> Optional[OrganizationalHierarchy]:
        """Update a hierarchy entry"""
        result = await db.execute(
            select(OrganizationalHierarchy).where(
                OrganizationalHierarchy.collaborator_id == collaborator_id
            )
        )
        hierarchy = result.scalar_one_or_none()
        
        if not hierarchy:
            return None
        
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(hierarchy, field, value)
        
        await db.commit()
        await db.refresh(hierarchy)
        return hierarchy

    @staticmethod
    async def get_hierarchy_for_collaborator(
        db: AsyncSession,
        collaborator_id: int
    ) -> Optional[OrganizationalHierarchy]:
        """Get hierarchy entry for a collaborator"""
        result = await db.execute(
            select(OrganizationalHierarchy)
            .options(
                selectinload(OrganizationalHierarchy.collaborator),
                selectinload(OrganizationalHierarchy.supervisor)
            )
            .where(OrganizationalHierarchy.collaborator_id == collaborator_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_supervisor(
        db: AsyncSession,
        collaborator_id: int
    ) -> Optional[Collaborator]:
        """Get the immediate supervisor of a collaborator"""
        hierarchy = await HierarchyService.get_hierarchy_for_collaborator(db, collaborator_id)
        if hierarchy and hierarchy.supervisor_id:
            result = await db.execute(
                select(Collaborator).where(Collaborator.id == hierarchy.supervisor_id)
            )
            return result.scalar_one_or_none()
        return None

    @staticmethod
    async def get_hierarchy_chain(
        db: AsyncSession,
        collaborator_id: int,
        max_level: int = JobLevel.DIRECTOR
    ) -> List[OrganizationalHierarchy]:
        """
        Get the full hierarchy chain from a collaborator up to max_level.
        Returns list from immediate supervisor to highest level.
        """
        chain = []
        current_id = collaborator_id
        visited = set()  # Prevent infinite loops
        
        while current_id and current_id not in visited:
            visited.add(current_id)
            
            hierarchy = await HierarchyService.get_hierarchy_for_collaborator(db, current_id)
            if not hierarchy:
                break
            
            # If we have a supervisor, add them to chain
            if hierarchy.supervisor_id:
                supervisor_hierarchy = await HierarchyService.get_hierarchy_for_collaborator(
                    db, hierarchy.supervisor_id
                )
                if supervisor_hierarchy:
                    chain.append(supervisor_hierarchy)
                    
                    # Stop if we reached the max level
                    if supervisor_hierarchy.job_level >= max_level:
                        break
                    
                    current_id = hierarchy.supervisor_id
                else:
                    break
            else:
                break
        
        return chain

    @staticmethod
    async def get_next_escalation_target(
        db: AsyncSession,
        current_approver_id: int,
        max_level: int = JobLevel.DIRECTOR
    ) -> Optional[Collaborator]:
        """
        Get the next person in hierarchy for escalation.
        Returns None if already at max_level or no supervisor found.
        """
        current_hierarchy = await HierarchyService.get_hierarchy_for_collaborator(
            db, current_approver_id
        )
        
        if not current_hierarchy:
            return None
        
        # Check if current level allows escalation
        if current_hierarchy.job_level >= max_level:
            return None
        
        # Get supervisor
        if current_hierarchy.supervisor_id:
            result = await db.execute(
                select(Collaborator).where(
                    Collaborator.id == current_hierarchy.supervisor_id
                )
            )
            return result.scalar_one_or_none()
        
        return None

    @staticmethod
    async def list_hierarchy(
        db: AsyncSession,
        department: Optional[str] = None,
        job_level: Optional[int] = None,
        is_active: bool = True,
        skip: int = 0,
        limit: int = 100
    ) -> Tuple[List[OrganizationalHierarchy], int]:
        """List hierarchy entries with filters"""
        query = select(OrganizationalHierarchy).options(
            selectinload(OrganizationalHierarchy.collaborator),
            selectinload(OrganizationalHierarchy.supervisor)
        )
        
        conditions = [OrganizationalHierarchy.is_active == is_active]
        
        if department:
            conditions.append(OrganizationalHierarchy.department == department)
        if job_level:
            conditions.append(OrganizationalHierarchy.job_level == job_level)
        
        query = query.where(and_(*conditions))
        
        # Get total count
        count_result = await db.execute(
            select(OrganizationalHierarchy.id).where(and_(*conditions))
        )
        total = len(count_result.all())
        
        # Get paginated results
        query = query.offset(skip).limit(limit)
        result = await db.execute(query)
        items = result.scalars().all()
        
        return list(items), total

    @staticmethod
    async def get_direct_reports(
        db: AsyncSession,
        supervisor_id: int
    ) -> List[OrganizationalHierarchy]:
        """Get all direct reports for a supervisor"""
        result = await db.execute(
            select(OrganizationalHierarchy)
            .options(selectinload(OrganizationalHierarchy.collaborator))
            .where(
                and_(
                    OrganizationalHierarchy.supervisor_id == supervisor_id,
                    OrganizationalHierarchy.is_active == True
                )
            )
        )
        return list(result.scalars().all())

    @staticmethod
    async def delete_hierarchy(
        db: AsyncSession,
        collaborator_id: int
    ) -> bool:
        """Delete (deactivate) a hierarchy entry"""
        result = await db.execute(
            select(OrganizationalHierarchy).where(
                OrganizationalHierarchy.collaborator_id == collaborator_id
            )
        )
        hierarchy = result.scalar_one_or_none()
        
        if hierarchy:
            hierarchy.is_active = False
            await db.commit()
            return True
        return False

    @staticmethod
    def to_response(hierarchy: OrganizationalHierarchy) -> HierarchyResponse:
        """Convert model to response schema"""
        collaborator_brief = None
        supervisor_brief = None
        
        if hierarchy.collaborator:
            collaborator_brief = CollaboratorBrief(
                id=hierarchy.collaborator.id,
                email=hierarchy.collaborator.email,
                name=hierarchy.collaborator.name
            )
        
        if hierarchy.supervisor:
            supervisor_brief = CollaboratorBrief(
                id=hierarchy.supervisor.id,
                email=hierarchy.supervisor.email,
                name=hierarchy.supervisor.name
            )
        
        return HierarchyResponse(
            id=hierarchy.id,
            collaborator_id=hierarchy.collaborator_id,
            supervisor_id=hierarchy.supervisor_id,
            job_level=hierarchy.job_level,
            job_title=hierarchy.job_title,
            department=hierarchy.department,
            cost_center=hierarchy.cost_center,
            is_active=hierarchy.is_active,
            job_level_label=hierarchy.job_level_label,
            created_at=hierarchy.created_at,
            updated_at=hierarchy.updated_at,
            collaborator=collaborator_brief,
            supervisor=supervisor_brief
        )
