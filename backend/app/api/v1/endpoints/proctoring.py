"""
backend/app/api/v1/endpoints/proctoring.py

Proctoring endpoints — updated to include audio_monitoring_logs in:
  - POST /proctoring/summary/:attempt_id  (integrity score computation)
  - GET  /proctoring/summary/:attempt_id  (per-attempt detail)
  - GET  /proctoring/flagged              (now attaches noise_event_count)

WHO DOES WHAT:
  - Camera / mic access request     → FRONTEND only (browser MediaDevices API)
  - Face detection ML model         → FRONTEND only (runs in browser, e.g. face-api.js)
  - Log face verification result    → BACKEND  POST /proctoring/face
  - Tab / fullscreen detection      → FRONTEND (document.visibilityState, fullscreenchange)
  - Log browser activity            → BACKEND  POST /proctoring/browser
  - Audio noise detection           → FRONTEND (WebAudio API) + BACKEND POST /proctoring/audio
  - View proctoring summary         → BACKEND  GET  /proctoring/summary/:id  (Proctor/Admin)
  - Integrity score calculation     → BACKEND  POST /proctoring/summary/:id  (on submission)

  STUDENTS NEVER ACCESS PROCTORING DATA — enforced by RLS + role checks.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from uuid import UUID

from app.core.security import require_student, require_proctor
from app.db.supabase import get_supabase_admin
from app.core.config import settings

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class FaceVerificationLog(BaseModel):
    attempt_id: UUID
    face_detected: bool
    identity_matched: bool
    person_count: int
    phone_detected: bool
    confidence_score: float     # 0.0–1.0 from ML model
    snapshot_url: Optional[str] = None


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


class ProctoringVerdictBody(BaseModel):
    proctor_verdict: str    # CLEAN | SUSPICIOUS | VIOLATED | PENDING
    flagged_for_review: Optional[bool] = None


# ── Student-facing log endpoints ──────────────────────────────────────────────

@router.post("/face")
async def log_face_verification(
    body: FaceVerificationLog,
    _: dict = Depends(require_student),
):
    """
    Frontend ML model runs face detection → sends result here.
    BACKEND stores it (append-only log).
    """
    if not (0.0 <= body.confidence_score <= 1.0):
        raise HTTPException(status_code=400, detail="confidence_score must be 0.0–1.0")

    supabase = get_supabase_admin()
    supabase.table("face_verification_logs").insert({
        "attempt_id":      str(body.attempt_id),
        "face_detected":   body.face_detected,
        "identity_matched": body.identity_matched,
        "person_count":    body.person_count,
        "phone_detected":  body.phone_detected,
        "confidence_score": body.confidence_score,
        "snapshot_url":    body.snapshot_url,
    }).execute()
    return {"logged": True}


@router.post("/browser")
async def log_browser_activity(
    body: BrowserActivityLog,
    _: dict = Depends(require_student),
):
    """
    Frontend sends cumulative tab switch + fullscreen exit counts.
    UPSERT — 1 row per attempt, updated cumulatively.
    """
    supabase = get_supabase_admin()
    supabase.table("browser_activity_logs").upsert(
        {
            "attempt_id":                str(body.attempt_id),
            "tab_switch_count":          body.tab_switch_count,
            "fullscreen_exit_count":     body.fullscreen_exit_count,
            "session_conflict_detected": body.session_conflict_detected,
        },
        on_conflict="attempt_id",
    ).execute()
    return {"logged": True}


@router.post("/audio")
async def log_audio(
    body: AudioLog,
    _: dict = Depends(require_student),
):
    """
    Frontend WebAudio API detects noise → sends each event here.
    INSERT (append-only, one row per noise event).
    noise_detected=False rows are still stored for audit trail.
    """
    supabase = get_supabase_admin()
    supabase.table("audio_monitoring_logs").insert({
        "attempt_id":    str(body.attempt_id),
        "noise_detected": body.noise_detected,
        "noise_level_db": body.noise_level_db,
        "notes":          body.notes,
    }).execute()
    return {"logged": True}


# ── Summary computation (called on exam submission) ───────────────────────────

@router.post("/summary/{attempt_id}")
async def compute_proctoring_summary(
    attempt_id: UUID,
    _: dict = Depends(require_student),
):
    """
    Called by the frontend on exam submission.
    Reads all three log tables, computes integrity_score with penalties,
    and writes/updates the proctoring_summary row for this attempt.

    Penalty config lives in INTEGRITY_SCORE_PENALTIES (core/config.py):
        face_absence:    0.05 per event
        multi_person:    0.10 per event
        phone_detected:  0.10 per event
        tab_switch:      0.03 per event
        fullscreen_exit: 0.02 per event
        noise_event:     0.02 per event  ← NEW
    """
    supabase = get_supabase_admin()
    p   = settings.INTEGRITY_SCORE_PENALTIES
    aid = str(attempt_id)

    # ── Face logs ─────────────────────────────────────────────────────────────
    face_logs    = supabase.table("face_verification_logs").select("*").eq("attempt_id", aid).execute().data
    face_absence = sum(1 for f in face_logs if not f["face_detected"])
    multi_person = sum(1 for f in face_logs if f["person_count"] > 1)
    phone_detect = sum(1 for f in face_logs if f["phone_detected"])

    # ── Browser logs ──────────────────────────────────────────────────────────
    browser      = supabase.table("browser_activity_logs").select("*").eq("attempt_id", aid).execute().data
    tab_switches = browser[0]["tab_switch_count"]      if browser else 0
    fs_exits     = browser[0]["fullscreen_exit_count"] if browser else 0

    # ── Audio logs ────────────────────────────────────────────────────────────
    audio_logs   = supabase.table("audio_monitoring_logs").select("id").eq("attempt_id", aid).eq("noise_detected", True).execute().data
    noise_events = len(audio_logs)

    # ── Integrity score ───────────────────────────────────────────────────────
    noise_penalty = p.get("noise_event", 0.02)   # fallback if not yet in config
    penalty = (
        face_absence * p["face_absence"]    +
        multi_person * p["multi_person"]    +
        phone_detect * p["phone_detected"]  +
        tab_switches * p["tab_switch"]      +
        fs_exits     * p["fullscreen_exit"] +
        noise_events * noise_penalty
    )
    integrity_score = round(max(0.0, 1.0 - penalty), 4)
    total_incidents = (
        face_absence + multi_person + phone_detect +
        tab_switches + fs_exits + noise_events
    )
    flagged = integrity_score < 0.7

    # ── Write summary ─────────────────────────────────────────────────────────
    supabase.table("proctoring_summary").upsert(
        {
            "attempt_id":            aid,
            "integrity_score":       integrity_score,
            "total_incidents":       total_incidents,
            "face_absence_count":    face_absence,
            "multi_person_count":    multi_person,
            "phone_detection_count": phone_detect,
            "tab_switch_count":      tab_switches,
            "fullscreen_exit_count": fs_exits,
            "noise_event_count":     noise_events,   # ← NEW column
            "flagged_for_review":    flagged,
            "proctor_verdict":       "PENDING",
        },
        on_conflict="attempt_id",
    ).execute()

    return {
        "integrity_score": integrity_score,
        "flagged":         flagged,
        "noise_events":    noise_events,
    }


# ── Proctor-only read endpoints ───────────────────────────────────────────────

@router.get("/summary/{attempt_id}", dependencies=[Depends(require_proctor)])
async def get_proctoring_summary(attempt_id: UUID):
    """
    Proctor/Admin view of a single attempt's proctoring summary.
    Includes noise_event_count from audio_monitoring_logs.
    Students NEVER see this.
    """
    supabase = get_supabase_admin()
    aid = str(attempt_id)

    result = (
        supabase.table("proctoring_summary")
        .select("*")
        .eq("attempt_id", aid)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="No proctoring summary for this attempt")

    # Attach live noise_event_count (in case summary was computed before audio logs arrived)
    audio_count = (
        supabase.table("audio_monitoring_logs")
        .select("id", count="exact")
        .eq("attempt_id", aid)
        .eq("noise_detected", True)
        .execute()
    ).count or 0

    return {**result.data, "noise_event_count": audio_count}


@router.patch("/verdict/{attempt_id}")
async def set_verdict(
    attempt_id: UUID,
    body: ProctoringVerdictBody,
    current_user: dict = Depends(require_proctor),
):
    """
    Proctor sets a verdict on a flagged attempt.
    Allowed values: CLEAN | SUSPICIOUS | VIOLATED | PENDING
    """
    allowed = {"CLEAN", "SUSPICIOUS", "VIOLATED", "PENDING"}
    if body.proctor_verdict not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"proctor_verdict must be one of: {', '.join(sorted(allowed))}",
        )

    supabase = get_supabase_admin()
    update: dict = {
        "proctor_verdict": body.proctor_verdict,
        "reviewed_by":     current_user["user_id"],
    }
    if body.flagged_for_review is not None:
        update["flagged_for_review"] = body.flagged_for_review

    supabase.table("proctoring_summary").update(update).eq("attempt_id", str(attempt_id)).execute()
    return {"message": "Verdict recorded"}


@router.get("/flagged", dependencies=[Depends(require_proctor)])
async def get_flagged_attempts():
    """
    Returns all attempts flagged for proctor review (PENDING verdict only).
    Attaches noise_event_count from audio_monitoring_logs to each row
    so the dashboard table can show the Audio Noise chip without a
    separate request per student.
    """
    supabase = get_supabase_admin()

    flagged = (
        supabase.table("proctoring_summary")
        .select("*, exam_attempts(student_id, exam_schedule_id, users(full_name))")
        .eq("flagged_for_review", True)
        .eq("proctor_verdict", "PENDING")
        .order("integrity_score", desc=False)
        .execute()
        .data
    )

    if not flagged:
        return []

    # Batch-fetch audio noise counts for all flagged attempt IDs
    attempt_ids = [r["attempt_id"] for r in flagged]
    audio_rows  = (
        supabase.table("audio_monitoring_logs")
        .select("attempt_id")
        .eq("noise_detected", True)
        .in_("attempt_id", attempt_ids)
        .execute()
        .data
    )

    # Count per attempt_id
    noise_counts: dict[str, int] = {}
    for row in audio_rows:
        aid = row["attempt_id"]
        noise_counts[aid] = noise_counts.get(aid, 0) + 1

    # Merge into flagged rows
    for r in flagged:
        r["noise_event_count"] = noise_counts.get(r["attempt_id"], 0)

    return flagged