from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, JSON, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
import uuid

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    password_salt = Column(String(64), nullable=False)
    public_key = Column(Text, nullable=True)
    role = Column(String(20), default="user")
    mfa_secret = Column(String(255), nullable=True)
    mfa_enabled = Column(Boolean, default=False)
    account_locked = Column(Boolean, default=False)
    failed_login_attempts = Column(Integer, default=0)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

class FileRecord(Base):
    __tablename__ = "files"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    original_filename = Column(String(255), nullable=False)
    encrypted_filename = Column(String(255), unique=True, nullable=False)
    file_size = Column(Integer, nullable=False)
    encrypted_size = Column(Integer, nullable=False)
    content_type = Column(String(100))
    sha256_hash = Column(String(64), nullable=False)
    encrypted_aes_key = Column(Text, nullable=False)
    iv = Column(String(64), nullable=False)
    auth_tag = Column(String(128))
    storage_path = Column(String(500), nullable=False)
    is_deleted = Column(Boolean, default=False)
    expires_at = Column(DateTime, nullable=True)
    uploaded_at = Column(DateTime, server_default=func.now())
    last_accessed = Column(DateTime, nullable=True)
    version = Column(Integer, default=1)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"))
    event_type = Column(String(50), nullable=False)
    event_severity = Column(String(20), default="INFO")
    ip_address = Column(String(45), nullable=True)  # Changed from INET to String
    user_agent = Column(Text, nullable=True)
    file_id = Column(String(36), ForeignKey("files.id"), nullable=True)
    event_data = Column(JSON, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

class UserSession(Base):
    __tablename__ = "user_sessions"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    session_token = Column(String(255), unique=True, nullable=False)
    refresh_token = Column(String(255), unique=True, nullable=False)
    ip_address = Column(String(45), nullable=True)  # Changed from INET to String
    user_agent = Column(Text, nullable=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    revoked = Column(Boolean, default=False)

class FileShare(Base):
    __tablename__ = "file_shares"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    file_id = Column(String(36), ForeignKey("files.id", ondelete="CASCADE"))
    shared_with_user_id = Column(String(36), ForeignKey("users.id"))
    permission = Column(String(20), default="read")
    shared_by_user_id = Column(String(36), ForeignKey("users.id"))
    created_at = Column(DateTime, server_default=func.now())
    expires_at = Column(DateTime, nullable=True)
