"""
Update existing users with hashed passwords.
Run with: python -m scripts.update_passwords
"""
import asyncio
from app.core.security import get_password_hash
from app.db.session import SessionLocal
from app.models.collaborator import Collaborator
from sqlalchemy import select

DEFAULT_PASSWORD = "ChangeMe123!"

async def update_passwords():
    async with SessionLocal() as db:
        # Get all users without hashed password
        result = await db.execute(
            select(Collaborator).where(Collaborator.hashed_password == None)
        )
        users = result.scalars().all()
        
        if not users:
            print("No users need password update")
            return
        
        hashed = get_password_hash(DEFAULT_PASSWORD)
        
        for user in users:
            user.hashed_password = hashed
            print(f"Updated password for: {user.email}")
        
        await db.commit()
        print(f"Updated {len(users)} users with default password")

if __name__ == "__main__":
    asyncio.run(update_passwords())
