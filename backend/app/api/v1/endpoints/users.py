"""
Users endpoints.

WHO DOES WHAT:
  - User registration (signup form + Supabase call)  → FRONTEND only
    (Supabase Auth SDK: supabase.auth.signUp with metadata.full_name)
  - User profile display                             → FRONTEND only
  - Profile update form                              → FRONTEND (UI) + BACKEND (PATCH /me)
  - List all users                                   → BACKEND (Admin only)
  - Activate / deactivate users                      → BACKEND (Admin only)
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from uuid import UUID

from app.core.security import get_current_user_with_roles, require_admin
from app.db.supabase import get_supabase_admin

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────────

class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    profile_photo: Optional[str] = None  # URL from Supabase Storage


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/")
async def list_users(
    is_active: Optional[bool] = None,
    _: dict = Depends(require_admin),
):
    """
    List all users. Admin only.
    Frontend uses this for the user management table.
    BACKEND responsibility.
    """
    supabase = get_supabase_admin()
    query = supabase.table("users").select("id, full_name, email, phone, is_active, is_verified, created_at")
    if is_active is not None:
        query = query.eq("is_active", is_active)
    result = query.execute()
    return result.data


@router.get("/{user_id}")
async def get_user(user_id: UUID, current_user: dict = Depends(get_current_user_with_roles)):
    """
    Get a single user by ID.
    - Any authenticated user can get their own profile.
    - Admins can get any user.
    BACKEND responsibility.
    """
    supabase = get_supabase_admin()

    is_self = str(user_id) == current_user["user_id"]
    is_admin = "Admin" in current_user["roles"]
    if not is_self and not is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")

    result = supabase.table("users").select("*").eq("id", str(user_id)).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")
    return result.data


@router.patch("/me")
async def update_my_profile(
    body: UserProfileUpdate,
    current_user: dict = Depends(get_current_user_with_roles),
):
    """
    Update the authenticated user's own profile.
    Frontend sends only changed fields.
    BACKEND responsibility.
    """
    supabase = get_supabase_admin()
    update_data = body.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = (
        supabase.table("users")
        .update(update_data)
        .eq("id", current_user["user_id"])
        .execute()
    )
    return result.data[0]


@router.patch("/{user_id}/deactivate", dependencies=[Depends(require_admin)])
async def deactivate_user(user_id: UUID):
    """
    Soft-deactivate a user (is_active = FALSE). Admin only.
    BACKEND responsibility.
    """
    supabase = get_supabase_admin()
    supabase.table("users").update({"is_active": False}).eq("id", str(user_id)).execute()
    return {"message": "User deactivated"}


@router.patch("/{user_id}/activate", dependencies=[Depends(require_admin)])
async def activate_user(user_id: UUID):
    """
    Re-activate a user (is_active = TRUE). Admin only.
    BACKEND responsibility.
    """
    supabase = get_supabase_admin()
    supabase.table("users").update({"is_active": True}).eq("id", str(user_id)).execute()
    return {"message": "User activated"}
