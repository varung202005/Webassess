"""
Notifications endpoints.
BACKEND sends notifications on key events.
FRONTEND polls or uses Supabase Realtime to display them.
"""
from fastapi import APIRouter, Depends
from uuid import UUID
from app.core.security import get_current_user_with_roles
from app.db.supabase import get_supabase_admin

router = APIRouter()


@router.get("/")
async def get_my_notifications(
    unread_only: bool = False,
    current_user: dict = Depends(get_current_user_with_roles),
):
    """Returns notifications for the current user. BACKEND responsibility."""
    supabase = get_supabase_admin()
    query = supabase.table("notifications").select("*").eq("user_id", current_user["user_id"])
    if unread_only:
        query = query.eq("is_read", False)
    return query.order("created_at", desc=True).execute().data


@router.patch("/read-all")
async def mark_all_read(current_user: dict = Depends(get_current_user_with_roles)):
    supabase = get_supabase_admin()
    supabase.table("notifications").update({"is_read": True}).eq("user_id", current_user["user_id"]).eq("is_read", False).execute()
    return {"marked": True}


@router.patch("/{notification_id}/read")
async def mark_as_read(notification_id: UUID, current_user: dict = Depends(get_current_user_with_roles)):
    supabase = get_supabase_admin()
    supabase.table("notifications").update({"is_read": True}).eq("id", str(notification_id)).eq("user_id", current_user["user_id"]).execute()
    return {"marked": True}
