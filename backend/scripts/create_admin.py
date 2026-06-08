import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database.connection import AsyncSessionLocal
from app.database.models import User
from app.auth.password_manager import PasswordManager
from sqlalchemy import select

async def create_admin():
    async with AsyncSessionLocal() as db:
        # Check if admin exists
        result = await db.execute(select(User).where(User.username == "Entropic_Master"))
        admin = result.scalar_one_or_none()
        
        if not admin:
            pm = PasswordManager()
            password_hash, salt = pm.hash_password("N3wqroj3ctP@sS!0604")
            
            new_admin = User(
                username="Entropic_Master",
                email="entropicuser@gmail.com",
                password_hash=password_hash,
                password_salt=salt,
                role="admin",
                public_key="Won'tOpenWithoutPermission"
            )
            db.add(new_admin)
            await db.commit()
            print("✅ Admin user created: admin / Admin123!")
        else:
            print("ℹ️ Admin user already exists")

if __name__ == "__main__":
    asyncio.run(create_admin())
