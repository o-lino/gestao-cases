"""
Celery Configuration

Async task processing for:
- Variable matching
- Owner notifications
- Catalog sync batches
"""

from celery import Celery
from app.core.config import settings

# Create Celery app
celery_app = Celery(
    "gestao_cases",
    broker=getattr(settings, 'REDIS_URL', 'redis://redis:6379/0'),
    backend=getattr(settings, 'REDIS_URL', 'redis://redis:6379/0'),
    include=[
        'app.workers.tasks',
    ]
)

# Celery configuration
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='America/Sao_Paulo',
    enable_utc=True,
    
    # Task settings
    task_track_started=True,
    task_time_limit=300,  # 5 minutes max
    task_soft_time_limit=240,  # 4 minutes soft limit
    
    # Retry settings
    task_default_retry_delay=60,  # 1 minute
    task_max_retries=3,
    
    # Result backend
    result_expires=3600,  # 1 hour
    
    # Worker settings
    worker_prefetch_multiplier=1,
    worker_concurrency=4,
)

# Beat schedule for periodic tasks
celery_app.conf.beat_schedule = {
    'sync-catalog-daily': {
        'task': 'app.workers.tasks.sync_catalog_scheduled',
        'schedule': 86400.0,  # Daily
    },
    'cleanup-expired-notifications': {
        'task': 'app.workers.tasks.cleanup_notifications',
        'schedule': 3600.0,  # Hourly
    },
}
