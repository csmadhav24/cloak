from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File as FastAPIFile, Form
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc
from typing import List, Optional
import os
import uuid
from datetime import datetime
import base64

from app.database.connection import get_db
from app.database.models import User, FileRecord, AuditLog, FileShare
from app.auth.middleware import get_current_user, get_current_active_user
from app.crypto.integrity import IntegrityVerifier

router = APIRouter()


jwt_handler = None
rsa_handler = None

def setup_handlers(jwt, rsa):
    """Inject handlers into files routes"""
    global jwt_handler, rsa_handler
    jwt_handler = jwt
    rsa_handler = rsa


from pydantic import BaseModel

class FileUploadResponse(BaseModel):
    file_id: str
    original_filename: str
    encrypted_filename: str
    sha256_hash: str
    file_size: int
    uploaded_at: datetime

class FileInfoResponse(BaseModel):
    id: str
    original_filename: str
    file_size: int
    sha256_hash: str
    uploaded_at: datetime
    last_accessed: Optional[datetime]

class FileListResponse(BaseModel):
    files: List[FileInfoResponse]
    total: int
    page: int
    page_size: int

@router.post("/upload", response_model=FileUploadResponse)
async def upload_file(
    request: Request,
    file: UploadFile = FastAPIFile(...),
    encrypted_aes_key: str = Form(...),
    iv: str = Form(...),
    auth_tag: str = Form(...),
    sha256_hash: str = Form(...),
    current_user = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload an encrypted file
    """
    
    try:
        file_content = await file.read()
        
        if len(file_content) > 100 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="File too large. Max 100MB")
        
        file_id = str(uuid.uuid4())
        encrypted_filename = f"{file_id}.enc"
        
        user_dir = os.path.join("uploads", str(current_user.id))
        os.makedirs(user_dir, exist_ok=True)
        
        storage_path = os.path.join(user_dir, encrypted_filename)
        
        with open(storage_path, "wb") as f:
            f.write(file_content)
        
        new_file = FileRecord(
            id=file_id,
            user_id=current_user.id,
            original_filename=file.filename,
            encrypted_filename=encrypted_filename,
            file_size=len(file_content),
            encrypted_size=len(file_content),
            content_type=file.content_type,
            sha256_hash=sha256_hash,
            encrypted_aes_key=encrypted_aes_key,
            iv=iv,
            auth_tag=auth_tag,
            storage_path=storage_path
        )
        
        db.add(new_file)
        await db.flush()  
        
        audit_log = AuditLog(
            user_id=current_user.id,
            event_type="FILE_UPLOAD",
            event_severity="INFO",
            ip_address=request.client.host,
            user_agent=request.headers.get("user-agent"),
            file_id=file_id,  
            event_data={
                "filename": file.filename,
                "size": len(file_content),
                "content_type": file.content_type
            }
        )
        
        db.add(audit_log)
        
        await db.commit()
        await db.refresh(new_file)
        
        return FileUploadResponse(
            file_id=str(new_file.id),
            original_filename=new_file.original_filename,
            encrypted_filename=new_file.encrypted_filename,
            sha256_hash=new_file.sha256_hash,
            file_size=new_file.file_size,
            uploaded_at=new_file.uploaded_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Upload error: {str(e)}")
        import traceback
        traceback.print_exc()
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.get("/files", response_model=FileListResponse)
async def list_user_files(
    request: Request,
    page: int = 1,
    page_size: int = 20,
    current_user = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """List all files for the current user"""
    
    offset = (page - 1) * page_size
    
    result = await db.execute(
        select(FileRecord)
        .where(and_(
            FileRecord.user_id == current_user.id,
            FileRecord.is_deleted == False
        ))
        .order_by(desc(FileRecord.uploaded_at))
        .offset(offset)
        .limit(page_size)
    )
    files = result.scalars().all()
    
    count_result = await db.execute(
        select(FileRecord).where(
            and_(
                FileRecord.user_id == current_user.id,
                FileRecord.is_deleted == False
            )
        )
    )
    total = len(count_result.scalars().all())
    
    return FileListResponse(
        files=[
            FileInfoResponse(
                id=str(f.id),
                original_filename=f.original_filename,
                file_size=f.file_size,
                sha256_hash=f.sha256_hash,
                uploaded_at=f.uploaded_at,
                last_accessed=f.last_accessed
            )
            for f in files
        ],
        total=total,
        page=page,
        page_size=page_size
    )

@router.get("/download/{file_id}")
async def download_file(
    file_id: str,
    request: Request,
    current_user = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Download an encrypted file"""
    
    result = await db.execute(
        select(FileRecord).where(FileRecord.id == file_id)
    )
    file_record = result.scalar_one_or_none()
    
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")
    
    if str(file_record.user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    if file_record.is_deleted:
        raise HTTPException(status_code=410, detail="File has been deleted")
    
    if not os.path.exists(file_record.storage_path):
        raise HTTPException(status_code=404, detail="File data not found")
    
    file_record.last_accessed = datetime.utcnow()
    
    audit_log = AuditLog(
        user_id=current_user.id,
        event_type="FILE_DOWNLOAD",
        event_severity="INFO",
        ip_address=request.client.host,
        user_agent=request.headers.get("user-agent"),
        file_id=file_id,
        event_data={"filename": file_record.original_filename}
    )
    db.add(audit_log)
    await db.commit()
    
    headers = {
        "X-SHA256-Hash": file_record.sha256_hash,
        "X-Encrypted-AES-Key": file_record.encrypted_aes_key,
        "X-IV": file_record.iv,
        "X-Auth-Tag": file_record.auth_tag,
        "X-Original-Filename": base64.b64encode(file_record.original_filename.encode()).decode()
    }
    
    return FileResponse(
        path=file_record.storage_path,
        media_type="application/octet-stream",
        filename=f"{file_record.original_filename}.encrypted",
        headers=headers
    )

@router.delete("/delete/{file_id}")
async def delete_file(
    file_id: str,
    request: Request,
    current_user = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a file (soft delete)"""
    
    result = await db.execute(
        select(FileRecord).where(FileRecord.id == file_id)
    )
    file_record = result.scalar_one_or_none()
    
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")
    
    if str(file_record.user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    file_record.is_deleted = True
    
    audit_log = AuditLog(
        user_id=current_user.id,
        event_type="FILE_DELETE",
        event_severity="WARNING",
        ip_address=request.client.host,
        user_agent=request.headers.get("user-agent"),
        file_id=file_id,
        event_data={"filename": file_record.original_filename}
    )
    db.add(audit_log)
    await db.commit()
    
    return {"message": "File deleted successfully", "file_id": file_id}

@router.post("/verify/{file_id}")
async def verify_file_integrity(
    file_id: str,
    request: Request,
    current_user = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Verify file integrity by recomputing SHA-256 hash"""
    
    result = await db.execute(
        select(FileRecord).where(FileRecord.id == file_id)
    )
    file_record = result.scalar_one_or_none()
    
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")
    
    if str(file_record.user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not os.path.exists(file_record.storage_path):
        raise HTTPException(status_code=404, detail="File data not found")
    
    computed_hash = IntegrityVerifier.compute_file_hash(file_record.storage_path)
    
    is_valid = computed_hash == file_record.sha256_hash
    
    audit_log = AuditLog(
        user_id=current_user.id,
        event_type="INTEGRITY_CHECK",
        event_severity="INFO" if is_valid else "WARNING",
        ip_address=request.client.host,
        user_agent=request.headers.get("user-agent"),
        file_id=file_id,
        event_data={
            "is_valid": is_valid,
            "stored_hash": file_record.sha256_hash,
            "computed_hash": computed_hash
        }
    )
    db.add(audit_log)
    await db.commit()
    
    return {
        "is_valid": is_valid,
        "stored_hash": file_record.sha256_hash,
        "computed_hash": computed_hash,
        "message": "Integrity verified" if is_valid else "Integrity check failed - file may be corrupted or tampered"
    }

@router.post("/share")
async def share_file(
    request: Request,
    share_data: dict,
    current_user = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Share a file with another user
    """
    try:
        file_id = share_data.get('file_id')
        recipient_username = share_data.get('recipient_username')
        permission = share_data.get('permission', 'read')
        
        if not file_id or not recipient_username:
            raise HTTPException(status_code=400, detail="File ID and recipient username required")
        
        result = await db.execute(
            select(FileRecord).where(FileRecord.id == file_id)
        )
        file_record = result.scalar_one_or_none()
        
        if not file_record:
            raise HTTPException(status_code=404, detail="File not found")
        
        if str(file_record.user_id) != str(current_user.id):
            raise HTTPException(status_code=403, detail="You don't own this file")
        
        result = await db.execute(
            select(User).where(User.username == recipient_username)
        )
        recipient = result.scalar_one_or_none()
        
        if not recipient:
            raise HTTPException(status_code=404, detail=f"User '{recipient_username}' not found")
        
        result = await db.execute(
            select(FileShare).where(
                and_(
                    FileShare.file_id == file_id,
                    FileShare.shared_with_user_id == recipient.id
                )
            )
        )
        existing_share = result.scalar_one_or_none()
        
        if existing_share:
            raise HTTPException(status_code=400, detail="File already shared with this user")
        
        new_share = FileShare(
            id=str(uuid.uuid4()),
            file_id=file_id,
            shared_with_user_id=recipient.id,
            shared_by_user_id=current_user.id,
            permission=permission
        )
        
        db.add(new_share)
        
        audit_log = AuditLog(
            id=str(uuid.uuid4()),
            user_id=current_user.id,
            event_type="FILE_SHARED",
            event_severity="INFO",
            ip_address=request.client.host,
            user_agent=request.headers.get("user-agent"),
            file_id=file_id,
            event_data={
                "filename": file_record.original_filename,
                "shared_with": recipient_username,
                "permission": permission
            }
        )
        db.add(audit_log)
        
        await db.commit()
        
        return {
            "message": f"File shared with {recipient_username}",
            "share_id": str(new_share.id),
            "recipient": recipient_username
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Share error: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/shared-with-me")
async def get_shared_files(
    request: Request,
    current_user = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all files shared with the current user
    """
    try:
        result = await db.execute(
            select(FileShare).where(FileShare.shared_with_user_id == current_user.id)
        )
        shares = result.scalars().all()
        
        shared_files = []
        for share in shares:
            file_result = await db.execute(
                select(FileRecord).where(FileRecord.id == share.file_id)
            )
            file_record = file_result.scalar_one_or_none()
            
            if file_record and not file_record.is_deleted:
                owner_result = await db.execute(
                    select(User).where(User.id == file_record.user_id)
                )
                owner = owner_result.scalar_one_or_none()
                
                shared_files.append({
                    "id": str(file_record.id),
                    "original_filename": file_record.original_filename,
                    "file_size": file_record.file_size,
                    "uploaded_at": file_record.uploaded_at,
                    "shared_at": share.created_at,
                    "owner_username": owner.username if owner else "Unknown",
                    "permission": share.permission
                })
        
        return {"files": shared_files}
        
    except Exception as e:
        print(f"Error getting shared files: {str(e)}")
        return {"files": []}