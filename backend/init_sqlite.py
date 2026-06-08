import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def create():
    # Use PostgreSQL connection
    DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/securefiletransfer"
    
    print("Connecting to database...")
    engine = create_async_engine(DATABASE_URL, echo=True)
    
    async with engine.begin() as conn:
        print("Creating users table...")
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(36) PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                password_salt VARCHAR(64) NOT NULL,
                public_key TEXT,
                role VARCHAR(20) DEFAULT 'user',
                mfa_secret VARCHAR(255),
                mfa_enabled BOOLEAN DEFAULT FALSE,
                account_locked BOOLEAN DEFAULT FALSE,
                failed_login_attempts INTEGER DEFAULT 0,
                last_login TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP
            )
        """))
        print("✅ users table created")
        
        print("Creating files table...")
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS files (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
                original_filename VARCHAR(255) NOT NULL,
                encrypted_filename VARCHAR(255) UNIQUE NOT NULL,
                file_size INTEGER NOT NULL,
                encrypted_size INTEGER NOT NULL,
                content_type VARCHAR(100),
                sha256_hash VARCHAR(64) NOT NULL,
                encrypted_aes_key TEXT NOT NULL,
                iv VARCHAR(64) NOT NULL,
                auth_tag VARCHAR(128),
                storage_path VARCHAR(500) NOT NULL,
                is_deleted BOOLEAN DEFAULT FALSE,
                expires_at TIMESTAMP,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_accessed TIMESTAMP,
                version INTEGER DEFAULT 1
            )
        """))
        print("✅ files table created")
        
        print("Creating audit_logs table...")
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS audit_logs (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) REFERENCES users(id),
                event_type VARCHAR(50) NOT NULL,
                event_severity VARCHAR(20) DEFAULT 'INFO',
                ip_address VARCHAR(45),
                user_agent TEXT,
                file_id VARCHAR(36) REFERENCES files(id),
                event_data JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        print("✅ audit_logs table created")
        
        print("Creating user_sessions table...")
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS user_sessions (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE,
                session_token VARCHAR(255) UNIQUE NOT NULL,
                refresh_token VARCHAR(255) UNIQUE NOT NULL,
                ip_address VARCHAR(45),
                user_agent TEXT,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                revoked BOOLEAN DEFAULT FALSE
            )
        """))
        print("✅ user_sessions table created")
        
        print("\n🎉 ALL TABLES CREATED SUCCESSFULLY!")
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(create())