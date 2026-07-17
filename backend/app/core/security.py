import base64
import logging

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.config import settings
from app.db.supabase import get_supabase_admin

bearer_scheme = HTTPBearer()

logger = logging.getLogger(__name__)

# Supabase issues JWTs with this issuer (project URL + /auth/v1)
EXPECTED_ISSUER = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1"
EXPECTED_AUDIENCE = "authenticated"


def _resolve_jwt_key() -> bytes:
    """
    Supabase JWT secrets are sometimes base64-encoded, sometimes raw.
    Resolve once at import time and reuse — never silently fall back
    to skipping signature verification at request time.
    """
    raw = settings.SUPABASE_JWT_SECRET
    try:
        decoded = base64.b64decode(raw, validate=True)
        if base64.b64encode(decoded) == raw.encode():
            return decoded
    except Exception:
        pass
    return raw.encode()


_JWT_KEY = _resolve_jwt_key()


def decode_token(token: str) -> dict:
    """
    Verifies and decodes a Supabase-issued JWT.

    SECURITY: Signature verification is mandatory. There is no fallback
    path that decodes an unverified token. Any failure — bad signature,
    expired token, malformed token, wrong audience, wrong issuer —
    results in a 401.
    """
    try:
        payload = jwt.decode(
            token,
            key=_JWT_KEY,
            algorithms=["HS256"],          # pin the algorithm — never trust alg from the token header
            audience=EXPECTED_AUDIENCE,
            issuer=EXPECTED_ISSUER,
            options={
                "require": ["exp", "iat", "sub", "aud", "iss"],
                "verify_signature": True,
                "verify_exp": True,
                "verify_aud": True,
                "verify_iss": True,
            },
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired")
    except jwt.InvalidAudienceError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token audience")
    except jwt.InvalidIssuerError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token issuer")
    except jwt.MissingRequiredClaimError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing required claims")
    except jwt.InvalidTokenError as e:
        # Catches InvalidSignatureError, DecodeError, InvalidAlgorithmError, etc.
        logger.warning("JWT rejected: invalid token (%s)", type(e).__name__)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or malformed token")
    except Exception:
        logger.exception("Unexpected error while decoding JWT")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """
    Dependency: Validates the Bearer JWT from Supabase Auth (signature,
    expiry, audience, issuer all enforced) and confirms the referenced
    user still exists, is active, and is not soft-deleted.
    Returns {"user_id", "token", "payload"}.
    """
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    # Confirm the user still exists and is active. Closes the gap where a
    # still-valid (unexpired) token belongs to a deactivated/deleted user.
    supabase = get_supabase_admin()
    result = (
        supabase.table("users")
        .select("id, is_active")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    user_row = result.data[0]
    if not user_row.get("is_active", False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    return {"user_id": user_id, "token": credentials.credentials, "payload": payload}


async def get_current_user_with_roles(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Dependency: Attaches the user's roles from public.user_roles.
    Rejects users with no assigned roles — an authenticated user with
    zero roles should never silently pass downstream checks.
    """
    supabase = get_supabase_admin()
    user_id = current_user["user_id"]

    result = (
        supabase.table("user_roles")
        .select("roles(name)")
        .eq("user_id", user_id)
        .execute()
    )
    roles = [row["roles"]["name"] for row in result.data if row.get("roles")]

    if not roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No roles assigned to this account")

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