"""
Candidate portal endpoints.

Candidates are users with the Candidate role. They do not need per-exam
assignment rows: any PUBLISHED ENTRANCE exam with an active schedule is
available to every candidate account.
"""
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request

from app.core.security import require_candidate
from app.db.supabase import get_supabase_admin

router = APIRouter()


def _dt(value: str | None) -> datetime | None:
    if not value:
        return None
    parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _published_entrance_schedules(supabase) -> list[dict]:
    schedules = (
        supabase.table("exam_schedules")
        .select(
            "id,start_time,end_time,is_published,"
            "exams(id,title,status,exam_type,duration_minutes,total_marks,pass_marks,instructions,"
            "exam_questions(id),exam_rules(id,require_fullscreen,enable_proctoring,"
            "allow_backtrack,allow_review_flag,max_tab_switches,auto_save_interval_sec))"
        )
        .order("start_time")
        .execute()
        .data
    ) or []

    return [
        schedule for schedule in schedules
        if (schedule.get("exams") or {}).get("exam_type") == "ENTRANCE"
        and (schedule.get("exams") or {}).get("status") == "PUBLISHED"
    ]


def _attempts_by_schedule(supabase, candidate_id: str) -> dict[str, dict]:
    attempts = (
        supabase.table("exam_attempts")
        .select("id,status,started_at,exam_schedule_id")
        .eq("student_id", candidate_id)
        .execute()
        .data
    ) or []
    return {attempt["exam_schedule_id"]: attempt for attempt in attempts}


def _pick_candidate_schedule(supabase, candidate_id: str) -> tuple[dict | None, dict | None, str]:
    now = datetime.now(timezone.utc)
    schedules = _published_entrance_schedules(supabase)
    attempts = _attempts_by_schedule(supabase, candidate_id)

    for schedule in schedules:
        attempt = attempts.get(schedule["id"])
        if attempt and attempt.get("status") == "IN_PROGRESS":
            return schedule, attempt, "IN_PROGRESS"

    active = []
    future = []
    submitted = []
    expired = []

    for schedule in schedules:
        start = _dt(schedule.get("start_time"))
        end = _dt(schedule.get("end_time"))
        if not start or not end:
            continue

        attempt = attempts.get(schedule["id"])
        if attempt and attempt.get("status") in ("SUBMITTED", "AUTO_SUBMITTED"):
            submitted.append((schedule, attempt))
            continue
        if attempt and attempt.get("status") != "IN_PROGRESS":
            continue

        if start <= now <= end:
            active.append((schedule, attempt))
        elif now < start:
            future.append((schedule, attempt))
        elif now > end:
            expired.append((schedule, attempt))

    if active:
        return active[0][0], active[0][1], "ACTIVE"
    if future:
        return future[0][0], future[0][1], "NOT_STARTED"
    if submitted:
        return submitted[-1][0], submitted[-1][1], "SUBMITTED"
    if expired:
        return expired[-1][0], expired[-1][1], "EXPIRED"
    return None, None, "NO_EXAM"


def _active_schedule_or_error(supabase, candidate_id: str) -> tuple[dict, dict]:
    schedule, attempt, state = _pick_candidate_schedule(supabase, candidate_id)
    if not schedule:
        raise HTTPException(status_code=403, detail="No published entrance assessment is available")
    if state == "IN_PROGRESS" and attempt:
        return schedule, attempt
    if state != "ACTIVE":
        raise HTTPException(status_code=403, detail="Assessment is not currently open")
    return schedule, {}


@router.get("/exam-state")
async def get_exam_state(current_user: dict = Depends(require_candidate)):
    """
    Returns one of six states:
      NOT_STARTED | ACTIVE | IN_PROGRESS | SUBMITTED | EXPIRED | NO_EXAM
    """
    supabase = get_supabase_admin()
    candidate_id = current_user["user_id"]
    schedule, attempt, state = _pick_candidate_schedule(supabase, candidate_id)

    if not schedule:
        return {"state": "NO_EXAM"}

    exam = schedule.get("exams") or {}
    schedule_id = schedule["id"]

    if state == "SUBMITTED":
        return {"state": "SUBMITTED"}
    if state == "EXPIRED":
        return {"state": "EXPIRED"}
    if state == "IN_PROGRESS" and attempt:
        return {
            "state": "IN_PROGRESS",
            "attempt_id": attempt["id"],
            "schedule_id": schedule_id,
            "exam_title": exam.get("title", ""),
        }
    if state == "NOT_STARTED":
        return {
            "state": "NOT_STARTED",
            "scheduled_at": schedule.get("start_time"),
            "exam_title": exam.get("title", ""),
            "exam_duration_minutes": exam.get("duration_minutes", 0),
        }

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


@router.post("/start-attempt")
async def start_attempt(
    request: Request,
    current_user: dict = Depends(require_candidate),
):
    supabase = get_supabase_admin()
    candidate_id = current_user["user_id"]
    schedule, existing = _active_schedule_or_error(supabase, candidate_id)
    exam = schedule.get("exams") or {}
    schedule_id = schedule["id"]
    end = _dt(schedule.get("end_time"))
    if not end:
        raise HTTPException(status_code=400, detail="Assessment schedule is misconfigured")

    if existing:
        started_at = _dt(existing["started_at"])
        duration_deadline = (started_at or datetime.now(timezone.utc)) + timedelta(
            minutes=exam.get("duration_minutes", 60)
        )
        effective_deadline = min(duration_deadline, end)
        return {
            "message": "Resuming existing attempt",
            "attempt_id": existing["id"],
            "schedule_id": schedule_id,
            "started_at": existing["started_at"],
            "effective_deadline": effective_deadline.isoformat(),
        }

    attempt = supabase.table("exam_attempts").insert({
        "exam_schedule_id": schedule_id,
        "student_id": candidate_id,
        "status": "IN_PROGRESS",
        "submission_type": "MANUAL",
        "ip_address": request.client.host if request.client else "unknown",
        "user_agent": request.headers.get("user-agent"),
    }).execute().data[0]

    supabase.table("submission_logs").insert({
        "attempt_id": attempt["id"],
        "event_type": "EXAM_STARTED",
        "metadata": f'{{"schedule_id": "{schedule_id}", "role": "CANDIDATE"}}',
    }).execute()

    started_at = _dt(attempt["started_at"]) or datetime.now(timezone.utc)
    duration_deadline = started_at + timedelta(minutes=exam.get("duration_minutes", 60))
    effective_deadline = min(duration_deadline, end)

    return {
        "attempt_id": attempt["id"],
        "schedule_id": schedule_id,
        "started_at": attempt["started_at"],
        "effective_deadline": effective_deadline.isoformat(),
    }


@router.post("/submit")
async def submit_attempt(
    body: dict,
    current_user: dict = Depends(require_candidate),
):
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
        .eq("student_id", candidate_id)
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
    return result


@router.get("/assignments/{exam_id}")
async def list_candidates(exam_id: UUID, current_user: dict = Depends(require_candidate)):
    raise HTTPException(status_code=403, detail="Access denied")
