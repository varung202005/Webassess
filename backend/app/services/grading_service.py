"""
Grading Service.

Auto-grades MCQ and TRUE_FALSE on submission.
SHORT_ANSWER and LONG_ANSWER require manual faculty review.

This will eventually become a Supabase DB Function (as decided in Phase 6).
For now it lives here as a Python service called from exam_attempts.submit.
"""
from app.core.config import settings
from app.db.supabase import get_supabase_admin


async def auto_grade_attempt(attempt_id: str) -> int:
    """
    Auto-grade all MCQ and TRUE_FALSE answers for an attempt.
    Updates is_correct and marks_awarded on each student_answer row.
    Returns total_score (sum of marks_awarded).
    """
    supabase = get_supabase_admin()

    # Fetch all answers for this attempt with question type and correct option
    answers = (
        supabase.table("student_answers")
        .select(
            "id, question_id, selected_option_id, selected_option_ids, "
            "questions(question_type, marks, negative_marks)"
        )
        .eq("attempt_id", attempt_id)
        .execute()
    )

    total_score = 0

    for ans in answers.data:
        q = ans.get("questions", {})
        q_type = q.get("question_type")

        # Only auto-grade objective types
        if q_type not in ("MCQ", "TRUE_FALSE", "MSQ"):
            continue

        selected_option_id = ans.get("selected_option_id")
        selected_option_ids = ans.get("selected_option_ids") or []
        if not selected_option_id and not selected_option_ids:
            # No answer selected — 0 marks, not incorrect (unanswered)
            supabase.table("student_answers").update({
                "is_correct": False,
                "marks_awarded": 0,
            }).eq("id", ans["id"]).execute()
            continue

        if q_type == "MSQ":
            question_id = ans.get("question_id")
            correct = (
                supabase.table("question_options")
                .select("id")
                .eq("question_id", question_id)
                .eq("is_correct", True)
                .execute()
                .data
            )
            is_correct = {row["id"] for row in correct} == set(selected_option_ids)
        else:
            option = (
                supabase.table("question_options")
                .select("is_correct")
                .eq("id", selected_option_id)
                .single()
                .execute()
            )
            is_correct = option.data["is_correct"] if option.data else False

        effective_marks = q.get("marks", 0)
        negative = q.get("negative_marks", 0)

        if is_correct:
            marks_awarded = effective_marks
        else:
            marks_awarded = max(0, -negative)  # Never go negative per-question in total

        total_score += marks_awarded

        supabase.table("student_answers").update({
            "is_correct": is_correct,
            "marks_awarded": marks_awarded,
        }).eq("id", ans["id"]).execute()

    return total_score


def calculate_grade(percentage: float) -> str:
    """
    Calculate letter grade from percentage.
    Thresholds defined in config — adjust per institution.
    """
    thresholds = settings.GRADE_THRESHOLDS  # A+:90, A:80, B+:70, B:60, C:50, D:40
    for grade, threshold in sorted(thresholds.items(), key=lambda x: -x[1]):
        if percentage >= threshold:
            return grade
    return "F"