from pydantic_settings import BaseSettings
from typing import List


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


settings = Settings()
