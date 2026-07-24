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
    if len(body.reason.strip()) < 10:
        raise HTTPException(status_code=400, detail="Reason must contain at least 10 characters")
    existing = (
        supabase.table("re_evaluation_requests")
        .select("id")
        .eq("result_id", str(body.result_id))
        .eq("student_id", current_user["user_id"])
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=409, detail="A re-evaluation request already exists for this result")

    req = supabase.table("re_evaluation_requests").insert({
        "result_id": str(body.result_id),
        "student_id": current_user["user_id"],
        "reason": body.reason.strip(),
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
        # `re_evaluation_requests` has TWO foreign keys into `users`
        # (student_id and reviewed_by), so PostgREST can't infer which
        # relationship "users(...)" refers to. Disambiguate explicitly
        # using the FK constraint name — we want the requesting student.
        .select(
            "*, results(exam_id, total_score, max_score, exams(title)), "
            "users!re_evaluation_requests_student_id_fkey(full_name, email)"
        )
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
        req_data = supabase.table("re_evaluation_requests").select("result_id").eq("id", str(request_id)).single().execute().data
        if req_data:
            res_id = req_data["result_id"]
            res_data = supabase.table("results").select("max_score, exam_id").eq("id", str(res_id)).single().execute().data
            if res_data:
                max_score = res_data["max_score"]
                exam_id = res_data["exam_id"]
                exam_data = supabase.table("exams").select("pass_marks").eq("id", str(exam_id)).single().execute().data
                pass_marks = exam_data["pass_marks"] if exam_data else 0

                percentage = round((body.updated_score / max_score) * 100, 2) if max_score > 0 else 0.0
                from app.services.grading_service import calculate_grade
                grade = calculate_grade(percentage)
                is_passed = body.updated_score >= pass_marks

                supabase.table("results").update({
                    "total_score": body.updated_score,
                    "percentage": percentage,
                    "grade": grade,
                    "is_passed": is_passed
                }).eq("id", str(res_id)).execute()

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