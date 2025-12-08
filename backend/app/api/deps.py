
from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from loguru import logger

from app.core import security
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.collaborator import Collaborator
from app.schemas.token import TokenPayload

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login/access-token"
)

async def get_db() -> Generator:
    async with SessionLocal() as db:
        yield db

async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(reusable_oauth2)
) -> Collaborator:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
    except (JWTError, ValidationError) as e:
        logger.debug(f"Token validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    
    # Fetch user from database using email from token
    logger.debug(f"Searching for user with email: {token_data.sub}")
    result = await db.execute(
        select(Collaborator).where(Collaborator.email == token_data.sub)
    )
    user = result.scalars().first()
    
    if not user:
        logger.debug(f"User not found for email: {token_data.sub}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if not user.active:
        logger.debug(f"User inactive: {token_data.sub}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    
    logger.debug(f"User authenticated successfully: {user.email}")
    return user


# Alias for compatibility
async def get_current_active_user(
    current_user: Collaborator = Depends(get_current_user)
) -> Collaborator:
    """Dependency that returns current active user (alias for get_current_user)"""
    return current_user


# Role-based permission dependencies
from app.core.permissions import UserRole


def require_role(required_role: UserRole):
    """Factory for role-checking dependencies."""
    async def role_checker(
        current_user: Collaborator = Depends(get_current_user)
    ) -> Collaborator:
        if not UserRole.has_permission(current_user.role, required_role.value):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires {required_role.value} role or higher"
            )
        return current_user
    return role_checker


async def require_admin(
    current_user: Collaborator = Depends(get_current_user)
) -> Collaborator:
    """Dependency that requires ADMIN role."""
    if current_user.role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


async def require_moderator_or_above(
    current_user: Collaborator = Depends(get_current_user)
) -> Collaborator:
    """Dependency that requires MODERATOR or ADMIN role."""
    if not UserRole.has_permission(current_user.role, UserRole.MODERATOR.value):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Moderator access required"
        )
    return current_user
