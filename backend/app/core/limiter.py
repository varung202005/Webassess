from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

# Shared limiter instance — import this in endpoint modules and decorate
# routes with @limiter.limit("N/minute"). Keyed by client IP by default;
# behind a reverse proxy, ensure X-Forwarded-For is trusted/parsed upstream
# so get_remote_address sees the real client IP.
limiter = Limiter(key_func=get_remote_address, default_limits=[settings.RATE_LIMIT_DEFAULT])