"""Routes module exports."""

from .search import router as search_router
from .search_v2 import router as search_v2_router
from .search_v3 import router as search_v3_router
from .search_v4 import router as search_v4_router
from .search_v5 import router as search_v5_router
from .search_v6 import router as search_v6_router
from .feedback import router as feedback_router
from .feedback_v2 import router as feedback_v2_router
from .admin import router as admin_router
from .metrics import router as metrics_router
from .monitoring import router as monitoring_router

__all__ = [
    "search_router", 
    "search_v2_router", 
    "search_v3_router",
    "search_v4_router",
    "search_v5_router",
    "search_v6_router",
    "feedback_router",
    "feedback_v2_router",
    "admin_router", 
    "metrics_router",
    "monitoring_router",
]







