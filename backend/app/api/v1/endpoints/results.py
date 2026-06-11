"""
Results endpoints.

WHO DOES WHAT:
  - Results page (scorecard UI)          → FRONTEND only
  - Publish result (toggle)              → BACKEND (Admin only)
  - Fetch own result                     → BACKEND (Student: own; Faculty: all in exam)
  - Analytics / pass-fail stats          → BACKEND
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from uuid import UUID

from app.core.security import require_admin, require_faculty, require_student, get_current_user_with_roles
from app.db.supabase import get_supabase_admin

router = APIRouter()


@router.get("/my")
async def get_my_results(current_user: dict = Depends(require_student)):
    """Student fetches their own published results."""
    supabase = get_supabase_admin()
    result = (
        supabase.table("results")
        .select("*, exams(title, total_marks, pass_marks)")
        .eq("student_id", current_user["user_id"])
        .eq("is_published", True)
        .execute()
    )
    return result.data


@router.get("/{result_id}")
async def get_result(result_id: UUID, current_user: dict = Depends(get_current_user_with_roles)):
    supabase = get_supabase_admin()
    result = (
        supabase.table("results")
        .select("*, exams(title), users(full_name)")
        .eq("id", str(result_id))
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Result not found")

    r = result.data
    # Students can only see published results
    if "Student" in current_user["roles"] and not r["is_published"]:
        raise HTTPException(status_code=403, detail="Result not yet published")
    return r


@router.patch("/{result_id}/publish", dependencies=[Depends(require_admin)])
async def publish_result(result_id: UUID):
    """Admin publishes a result. Triggers published_at via DB trigger."""
    supabase = get_supabase_admin()
    supabase.table("results").update({"is_published": True}).eq("id", str(result_id)).execute()
    # Notify student
    result = supabase.table("results").select("student_id, exams(title)").eq("id", str(result_id)).single().execute()
    if result.data:
        supabase.table("notifications").insert({
            "user_id": result.data["student_id"],
            "type": "RESULT_PUBLISHED",
            "title": "Your result is out!",
            "body": f"Results for {result.data['exams']['title']} have been published.",
        }).execute()
    return {"message": "Result published"}


@router.get("/exam/{exam_id}/stats", dependencies=[Depends(require_faculty)])
async def get_exam_stats(exam_id: UUID):
    """Pass/fail stats, average score, grade distribution for an exam."""
    supabase = get_supabase_admin()
    results = supabase.table("results").select("total_score, percentage, grade, is_passed").eq("exam_id", str(exam_id)).execute()

    data = results.data
    if not data:
        return {"total_attempts": 0}

    total = len(data)
    passed = sum(1 for r in data if r["is_passed"])
    avg_pct = round(sum(r["percentage"] for r in data) / total, 2)
    grade_dist = {}
    for r in data:
        grade_dist[r["grade"]] = grade_dist.get(r["grade"], 0) + 1

    return {
        "total_attempts": total,
        "passed": passed,
        "failed": total - passed,
        "pass_rate": round(passed / total * 100, 2),
        "average_percentage": avg_pct,
        "grade_distribution": grade_dist,
    }
