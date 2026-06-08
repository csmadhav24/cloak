from fastapi import APIRouter, HTTPException, Depends, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
import uuid

from app.database.connection import get_db
from app.database.models import User, AuditLog
from app.auth.password_manager import PasswordManager
from app.auth.jwt_handler import JWTHandler
from app.auth.middleware import get_current_user
from app.crypto.rsa_handler import RSAHandler

router = APIRouter()
security = HTTPBearer()
password_manager = PasswordManager()


jwt_handler = None
rsa_handler = None

def setup_handlers(jwt, rsa):
    """Inject handlers into auth routes"""
    global jwt_handler, rsa_handler
    jwt_handler = jwt
    rsa_handler = rsa


class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8)
    public_key: str

class UserLogin(BaseModel):
    username: str
    password: str
    mfa_token: str = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict

@router.post("/register")
async def register(
    user_data: UserRegister, 
    request: Request, 
    db: AsyncSession = Depends(get_db)
):
    """Register a new user"""
    
    
    is_valid, issues = password_manager.validate_password_strength(user_data.password)
    if not is_valid:
        raise HTTPException(status_code=400, detail={"errors": issues})
    
    
    existing_user = await db.execute(
        select(User).where(User.username == user_data.username)
    )
    if existing_user.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Username already exists")
    
    
    existing_email = await db.execute(
        select(User).where(User.email == user_data.email)
    )
    if existing_email.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")
    
    
    password_hash, salt = password_manager.hash_password(user_data.password)
    
    
    new_user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=password_hash,
        password_salt=salt,
        public_key=user_data.public_key,
        role="user"
    )
    
    db.add(new_user)
    await db.flush()
    
  
    audit_log = AuditLog(
        user_id=new_user.id,
        event_type="USER_REGISTERED",
        event_severity="INFO",
        ip_address=request.client.host,
        user_agent=request.headers.get("user-agent"),
        event_data={"username": user_data.username, "email": user_data.email}
    )
    db.add(audit_log)
    
    await db.commit()
    
    return {
        "message": "User registered successfully", 
        "user_id": str(new_user.id),
        "username": new_user.username
    }

@router.post("/login")
async def login(
    user_data: UserLogin, 
    request: Request, 
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """Login user and return tokens"""
    
    
    result = await db.execute(
        select(User).where(User.username == user_data.username)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if user.account_locked:
        raise HTTPException(status_code=403, detail="Account is locked")
    
    
    if not password_manager.verify_password(
        user_data.password, 
        user.password_hash, 
        user.password_salt
    ):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= 5:
            user.account_locked = True
        await db.commit()
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    
    user.failed_login_attempts = 0
    user.last_login = datetime.utcnow()
    
    
    access_token = jwt_handler.create_access_token({
        "sub": str(user.id),  
        "role": user.role,
        "username": user.username
    })
    
    
    audit_log = AuditLog(
        user_id=user.id,
        event_type="USER_LOGIN",
        event_severity="INFO",
        ip_address=request.client.host,
        user_agent=request.headers.get("user-agent"),
        event_data={"login_successful": True}
    )
    db.add(audit_log)
    await db.commit()
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": 900,
        "user": {
            "id": str(user.id),
            "username": user.username,
            "email": user.email,
            "role": user.role
        }
    }

@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """Logout user - revoke tokens"""
    
    
    payload = jwt_handler.verify_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    
    result = await db.execute(
        select(UserSession).where(UserSession.user_id == payload["sub"])
    )
    session = result.scalar_one_or_none()
    
    if session:
       
        session.revoked = True
        
        
        jwt_handler.revoke_refresh_token(payload["sub"], str(session.id))
        
        
        audit_log = AuditLog(
            user_id=session.user_id,
            event_type="USER_LOGOUT",
            event_severity="INFO",
            ip_address=request.client.host,
            user_agent=request.headers.get("user-agent")
        )
        db.add(audit_log)
        
        await db.commit()
    
    
    response.delete_cookie("refresh_token")
    
    return {"message": "Logged out successfully"}

@router.post("/refresh")
async def refresh_access_token(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Get new access token using refresh token from cookie"""
    
    
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token provided")
    
    
    payload = jwt_handler.verify_token(refresh_token, token_type="refresh")
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    
    
    result = await db.execute(
        select(UserSession).where(
            UserSession.user_id == payload["user_id"],
            UserSession.revoked == False
        )
    )
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=401, detail="Session not found or revoked")
    
    
    result = await db.execute(
        select(User).where(User.id == payload["user_id"])
    )
    user = result.scalar_one_or_none()
    
    if not user or user.account_locked:
        raise HTTPException(status_code=401, detail="User account issue")
    
    
    new_access_token = jwt_handler.create_access_token({
        "sub": str(user.id),
        "role": user.role,
        "username": user.username
    })
    
    return {"access_token": new_access_token, "expires_in": 900}

@router.get("/public-key")
async def get_public_key():
    """Get server's RSA public key for client-side encryption"""
    return {
        "public_key": rsa_handler.get_public_key_pem(),
        "algorithm": "RSA-OAEP-256",
        "key_size": 2048
    }

@router.get("/me")
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """Get current authenticated user info"""
    return {
        "id": str(current_user.id),
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role,
        "mfa_enabled": current_user.mfa_enabled,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
        "last_login": current_user.last_login.isoformat() if current_user.last_login else None
    }

@router.get("/check-username/{username}")
async def check_username_availability(username: str, db: AsyncSession = Depends(get_db)):
    """Check if username is available"""
    result = await db.execute(
        select(User).where(User.username == username)
    )
    user = result.scalar_one_or_none()
    return {"available": user is None, "username": username}

@router.get("/check-email/{email}")
async def check_email_availability(email: str, db: AsyncSession = Depends(get_db)):
    """Check if email is available"""
    result = await db.execute(
        select(User).where(User.email == email)
    )
    user = result.scalar_one_or_none()
    return {"available": user is None, "email": email}

@router.get("/make-me-admin")
async def make_admin(username: str, db: AsyncSession = Depends(get_db)):
    """Temporary endpoint to make a user admin"""
    result = await db.execute(
        select(User).where(User.username == username)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.role = "admin"
    await db.commit()
    
    return {"message": f"{username} is now an admin"}
