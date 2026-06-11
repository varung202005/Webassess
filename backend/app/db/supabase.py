from supabase import create_client, Client
from app.core.config import settings

# Admin client — full DB access, bypasses RLS
# NEVER expose this client or its key to the frontend
_admin_client: Client | None = None

# Anon client — respects RLS, used for user-scoped queries when needed
_anon_client: Client | None = None


def get_supabase_admin() -> Client:
    global _admin_client
    if _admin_client is None:
        _admin_client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY,
        )
    return _admin_client


def get_supabase_anon() -> Client:
    global _anon_client
    if _anon_client is None:
        _anon_client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_ANON_KEY,
        )
    return _anon_client
