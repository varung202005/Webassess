"""
Auth endpoints.

WHO DOES WHAT:
  - Signup UI form          → FRONTEND only (Supabase Auth SDK)
  - Login UI form           → FRONTEND only (Supabase Auth SDK)
  - Token storage/refresh   → FRONTEND only (Supabase Auth SDK handles this)
  - /me (profile fetch)     → BACKEND — returns user profile + roles
  - /assign-role            → BACKEND — Admin only, inserts into user_roles
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, UUID4

from app.core.security import get_current_user_with_roles, require_admin
from app.db.supabase import get_supabase_admin

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────────

class AssignRoleRequest(BaseModel):
    user_id: UUID4
    role_id: int  # FK to roles table (1=Admin,2=Faculty,3=Proctor,4=Student)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user_with_roles)):
    """
    Returns the currently authenticated user's profile and their assigned roles.
    Frontend calls this on app load after Supabase login to bootstrap the session.

    BACKEND responsibility.
    """
    supabase = get_supabase_admin()
    user_id = current_user["user_id"]

    result = supabase.table("users").select("*").eq("id", user_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="User not found in public.users")

    return {
        "user": result.data,
        "roles": current_user["roles"],
    }


@router.post("/assign-role", dependencies=[Depends(require_admin)])
async def assign_role(body: AssignRoleRequest):
    """
    Assigns a role to a user. Admin only.
    BACKEND responsibility.
    """
    supabase = get_supabase_admin()

    # Check the role exists
    role = supabase.table("roles").select("id,name").eq("id", body.role_id).single().execute()
    if not role.data:
        raise HTTPException(status_code=404, detail="Role not found")

    # Upsert to avoid duplicate assignment errors
    supabase.table("user_roles").upsert(
        {"user_id": str(body.user_id), "role_id": body.role_id},
        on_conflict="user_id,role_id",
    ).execute()

    return {"message": f"Role '{role.data['name']}' assigned successfully"}


@router.delete("/remove-role", dependencies=[Depends(require_admin)])
async def remove_role(user_id: UUID4, role_id: int):
    """
    Removes a role from a user. Admin only.
    BACKEND responsibility.
    """
    supabase = get_supabase_admin()
    supabase.table("user_roles").delete().eq("user_id", str(user_id)).eq("role_id", role_id).execute()
    return {"message": "Role removed"}


@router.get("/roles", dependencies=[Depends(require_admin)])
async def list_roles():
    """
    Returns all available roles. Used by Admin UI dropdowns.
    BACKEND responsibility.
    """
    supabase = get_supabase_admin()
    result = supabase.table("roles").select("*").execute()
    return result.data
