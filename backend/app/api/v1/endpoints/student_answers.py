"""
Student Answers — answers saved during a live exam.

WHO DOES WHAT:
  - Answer selection UI (radio/checkbox) → FRONTEND only
  - Auto-save every N seconds            → FRONTEND triggers POST /save (per exam_rules.auto_save_interval_sec)
  - Mark for review flag                 → FRONTEND (checkbox) + BACKEND (upsert)
  - Navigate between questions           → FRONTEND + BACKEND (log navigation action)
  - Fetch answers to resume attempt      → BACKEND (GET /answers/{attempt_id})

CRITICAL: Always use UPSERT — never plain INSERT. Idempotent saves.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timedelta, timezone

from app.core.security import require_faculty, get_current_user_with_roles, require_exam_taker
from app.db.supabase import get_supabase_admin

router = APIRouter()


class AnswerUpsert(BaseModel):
    attempt_id: UUID
    question_id: UUID
    selected_option_id: Optional[UUID] = None   # MCQ / TRUE_FALSE / MSQ
    selected_option_ids: Optional[List[UUID]] = None  # MSQ
    answer_text: Optional[str] = None            # SHORT_ANSWER / LONG_ANSWER
    is_marked_for_review: bool = False
    time_spent_sec: int = 0


class NavigationLog(BaseModel):
    attempt_id: UUID
    question_id: UUID
    action: str   # VISITED, ANSWERED, SKIPPED, FLAGGED, UNFLAGGED, REVISITED


@router.post("/save")
async def save_answer(
    body: AnswerUpsert,
    current_user: dict = Depends(require_exam_taker),
):
    """
    UPSERT an answer. Called by frontend auto-save and on every answer change.
    This is the core auto-save endpoint — must be idempotent.
    marks_awarded and is_correct are NOT set here — grading service handles those.
    BACKEND responsibility.
    """
    supabase = get_supabase_admin()

    # Verify attempt belongs to this exam taker.
    attempt = (
        supabase.table("exam_attempts")
        .select("status,started_at,exam_schedule_id")
        .eq("id", str(body.attempt_id))
        .eq("student_id", current_user["user_id"])
        .single()
        .execute()
    )
    if not attempt.data:
        raise HTTPException(status_code=403, detail="Attempt not found or not yours")
    if attempt.data["status"] != "IN_PROGRESS":
        raise HTTPException(status_code=400, detail="Exam is not IN_PROGRESS")

    schedule = (
        supabase.table("exam_schedules")
        .select("end_time, exams(duration_minutes)")
        .eq("id", attempt.data["exam_schedule_id"])
        .single()
        .execute()
        .data
    )
    duration_deadline = datetime.fromisoformat(attempt.data["started_at"]) + timedelta(
        minutes=schedule["exams"]["duration_minutes"]
    )
    effective_deadline = min(
        duration_deadline,
        datetime.fromisoformat(schedule["end_time"]),
    )
    if datetime.now(timezone.utc) >= effective_deadline:
        raise HTTPException(status_code=409, detail="Exam time has expired; submit the attempt")

    upsert_data = {
        "attempt_id": str(body.attempt_id),
        "question_id": str(body.question_id),
        "selected_option_id": str(body.selected_option_id) if body.selected_option_id else None,
        "selected_option_ids": [str(v) for v in body.selected_option_ids] if body.selected_option_ids else None,
        "answer_text": body.answer_text,
        "is_marked_for_review": body.is_marked_for_review,
        "time_spent_sec": body.time_spent_sec,
        # marks_awarded and is_correct intentionally omitted —
        # set by auto_grade_attempt() on submission and faculty grading only
    }

    # UPSERT on (attempt_id, question_id) — the unique constraint
    supabase.table("student_answers").upsert(
        upsert_data,
        on_conflict="attempt_id,question_id",
    ).execute()

    return {"saved": True}


@router.get("/by-exam/{exam_id}")
async def get_attempts_for_exam(exam_id: UUID, _: dict = Depends(require_faculty)):
    """
    Returns all attempts for a given exam_id, with student info.
    Used by faculty Evaluation page to populate the student list.
    BACKEND responsibility.
    """
    supabase = get_supabase_admin()

    result = (
        supabase.table("exam_attempts")
        .select("*, exam_schedules!inner(exam_id), users(full_name, email), students(roll_number)")
        .eq("exam_schedules.exam_id", str(exam_id))
        .execute()
    )
    return result.data


@router.get("/{attempt_id}")
async def get_answers_for_attempt(
    attempt_id: UUID,
    current_user: dict = Depends(get_current_user_with_roles),
):
    """
    Returns all saved answers for an attempt.
    Students use this to restore their answers on page refresh / reconnect.
    BACKEND responsibility.
    """
    supabase = get_supabase_admin()
    query = supabase.table("student_answers").select("*").eq("attempt_id", str(attempt_id))

    # Exam takers can only fetch their own attempt's answers.
    if "Student" in current_user["roles"] or "Candidate" in current_user["roles"]:
        attempt = (
            supabase.table("exam_attempts")
            .select("student_id")
            .eq("id", str(attempt_id))
            .single()
            .execute()
        )
        if not attempt.data or attempt.data["student_id"] != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Forbidden")

    return query.execute().data


@router.post("/navigate")
async def log_navigation(
    body: NavigationLog,
    current_user: dict = Depends(require_exam_taker),
):
    """
    Log question navigation action (VISITED, ANSWERED, SKIPPED, FLAGGED etc.).
    Frontend calls this on every question transition.
    Append-only — no UNIQUE constraint on navigation logs.
    BACKEND responsibility.
    """
    valid_actions = {"VISITED", "ANSWERED", "SKIPPED", "FLAGGED", "UNFLAGGED", "REVISITED"}
    if body.action not in valid_actions:
        raise HTTPException(status_code=400, detail=f"Invalid action. Use: {valid_actions}")

    supabase = get_supabase_admin()
    attempt = (
        supabase.table("exam_attempts")
        .select("student_id")
        .eq("id", str(body.attempt_id))
        .single()
        .execute()
    )
    if not attempt.data or attempt.data["student_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Attempt not found or not yours")

    supabase.table("question_navigation_logs").insert({
        "attempt_id": str(body.attempt_id),
        "question_id": str(body.question_id),
        "action": body.action,
    }).execute()

    return {"logged": True}
