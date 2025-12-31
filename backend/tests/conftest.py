
import pytest
import pytest_asyncio
from typing import AsyncGenerator, Generator
from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db.base import Base
from app.api.deps import get_db
from app.core.config import settings
from app.core.security import get_password_hash

# Tests use a separate database (db-test in docker-compose.test.yml)
# The database uses tmpfs so all data is ephemeral

@pytest_asyncio.fixture(scope="function")
async def db() -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI, pool_pre_ping=True)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, class_=AsyncSession)
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed test user with hashed password
    from app.models.collaborator import Collaborator
    async with TestingSessionLocal() as session:
        user = Collaborator(
            id=1,
            email="admin@example.com",
            name="Admin User",
            role="ADMIN",
            hashed_password=get_password_hash("TestPassword123!")
        )
        session.add(user)
        await session.commit()

    async with TestingSessionLocal() as session:
        yield session
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()

@pytest_asyncio.fixture(scope="function")
async def client(db: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()
