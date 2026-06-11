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
    limit: int = 100,
    _: dict = Depends(require_admin),
):
    supabase = get_supabase_admin()
    query = supabase.table("audit_logs").select("*, users(full_name, email)").order("created_at", desc=True).limit(limit)
    if table_name:
        query = query.eq("table_name", table_name)
    if user_id:
        query = query.eq("user_id", str(user_id))
    if action:
        query = query.eq("action", action)
    return query.execute().data
