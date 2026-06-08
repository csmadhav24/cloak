import asyncio
from app.database.connection import engine
from app.database.models import Base

async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Database tables created successfully!")

asyncio.run(create_tables())