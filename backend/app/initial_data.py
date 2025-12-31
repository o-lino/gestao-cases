
import asyncio
import logging

from app.db.session import SessionLocal
from app.models.collaborator import Collaborator
from app.models.hierarchy import OrganizationalHierarchy, JobLevel
from app.core.config import settings
from app.core.security import get_password_hash

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Default password for initial users (MUST be changed in production)
DEFAULT_PASSWORD = "ChangeMe123!"  # Users should change this on first login

# Sample collaborators data
INITIAL_COLLABORATORS = [
    {"id": 1, "email": "admin@example.com", "name": "Admin User", "role": "ADMIN"},
    {"id": 2, "email": "diretor@example.com", "name": "Carlos Silva", "role": "MODERATOR"},
    {"id": 3, "email": "gerente@example.com", "name": "Ana Costa", "role": "MODERATOR"},
    {"id": 4, "email": "coord@example.com", "name": "Roberto Santos", "role": "CURATOR"},
    {"id": 5, "email": "analista1@example.com", "name": "Mariana Lima", "role": "USER"},
    {"id": 6, "email": "analista2@example.com", "name": "Pedro Oliveira", "role": "USER"},
    {"id": 7, "email": "analista3@example.com", "name": "Juliana Ferreira", "role": "USER"},
]

# Sample hierarchy data (collaborator_id, supervisor_id, job_level, job_title, department)
INITIAL_HIERARCHY = [
    (1, None, JobLevel.DIRECTOR, "Diretor de TI", "Tecnologia"),
    (2, 1, JobLevel.SENIOR_MANAGER, "Diretor de Dados", "Dados & Analytics"),
    (3, 2, JobLevel.MANAGER, "Gerente de Analytics", "Dados & Analytics"),
    (4, 3, JobLevel.COORDINATOR, "Coordenador de BI", "Dados & Analytics"),
    (5, 4, JobLevel.ANALYST, "Analista de Dados Sr.", "Dados & Analytics"),
    (6, 4, JobLevel.ANALYST, "Analista de Dados Pl.", "Dados & Analytics"),
    (7, 3, JobLevel.SPECIALIST, "Especialista em ML", "Dados & Analytics"),
]


async def init_db() -> None:
    async with SessionLocal() as session:
        # Create collaborators
        for collab_data in INITIAL_COLLABORATORS:
            user = await session.get(Collaborator, collab_data["id"])
            if not user:
                logger.info(f"Creating collaborator: {collab_data['name']}")
                user = Collaborator(
                    id=collab_data["id"],
                    email=collab_data["email"],
                    name=collab_data["name"],
                    role=collab_data["role"],
                    hashed_password=get_password_hash(DEFAULT_PASSWORD),
                )
                session.add(user)
            else:
                logger.info(f"Collaborator already exists: {collab_data['name']}")
        
        await session.commit()
        logger.info("Collaborators initialized")
        
        # Create hierarchy entries
        for collab_id, supervisor_id, job_level, job_title, department in INITIAL_HIERARCHY:
            from sqlalchemy import select
            
            # Check if hierarchy entry exists
            result = await session.execute(
                select(OrganizationalHierarchy).where(
                    OrganizationalHierarchy.collaborator_id == collab_id
                )
            )
            existing = result.scalar_one_or_none()
            
            if not existing:
                logger.info(f"Creating hierarchy for collaborator {collab_id}: {job_title}")
                hierarchy = OrganizationalHierarchy(
                    collaborator_id=collab_id,
                    supervisor_id=supervisor_id,
                    job_level=job_level,
                    job_title=job_title,
                    department=department,
                    is_active=True
                )
                session.add(hierarchy)
            else:
                logger.info(f"Hierarchy already exists for collaborator {collab_id}")
        
        await session.commit()
        logger.info("Hierarchy initialized")
        logger.info("Initial data setup complete!")


if __name__ == "__main__":
    asyncio.run(init_db())

