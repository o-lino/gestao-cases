
from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import security
from app.core.config import settings
from app.db.session import SessionLocal
from app.schemas.token import Token

router = APIRouter()

@router.post("/login/access-token", response_model=Token)
async def login_access_token(
    form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests
    """
    # TODO: Validate user against DB
    # user = await crud.user.authenticate(db, email=form_data.username, password=form_data.password)
    # if not user:
    #     raise HTTPException(status_code=400, detail="Incorrect email or password")
    # elif not crud.user.is_active(user):
    #     raise HTTPException(status_code=400, detail="Inactive user")
    
    # MOCK implementation for scaffolding
    if form_data.username != "admin@example.com" or form_data.password != "password":
         raise HTTPException(status_code=400, detail="Incorrect email or password")

    # Ensure user exists in DB for foreign key constraints and token validation
    # This fixes the 403 Forbidden error where token is valid but user is missing in DB
    from app.models.collaborator import Collaborator
    from sqlalchemy import select
    
    async with SessionLocal() as db:
        result = await db.execute(select(Collaborator).where(Collaborator.email == form_data.username))
        user = result.scalars().first()
        if not user:
            user = Collaborator(
                email=form_data.username,
                name="Admin User",
                role="ADMIN",
                active=True
            )
            db.add(user)
            await db.commit()

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": security.create_access_token(
            subject=form_data.username, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }
