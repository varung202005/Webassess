"""
Grading endpoints — manual scoring for SHORT_ANSWER and LONG_ANSWER.

WHO DOES WHAT:
  - View subjective answers         → BACKEND (Faculty fetches ungraded answers)
  - Score input form                → FRONTEND (UI form with marks input)
  - Submit manual score             → BACKEND (PATCH /grading/score)
  - Grading log (audit trail)       → BACKEND (auto-appended on every score change)
  - Grade dashboard / progress      → FRONTEND (renders grading queue) + BACKEND (query)
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from uuid import UUID

from app.core.security import require_faculty
from app.db.supabase import get_supabase_admin

router = APIRouter()


class ManualScoreUpdate(BaseModel):
    answer_id: UUID
    marks_awarded: int
    is_correct: Optional[bool] = None
    change_reason: str   # Required — every score change must be documented


@router.get("/pending/{exam_id}")
async def get_pending_grading(exam_id: UUID, _: dict = Depends(require_faculty)):
    """
    Returns all SHORT_ANSWER and LONG_ANSWER student answers that need manual grading.
    Faculty dashboard — grading queue.
    BACKEND responsibility.
    """
    supabase = get_supabase_admin()

    # Get attempts for this exam
    attempts = (
        supabase.table("exam_attempts")
        .select("id, exam_schedules(exam_id)")
        .execute()
    )
    # Filter to this exam
    attempt_ids = [
        a["id"] for a in attempts.data
        if a.get("exam_schedules", {}).get("exam_id") == str(exam_id)
    ]

    if not attempt_ids:
        return []

    # Get ungraded subjective answers
    result = (
        supabase.table("student_answers")
        .select("*, questions(question_text, question_type, marks)")
        .in_("attempt_id", attempt_ids)
        .is_("is_correct", "null")   # NULL = not graded yet
        .execute()
    )

    # Filter to subjective only
    subjective = [
        r for r in result.data
        if r.get("questions", {}).get("question_type") in ("SHORT_ANSWER", "LONG_ANSWER")
    ]
    return subjective


@router.patch("/score")
async def set_manual_score(
    body: ManualScoreUpdate,
    current_user: dict = Depends(require_faculty),
):
    """
    Faculty sets marks for a subjective answer.
    Also writes to grading_logs as an immutable audit trail.
    BACKEND responsibility.
    """
    supabase = get_supabase_admin()

    # Get current answer
    answer = (
        supabase.table("student_answers")
        .select("marks_awarded, attempt_id")
        .eq("id", str(body.answer_id))
        .single()
        .execute()
    )
    if not answer.data:
        raise HTTPException(status_code=404, detail="Answer not found")

    old_score = answer.data["marks_awarded"]
    new_score = body.marks_awarded

    if old_score == new_score:
        raise HTTPException(status_code=400, detail="New score is same as old score (no-op blocked)")

    # Update answer
    supabase.table("student_answers").update({
        "marks_awarded": new_score,
        "is_correct": body.is_correct,
    }).eq("id", str(body.answer_id)).execute()

    # Get result for this attempt to link grading_log
    result = (
        supabase.table("results")
        .select("id")
        .eq("attempt_id", answer.data["attempt_id"])
        .single()
        .execute()
    )
    if result.data:
        supabase.table("grading_logs").insert({
            "result_id": result.data["id"],
            "changed_by": current_user["user_id"],
            "old_score": old_score,
            "new_score": new_score,
            "change_reason": body.change_reason,
        }).execute()

        # Recalculate total_score on results
        all_answers = (
            supabase.table("student_answers")
            .select("marks_awarded")
            .eq("attempt_id", answer.data["attempt_id"])
            .execute()
        )
        new_total = sum(a["marks_awarded"] for a in all_answers.data)

        # Get max_score from results to recalc percentage
        res_data = (
            supabase.table("results")
            .select("max_score")
            .eq("id", result.data["id"])
            .single()
            .execute()
        )
        max_score = res_data.data["max_score"]
        percentage = round((new_total / max_score) * 100, 2) if max_score > 0 else 0

        from app.services.grading_service import calculate_grade
        grade = calculate_grade(percentage)

        supabase.table("results").update({
            "total_score": new_total,
            "percentage": percentage,
            "grade": grade,
        }).eq("id", result.data["id"]).execute()

    return {"message": "Score updated", "new_score": new_score}
