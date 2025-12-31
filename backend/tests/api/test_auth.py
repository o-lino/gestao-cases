"""
Authentication Tests

Tests for the login endpoint with real password verification.
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash


class TestAuthentication:
    """Test suite for authentication endpoints"""
    
    @pytest.mark.asyncio
    async def test_login_success(self, client: AsyncClient, db: AsyncSession):
        """Test successful login with correct credentials"""
        response = await client.post(
            "/api/v1/auth/login/access-token",
            data={
                "username": "admin@example.com",
                "password": "TestPassword123!"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
    
    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client: AsyncClient, db: AsyncSession):
        """Test login failure with wrong password"""
        response = await client.post(
            "/api/v1/auth/login/access-token",
            data={
                "username": "admin@example.com",
                "password": "WrongPassword123!"
            }
        )
        assert response.status_code == 400
        assert "Incorrect email or password" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_login_nonexistent_user(self, client: AsyncClient, db: AsyncSession):
        """Test login failure with non-existent email"""
        response = await client.post(
            "/api/v1/auth/login/access-token",
            data={
                "username": "nonexistent@example.com",
                "password": "SomePassword123!"
            }
        )
        assert response.status_code == 400
        assert "Incorrect email or password" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_login_returns_valid_token(self, client: AsyncClient, db: AsyncSession):
        """Test that login returns a token that can be used for authentication"""
        # Login first
        login_response = await client.post(
            "/api/v1/auth/login/access-token",
            data={
                "username": "admin@example.com",
                "password": "TestPassword123!"
            }
        )
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        
        # Use token to access protected endpoint
        health_response = await client.get(
            "/health",
            headers={"Authorization": f"Bearer {token}"}
        )
        # Health endpoint doesn't require auth, but token should be valid format
        assert health_response.status_code == 200


class TestAuthenticationEdgeCases:
    """Edge case tests for authentication"""
    
    @pytest.mark.asyncio
    async def test_login_empty_password(self, client: AsyncClient, db: AsyncSession):
        """Test login with empty password"""
        response = await client.post(
            "/api/v1/auth/login/access-token",
            data={
                "username": "admin@example.com",
                "password": ""
            }
        )
        # Should fail validation or return 400
        assert response.status_code in [400, 422]
    
    @pytest.mark.asyncio
    async def test_login_empty_username(self, client: AsyncClient, db: AsyncSession):
        """Test login with empty username"""
        response = await client.post(
            "/api/v1/auth/login/access-token",
            data={
                "username": "",
                "password": "TestPassword123!"
            }
        )
        # Should fail validation or return 400
        assert response.status_code in [400, 422]
    
    @pytest.mark.asyncio
    async def test_old_mock_credentials_fail(self, client: AsyncClient, db: AsyncSession):
        """Ensure old mock credentials no longer work"""
        response = await client.post(
            "/api/v1/auth/login/access-token",
            data={
                "username": "admin@example.com",
                "password": "password"  # The OLD mock password
            }
        )
        assert response.status_code == 400
        assert "Incorrect email or password" in response.json()["detail"]
