import asyncio
import sys
import os

# Add the current directory to sys.path to make imports work
sys.path.append(os.getcwd())

from app.db.session import SessionLocal
from app.models.case import Case
from sqlalchemy import select, update

async def reset_case():
    async with SessionLocal() as session:
        # Find the first case or a specific one
        result = await session.execute(select(Case.id).order_by(Case.id).limit(1))
        case_id = result.scalar_one_or_none()
        
        if case_id:
            print(f"Found case ID {case_id}")
            # Update to DRAFT
            await session.execute(
                update(Case)
                .where(Case.id == case_id)
                .values(status='DRAFT')
            )
            await session.commit()
            print(f"Reset case {case_id} to DRAFT successfully.")
        else:
            print("No cases found.")

if __name__ == "__main__":
    asyncio.run(reset_case())
