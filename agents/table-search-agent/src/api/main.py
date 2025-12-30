from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.core.config import settings
from .routes import (
    search_router, 
    search_v2_router, 
    search_v3_router,
    search_v4_router,
    search_v5_router,
    search_v6_router,
    feedback_router,
    feedback_v2_router,
    admin_router, 
    metrics_router,
    monitoring_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    print("=" * 50)
    print("[Startup] Table Search Agent v1.1.0")
    print("=" * 50)
    
    # Quality sync
    from src.agent.quality import get_quality_cache, start_quality_sync
    
    print("[Startup] Syncing quality metrics from Athena...")
    cache = get_quality_cache()
    result = await cache.sync_from_athena(force=True)
    print(f"[Startup] Quality sync complete: {result}")
    
    await start_quality_sync()
    print("[Startup] Quality scheduler started")
    
    # DataMesh export
    from src.agent.monitoring import start_datamesh_export
    await start_datamesh_export()
    print("[Startup] DataMesh exporter started")
    
    print("[Startup] Ready to serve requests")
    print("=" * 50)
    
    yield
    
    # Shutdown
    print("[Shutdown] Stopping services...")
    
    from src.agent.quality import stop_quality_sync
    await stop_quality_sync()
    print("[Shutdown] Quality scheduler stopped")
    
    from src.agent.monitoring import stop_datamesh_export
    await stop_datamesh_export()
    print("[Shutdown] DataMesh exporter stopped")
    
    print("[Shutdown] Complete")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    
    app = FastAPI(
        title="Table Search Agent",
        description="LangGraph-based intelligent agent for table search with disambiguation, column search, and LLM reranking",
        version="1.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )
    
    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Configure for production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Include routers
    app.include_router(search_router, prefix="/api/v1")       # V1 (legacy)
    app.include_router(search_v2_router, prefix="/api")       # V2 (hierarchical)
    app.include_router(search_v3_router, prefix="/api")       # V3 (disambiguation)
    app.include_router(search_v4_router, prefix="/api")       # V4 (column search)
    app.include_router(search_v5_router, prefix="/api")       # V5 (ambiguity)
    app.include_router(search_v6_router, prefix="/api")       # V6 (final)
    app.include_router(feedback_router, prefix="/api/v1")     # V1 feedback
    app.include_router(feedback_v2_router, prefix="/api")     # V2 feedback
    app.include_router(admin_router, prefix="/api/v1")
    app.include_router(metrics_router, prefix="/api/v1")
    app.include_router(monitoring_router, prefix="/api")      # Monitoring
    
    # Root endpoint
    @app.get("/")
    async def root():
        return {
            "name": "Table Search Agent",
            "version": "1.1.0",
            "docs": "/docs",
            "endpoints": {
                "search": "/api/v6/search/single",
                "feedback": "/api/v2/feedback",
                "monitoring": "/api/monitoring/dashboard",
                "health": "/api/monitoring/health",
            },
            "features": [
                "Hierarchical search (Domain → Owner → Table)",
                "Column-level search",
                "Historical learning from feedback",
                "Multi-dimensional disambiguation scoring",
                "Ambiguity detection with clarifying questions",
                "LLM-based reranking",
                "DataMesh monitoring export",
            ]
        }
    
    return app


# Application instance
app = create_app()


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "src.api.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.api_debug,
    )
