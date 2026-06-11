"""
Exams endpoints.

WHO DOES WHAT:
  - Exam creation form    → FRONTEND (UI) + BACKEND (POST)
  - Status transitions    → BACKEND only (DRAFT→REVIEW→PUBLISHED→ARCHIVED)
  - Add questions         → BACKEND (POST /exams/{id}/questions)
  - Student exam list     → BACKEND (filters by registration)
  - Faculty exam list     → BACKEND (filters by created_by)
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, model_validator
from typing import Optional, List, Literal
from uuid import UUID

from app.core.security import require_faculty, require_admin, get_current_user_with_roles
from app.db.supabase import get_supabase_admin

router = APIRouter()

ExamStatus = Literal["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"]


# ── Schemas ──────────────────────────────────────────────────────────────────

class ExamCreate(BaseModel):
    title: str
    course_id: UUID
    total_marks: int
    pass_marks: int
    duration_minutes: int
    shuffle_questions: bool = False
    shuffle_options: bool = False
    instructions: Optional[str] = None

    @model_validator(mode="after")
    def validate_marks(self):
        if self.pass_marks >= self.total_marks:
            raise ValueError("pass_marks must be less than total_marks")
        return self


class ExamUpdate(BaseModel):
    title: Optional[str] = None
    total_marks: Optional[int] = None
    pass_marks: Optional[int] = None
    duration_minutes: Optional[int] = None
    shuffle_questions: Optional[bool] = None
    shuffle_options: Optional[bool] = None
    instructions: Optional[str] = None


class ExamQuestionAdd(BaseModel):
    question_id: UUID
    section_id: Optional[UUID] = None
    order_index: int
    marks_override: Optional[int] = None   # NULL = use question's own marks


class StatusTransition(BaseModel):
    status: ExamStatus


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/")
async def list_exams(
    course_id: Optional[UUID] = None,
    status: Optional[ExamStatus] = None,
    current_user: dict = Depends(get_current_user_with_roles),
):
    supabase = get_supabase_admin()
    query = supabase.table("exams").select("*, courses(name, code)")

    # Faculty see only their own exams; admins see all
    if "Faculty" in current_user["roles"] and "Admin" not in current_user["roles"]:
        query = query.eq("created_by", current_user["user_id"])

    if course_id:
        query = query.eq("course_id", str(course_id))
    if status:
        query = query.eq("status", status)

    return query.execute().data


@router.get("/{exam_id}")
async def get_exam(exam_id: UUID, _: dict = Depends(get_current_user_with_roles)):
    supabase = get_supabase_admin()
    result = (
        supabase.table("exams")
        .select("*, courses(name), exam_sections(*), exam_rules(*)")
        .eq("id", str(exam_id))
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Exam not found")
    return result.data


@router.post("/")
async def create_exam(
    body: ExamCreate,
    current_user: dict = Depends(require_faculty),
):
    """Create a new exam in DRAFT status. Faculty/Admin only."""
    supabase = get_supabase_admin()
    data = {
        **body.model_dump(),
        "course_id": str(body.course_id),
        "created_by": current_user["user_id"],
        "status": "DRAFT",
    }
    result = supabase.table("exams").insert(data).execute()
    return result.data[0]


@router.patch("/{exam_id}")
async def update_exam(
    exam_id: UUID,
    body: ExamUpdate,
    _: dict = Depends(require_faculty),
):
    """Update exam details. Only allowed when status is DRAFT."""
    supabase = get_supabase_admin()

    exam = supabase.table("exams").select("status").eq("id", str(exam_id)).single().execute()
    if not exam.data:
        raise HTTPException(status_code=404, detail="Exam not found")
    if exam.data["status"] not in ("DRAFT", "REVIEW"):
        raise HTTPException(status_code=400, detail="Cannot edit a PUBLISHED or ARCHIVED exam")

    data = body.model_dump(exclude_none=True)
    result = supabase.table("exams").update(data).eq("id", str(exam_id)).execute()
    return result.data[0]


@router.patch("/{exam_id}/status", dependencies=[Depends(require_faculty)])
async def change_exam_status(exam_id: UUID, body: StatusTransition):
    """
    Status transition: DRAFT → REVIEW → PUBLISHED → ARCHIVED.
    BACKEND enforces valid transitions. BACKEND responsibility.
    """
    supabase = get_supabase_admin()
    valid_transitions = {
        "DRAFT":     ["REVIEW"],
        "REVIEW":    ["PUBLISHED", "DRAFT"],
        "PUBLISHED": ["ARCHIVED"],
        "ARCHIVED":  [],
    }
    exam = supabase.table("exams").select("status").eq("id", str(exam_id)).single().execute()
    if not exam.data:
        raise HTTPException(status_code=404, detail="Exam not found")

    current = exam.data["status"]
    if body.status not in valid_transitions.get(current, []):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid transition: {current} → {body.status}. Allowed: {valid_transitions[current]}",
        )

    supabase.table("exams").update({"status": body.status}).eq("id", str(exam_id)).execute()
    return {"message": f"Exam status updated to {body.status}"}


@router.get("/{exam_id}/questions")
async def get_exam_questions(exam_id: UUID, _: dict = Depends(get_current_user_with_roles)):
    """
    Returns all questions for an exam with effective marks.
    This is the key query from Phase 4 of the DB design.
    BACKEND responsibility.
    """
    supabase = get_supabase_admin()
    # Use Supabase's RPC or a joined query
    result = (
        supabase.table("exam_questions")
        .select(
            "order_index, marks_override, "
            "questions(id, question_text, question_type, marks, question_options(*)), "
            "exam_sections(title)"
        )
        .eq("exam_id", str(exam_id))
        .order("order_index")
        .execute()
    )
    # Compute effective_marks in Python (COALESCE equivalent)
    for row in result.data:
        row["effective_marks"] = (
            row["marks_override"]
            if row["marks_override"] is not None
            else row["questions"]["marks"]
        )
    return result.data


@router.post("/{exam_id}/questions", dependencies=[Depends(require_faculty)])
async def add_question_to_exam(exam_id: UUID, body: ExamQuestionAdd):
    """
    Add a question to an exam (bridge table insert).
    BACKEND responsibility.
    """
    supabase = get_supabase_admin()
    data = {
        "exam_id": str(exam_id),
        "question_id": str(body.question_id),
        "section_id": str(body.section_id) if body.section_id else None,
        "order_index": body.order_index,
        "marks_override": body.marks_override,
    }
    result = supabase.table("exam_questions").insert(data).execute()
    return result.data[0]


@router.delete("/{exam_id}/questions/{question_id}", dependencies=[Depends(require_faculty)])
async def remove_question_from_exam(exam_id: UUID, question_id: UUID):
    supabase = get_supabase_admin()
    supabase.table("exam_questions").delete().eq("exam_id", str(exam_id)).eq("question_id", str(question_id)).execute()
    return {"message": "Question removed from exam"}
