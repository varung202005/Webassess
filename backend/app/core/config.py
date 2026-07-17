from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    PROJECT_NAME: str = "Online Exam Portal"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    # Supabase
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str   # Server-side only — never expose to frontend
    SUPABASE_ANON_KEY: str           # Used for auth token verification

    # JWT — Supabase signs JWTs with this secret
    SUPABASE_JWT_SECRET: str

    # OpenRouter API Key — used for DeepSeek R1 answer inference in question extraction
    OPENROUTER_API_KEY: str

    # Frontend / invitation links
    FRONTEND_URL: str = "http://localhost:5173"

    # SMTP invitation delivery. If SMTP_HOST is unset, invitation assignment
    # still works and reports email as skipped.
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: Optional[str] = None
    SMTP_FROM_NAME: str = "Online Exam Portal"
    SMTP_USE_TLS: bool = True

    # CORS
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ]

    # Proctoring
    INTEGRITY_SCORE_PENALTIES: dict = {
        "face_absence": 0.05,
        "multi_person": 0.10,
        "phone_detected": 0.10,
        "tab_switch": 0.03,
        "fullscreen_exit": 0.02,
        "noise_event": 0.02,
        "focus_loss": 0.02,
        "clipboard": 0.05,
        "screenshot": 0.10,
        "print": 0.10,
    }

    # Grade thresholds (percentage)
    GRADE_THRESHOLDS: dict = {
        "A+": 90,
        "A":  80,
        "B+": 70,
        "B":  60,
        "C":  50,
        "D":  40,
    }

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"        # allow extra keys in .env (e.g. GROQ_API_KEY)


settings = Settings()