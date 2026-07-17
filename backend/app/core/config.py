from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    PROJECT_NAME: str = "Online Exam Portal"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    # Deployment environment: "development" | "staging" | "production"
    # Controls whether interactive API docs are exposed and how strict
    # security defaults (CORS, error verbosity) are.
    ENVIRONMENT: str = "development"

    # Supabase
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str   # Server-side only — never expose to frontend
    SUPABASE_ANON_KEY: str           # Used for auth token verification

    # JWT — Supabase signs JWTs with this secret
    SUPABASE_JWT_SECRET: str

    # OpenRouter API Key — used for DeepSeek R1 answer inference in question extraction
    # AI answer inference is optional; authentication and the core portal must
    # remain available when the key has not been configured.
    OPENROUTER_API_KEY: str = ""

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

    # Rate limiting (SlowAPI, keyed by client IP unless noted).
    # Generous enough not to disrupt legitimate exam-taking traffic
    # (e.g. autosave), but tight on brute-forceable / expensive actions.
    RATE_LIMIT_LOGIN: str = "5/minute"
    RATE_LIMIT_ROLE_ASSIGNMENT: str = "10/minute"
    RATE_LIMIT_FILE_UPLOAD: str = "10/minute"
    RATE_LIMIT_EXAM_START: str = "5/minute"
    RATE_LIMIT_ANSWER_SAVE: str = "60/minute"
    RATE_LIMIT_EXAM_SUBMIT: str = "5/minute"
    RATE_LIMIT_GRADING: str = "30/minute"
    RATE_LIMIT_NOTIFICATIONS: str = "30/minute"
    RATE_LIMIT_DEFAULT: str = "120/minute"

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