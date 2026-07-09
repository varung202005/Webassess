"""Audit logs — Admin only read-only access."""
from fastapi import APIRouter, Depends
from typing import Optional
from uuid import UUID
from app.core.security import require_admin
from app.db.supabase import get_supabase_admin

router = APIRouter()


@router.get("/")
async def get_audit_logs(
    table_name: Optional[str] = None,
    user_id: Optional[UUID] = None,
    action: Optional[str] = None,
    search: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    _: dict = Depends(require_admin),
):
    supabase = get_supabase_admin()
    safe_limit = min(max(limit, 1), 200)
    safe_offset = max(offset, 0)
    query = supabase.table("audit_logs").select("*, users(full_name, email)", count="exact").order("created_at", desc=True)
    if table_name:
        query = query.eq("table_name", table_name)
    if user_id:
        query = query.eq("user_id", str(user_id))
    if action:
        query = query.eq("action", action)
    if start_date:
        query = query.gte("created_at", start_date)
    if end_date:
        query = query.lte("created_at", end_date)
    if search:
        term = search.replace(",", " ").strip()
        if term:
            query = query.or_(f"action.ilike.%{term}%,table_name.ilike.%{term}%")

    result = query.range(safe_offset, safe_offset + safe_limit - 1).execute()
    return {
        "items": result.data or [],
        "total": result.count or 0,
        "limit": safe_limit,
        "offset": safe_offset,
    }
