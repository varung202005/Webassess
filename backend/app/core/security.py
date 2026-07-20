import base64
import logging
import time

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

# Supabase now supports asymmetric (ES256) JWT signing keys in addition to
# the legacy shared-secret (HS256) scheme. Projects that have rotated to
# asymmetric keys issue ES256 tokens verifiable via this JWKS endpoint —
# no shared secret involved. We fetch/cache signing keys from here rather
# than trusting anything else in the token.
#
# FIX: PyJWT's default cache lifespan is 5 minutes, which means this
# endpoint gets hit fairly often. On machines where outbound HTTPS is
# occasionally blocked at the OS level (seen in practice as intermittent
# `PyJWKClientConnectionError` / WinError 10013 from antivirus, a
# corporate firewall, or a stale HTTP(S)_PROXY env var), that's a lot of
# opportunities for a transient blip to reject an otherwise-valid token.
# Supabase's signing keys essentially never change without an explicit
# rotation, so caching them for an hour instead of 5 minutes is safe and
# cuts network exposure ~12x. `timeout` also guards against a hung socket
# blocking the request indefinitely instead of failing fast.
_JWKS_CLIENT = jwt.PyJWKClient(
    f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json",
    cache_keys=True,
    cache_jwk_set=True,
    lifespan=3600,
    timeout=10,
)

# How many times to retry fetching the JWKS signing key on a transient
# connection failure before giving up, and how long to wait between tries.
_JWKS_FETCH_MAX_ATTEMPTS = 3
_JWKS_FETCH_RETRY_DELAY_SECONDS = 0.4


def _get_es256_signing_key(token: str):
    """
    Resolve the ES256 signing key for `token`, retrying a couple of times
    on a transient network failure reaching Supabase's JWKS endpoint
    before giving up. This is specifically to smooth over one-off local
    connectivity blips (antivirus/firewall/proxy issues) — see the note
    above `_JWKS_CLIENT`. Any *validation* failure (bad token, no matching
    key, etc.) is not retried and propagates immediately.
    """
    last_error: jwt.exceptions.PyJWKClientConnectionError | None = None
    for attempt in range(_JWKS_FETCH_MAX_ATTEMPTS):
        try:
            return _JWKS_CLIENT.get_signing_key_from_jwt(token).key
        except jwt.exceptions.PyJWKClientConnectionError as e:
            last_error = e
            if attempt < _JWKS_FETCH_MAX_ATTEMPTS - 1:
                logger.warning(
                    "JWKS fetch failed (attempt %d/%d), retrying: %s",
                    attempt + 1, _JWKS_FETCH_MAX_ATTEMPTS, e,
                )
                time.sleep(_JWKS_FETCH_RETRY_DELAY_SECONDS * (attempt + 1))
    raise last_error

# Algorithms we are willing to accept. Which one applies to a given token
# is determined by the token's own header, then verified against the
# matching key material below — HS256 against the static secret, ES256
# against Supabase's published public key.
_ALLOWED_ALGORITHMS = {"HS256", "ES256"}


def decode_token(token: str) -> dict:
    """
    Verifies and decodes a Supabase-issued JWT.

    SECURITY: Signature verification is mandatory. There is no fallback
    path that decodes an unverified token. Any failure — bad signature,
    expired token, malformed token, wrong audience, wrong issuer,
    unsupported algorithm — results in a 401.

    Supports both of Supabase's signing schemes:
      - Legacy HS256, verified against SUPABASE_JWT_SECRET.
      - New asymmetric ES256, verified against Supabase's JWKS public key.
    The algorithm is read from the token header only to pick which *known*
    key/algorithm pair to verify with — it is never used to bypass
    verification, and anything outside _ALLOWED_ALGORITHMS is rejected.
    """
    try:
        try:
            unverified_alg = jwt.get_unverified_header(token).get("alg")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or malformed token")

        if unverified_alg not in _ALLOWED_ALGORITHMS:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unsupported token algorithm")

        if unverified_alg == "ES256":
            signing_key = _get_es256_signing_key(token)
            key, algorithms = signing_key, ["ES256"]
        else:
            key, algorithms = _JWT_KEY, ["HS256"]

        payload = jwt.decode(
            token,
            key=key,
            algorithms=algorithms,         # pin to the single algorithm resolved above
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
    except HTTPException:
        # Re-raise HTTPExceptions we raised ourselves above (e.g. unsupported
        # algorithm, malformed header) unchanged — don't let them fall into
        # the generic Exception handler below and get rewritten/logged as
        # unexpected errors.
        raise
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
    except jwt.exceptions.PyJWKClientConnectionError as e:
        # We genuinely couldn't reach Supabase's JWKS endpoint after retries
        # (see _get_es256_signing_key) — this is an infra/network problem,
        # not a bad token. Returning 401 here would look identical to an
        # invalid session and could cause a frontend to needlessly log the
        # user out; 503 signals "transient, try again" instead.
        logger.error("Could not reach Supabase JWKS endpoint after retries: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service temporarily unavailable. Please try again.",
        )
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