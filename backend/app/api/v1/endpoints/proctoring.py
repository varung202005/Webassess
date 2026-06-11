"""
Proctoring endpoints.

WHO DOES WHAT:
  - Camera / mic access request     → FRONTEND only (browser MediaDevices API)
  - Face detection ML model         → FRONTEND only (runs in browser, e.g. face-api.js)
  - Log face verification result    → BACKEND (POST /proctoring/face — receives ML output)
  - Tab / fullscreen detection      → FRONTEND (document.visibilityState, fullscreenchange)
  - Log browser activity            → BACKEND (POST /proctoring/browser)
  - Audio noise detection           → FRONTEND (WebAudio API) + BACKEND (POST /proctoring/audio)
  - View proctoring summary         → BACKEND (Proctor/Admin only)
  - Integrity score calculation     → BACKEND service (called on submission)
  
  STUDENTS NEVER ACCESS PROCTORING DATA — enforced by RLS + role check here.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from uuid import UUID

from app.core.security import require_student, require_proctor, get_current_user_with_roles
from app.db.supabase import get_supabase_admin
from app.core.config import settings

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────────

class FaceVerificationLog(BaseModel):
    attempt_id: UUID
    face_detected: bool
    identity_matched: bool
    person_count: int
    phone_detected: bool
    confidence_score: float     # 0.0–1.0 from ML model
    snapshot_url: Optional[str] = None   # URL in Supabase Storage


class BrowserActivityLog(BaseModel):
    attempt_id: UUID
    tab_switch_count: int
    fullscreen_exit_count: int
    session_conflict_detected: bool = False


class AudioLog(BaseModel):
    attempt_id: UUID
    noise_detected: bool
    noise_level_db: float
    notes: Optional[str] = None


class ProctoringVerdict(BaseModel):
    proctor_verdict: str   # CLEAN, SUSPICIOUS, VIOLATED, PENDING
    flagged_for_review: Optional[bool] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/face")
async def log_face_verification(body: FaceVerificationLog, _: dict = Depends(require_student)):
    """
    Frontend ML model runs face detection → sends result here.
    BACKEND stores it (append-only log).
    """
    if not (0.0 <= body.confidence_score <= 1.0):
        raise HTTPException(status_code=400, detail="confidence_score must be 0.0–1.0")

    supabase = get_supabase_admin()
    supabase.table("face_verification_logs").insert({
        "attempt_id": str(body.attempt_id),
        "face_detected": body.face_detected,
        "identity_matched": body.identity_matched,
        "person_count": body.person_count,
        "phone_detected": body.phone_detected,
        "confidence_score": body.confidence_score,
        "snapshot_url": body.snapshot_url,
    }).execute()
    return {"logged": True}


@router.post("/browser")
async def log_browser_activity(body: BrowserActivityLog, _: dict = Depends(require_student)):
    """
    Frontend sends cumulative tab switch + fullscreen exit counts.
    UPSERT (1 row per attempt, updated cumulatively).
    """
    supabase = get_supabase_admin()
    supabase.table("browser_activity_logs").upsert(
        {
            "attempt_id": str(body.attempt_id),
            "tab_switch_count": body.tab_switch_count,
            "fullscreen_exit_count": body.fullscreen_exit_count,
            "session_conflict_detected": body.session_conflict_detected,
        },
        on_conflict="attempt_id",
    ).execute()
    return {"logged": True}


@router.post("/audio")
async def log_audio(body: AudioLog, _: dict = Depends(require_student)):
    supabase = get_supabase_admin()
    supabase.table("audio_monitoring_logs").insert({
        "attempt_id": str(body.attempt_id),
        "noise_detected": body.noise_detected,
        "noise_level_db": body.noise_level_db,
        "notes": body.notes,
    }).execute()
    return {"logged": True}


@router.post("/summary/{attempt_id}")
async def compute_proctoring_summary(attempt_id: UUID, _: dict = Depends(require_student)):
    """
    Called on exam submission. Computes integrity_score from all logs.
    Writes to proctoring_summary (1:1 with attempt).
    BACKEND responsibility.
    """
    supabase = get_supabase_admin()
    p = settings.INTEGRITY_SCORE_PENALTIES
    aid = str(attempt_id)

    # Aggregate face logs
    face_logs = supabase.table("face_verification_logs").select("*").eq("attempt_id", aid).execute().data
    face_absence  = sum(1 for f in face_logs if not f["face_detected"])
    multi_person  = sum(1 for f in face_logs if f["person_count"] > 1)
    phone_detect  = sum(1 for f in face_logs if f["phone_detected"])

    # Browser activity
    browser = supabase.table("browser_activity_logs").select("*").eq("attempt_id", aid).execute().data
    tab_switches   = browser[0]["tab_switch_count"] if browser else 0
    fs_exits       = browser[0]["fullscreen_exit_count"] if browser else 0

    # Calculate integrity score
    penalty = (
        face_absence * p["face_absence"] +
        multi_person * p["multi_person"] +
        phone_detect * p["phone_detected"] +
        tab_switches * p["tab_switch"] +
        fs_exits     * p["fullscreen_exit"]
    )
    integrity_score = round(max(0.0, 1.0 - penalty), 4)
    total_incidents = face_absence + multi_person + phone_detect + tab_switches + fs_exits
    flagged = integrity_score < 0.7

    supabase.table("proctoring_summary").upsert(
        {
            "attempt_id": aid,
            "integrity_score": integrity_score,
            "total_incidents": total_incidents,
            "face_absence_count": face_absence,
            "multi_person_count": multi_person,
            "phone_detection_count": phone_detect,
            "tab_switch_count": tab_switches,
            "fullscreen_exit_count": fs_exits,
            "flagged_for_review": flagged,
            "proctor_verdict": "PENDING",
        },
        on_conflict="attempt_id",
    ).execute()

    return {"integrity_score": integrity_score, "flagged": flagged}


@router.get("/summary/{attempt_id}", dependencies=[Depends(require_proctor)])
async def get_proctoring_summary(attempt_id: UUID):
    """Proctor/Admin view of proctoring summary. Students NEVER see this."""
    supabase = get_supabase_admin()
    result = supabase.table("proctoring_summary").select("*").eq("attempt_id", str(attempt_id)).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="No proctoring summary for this attempt")
    return result.data


@router.patch("/verdict/{attempt_id}", dependencies=[Depends(require_proctor)])
async def set_verdict(attempt_id: UUID, body: ProctoringVerdict, current_user: dict = Depends(require_proctor)):
    supabase = get_supabase_admin()
    update = {
        "proctor_verdict": body.proctor_verdict,
        "reviewed_by": current_user["user_id"],
    }
    if body.flagged_for_review is not None:
        update["flagged_for_review"] = body.flagged_for_review
    supabase.table("proctoring_summary").update(update).eq("attempt_id", str(attempt_id)).execute()
    return {"message": "Verdict recorded"}


@router.get("/flagged", dependencies=[Depends(require_proctor)])
async def get_flagged_attempts():
    """Returns all attempts flagged for proctor review."""
    supabase = get_supabase_admin()
    return (
        supabase.table("proctoring_summary")
        .select("*, exam_attempts(student_id, exam_schedule_id, users(full_name))")
        .eq("flagged_for_review", True)
        .eq("proctor_verdict", "PENDING")
        .execute()
        .data
    )
