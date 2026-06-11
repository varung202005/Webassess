"""
Re-Evaluation Requests.

WHO DOES WHAT:
  - Request re-eval form (reason text)  → FRONTEND (UI) + BACKEND (POST)
  - Faculty reviews and resolves        → BACKEND (PATCH status + updated_score)
  - Student sees request status         → FRONTEND renders + BACKEND (GET /my)
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Literal
from uuid import UUID

from app.core.security import require_student, require_faculty, get_current_user_with_roles
from app.db.supabase import get_supabase_admin

router = APIRouter()

ReEvalStatus = Literal["PENDING", "REVIEWING", "RESOLVED", "REJECTED"]


class ReEvalCreate(BaseModel):
    result_id: UUID
    reason: str


class ReEvalReview(BaseModel):
    status: ReEvalStatus
    reviewer_notes: Optional[str] = None
    updated_score: Optional[int] = None


@router.post("/")
async def request_re_evaluation(
    body: ReEvalCreate,
    current_user: dict = Depends(require_student),
):
    supabase = get_supabase_admin()

    # Validate result belongs to student
    result = (
        supabase.table("results")
        .select("student_id, is_published")
        .eq("id", str(body.result_id))
        .single()
        .execute()
    )
    if not result.data or result.data["student_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Not your result")
    if not result.data["is_published"]:
        raise HTTPException(status_code=400, detail="Result is not published yet")

    req = supabase.table("re_evaluation_requests").insert({
        "result_id": str(body.result_id),
        "student_id": current_user["user_id"],
        "reason": body.reason,
        "status": "PENDING",
    }).execute()

    return req.data[0]


@router.get("/my")
async def my_requests(current_user: dict = Depends(require_student)):
    supabase = get_supabase_admin()
    return (
        supabase.table("re_evaluation_requests")
        .select("*, results(total_score, grade, exams(title))")
        .eq("student_id", current_user["user_id"])
        .execute()
        .data
    )


@router.get("/pending", dependencies=[Depends(require_faculty)])
async def pending_requests():
    supabase = get_supabase_admin()
    return (
        supabase.table("re_evaluation_requests")
        .select("*, results(exam_id, total_score, max_score, exams(title)), users(full_name)")
        .eq("status", "PENDING")
        .execute()
        .data
    )


@router.patch("/{request_id}")
async def review_request(
    request_id: UUID,
    body: ReEvalReview,
    current_user: dict = Depends(require_faculty),
):
    supabase = get_supabase_admin()
    update = {
        "status": body.status,
        "reviewed_by": current_user["user_id"],
        "reviewer_notes": body.reviewer_notes,
    }
    if body.updated_score is not None:
        update["updated_score"] = body.updated_score
    result = supabase.table("re_evaluation_requests").update(update).eq("id", str(request_id)).execute()

    # Notify student
    req = result.data[0]
    supabase.table("notifications").insert({
        "user_id": req["student_id"],
        "type": "REEVAL_RESOLVED",
        "title": f"Re-evaluation {body.status}",
        "body": body.reviewer_notes or f"Your re-evaluation request has been {body.status}.",
    }).execute()

    return req
