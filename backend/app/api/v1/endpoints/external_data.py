"""
External Data API Endpoints

Endpoints for synchronizing external data from other systems.
Used by automated processes to update Collaborators, DataTables, and Hierarchy.
All endpoints require ADMIN role.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.models.collaborator import Collaborator
from app.services.external_data_service import external_data_service
from app.schemas.external_data import (
    CollaboratorSyncRequest,
    DataTableSyncRequest,
    HierarchySyncRequest,
    SyncResult,
    ExternalDataStats,
)


router = APIRouter()


# =============================================================================
# Collaborator Sync
# =============================================================================

@router.post("/collaborators/sync", response_model=SyncResult)
async def sync_collaborators(
    request: CollaboratorSyncRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.require_admin)
):
    """
    Synchronize collaborators from external HR system.
    
    Receives a list of collaborator records and performs upsert:
    - Creates new collaborators if email doesn't exist
    - Updates existing collaborators if email matches
    
    Expected input format (from pandas DataFrame):
    ```python
    import pandas as pd
    df = pd.DataFrame([...])
    requests.post(url, json={"data": df.to_dict(orient='records')})
    ```
    """
    result = await external_data_service.sync_collaborators(db, request.data)
    return result


# =============================================================================
# DataTable Sync
# =============================================================================

@router.post("/data-tables/sync", response_model=SyncResult)
async def sync_data_tables(
    request: DataTableSyncRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.require_admin)
):
    """
    Synchronize data tables from external catalog (e.g., Atlan, AWS Glue).
    
    Receives a list of data table records and performs upsert:
    - Creates new tables if name doesn't exist
    - Updates existing tables if name matches
    - Resolves owner_email to owner_id
    
    Expected input format (from pandas DataFrame):
    ```python
    import pandas as pd
    df = pd.DataFrame([...])
    requests.post(url, json={"data": df.to_dict(orient='records')})
    ```
    """
    result = await external_data_service.sync_data_tables(db, request.data)
    return result


# =============================================================================
# Organizational Hierarchy Sync
# =============================================================================

@router.post("/hierarchy/sync", response_model=SyncResult)
async def sync_organizational_hierarchy(
    request: HierarchySyncRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.require_admin)
):
    """
    Synchronize organizational hierarchy from external HR system.
    
    Receives a list of hierarchy records and performs upsert:
    - Creates new hierarchy record if collaborator doesn't have one
    - Updates existing hierarchy if collaborator_id matches
    - Resolves collaborator_email and supervisor_email to IDs
    
    Note: Collaborators must exist before syncing hierarchy.
    
    Expected input format (from pandas DataFrame):
    ```python
    import pandas as pd
    df = pd.DataFrame([...])
    requests.post(url, json={"data": df.to_dict(orient='records')})
    ```
    """
    result = await external_data_service.sync_organizational_hierarchy(db, request.data)
    return result


# =============================================================================
# Statistics
# =============================================================================

@router.get("/stats", response_model=ExternalDataStats)
async def get_external_data_stats(
    db: AsyncSession = Depends(deps.get_db),
    current_user: Collaborator = Depends(deps.require_admin)
):
    """
    Get statistics about external data tables.
    
    Returns counts for:
    - Total and active collaborators
    - Total and active data tables
    - Hierarchy records
    """
    return await external_data_service.get_stats(db)
