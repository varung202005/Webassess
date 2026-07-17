"""
Auth endpoints.

WHO DOES WHAT:
  - Signup UI form          → FRONTEND only (Supabase Auth SDK)
  - Login UI form           → FRONTEND only (Supabase Auth SDK)
  - Token storage/refresh   → FRONTEND only (Supabase Auth SDK handles this)
  - /me (profile fetch)     → BACKEND — returns user profile + roles
  - /assign-role            → BACKEND — Admin only, inserts into user_roles
"""
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, UUID4

from app.core.security import get_current_user_with_roles, require_admin
from app.core.limiter import limiter
from app.core.config import settings
from app.db.supabase import get_supabase_admin

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Schemas ──────────────────────────────────────────────────────────────────

class AssignRoleRequest(BaseModel):
    user_id: UUID4
    role_id: int  # FK to roles table (1=Admin,2=Faculty,3=Proctor,4=Student)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _write_audit_log(action: str, actor_id: str, record_id: str, new_values: dict, request: Request) -> None:
    """
    Best-effort audit trail write. Never blocks or fails the calling
    request — a logging outage should not take down role management.
    """
    try:
        supabase = get_supabase_admin()
        supabase.table("audit_logs").insert({
            "user_id": actor_id,
            "action": action,
            "table_name": "user_roles",
            "record_id": record_id,
            "new_values": json.dumps(new_values, default=str),
            "ip_address": request.client.host if request.client else None,
        }).execute()
    except Exception:
        logger.exception("Failed to write audit log for action=%s record_id=%s", action, record_id)


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

    # Never return the password hash, even though it's server-side data —
    # defense in depth in case a future select("*") column gets added.
    user_data = dict(result.data)
    user_data.pop("password_hash", None)

    return {
        "user": user_data,
        "roles": current_user["roles"],
    }


@router.post("/assign-role", dependencies=[Depends(require_admin)])
@limiter.limit(settings.RATE_LIMIT_ROLE_ASSIGNMENT)
async def assign_role(
    request: Request,
    body: AssignRoleRequest,
    current_user: dict = Depends(get_current_user_with_roles),
):
    """
    Assigns a role to a user. Admin only.
    BACKEND responsibility.
    """
    supabase = get_supabase_admin()

    # Check the role exists
    role = supabase.table("roles").select("id,name").eq("id", body.role_id).single().execute()
    if not role.data:
        raise HTTPException(status_code=404, detail="Role not found")

    # Check the target user exists (avoid silently inserting an orphaned row)
    target = supabase.table("users").select("id").eq("id", str(body.user_id)).single().execute()
    if not target.data:
        raise HTTPException(status_code=404, detail="User not found")

    # Upsert to avoid duplicate assignment errors
    supabase.table("user_roles").upsert(
        {"user_id": str(body.user_id), "role_id": body.role_id},
        on_conflict="user_id,role_id",
    ).execute()

    _write_audit_log(
        action="ROLE_ASSIGNED",
        actor_id=current_user["user_id"],
        record_id=str(body.user_id),
        new_values={"role_id": body.role_id, "role_name": role.data["name"]},
        request=request,
    )

    return {"message": f"Role '{role.data['name']}' assigned successfully"}


@router.delete("/remove-role", dependencies=[Depends(require_admin)])
@limiter.limit(settings.RATE_LIMIT_ROLE_ASSIGNMENT)
async def remove_role(
    request: Request,
    user_id: UUID4,
    role_id: int,
    current_user: dict = Depends(get_current_user_with_roles),
):
    """
    Removes a role from a user. Admin only.
    BACKEND responsibility.
    """
    supabase = get_supabase_admin()

    # Prevent an admin from stripping their own last Admin role and
    # locking every admin out of role management. Other self-edits
    # (e.g. removing a non-Admin role from themselves) are still allowed.
    role = supabase.table("roles").select("id,name").eq("id", role_id).single().execute()
    if role.data and role.data["name"].lower() == "admin" and str(user_id) == current_user["user_id"]:
        admin_count = (
            supabase.table("user_roles")
            .select("user_id", count="exact")
            .eq("role_id", role_id)
            .execute()
        )
        if (admin_count.count or 0) <= 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot remove the last Admin role from your own account",
            )

    supabase.table("user_roles").delete().eq("user_id", str(user_id)).eq("role_id", role_id).execute()

    _write_audit_log(
        action="ROLE_REVOKED",
        actor_id=current_user["user_id"],
        record_id=str(user_id),
        new_values={"role_id": role_id},
        request=request,
    )

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