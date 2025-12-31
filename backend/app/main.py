
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.api.v1.router import api_router
from app.core.exceptions import (
    business_rule_exception_handler,
    integrity_error_handler,
    validation_error_handler,
    BusinessRuleException
)
from app.core.rate_limit import RateLimitMiddleware

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Register exception handlers
app.add_exception_handler(BusinessRuleException, business_rule_exception_handler)
app.add_exception_handler(IntegrityError, integrity_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)

# Configure CORS with specific origins from settings
# In production, BACKEND_CORS_ORIGINS should be set to your actual domains
if settings.BACKEND_CORS_ORIGINS:
    # Convert Pydantic URL objects to strings and strip trailing slashes for proper matching
    origins = [str(origin).rstrip('/') for origin in settings.BACKEND_CORS_ORIGINS]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
    )
else:
    # Development fallback - still more restrictive than before
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000"],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
    )

# Add rate limiting middleware
# Protects auth endpoints (10 req/min) and case creation (30 req/min)
app.add_middleware(RateLimitMiddleware)

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/health")
def health_check():
    return {"status": "ok"}

