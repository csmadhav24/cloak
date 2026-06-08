from fastapi import APIRouter, HTTPException, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from datetime import datetime

from app.database.connection import get_db
from app.database.models import User, FileRecord, AuditLog
from app.auth.middleware import RoleChecker, get_current_user
from app.auth.password_manager import PasswordManager

router = APIRouter()
password_manager = PasswordManager()

from pydantic import BaseModel

class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    role: str
    mfa_enabled: bool
    account_locked: bool
    failed_login_attempts: int
    last_login: Optional[datetime]
    created_at: datetime

class SystemStatsResponse(BaseModel):
    total_users: int
    total_files: int
    total_storage_bytes: int
    active_sessions: int
    recent_uploads_24h: int
    failed_logins_24h: int
    integrity_failures: int

@router.get("/users")
async def get_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all users (admin only)"""
    print(f"User accessing admin: {current_user.username}, Role: {current_user.role}")
    
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.execute(select(User))
    users = result.scalars().all()
    
    
    return [
        {
            "id": str(u.id),
            "username": u.username,
            "email": u.email,
            "role": u.role,
            "account_locked": u.account_locked,
            "created_at": u.created_at.isoformat() if u.created_at else None
        }
        for u in users
    ]

@router.get("/stats")
async def get_system_stats(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get system statistics (Admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    
    users_result = await db.execute(select(func.count()).select_from(User))
    total_users = users_result.scalar() or 0
    
    
    files_result = await db.execute(select(func.count()).select_from(FileRecord))
    total_files = files_result.scalar() or 0
    
    
    storage_result = await db.execute(select(func.sum(FileRecord.file_size)).select_from(FileRecord))
    total_storage_bytes = storage_result.scalar() or 0
    
    
    day_ago = datetime.utcnow()
    recent_result = await db.execute(
        select(func.count()).select_from(FileRecord).where(FileRecord.uploaded_at >= day_ago)
    )
    recent_uploads_24h = recent_result.scalar() or 0
    
    
    failed_logins_24h = 0
    
    
    integrity_failures = 0
    
    
    active_sessions = 0
    
    return SystemStatsResponse(
        total_users=total_users,
        total_files=total_files,
        total_storage_bytes=total_storage_bytes,
        active_sessions=active_sessions,
        recent_uploads_24h=recent_uploads_24h,
        failed_logins_24h=failed_logins_24h,
        integrity_failures=integrity_failures
    )

@router.put("/users/{user_id}")
async def update_user(
    user_id: str,
    update_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update user (admin only)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    
    if "role" in update_data:
        user.role = update_data["role"]
    if "account_locked" in update_data:
        user.account_locked = update_data["account_locked"]
    
    await db.commit()
    return {"message": "User updated successfully"}