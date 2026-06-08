from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import redis
import logging
import os
from contextlib import asynccontextmanager
from sqlalchemy import select
from app.database.models import User

from app.config import settings
from app.database.connection import engine, AsyncSessionLocal
from app.database.models import Base
from app.auth.jwt_handler import JWTHandler
from app.crypto.rsa_handler import RSAHandler
from app.api import auth, files, audit, admin

# Setup logging
logging.basicConfig(
    level=settings.LOG_LEVEL,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Setup rate limiter
limiter = Limiter(key_func=get_remote_address)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting Secure File Transfer System...")
    
    # Create database tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created/verified")
        await create_default_admin()
    # Create necessary directories
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(settings.RSA_PRIVATE_KEY_PATH), exist_ok=True)
    logger.info("Directories created")
async def create_default_admin():
    """Create a default admin user if none exists"""
    async with AsyncSessionLocal() as db:
        # Check if any users exist
        result = await db.execute(select(User))
        users = result.scalars().all()
        
        if len(users) == 0:
            # Create default admin
            from app.auth.password_manager import PasswordManager
            pm = PasswordManager()
            password_hash, salt = pm.hash_password("N3wqroj3ctP@sS!0604")
            
            admin = User(
                username="Entropic_Master",
                email="entropicuser@gmail.com",
                password_hash=password_hash,
                password_salt=salt,
                role="admin",
                public_key="Won'tOpenWithoutPermission"
            )
            db.add(admin)
            await db.commit()
            logger.info("✅ Default admin user created: admin / Admin123!")
    # Initialize Redis
    try:
        redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
        redis_client.ping()
        logger.info("Redis connected successfully")
    except Exception as e:
        logger.warning(f"Redis not available: {e}. Using in-memory storage.")
        redis_client = None
    
    # Initialize JWT handler
    jwt_handler = JWTHandler(redis_client)
    logger.info("JWT handler initialized")
    
    # Initialize RSA handler
    rsa_handler = RSAHandler(
        private_key_path=settings.RSA_PRIVATE_KEY_PATH,
        public_key_path=settings.RSA_PUBLIC_KEY_PATH
    )
    logger.info("RSA handler initialized")
    
    # Inject handlers into routes
    auth.setup_handlers(jwt_handler, rsa_handler)
    files.setup_handlers(jwt_handler, rsa_handler)
    
    # Store in app state for access in routes
    app.state.jwt_handler = jwt_handler
    app.state.rsa_handler = rsa_handler
    app.state.redis = redis_client
    
    yield
    
    # Shutdown
    logger.info("Shutting down...")
    await engine.dispose()
    redis_client.close()
    logger.info("Shutdown complete")

# Create FastAPI app
app = FastAPI(
    title="Secure File Transfer System",
    description="Enterprise-grade secure file transfer with end-to-end encryption",
    version="1.0.0",
    lifespan=lifespan
)

# Add rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS middleware - HARDCODED
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://cloak-6cxy.onrender.com",
        "http://localhost:5173",
        "http://localhost:3000"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Security headers middleware
from app.utils.security_headers import add_security_headers
app.middleware("http")(add_security_headers)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(files.router, prefix="/api/files", tags=["Files"])
app.include_router(audit.router, prefix="/api/audit", tags=["Audit"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])

@app.get("/")
async def root():
    return {
        "name": "Secure File Transfer System",
        "version": "1.0.0",
        "status": "operational",
        "encryption": {
            "file": "AES-256-GCM",
            "key_exchange": "RSA-2048",
            "integrity": "SHA-256"
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat()
    }

from datetime import datetime
