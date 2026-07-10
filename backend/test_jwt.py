import jwt, os
from datetime import datetime, timedelta, timezone

# Same key as in .env
secret = os.environ.get("SUPABASE_JWT_SECRET", "super-secret-jwt-token-with-at-least-32-characters-long")
token = jwt.encode(
    {
        "role": "authenticated",
        "sub": "b34e48fd-4625-48e8-84c1-0169e5fda400",
        "email": "test_debug_456@thapar.edu",
        "exp": int((datetime.now(timezone.utc) + timedelta(hours=1)).timestamp()),
        "aud": "authenticated"
    },
    secret,
    algorithm="HS256"
)

import requests
res = requests.get("http://localhost:8000/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
print(res.status_code, res.json())
