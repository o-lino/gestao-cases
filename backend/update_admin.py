"""Update admin password with fresh hash"""
import asyncio
from passlib.context import CryptContext
from app.db.session import SessionLocal
from app.models.collaborator import Collaborator
from sqlalchemy import select

pwd = CryptContext(schemes=['bcrypt'], deprecated='auto')
PASSWORD = 'admin123'  # New password

async def update_admin():
    async with SessionLocal() as db:
        result = await db.execute(
            select(Collaborator).where(Collaborator.email == 'admin@example.com')
        )
        user = result.scalars().first()
        if user:
            new_hash = pwd.hash(PASSWORD)
            print(f"Generated hash: {new_hash}")
            print(f"Hash length: {len(new_hash)}")
            user.hashed_password = new_hash
            await db.commit()
            print(f"Updated password for admin@example.com to '{PASSWORD}'")
            
            # Verify it works
            result2 = await db.execute(
                select(Collaborator).where(Collaborator.email == 'admin@example.com')
            )
            user2 = result2.scalars().first()
            verification = pwd.verify(PASSWORD, user2.hashed_password)
            print(f"Verification: {verification}")
        else:
            print("Admin user not found")

asyncio.run(update_admin())
