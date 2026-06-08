# 🔒 Secure File Transfer System

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Python](https://img.shields.io/badge/python-3.11+-green)
![React](https://img.shields.io/badge/react-18-blue)
![Security](https://img.shields.io/badge/security-AES--256--GCM-red)

## 📌 Overview

A production-ready secure file transfer system with **end-to-end encryption**. Files are encrypted client-side before upload using AES-256-GCM, and keys are exchanged via RSA-2048 with SHA-256 integrity verification.

## 🚀 Features

- **🔐 End-to-End Encryption**: AES-256-GCM + RSA-2048
- **✅ Integrity Verification**: SHA-256 hashing
- **👥 User Authentication**: JWT with refresh tokens
- **📁 File Sharing**: Share encrypted files with other users
- **📊 Admin Panel**: User management, statistics, audit logs
- **🔒 Secure Password Storage**: Argon2id hashing
- **📝 Audit Logging**: Complete system activity tracking

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | FastAPI (Python 3.11+) |
| Frontend | React 18 with TypeScript |
| Database | SQLite / PostgreSQL |
| Cache | Redis |
| Encryption | Cryptography (AES-256-GCM, RSA-2048) |
| Authentication | JWT with refresh tokens |

## 📦 Installation

### Prerequisites
- Python 3.11 or higher
- Node.js 18 or higher
- Docker (optional, for PostgreSQL/Redis)

### Backend Setup

```bash
# Navigate to backend folder
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Generate RSA keys
python -c "from app.crypto.rsa_handler import RSAHandler; RSAHandler('keys/private.pem', 'keys/public.pem')"

# Start backend server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

### Frontend Setup 
# Navigate to frontend folder
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev



### Environment Variables
DATABASE_URL=sqlite+aiosqlite:///./securefiletransfer.db
SECRET_KEY=your-secret-key-here
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
RSA_PRIVATE_KEY_PATH=keys/private_key.pem
RSA_PUBLIC_KEY_PATH=keys/public_key.pem
CORS_ORIGINS=http://localhost:5173,http://localhost:3000


### API Endpoints

Method	    Endpoint	            Description	            Auth
POST	    /api/auth/register	    User registration	    No
POST	    /api/auth/login	        User login	            No
GET	        /api/auth/me	        Get current user	    Yes
POST	    /api/files/upload	    Upload encrypted file	Yes
GET	        /api/files/files	    List user files	        Yes
POST	    /api/files/share	    Share file with user	Yes
GET         /api/admin/users	    List all users	        Admin
GET	        /api/admin/stats	    System statistics	    Admin
GET	        /api/audit/logs	        View audit logs	        Admin


###🔒 Security Features
Client-side encryption before file upload
RSA-2048 for secure AES key exchange
AES-256-GCM for file encryption with authentication
SHA-256 for file integrity verification
JWT tokens with short expiration (15 minutes)
HTTP-only cookies for refresh tokens
Argon2id password hashing
Rate limiting on API endpoints
Audit logging for all security events



### Project Structure
secure-file-transfer/
├── backend/
│   ├── app/
│   │   ├── api/          # API endpoints
│   │   ├── auth/         # Authentication
│   │   ├── crypto/       # Encryption handlers
│   │   ├── database/     # Database models
│   │   └── main.py       # FastAPI application
│   ├── keys/             # RSA keys (gitignored)
│   ├── uploads/          # Encrypted files (gitignored)
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── components/   # React components
    │   ├── pages/        # Page components
    │   └── App.jsx
    └── package.json    


### Deployment
docker-compose up --build