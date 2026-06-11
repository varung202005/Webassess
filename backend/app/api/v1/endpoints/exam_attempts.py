"""
Exam Attempts — the live exam session.

WHO DOES WHAT:
  - Start exam button                 → FRONTEND (calls POST /exam-attempts/start)
  - Timer countdown                   → FRONTEND only (JavaScript timer)
  - Auto-submit on timer expiry       → FRONTEND triggers POST /submit (with type=AUTO)
  - Browser tab / fullscreen events   → FRONTEND detects, calls log endpoints
  - Attempt status display            → FRONTEND
  - Start / submit logic              → BACKEND (validates eligibility, writes attempt)
  - Auto-submit when timer hits 0     → BACKEND also does a final force-submit via cron
    (optional safety net — primary is frontend-driven)
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Literal
from uuid import UUID
from datetime import datetime, timezone

from app.core.security import require_student, require_faculty, get_current_user_with_roles
from app.db.supabase import get_supabase_admin

router = APIRouter()

SubmissionType = Literal["MANUAL", "AUTO", "FORCED"]


class StartAttemptRequest(BaseModel):
    exam_schedule_id: UUID


class SubmitAttemptRequest(BaseModel):
    attempt_id: UUID
    submission_type: SubmissionType = "MANUAL"


@router.post("/start")
async def start_attempt(
    body: StartAttemptRequest,
    request: Request,
    current_user: dict = Depends(require_student),
):
    """
    Creates a new IN_PROGRESS attempt.
    BACKEND validates eligibility, creates attempt, logs EXAM_STARTED event.
    """
    supabase = get_supabase_admin()
    student_id = current_user["user_id"]
    schedule_id = str(body.exam_schedule_id)

    # Eligibility re-check (don't trust frontend alone)
    reg = (
        supabase.table("exam_registrations")
        .select("status, exam_schedules(is_published, start_time, end_time)")
        .eq("exam_schedule_id", schedule_id)
        .eq("student_id", student_id)
        .execute()
    )
    if not reg.data or reg.data[0]["status"] != "REGISTERED":
        raise HTTPException(status_code=403, detail="Not eligible to attempt this exam")

    sched = reg.data[0]["exam_schedules"]
    now = datetime.now(timezone.utc)
    start = datetime.fromisoformat(sched["start_time"])
    end = datetime.fromisoformat(sched["end_time"])
    if not (start <= now <= end):
        raise HTTPException(status_code=403, detail="Outside exam time window")

    # Prevent duplicate attempts
    existing = (
        supabase.table("exam_attempts")
        .select("id, status")
        .eq("exam_schedule_id", schedule_id)
        .eq("student_id", student_id)
        .execute()
    )
    if existing.data:
        a = existing.data[0]
        if a["status"] == "IN_PROGRESS":
            return {"message": "Resuming existing attempt", "attempt_id": a["id"]}
        raise HTTPException(status_code=409, detail=f"Attempt already exists: {a['status']}")

    # Create attempt
    attempt_data = {
        "exam_schedule_id": schedule_id,
        "student_id": student_id,
        "status": "IN_PROGRESS",
        "submission_type": "MANUAL",
        "ip_address": request.client.host if request.client else None,
        "user_agent": request.headers.get("user-agent"),
    }
    attempt = supabase.table("exam_attempts").insert(attempt_data).execute().data[0]

    # Log EXAM_STARTED event
    supabase.table("submission_logs").insert({
        "attempt_id": attempt["id"],
        "event_type": "EXAM_STARTED",
        "metadata": f'{{"schedule_id": "{schedule_id}"}}',
    }).execute()

    return {"attempt_id": attempt["id"], "started_at": attempt["started_at"]}


@router.post("/submit")
async def submit_attempt(
    body: SubmitAttemptRequest,
    current_user: dict = Depends(require_student),
):
    """
    Submits the exam attempt. Runs auto-grading for MCQ and TRUE_FALSE.
    BACKEND responsibility — this is the most critical endpoint.
    """
    from app.services.grading_service import auto_grade_attempt

    supabase = get_supabase_admin()
    attempt_id = str(body.attempt_id)

    # Validate attempt belongs to student
    attempt = (
        supabase.table("exam_attempts")
        .select("*")
        .eq("id", attempt_id)
        .eq("student_id", current_user["user_id"])
        .single()
        .execute()
    )
    if not attempt.data:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if attempt.data["status"] != "IN_PROGRESS":
        raise HTTPException(status_code=400, detail="Attempt is not IN_PROGRESS")

    now = datetime.now(timezone.utc)
    started_at = datetime.fromisoformat(attempt.data["started_at"])
    time_spent = int((now - started_at).total_seconds())

    # Auto-grade MCQ/TRUE_FALSE answers
    total_score = await auto_grade_attempt(attempt_id)

    # Update attempt to SUBMITTED
    status = "SUBMITTED" if body.submission_type == "MANUAL" else "AUTO_SUBMITTED"
    supabase.table("exam_attempts").update({
        "status": status,
        "submitted_at": now.isoformat(),
        "total_score": total_score,
        "total_time_spent_sec": time_spent,
        "submission_type": body.submission_type,
    }).eq("id", attempt_id).execute()

    # Log submission event
    event = "MANUAL_SUBMIT" if body.submission_type == "MANUAL" else "AUTO_SUBMIT"
    supabase.table("submission_logs").insert({
        "attempt_id": attempt_id,
        "event_type": event,
        "metadata": f'{{"total_score": {total_score}, "time_spent_sec": {time_spent}}}',
    }).execute()

    # Create result record
    await _create_result(attempt_id, attempt.data, total_score)

    return {"message": "Exam submitted", "total_score": total_score}


async def _create_result(attempt_id: str, attempt: dict, total_score: int):
    """Create the results row after submission."""
    from app.services.grading_service import calculate_grade
    supabase = get_supabase_admin()

    # Get exam max_score and pass_marks
    sched = (
        supabase.table("exam_schedules")
        .select("exams(total_marks, pass_marks, id)")
        .eq("id", attempt["exam_schedule_id"])
        .single()
        .execute()
    )
    exam = sched.data["exams"]
    max_score = exam["total_marks"]
    percentage = round((total_score / max_score) * 100, 2) if max_score > 0 else 0
    is_passed = total_score >= exam["pass_marks"]
    grade = calculate_grade(percentage)

    supabase.table("results").upsert({
        "attempt_id": attempt_id,
        "student_id": attempt["student_id"],
        "exam_id": exam["id"],
        "total_score": total_score,
        "max_score": max_score,
        "percentage": percentage,
        "grade": grade,
        "is_passed": is_passed,
        "is_published": False,
    }, on_conflict="attempt_id").execute()


@router.get("/{attempt_id}")
async def get_attempt(attempt_id: UUID, current_user: dict = Depends(get_current_user_with_roles)):
    supabase = get_supabase_admin()
    query = supabase.table("exam_attempts").select("*").eq("id", str(attempt_id))

    if "Student" in current_user["roles"]:
        query = query.eq("student_id", current_user["user_id"])

    result = query.single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Attempt not found")
    return result.data


@router.post("/{attempt_id}/log-event")
async def log_submission_event(
    attempt_id: UUID,
    event_type: str,
    metadata: Optional[str] = None,
    current_user: dict = Depends(require_student),
):
    """
    Log tab switches, fullscreen exits, connection lost/restored, etc.
    Frontend calls this on every detectable event.
    BACKEND writes to submission_logs (append-only).
    
    Valid event_type values:
      TAB_SWITCH_WARNING, FULLSCREEN_EXIT, CONNECTION_LOST,
      CONNECTION_RESTORED, TIME_WARNING, ANSWER_SAVED
    """
    valid_events = {
        "TAB_SWITCH_WARNING", "FULLSCREEN_EXIT", "CONNECTION_LOST",
        "CONNECTION_RESTORED", "TIME_WARNING", "ANSWER_SAVED",
    }
    if event_type not in valid_events:
        raise HTTPException(status_code=400, detail=f"Invalid event_type. Use one of: {valid_events}")

    supabase = get_supabase_admin()
    supabase.table("submission_logs").insert({
        "attempt_id": str(attempt_id),
        "event_type": event_type,
        "metadata": metadata,
    }).execute()

    return {"logged": True}


@router.get("/{attempt_id}/timeline")
async def get_attempt_timeline(attempt_id: UUID, _: dict = Depends(require_faculty)):
    """
    Full attempt timeline: navigation + system events merged and sorted by time.
    Phase 7 query. BACKEND responsibility.
    """
    supabase = get_supabase_admin()
    nav = supabase.table("question_navigation_logs").select("action, action_time").eq("attempt_id", str(attempt_id)).execute()
    sys = supabase.table("submission_logs").select("event_type, logged_at").eq("attempt_id", str(attempt_id)).execute()

    timeline = [
        {"source": "NAVIGATION", "event": r["action"], "time": r["action_time"]}
        for r in nav.data
    ] + [
        {"source": "SYSTEM", "event": r["event_type"], "time": r["logged_at"]}
        for r in sys.data
    ]
    timeline.sort(key=lambda x: x["time"])
    return timeline
