"""
Candidate portal endpoints.

A Candidate is an external user assigned to an ENTRANCE exam by Faculty.
They have no dashboard — after login they are routed directly here.

WHO DOES WHAT:
  - /exam-state          → returns the candidate's current exam state (one of six states)
  - /start-attempt       → creates an IN_PROGRESS attempt; reuses exam_attempts table
  - /submit              → delegates to the shared submit logic (same as student)

The live exam engine (LiveExam.tsx) is reused unchanged by pointing it at
the same /api/v1/student/exam-session/:scheduleId and /api/v1/student-answers
endpoints — candidates are valid users in exam_attempts so all those
endpoints already work for them.  Only /start and /submit needed separate
endpoints because the student versions check exam_registrations (which
candidates don't use).
"""
import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request

from app.core.security import require_candidate
from app.db.supabase import get_supabase_admin

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_assignment(supabase, candidate_id: str) -> dict | None:
    """Return the candidate's exam assignment row, or None."""
    result = (
        supabase.table("candidate_exam_assignments")
        .select(
            "id,exam_schedule_id,status,"
            "exam_schedules(start_time,end_time,is_published,"
            "exams(id,title,duration_minutes,total_marks,pass_marks,instructions,"
            "exam_questions(id),exam_rules(id,require_fullscreen,enable_proctoring,"
            "allow_backtrack,allow_review_flag,max_tab_switches,auto_save_interval_sec)))"
        )
        .eq("candidate_id", candidate_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
        .data
    )
    return result[0] if result else None


def _get_existing_attempt(supabase, schedule_id: str, candidate_id: str) -> dict | None:
    result = (
        supabase.table("exam_attempts")
        .select("id,status,started_at")
        .eq("exam_schedule_id", schedule_id)
        .eq("student_id", candidate_id)
        .execute()
        .data
    )
    return result[0] if result else None


# ── GET /exam-state ───────────────────────────────────────────────────────────

@router.get("/exam-state")
async def get_exam_state(current_user: dict = Depends(require_candidate)):
    """
    Returns one of six states that drive the candidate UI:
      NOT_STARTED | ACTIVE | IN_PROGRESS | SUBMITTED | EXPIRED | NO_EXAM
    """
    supabase = get_supabase_admin()
    candidate_id = current_user["user_id"]

    assignment = _get_assignment(supabase, candidate_id)
    if not assignment:
        return {"state": "NO_EXAM"}

    schedule = assignment.get("exam_schedules") or {}
    exam = schedule.get("exams") or {}

    if not schedule or not exam:
        return {"state": "NO_EXAM"}

    now = datetime.now(timezone.utc)

    # Parse schedule times
    def _dt(val):
        if not val:
            return None
        return datetime.fromisoformat(val.replace("Z", "+00:00"))

    start = _dt(schedule.get("start_time"))
    end = _dt(schedule.get("end_time"))

    if not start or not end:
        return {"state": "NO_EXAM"}

    schedule_id = assignment["exam_schedule_id"]

    # Check for existing attempt first
    attempt = _get_existing_attempt(supabase, schedule_id, candidate_id)

    if attempt:
        if attempt["status"] in ("SUBMITTED", "AUTO_SUBMITTED"):
            return {"state": "SUBMITTED"}
        if attempt["status"] == "IN_PROGRESS":
            return {
                "state": "IN_PROGRESS",
                "attempt_id": attempt["id"],
                "schedule_id": schedule_id,
                "exam_title": exam.get("title", ""),
            }

    # No active attempt — determine schedule state
    if now < start:
        return {
            "state": "NOT_STARTED",
            "scheduled_at": schedule.get("start_time"),
            "exam_title": exam.get("title", ""),
            "exam_duration_minutes": exam.get("duration_minutes", 0),
        }

    if now > end:
        return {"state": "EXPIRED"}

    # Window is open and no attempt yet → ACTIVE
    questions = exam.get("exam_questions") or []
    rules_list = exam.get("exam_rules") or []
    rules = rules_list[0] if isinstance(rules_list, list) and rules_list else rules_list

    return {
        "state": "ACTIVE",
        "exam_title": exam.get("title", ""),
        "exam_duration_minutes": exam.get("duration_minutes", 0),
        "total_questions": len(questions),
        "total_marks": exam.get("total_marks", 0),
        "pass_marks": exam.get("pass_marks", 0),
        "instructions": exam.get("instructions"),
        "schedule_id": schedule_id,
        "rules": rules if isinstance(rules, dict) else None,
    }


# ── POST /start-attempt ───────────────────────────────────────────────────────

@router.post("/start-attempt")
async def start_attempt(
    request: Request,
    current_user: dict = Depends(require_candidate),
):
    """
    Creates a new IN_PROGRESS attempt for the candidate.
    Mirrors /exam-attempts/start but validates against candidate_exam_assignments
    instead of exam_registrations.
    """
    supabase = get_supabase_admin()
    candidate_id = current_user["user_id"]

    assignment = _get_assignment(supabase, candidate_id)
    if not assignment:
        raise HTTPException(status_code=403, detail="No exam is assigned to your account")

    schedule = assignment.get("exam_schedules") or {}
    exam = schedule.get("exams") or {}
    schedule_id = assignment["exam_schedule_id"]

    now = datetime.now(timezone.utc)

    def _dt(val):
        if not val:
            return None
        return datetime.fromisoformat(val.replace("Z", "+00:00"))

    start = _dt(schedule.get("start_time"))
    end = _dt(schedule.get("end_time"))

    if not start or not end:
        raise HTTPException(status_code=400, detail="Exam schedule is misconfigured")

    if now < start:
        raise HTTPException(status_code=403, detail="Exam has not started yet")
    if now > end:
        raise HTTPException(status_code=403, detail="Exam window has expired")

    # Prevent duplicate attempts
    existing = _get_existing_attempt(supabase, schedule_id, candidate_id)
    if existing:
        if existing["status"] == "IN_PROGRESS":
            # Resume — return existing attempt
            from datetime import timedelta
            started_at = datetime.fromisoformat(
                existing["started_at"].replace("Z", "+00:00")
            )
            duration_deadline = started_at + timedelta(minutes=exam.get("duration_minutes", 60))
            effective_deadline = min(duration_deadline, end)
            return {
                "message": "Resuming existing attempt",
                "attempt_id": existing["id"],
                "schedule_id": schedule_id,
                "started_at": existing["started_at"],
                "effective_deadline": effective_deadline.isoformat(),
            }
        raise HTTPException(
            status_code=409,
            detail=f"Your attempt is already {existing['status']}. You cannot restart."
        )

    # Create attempt (student_id column stores the candidate's user id — no schema change needed)
    attempt_data = {
        "exam_schedule_id": schedule_id,
        "student_id": candidate_id,
        "status": "IN_PROGRESS",
        "submission_type": "MANUAL",
        "ip_address": request.client.host if request.client else "unknown",
        "user_agent": request.headers.get("user-agent"),
    }
    attempt = supabase.table("exam_attempts").insert(attempt_data).execute().data[0]

    # Update assignment status
    supabase.table("candidate_exam_assignments").update(
        {"status": "STARTED"}
    ).eq("id", assignment["id"]).execute()

    # Log EXAM_STARTED
    supabase.table("submission_logs").insert({
        "attempt_id": attempt["id"],
        "event_type": "EXAM_STARTED",
        "metadata": f'{{"schedule_id": "{schedule_id}", "role": "CANDIDATE"}}',
    }).execute()

    from datetime import timedelta
    started_at = datetime.fromisoformat(attempt["started_at"].replace("Z", "+00:00"))
    duration_deadline = started_at + timedelta(minutes=exam.get("duration_minutes", 60))
    effective_deadline = min(duration_deadline, end)

    return {
        "attempt_id": attempt["id"],
        "schedule_id": schedule_id,
        "started_at": attempt["started_at"],
        "effective_deadline": effective_deadline.isoformat(),
    }


# ── POST /submit ──────────────────────────────────────────────────────────────

@router.post("/submit")
async def submit_attempt(
    body: dict,
    current_user: dict = Depends(require_candidate),
):
    """
    Submit candidate attempt. Delegates to the same _finalize_attempt
    logic used for students — no duplication.
    """
    from app.api.v1.endpoints.exam_attempts import _finalize_attempt, SubmissionType

    supabase = get_supabase_admin()
    candidate_id = current_user["user_id"]
    attempt_id = body.get("attempt_id")
    submission_type: SubmissionType = body.get("submission_type", "MANUAL")

    if not attempt_id:
        raise HTTPException(status_code=400, detail="attempt_id is required")

    attempt = (
        supabase.table("exam_attempts")
        .select("*")
        .eq("id", str(attempt_id))
        .eq("student_id", candidate_id)   # candidate's user id is in student_id column
        .single()
        .execute()
    )
    if not attempt.data:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if attempt.data["status"] != "IN_PROGRESS":
        raise HTTPException(status_code=400, detail="Attempt is not IN_PROGRESS")

    result = await _finalize_attempt(supabase, attempt.data, submission_type)
    if result is None:
        raise HTTPException(status_code=409, detail="Attempt was already submitted")

    # Mark assignment as COMPLETED
    supabase.table("candidate_exam_assignments").update(
        {"status": "COMPLETED"}
    ).eq("candidate_id", candidate_id).eq("exam_schedule_id", attempt.data["exam_schedule_id"]).execute()

    return result


# ── GET /assignments (Faculty use — list candidates for an exam) ──────────────

@router.get("/assignments/{exam_id}")
async def list_candidates(exam_id: UUID, current_user: dict = Depends(require_candidate)):
    """
    This endpoint is intentionally 403 for candidates.
    Faculty uses /faculty/candidates/{exam_id} instead.
    """
    raise HTTPException(status_code=403, detail="Access denied")
