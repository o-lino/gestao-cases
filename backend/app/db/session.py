
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Configure async engine with connection pool settings
# These are tuned for Docker container environments
engine = create_async_engine(
    settings.SQLALCHEMY_DATABASE_URI,
    pool_pre_ping=True,       # Verify connection is alive before using
    pool_size=5,              # Number of connections to keep open
    max_overflow=10,          # Extra connections under high load
    pool_timeout=30,          # Seconds to wait for available connection
    pool_recycle=1800,        # Recycle connections after 30 minutes
    echo=False,               # Set to True for SQL debugging
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    class_=AsyncSession
)


async def get_db():
    """Dependency to get database session"""
    async with SessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
