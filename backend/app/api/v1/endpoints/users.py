"""
User management endpoints for admin operations.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional, List
from pydantic import BaseModel, EmailStr

from app.models.collaborator import Collaborator
from app.api.deps import get_current_user, require_admin, require_moderator_or_above, get_db
from app.core.permissions import UserRole, ROLE_DESCRIPTIONS

router = APIRouter()


class UserCreate(BaseModel):
    email: EmailStr
    name: str
    role: str = UserRole.USER.value


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    active: Optional[bool] = None


class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    role: str
    active: bool

    class Config:
        from_attributes = True


@router.get("/users")
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    role: Optional[str] = None,
    active: Optional[bool] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_moderator_or_above)  # Moderators can view users
):
    """
    List all users with optional filters.
    Requires ADMIN or MANAGER role.
    """
    query = select(Collaborator)
    
    if role:
        query = query.where(Collaborator.role == role)
    
    if active is not None:
        query = query.where(Collaborator.active == active)
    
    if search:
        search_term = f"%{search}%"
        query = query.where(
            Collaborator.name.ilike(search_term) | 
            Collaborator.email.ilike(search_term)
        )
    
    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Get paginated results
    query = query.offset(skip).limit(limit).order_by(Collaborator.name)
    result = await db.execute(query)
    users = result.scalars().all()
    
    return {
        "items": [UserResponse.model_validate(u) for u in users],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.post("/users", response_model=UserResponse)
async def create_user(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_admin)  # Only admins can create users
):
    """
    Create a new user.
    Requires ADMIN role.
    """
    # Check if email already exists
    existing = await db.execute(
        select(Collaborator).where(Collaborator.email == user_data.email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    new_user = Collaborator(
        email=user_data.email,
        name=user_data.name,
        role=user_data.role,
        active=True,
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    return new_user


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Get a specific user by ID.
    """
    result = await db.execute(
        select(Collaborator).where(Collaborator.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_admin)  # Only admins can update users
):
    """
    Update a user.
    Requires ADMIN role.
    """
    result = await db.execute(
        select(Collaborator).where(Collaborator.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update fields
    update_data = user_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    
    await db.commit()
    await db.refresh(user)
    
    return user


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_admin)  # Only admins can delete users
):
    """
    Soft delete a user (set active=False).
    Requires ADMIN role.
    """
    result = await db.execute(
        select(Collaborator).where(Collaborator.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.active = False
    await db.commit()
    
    return {"message": "User deactivated successfully"}


@router.get("/users/me")
async def get_current_user_profile(
    current_user = Depends(get_current_user)
):
    """
    Get current user's profile.
    """
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "role": current_user.role,
    }
