
import asyncio
import logging

from app.db.session import SessionLocal
from app.models.collaborator import Collaborator
from app.core.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def init_db() -> None:
    async with SessionLocal() as session:
        user = await session.get(Collaborator, 1)
        if not user:
            logger.info("Creating initial user")
            user = Collaborator(
                id=1,
                email="admin@example.com",
                name="Admin User",
                role="ADMIN",
                # password is not stored in this model? 
                # Auth implementation in auth.py checks hardcoded password for now.
                # But we need the user in DB for foreign keys and get_current_user check.
            )
            session.add(user)
            await session.commit()
            logger.info("Initial user created")
        else:
            logger.info("Initial user already exists")

if __name__ == "__main__":
    asyncio.run(init_db())
