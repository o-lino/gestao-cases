"""
Monitoring API Routes

Endpoints for monitoring, metrics, and health checks.
"""

from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel, Field

from src.agent.monitoring import (
    get_metrics_collector,
    get_datamesh_exporter,
    get_health_checker,
    HealthStatus,
)


router = APIRouter(prefix="/monitoring", tags=["Monitoring"])


# ============== Response Models ==============

class MetricsResponse(BaseModel):
    """Current metrics response."""
    uptime_seconds: float
    total_requests: int
    
    # Quality
    hit_rate: float
    ambiguity_rate: float
    false_positive_rate: float
    
    # Feedback
    feedback_count: int
    approval_rate: float
    
    # Performance
    avg_latency_ms: float
    p50_latency_ms: float
    p95_latency_ms: float
    p99_latency_ms: float
    
    # LLM
    llm_calls_total: int
    rerank_activation_rate: float
    
    # Cache
    cache_hit_rate: float
    
    # Errors
    error_count: int


class HourlyMetricsResponse(BaseModel):
    """Hourly aggregated metrics."""
    period_start: str
    period_end: str
    total_requests: int
    hit_rate: float
    ambiguity_rate: float
    avg_latency_ms: float
    p50_latency_ms: float
    p95_latency_ms: float
    rerank_rate: float
    cache_hit_rate: float


class ComponentHealthResponse(BaseModel):
    """Component health."""
    name: str
    status: str
    message: str
    details: Optional[dict] = None


class HealthResponse(BaseModel):
    """Full health response."""
    status: str
    version: str
    uptime_seconds: float
    components: list[ComponentHealthResponse]
    timestamp: str


class ExportStatusResponse(BaseModel):
    """DataMesh export status."""
    running: bool
    method: str
    last_export: Optional[str] = None
    buffer_size: int
    interval_minutes: int


class ExportResult(BaseModel):
    """Export result."""
    status: str
    method: str
    last_export: Optional[str] = None


# ============== Endpoints ==============

@router.get("/metrics", response_model=MetricsResponse)
async def get_metrics() -> MetricsResponse:
    """Get current metrics."""
    collector = get_metrics_collector()
    stats = collector.get_current_stats()
    return MetricsResponse(**stats)


@router.get("/metrics/hourly", response_model=HourlyMetricsResponse)
async def get_hourly_metrics() -> HourlyMetricsResponse:
    """Get hourly aggregated metrics."""
    collector = get_metrics_collector()
    hourly = collector.aggregate_hourly()
    
    return HourlyMetricsResponse(
        period_start=hourly.period_start.isoformat(),
        period_end=hourly.period_end.isoformat(),
        total_requests=hourly.total_requests,
        hit_rate=hourly.hit_rate_top1,
        ambiguity_rate=hourly.ambiguity_rate,
        avg_latency_ms=hourly.avg_latency_ms,
        p50_latency_ms=hourly.p50_latency_ms,
        p95_latency_ms=hourly.p95_latency_ms,
        rerank_rate=hourly.rerank_activation_rate,
        cache_hit_rate=hourly.intent_cache_hit_rate,
    )


@router.get("/health", response_model=HealthResponse)
async def get_health() -> HealthResponse:
    """Get full health status."""
    checker = get_health_checker()
    health = await checker.check_all()
    
    return HealthResponse(
        status=health.status.value,
        version=health.version,
        uptime_seconds=health.uptime_seconds,
        components=[
            ComponentHealthResponse(
                name=c.name,
                status=c.status.value,
                message=c.message,
                details=c.details,
            )
            for c in health.components
        ],
        timestamp=health.timestamp.isoformat(),
    )


@router.get("/health/simple")
async def get_health_simple():
    """Simple health check for load balancers."""
    checker = get_health_checker()
    health = await checker.check_all()
    
    if health.status == HealthStatus.UNHEALTHY:
        return {"status": "unhealthy"}, 503
    
    return {"status": health.status.value}


@router.get("/export/status", response_model=ExportStatusResponse)
async def get_export_status() -> ExportStatusResponse:
    """Get DataMesh export status."""
    exporter = get_datamesh_exporter()
    return ExportStatusResponse(**exporter.status)


@router.post("/export/now", response_model=ExportResult)
async def export_now() -> ExportResult:
    """Force immediate export to DataMesh."""
    exporter = get_datamesh_exporter()
    result = await exporter.export_now()
    return ExportResult(**result)


@router.get("/dashboard")
async def get_dashboard_data():
    """Get all data for dashboard view."""
    collector = get_metrics_collector()
    checker = get_health_checker()
    exporter = get_datamesh_exporter()
    
    stats = collector.get_current_stats()
    hourly = collector.aggregate_hourly()
    health = await checker.check_all()
    
    return {
        "summary": {
            "status": health.status.value,
            "version": "1.0.0",
            "uptime_seconds": stats["uptime_seconds"],
            "total_requests": stats["total_requests"],
        },
        "quality": {
            "hit_rate": stats["hit_rate"],
            "approval_rate": stats["approval_rate"],
            "ambiguity_rate": stats["ambiguity_rate"],
            "false_positive_rate": stats["false_positive_rate"],
        },
        "performance": {
            "avg_latency_ms": stats["avg_latency_ms"],
            "p50_latency_ms": stats["p50_latency_ms"],
            "p95_latency_ms": stats["p95_latency_ms"],
            "p99_latency_ms": stats["p99_latency_ms"],
            "cache_hit_rate": stats["cache_hit_rate"],
        },
        "llm": {
            "total_calls": stats["llm_calls_total"],
            "rerank_rate": stats["rerank_activation_rate"],
        },
        "hourly": {
            "requests": hourly.total_requests,
            "hit_rate": hourly.hit_rate_top1,
            "p95_latency": hourly.p95_latency_ms,
        },
        "health": {
            "overall": health.status.value,
            "components": [
                {"name": c.name, "status": c.status.value}
                for c in health.components
            ],
        },
        "export": exporter.status,
    }
