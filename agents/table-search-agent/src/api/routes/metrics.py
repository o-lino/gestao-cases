"""
Metrics Endpoint

Exposes metrics for monitoring agent quality.
"""

from fastapi import APIRouter
from pydantic import BaseModel

from src.agent.metrics import get_metrics_collector, MetricsSummary
from src.agent.memory import get_intent_cache


router = APIRouter(prefix="/metrics", tags=["Metrics"])


class MetricsResponse(BaseModel):
    """Metrics response model."""
    # Volume
    total_requests: int
    total_with_feedback: int
    
    # Accuracy
    hit_rate_top1: float
    hit_rate_owner: float
    
    # Calibration
    avg_confidence_when_approved: float
    avg_confidence_when_rejected: float
    false_positive_rate: float
    
    # Performance
    avg_latency_ms: float
    p95_latency_ms: float
    
    # Cache
    intent_cache_hit_rate: float
    intent_cache_size: int


class CacheStatsResponse(BaseModel):
    """Cache statistics."""
    size: int
    max_size: int
    hits: int
    misses: int
    hit_rate: str


@router.get("", response_model=MetricsResponse)
async def get_metrics() -> MetricsResponse:
    """Get aggregated quality metrics."""
    collector = get_metrics_collector()
    summary = collector.get_summary()
    cache = get_intent_cache()
    
    return MetricsResponse(
        total_requests=summary.total_requests,
        total_with_feedback=summary.total_with_feedback,
        hit_rate_top1=summary.hit_rate_top1,
        hit_rate_owner=summary.hit_rate_owner,
        avg_confidence_when_approved=summary.avg_confidence_when_approved,
        avg_confidence_when_rejected=summary.avg_confidence_when_rejected,
        false_positive_rate=summary.false_positive_rate,
        avg_latency_ms=summary.avg_latency_ms,
        p95_latency_ms=summary.p95_latency_ms,
        intent_cache_hit_rate=summary.intent_cache_hit_rate,
        intent_cache_size=cache.stats["size"],
    )


@router.get("/cache", response_model=CacheStatsResponse)
async def get_cache_stats() -> CacheStatsResponse:
    """Get intent cache statistics."""
    cache = get_intent_cache()
    stats = cache.stats
    
    return CacheStatsResponse(**stats)


@router.post("/export")
async def export_metrics(path: str = "./data/metrics_export.json"):
    """Export all events to JSON file."""
    collector = get_metrics_collector()
    count = collector.export_events(path)
    
    return {"exported": count, "path": path}
