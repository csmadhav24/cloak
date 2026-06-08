from fastapi import APIRouter, HTTPException, Depends, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc, func
from typing import List, Optional
from datetime import datetime, timedelta

from app.database.connection import get_db
from app.database.models import AuditLog, User, FileRecord
from app.auth.middleware import get_current_user, RoleChecker

router = APIRouter()

from pydantic import BaseModel

class AuditLogEntry(BaseModel):
    id: str
    user_id: Optional[str]
    username: Optional[str]
    event_type: str
    event_severity: str
    ip_address: Optional[str]
    user_agent: Optional[str]
    file_id: Optional[str]
    event_data: Optional[dict]
    created_at: datetime

class AuditLogResponse(BaseModel):
    logs: List[AuditLogEntry]
    total: int
    page: int
    page_size: int
    filters: dict

@router.get("/logs", response_model=AuditLogResponse)
async def get_audit_logs(
    request: Request,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=500, description="Items per page"),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    event_severity: Optional[str] = Query(None, description="Filter by severity"),
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    start_date: Optional[datetime] = Query(None, description="Start date filter"),
    end_date: Optional[datetime] = Query(None, description="End date filter"),
    _ = Depends(RoleChecker(["admin", "auditor"])),  # Only admin/auditor can view audit logs
    db: AsyncSession = Depends(get_db)
):
    """
    Get audit logs with filtering (Admin/Auditor only)
    """
    
    
    query = select(AuditLog)
    count_query = select(func.count()).select_from(AuditLog)
    
   
    if event_type:
        query = query.where(AuditLog.event_type == event_type)
        count_query = count_query.where(AuditLog.event_type == event_type)
    
    if event_severity:
        query = query.where(AuditLog.event_severity == event_severity)
        count_query = count_query.where(AuditLog.event_severity == event_severity)
    
    if user_id:
        query = query.where(AuditLog.user_id == user_id)
        count_query = count_query.where(AuditLog.user_id == user_id)
    
    if start_date:
        query = query.where(AuditLog.created_at >= start_date)
        count_query = count_query.where(AuditLog.created_at >= start_date)
    
    if end_date:
        query = query.where(AuditLog.created_at <= end_date)
        count_query = count_query.where(AuditLog.created_at <= end_date)
    
    
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    
    offset = (page - 1) * page_size
    query = query.order_by(desc(AuditLog.created_at)).offset(offset).limit(page_size)
    
    result = await db.execute(query)
    logs = result.scalars().all()
    
    
    user_ids = list(set([log.user_id for log in logs if log.user_id]))
    usernames = {}
    if user_ids:
        user_result = await db.execute(
            select(User).where(User.id.in_(user_ids))
        )
        users = user_result.scalars().all()
        usernames = {str(u.id): u.username for u in users}
    
    
    audit_entries = []
    for log in logs:
        audit_entries.append(AuditLogEntry(
            id=str(log.id),
            user_id=str(log.user_id) if log.user_id else None,
            username=usernames.get(str(log.user_id)) if log.user_id else None,
            event_type=log.event_type,
            event_severity=log.event_severity,
            ip_address=str(log.ip_address) if log.ip_address else None,
            user_agent=log.user_agent,
            file_id=str(log.file_id) if log.file_id else None,
            event_data=log.event_data,
            created_at=log.created_at
        ))
    
    return AuditLogResponse(
        logs=audit_entries,
        total=total,
        page=page,
        page_size=page_size,
        filters={
            "event_type": event_type,
            "event_severity": event_severity,
            "user_id": user_id,
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": end_date.isoformat() if end_date else None
        }
    )

@router.get("/stats")
async def get_audit_stats(
    request: Request,
    days: int = Query(7, ge=1, le=90, description="Number of days to analyze"),
    _ = Depends(RoleChecker(["admin", "auditor"])),
    db: AsyncSession = Depends(get_db)
):
    """
    Get audit statistics (Admin/Auditor only)
    """
    
    
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    s
    result = await db.execute(
        select(AuditLog.event_type, func.count(AuditLog.id))
        .where(AuditLog.created_at >= start_date)
        .group_by(AuditLog.event_type)
    )
    event_counts = {row[0]: row[1] for row in result.all()}
    
    
    result = await db.execute(
        select(AuditLog.event_severity, func.count(AuditLog.id))
        .where(AuditLog.created_at >= start_date)
        .group_by(AuditLog.event_severity)
    )
    severity_counts = {row[0]: row[1] for row in result.all()}
    
    
    result = await db.execute(
        select(
            func.date_trunc('day', AuditLog.created_at).label('day'),
            func.count(AuditLog.id).label('count')
        )
        .where(AuditLog.created_at >= start_date)
        .group_by(func.date_trunc('day', AuditLog.created_at))
        .order_by('day')
    )
    daily_activity = [{"date": row[0].isoformat(), "count": row[1]} for row in result.all()]
    
    
    result = await db.execute(
        select(AuditLog.user_id, func.count(AuditLog.id))
        .where(AuditLog.created_at >= start_date)
        .where(AuditLog.user_id.isnot(None))
        .group_by(AuditLog.user_id)
        .order_by(func.count(AuditLog.id).desc())
        .limit(10)
    )
    top_users = []
    for row in result.all():
        
        user_result = await db.execute(
            select(User.username).where(User.id == row[0])
        )
        username = user_result.scalar_one_or_none()
        top_users.append({
            "user_id": str(row[0]),
            "username": username,
            "activity_count": row[1]
        })
    
    return {
        "period_days": days,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "total_events": sum(event_counts.values()),
        "event_counts": event_counts,
        "severity_counts": severity_counts,
        "daily_activity": daily_activity,
        "top_users": top_users
    }

@router.get("/events/types")
async def get_event_types(
    _ = Depends(RoleChecker(["admin", "auditor"])),
    db: AsyncSession = Depends(get_db)
):
    """Get all distinct event types (Admin/Auditor only)"""
    
    result = await db.execute(
        select(AuditLog.event_type).distinct()
    )
    event_types = [row[0] for row in result.all()]
    
    return {"event_types": event_types}