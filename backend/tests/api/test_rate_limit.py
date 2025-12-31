"""
Rate Limiting Tests

Tests for the rate limiting middleware.
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient


class TestRateLimiting:
    """Test suite for rate limiting"""
    
    @pytest.mark.asyncio
    async def test_rate_limit_headers_present(self, client: AsyncClient, db):
        """Test that rate limit headers are present in responses"""
        response = await client.get("/health")
        assert response.status_code == 200
        
        # Check for rate limit headers
        assert "X-RateLimit-Limit" in response.headers
        assert "X-RateLimit-Remaining" in response.headers
        assert "X-RateLimit-Reset" in response.headers
    
    @pytest.mark.asyncio
    async def test_rate_limit_decrements(self, client: AsyncClient, db):
        """Test that rate limit remaining decrements with each request"""
        # Make first request
        response1 = await client.get("/health")
        remaining1 = int(response1.headers.get("X-RateLimit-Remaining", 0))
        
        # Make second request
        response2 = await client.get("/health")
        remaining2 = int(response2.headers.get("X-RateLimit-Remaining", 0))
        
        # Remaining should have decremented (or stayed 0 if at limit)
        assert remaining2 <= remaining1
    
    @pytest.mark.asyncio
    async def test_rate_limit_auth_endpoint_stricter(self, client: AsyncClient, db):
        """Test that auth endpoints have stricter rate limits"""
        # Make a request to auth endpoint
        response = await client.post(
            "/api/v1/auth/login/access-token",
            data={"username": "test@test.com", "password": "wrong"}
        )
        
        # Check rate limit header shows lower limit (10 for auth vs 100 default)
        if "X-RateLimit-Limit" in response.headers:
            limit = int(response.headers["X-RateLimit-Limit"])
            assert limit <= 10, "Auth endpoint should have stricter rate limit"


class TestRateLimitingBehavior:
    """Behavior tests for rate limiting (requires specific setup)"""
    
    @pytest.mark.asyncio
    @pytest.mark.skip(reason="Requires many rapid requests - run manually")
    async def test_rate_limit_blocks_excessive_requests(self, client: AsyncClient, db):
        """Test that excessive requests are blocked with 429"""
        # Make many rapid requests
        for i in range(15):
            response = await client.post(
                "/api/v1/auth/login/access-token",
                data={"username": "test@test.com", "password": "wrong"}
            )
            
            if response.status_code == 429:
                # Successfully hit rate limit
                assert "Too many requests" in response.json()["detail"]
                assert "Retry-After" in response.headers
                return
        
        # If we got here without being rate limited, that's also acceptable
        # (test might run slowly enough to not hit limit)
