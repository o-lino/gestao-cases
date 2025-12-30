"""
External Data Service

Service for synchronizing external data (Collaborators, DataTables, Hierarchy)
with the internal database. Uses upsert logic to create or update records.
"""

from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from loguru import logger

from app.models.collaborator import Collaborator
from app.models.data_catalog import DataTable
from app.models.hierarchy import OrganizationalHierarchy
from app.schemas.external_data import (
    CollaboratorSyncItem,
    DataTableSyncItem,
    HierarchySyncItem,
    SyncResult,
    SyncError,
    ExternalDataStats,
)


class ExternalDataService:
    """Service for external data synchronization"""

    # =========================================================================
    # Collaborator Sync
    # =========================================================================

    async def sync_collaborators(
        self,
        db: AsyncSession,
        items: List[CollaboratorSyncItem]
    ) -> SyncResult:
        """
        Synchronize collaborators from external source.
        Uses email as unique identifier for upsert.
        """
        result = SyncResult(total_processed=len(items))
        
        for idx, item in enumerate(items):
            try:
                # Check if collaborator exists
                stmt = select(Collaborator).where(Collaborator.email == item.email)
                existing = (await db.execute(stmt)).scalar_one_or_none()
                
                if existing:
                    # Update existing
                    existing.name = item.name
                    existing.role = item.role or "USER"
                    existing.active = item.active if item.active is not None else True
                    result.updated += 1
                    logger.debug(f"Updated collaborator: {item.email}")
                else:
                    # Create new
                    new_collab = Collaborator(
                        email=item.email,
                        name=item.name,
                        role=item.role or "USER",
                        active=item.active if item.active is not None else True
                    )
                    db.add(new_collab)
                    result.created += 1
                    logger.debug(f"Created collaborator: {item.email}")
                    
            except Exception as e:
                result.errors.append(SyncError(
                    index=idx,
                    identifier=item.email,
                    error=str(e)
                ))
                logger.error(f"Error syncing collaborator {item.email}: {e}")
        
        await db.commit()
        logger.info(f"Collaborator sync complete: {result.created} created, {result.updated} updated, {len(result.errors)} errors")
        return result

    # =========================================================================
    # DataTable Sync
    # =========================================================================

    async def sync_data_tables(
        self,
        db: AsyncSession,
        items: List[DataTableSyncItem]
    ) -> SyncResult:
        """
        Synchronize data tables from external catalog.
        Uses name as unique identifier for upsert.
        """
        result = SyncResult(total_processed=len(items))
        
        # Pre-fetch all collaborator emails for owner resolution
        email_to_id = await self._get_collaborator_email_map(db)
        
        for idx, item in enumerate(items):
            try:
                # Resolve owner_id from email
                owner_id = None
                if item.owner_email:
                    owner_id = email_to_id.get(item.owner_email)
                    if not owner_id:
                        logger.warning(f"Owner email {item.owner_email} not found for table {item.name}")
                
                # Check if table exists
                stmt = select(DataTable).where(DataTable.name == item.name)
                existing = (await db.execute(stmt)).scalar_one_or_none()
                
                if existing:
                    # Update existing
                    existing.display_name = item.display_name
                    existing.description = item.description
                    existing.schema_name = item.schema_name
                    existing.database_name = item.database_name
                    existing.full_path = item.full_path
                    existing.domain = item.domain
                    existing.keywords = item.keywords or []
                    existing.columns = item.columns or []
                    existing.row_count = item.row_count
                    existing.is_active = item.is_active if item.is_active is not None else True
                    existing.is_sensitive = item.is_sensitive if item.is_sensitive is not None else False
                    if owner_id:
                        existing.owner_id = owner_id
                    result.updated += 1
                    logger.debug(f"Updated data table: {item.name}")
                else:
                    # Create new
                    new_table = DataTable(
                        name=item.name,
                        display_name=item.display_name,
                        description=item.description,
                        schema_name=item.schema_name,
                        database_name=item.database_name,
                        full_path=item.full_path,
                        domain=item.domain,
                        keywords=item.keywords or [],
                        columns=item.columns or [],
                        row_count=item.row_count,
                        owner_id=owner_id,
                        is_active=item.is_active if item.is_active is not None else True,
                        is_sensitive=item.is_sensitive if item.is_sensitive is not None else False
                    )
                    db.add(new_table)
                    result.created += 1
                    logger.debug(f"Created data table: {item.name}")
                    
            except Exception as e:
                result.errors.append(SyncError(
                    index=idx,
                    identifier=item.name,
                    error=str(e)
                ))
                logger.error(f"Error syncing data table {item.name}: {e}")
        
        await db.commit()
        logger.info(f"DataTable sync complete: {result.created} created, {result.updated} updated, {len(result.errors)} errors")
        return result

    # =========================================================================
    # Organizational Hierarchy Sync
    # =========================================================================

    async def sync_organizational_hierarchy(
        self,
        db: AsyncSession,
        items: List[HierarchySyncItem]
    ) -> SyncResult:
        """
        Synchronize organizational hierarchy from external source.
        Uses collaborator_id as unique identifier for upsert.
        """
        result = SyncResult(total_processed=len(items))
        
        # Pre-fetch all collaborator emails for resolution
        email_to_id = await self._get_collaborator_email_map(db)
        
        for idx, item in enumerate(items):
            try:
                # Resolve collaborator_id from email
                collaborator_id = email_to_id.get(item.collaborator_email)
                if not collaborator_id:
                    result.errors.append(SyncError(
                        index=idx,
                        identifier=item.collaborator_email,
                        error=f"Collaborator not found: {item.collaborator_email}"
                    ))
                    continue
                
                # Resolve supervisor_id from email
                supervisor_id = None
                if item.supervisor_email:
                    supervisor_id = email_to_id.get(item.supervisor_email)
                    if not supervisor_id:
                        logger.warning(f"Supervisor email {item.supervisor_email} not found for {item.collaborator_email}")
                
                # Check if hierarchy record exists
                stmt = select(OrganizationalHierarchy).where(
                    OrganizationalHierarchy.collaborator_id == collaborator_id
                )
                existing = (await db.execute(stmt)).scalar_one_or_none()
                
                if existing:
                    # Update existing
                    existing.supervisor_id = supervisor_id
                    existing.job_level = item.job_level
                    existing.job_title = item.job_title
                    existing.department = item.department
                    existing.cost_center = item.cost_center
                    existing.is_active = item.is_active if item.is_active is not None else True
                    result.updated += 1
                    logger.debug(f"Updated hierarchy for: {item.collaborator_email}")
                else:
                    # Create new
                    new_hierarchy = OrganizationalHierarchy(
                        collaborator_id=collaborator_id,
                        supervisor_id=supervisor_id,
                        job_level=item.job_level,
                        job_title=item.job_title,
                        department=item.department,
                        cost_center=item.cost_center,
                        is_active=item.is_active if item.is_active is not None else True
                    )
                    db.add(new_hierarchy)
                    result.created += 1
                    logger.debug(f"Created hierarchy for: {item.collaborator_email}")
                    
            except Exception as e:
                result.errors.append(SyncError(
                    index=idx,
                    identifier=item.collaborator_email,
                    error=str(e)
                ))
                logger.error(f"Error syncing hierarchy {item.collaborator_email}: {e}")
        
        await db.commit()
        logger.info(f"Hierarchy sync complete: {result.created} created, {result.updated} updated, {len(result.errors)} errors")
        return result

    # =========================================================================
    # Statistics
    # =========================================================================

    async def get_stats(self, db: AsyncSession) -> ExternalDataStats:
        """Get statistics about external data tables"""
        
        # Collaborators
        collab_total = (await db.execute(
            select(func.count(Collaborator.id))
        )).scalar() or 0
        
        collab_active = (await db.execute(
            select(func.count(Collaborator.id)).where(Collaborator.active == True)
        )).scalar() or 0
        
        # DataTables
        tables_total = (await db.execute(
            select(func.count(DataTable.id))
        )).scalar() or 0
        
        tables_active = (await db.execute(
            select(func.count(DataTable.id)).where(DataTable.is_active == True)
        )).scalar() or 0
        
        # Hierarchy
        hierarchy_count = (await db.execute(
            select(func.count(OrganizationalHierarchy.id))
        )).scalar() or 0
        
        return ExternalDataStats(
            collaborators_total=collab_total,
            collaborators_active=collab_active,
            data_tables_total=tables_total,
            data_tables_active=tables_active,
            hierarchy_records=hierarchy_count
        )

    # =========================================================================
    # Helper Methods
    # =========================================================================

    async def _get_collaborator_email_map(self, db: AsyncSession) -> Dict[str, int]:
        """Get mapping from email to collaborator ID"""
        stmt = select(Collaborator.email, Collaborator.id)
        result = await db.execute(stmt)
        return {row.email: row.id for row in result.fetchall()}


# Singleton instance
external_data_service = ExternalDataService()
