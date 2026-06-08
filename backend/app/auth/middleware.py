from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.auth.jwt_handler import JWTHandler
from app.database.connection import get_db
from app.database.models import User

security = HTTPBearer()
jwt_handler = JWTHandler()  # Create instance directly

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """Get current authenticated user"""
    
    token = credentials.credentials
    print(f"Received token: {token[:50]}...")  # Debug
    
    # Verify token
    payload = jwt_handler.verify_token(token, token_type="access")
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    # Get user_id from payload
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    
    print(f"Looking for user with ID: {user_id}")  # Debug
    
    # Get user from database
    from sqlalchemy import select
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        print(f"User not found with ID: {user_id}")  # Debug
        raise HTTPException(status_code=401, detail="User not found")
    
    if user.account_locked:
        raise HTTPException(status_code=403, detail="Account is locked")
    
    print(f"User found: {user.username}")  # Debug
    return user

async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current active user"""
    return current_user

class RoleChecker:
    def __init__(self, allowed_roles: list):
        self.allowed_roles = allowed_roles
    
    async def __call__(self, current_user: User = Depends(get_current_user)):
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Role {current_user.role} not allowed. Required: {self.allowed_roles}"
            )
        return True