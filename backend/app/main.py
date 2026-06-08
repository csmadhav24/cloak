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
from datetime import datetime
from sqlalchemy import select

from app.config import settings
from app.database.connection import engine, AsyncSessionLocal
from app.database.models import Base, User
from app.auth.jwt_handler import JWTHandler
from app.auth.password_manager import PasswordManager
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

async def create_default_admin():
    """Create default admin user only if no users exist and tables are ready"""
    try:
        async with AsyncSessionLocal() as db:
            # Check if users table has any records
            result = await db.execute(select(User))
            users = result.scalars().all()
            
            if len(users) == 0:
                # Create default admin
                pm = PasswordManager()
                password_hash, salt = pm.hash_password("N3wqroj3ctP@sS!0604")
                
                admin_user = User(
                    username="Entropic_Master",
                    email="entropicuser@gmail.com",
                    password_hash=password_hash,
                    password_salt=salt,
                    role="admin",
                    public_key="Won'tOpenWithoutPermission"
                )
                db.add(admin_user)
                await db.commit()
                logger.info("=" * 60)
                logger.info("✅ DEFAULT ADMIN USER CREATED")
                logger.info("   Username: Entropic_Master")
                logger.info("   Password: N3wqroj3ctP@sS!0604")
                logger.info("=" * 60)
            else:
                logger.info(f"ℹ️ Database already has {len(users)} user(s). Admin creation skipped.")
    except Exception as e:
        logger.error(f"Error creating admin user: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # ========== STARTUP ==========
    logger.info("Starting Secure File Transfer System...")
    
    # Step 1: Create database tables
    logger.info("Step 1: Creating database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("✅ Database tables created/verified")
    
    # Step 2: Create default admin user (tables now exist)
    logger.info("Step 2: Checking for default admin user...")
    await create_default_admin()
    
    # Step 3: Create necessary directories
    logger.info("Step 3: Creating directories...")
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(settings.RSA_PRIVATE_KEY_PATH), exist_ok=True)
    logger.info(f"✅ Directories created: {settings.UPLOAD_DIR}, keys/")
    
    # Step 4: Initialize Redis (optional)
    logger.info("Step 4: Connecting to Redis...")
    try:
        redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
        redis_client.ping()
        logger.info("✅ Redis connected successfully")
    except Exception as e:
        logger.warning(f"⚠️ Redis not available: {e}. Using in-memory storage.")
        redis_client = None
    
    # Step 5: Initialize JWT handler
    logger.info("Step 5: Initializing JWT handler...")
    jwt_handler = JWTHandler(redis_client)
    logger.info("✅ JWT handler initialized")
    
    # Step 6: Initialize RSA handler
    logger.info("Step 6: Initializing RSA handler...")
    rsa_handler = RSAHandler(
        private_key_path=settings.RSA_PRIVATE_KEY_PATH,
        public_key_path=settings.RSA_PUBLIC_KEY_PATH
    )
    logger.info("✅ RSA handler initialized")
    
    # Step 7: Inject handlers into routes
    logger.info("Step 7: Setting up route handlers...")
    auth.setup_handlers(jwt_handler, rsa_handler)
    files.setup_handlers(jwt_handler, rsa_handler)
    
    # Store in app state
    app.state.jwt_handler = jwt_handler
    app.state.rsa_handler = rsa_handler
    app.state.redis = redis_client
    
    logger.info("=" * 60)
    logger.info("🚀 APPLICATION STARTUP COMPLETE!")
    logger.info("=" * 60)
    
    yield
    
    # ========== SHUTDOWN ==========
    logger.info("Shutting down...")
    if redis_client:
        redis_client.close()
    await engine.dispose()
    logger.info("✅ Shutdown complete")

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

# CORS middleware - Allow frontend connections
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
