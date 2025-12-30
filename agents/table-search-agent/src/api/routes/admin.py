"""
Admin Routes

Administrative endpoints for catalog sync and management.
"""

from fastapi import APIRouter, HTTPException

from ..schemas import (
    CatalogSyncRequest,
    CatalogSyncResponse,
    HealthResponse,
)
from src.agent.rag.retriever import get_retriever


router = APIRouter(prefix="/admin", tags=["Admin"])


@router.post("/sync/catalog", response_model=CatalogSyncResponse)
async def sync_catalog(request: CatalogSyncRequest) -> CatalogSyncResponse:
    """
    Sync table catalog from source system.
    
    This endpoint receives table metadata from gestao-cases-2.0 and
    indexes them in the vector database for semantic search.
    """
    retriever = get_retriever()
    synced = 0
    failed = 0
    
    for table in request.tables:
        try:
            await retriever.index_table({
                "id": table.id,
                "name": table.name,
                "display_name": table.display_name,
                "description": table.description,
                "domain": table.domain,
                "schema_name": table.schema_name,
                "keywords": table.keywords,
                "columns": table.columns,
                "owner_id": table.owner_id,
                "owner_name": table.owner_name,
            })
            synced += 1
        except Exception as e:
            print(f"Failed to sync table {table.id}: {e}")
            failed += 1
    
    return CatalogSyncResponse(
        success=failed == 0,
        tables_synced=synced,
        tables_failed=failed,
        message=f"Synced {synced} tables from {request.source}" + (
            f", {failed} failed" if failed > 0 else ""
        ),
    )


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """
    Health check endpoint.
    
    Returns the status of all system components.
    """
    components = {}
    
    # Check RAG
    try:
        get_retriever()
        components["rag"] = "healthy"
    except Exception as e:
        components["rag"] = f"unhealthy: {str(e)}"
    
    # Check agent
    try:
        from src.agent import get_agent
        get_agent()
        components["agent"] = "healthy"
    except Exception as e:
        components["agent"] = f"unhealthy: {str(e)}"
    
    # Overall status
    all_healthy = all(v == "healthy" for v in components.values())
    
    return HealthResponse(
        status="healthy" if all_healthy else "degraded",
        version="0.1.0",
        components=components,
    )
