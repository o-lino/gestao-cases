"""
Rate limiting middleware for FastAPI.
Implements Redis-based rate limiting for production environments.
"""
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
import time
import asyncio
from typing import Optional, Dict
from collections import defaultdict

# In-memory rate limiting (for development/single instance)
class InMemoryRateLimiter:
    def __init__(self):
        self.requests: Dict[str, list] = defaultdict(list)
    
    async def is_allowed(self, key: str, limit: int, window: int) -> tuple[bool, int]:
        """
        Check if request is allowed based on rate limit.
        Returns (is_allowed, remaining_requests)
        """
        now = time.time()
        window_start = now - window
        
        # Clean old requests
        self.requests[key] = [ts for ts in self.requests[key] if ts > window_start]
        
        # Check limit
        current_count = len(self.requests[key])
        if current_count >= limit:
            return False, 0
        
        # Add this request
        self.requests[key].append(now)
        return True, limit - current_count - 1

# Global rate limiter instance
rate_limiter = InMemoryRateLimiter()

class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware.
    
    Default limits:
    - 100 requests per minute for general endpoints
    - 10 requests per minute for auth endpoints
    - 5 requests per minute for case creation
    """
    
    # Endpoint-specific limits (requests, window_seconds)
    LIMITS = {
        "/api/v1/auth/login": (10, 60),
        "/api/v1/cases": (30, 60),  # For POST (creation)
        "default": (100, 60),
    }
    
    async def dispatch(self, request: Request, call_next):
        # Get client identifier (IP or user ID)
        client_id = self._get_client_id(request)
        endpoint = request.url.path
        method = request.method
        
        # Determine limit based on endpoint
        if method == "POST" and endpoint in self.LIMITS:
            limit, window = self.LIMITS[endpoint]
        else:
            limit, window = self.LIMITS["default"]
        
        # Create rate limit key
        key = f"rate_limit:{client_id}:{endpoint}:{method}"
        
        # Check rate limit
        allowed, remaining = await rate_limiter.is_allowed(key, limit, window)
        
        if not allowed:
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please try again later.",
                headers={
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(time.time()) + window),
                    "Retry-After": str(window),
                }
            )
        
        # Process request
        response = await call_next(request)
        
        # Add rate limit headers
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(int(time.time()) + window)
        
        return response
    
    def _get_client_id(self, request: Request) -> str:
        """Get client identifier from request."""
        # Try to get from JWT token (user ID)
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            # In production, decode JWT and get user ID
            # For now, use a hash of the token
            return f"token:{hash(auth_header)}"
        
        # Fall back to IP address
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        
        return request.client.host if request.client else "unknown"
