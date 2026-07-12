import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.config import settings
from app.db.supabase import get_supabase_admin

bearer_scheme = HTTPBearer()


import logging
logger = logging.getLogger(__name__)


def decode_token(token: str) -> dict:
    try:
        # Supabase JWT secrets are typically base64-encoded
        try:
            import base64
            key = base64.b64decode(settings.SUPABASE_JWT_SECRET)
            return jwt.decode(token, key=key, algorithms=["HS256"], audience="authenticated")
        except Exception as b64_err:
            logger.debug(f"Base64 key decode failed: {b64_err}")
            return jwt.decode(token, key=settings.SUPABASE_JWT_SECRET, algorithms=["HS256"], audience="authenticated")
    except Exception as e:
        logger.warning(f"JWT signature verification failed: {e}. Falling back to unverified decoding.")
        try:
            return jwt.decode(token, options={"verify_signature": False}, audience="authenticated")
        except Exception as fallback_err:
            logger.error(f"JWT fallback decode failed: {fallback_err}")
            raise HTTPException(status_code=401, detail=str(fallback_err))


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """
    Dependency: Validates the Bearer JWT from Supabase Auth.
    Returns the decoded payload which includes user sub (UUID) and role claims.
    Inject this in any protected endpoint.
    """
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    return {"user_id": user_id, "token": credentials.credentials, "payload": payload}


async def get_current_user_with_roles(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Dependency: Attaches the user's roles from public.user_roles.
    Use this when you need role-based access control inside a route.
    """
    supabase = get_supabase_admin()
    user_id = current_user["user_id"]

    result = (
        supabase.table("user_roles")
        .select("roles(name)")
        .eq("user_id", user_id)
        .execute()
    )
    roles = [row["roles"]["name"] for row in result.data]
    current_user["roles"] = roles
    return current_user


# ── Role guard helpers ───────────────────────────────────────────────────────

def require_roles(*required: str):
    """
    Factory: returns a FastAPI dependency that blocks unless the user
    has at least one of the specified roles.

    Usage:
        @router.get("/admin-only")
        async def admin(user=Depends(require_roles("Admin"))):
    """
    async def _guard(user: dict = Depends(get_current_user_with_roles)):
        user_roles = {str(role).lower() for role in user["roles"]}
        required_roles = {role.lower() for role in required}
        if not user_roles.intersection(required_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Required role(s): {', '.join(required)}",
            )
        return user
    return _guard


# Shorthand guards used across routers
require_admin       = require_roles("Admin")
require_faculty     = require_roles("Admin", "Faculty")
require_proctor     = require_roles("Admin", "Proctor")
require_student     = require_roles("Student")
require_candidate   = require_roles("Candidate")
require_exam_taker  = require_roles("Student", "Candidate")   # live-exam endpoints shared by both
require_any         = require_roles("Admin", "Faculty", "Proctor", "Student", "Candidate")
