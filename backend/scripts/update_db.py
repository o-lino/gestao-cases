
import asyncio
from sqlalchemy import text
from app.db.session import engine

async def add_column():
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE cases ADD COLUMN client_name VARCHAR(255)"))
            print("Column client_name added successfully.")
        except Exception as e:
            print(f"Error adding column (might already exist): {e}")

if __name__ == "__main__":
    asyncio.run(add_column())
