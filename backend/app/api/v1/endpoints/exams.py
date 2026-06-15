"""
exams.py — FIX: removed 'semester' from the insert payload (column does not exist in DB).
"""

import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.security import require_faculty
from app.db.supabase import get_supabase_admin

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class ExamCreate(BaseModel):
    title: str
    course_id: Optional[str] = None
    total_marks: int
    pass_marks: int
    duration_minutes: int
    shuffle_questions: bool = False
    shuffle_options: bool = False
    instructions: Optional[str] = None
    # NOTE: 'semester' intentionally excluded — that column does not exist in the DB.
    # If you add it to the DB later, add it back here.


class ExamUpdate(BaseModel):
    title: Optional[str] = None
    course_id: Optional[str] = None
    total_marks: Optional[int] = None
    pass_marks: Optional[int] = None
    duration_minutes: Optional[int] = None
    shuffle_questions: Optional[bool] = None
    shuffle_options: Optional[bool] = None
    instructions: Optional[str] = None
    status: Optional[str] = None


class QuestionAdd(BaseModel):
    question_id: str
    order_index: int = 0


class ExamRulesUpsert(BaseModel):
    exam_id: str
    allow_backtrack: bool = True
    mark_for_review: bool = True
    fullscreen_required: bool = False
    proctoring_enabled: bool = False
    camera_required: bool = False
    microphone_required: bool = False
    max_tab_switches: int = 3
    auto_save_interval_sec: int = 30


class ScheduleCreate(BaseModel):
    exam_id: str
    department_id: str
    start_time: str
    end_time: str
    registration_deadline: Optional[str] = None
    is_published: bool = False


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/")
async def list_exams(current_user: dict = Depends(require_faculty)):
    supabase = get_supabase_admin()
    result = (
        supabase.table("exams")
        .select(
            "id,title,status,course_id,duration_minutes,total_marks,pass_marks,"
            "created_by,created_at,updated_at,instructions,"
            "shuffle_questions,shuffle_options,courses(name,code)"
        )
        .eq("created_by", current_user["user_id"])
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


@router.get("/{exam_id}")
async def get_exam(exam_id: UUID, _: dict = Depends(require_faculty)):
    supabase = get_supabase_admin()
    result = (
        supabase.table("exams")
        .select(
            "*, courses(name,code), exam_questions(*, questions(*))"
        )
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
    supabase = get_supabase_admin()

    # FIX: Only insert columns that actually exist in the exams table.
    # 'semester' was being sent previously and caused PGRST204 / 500 errors.
    data = {
        "created_by":        current_user["user_id"],
        "title":             body.title,
        "course_id":         body.course_id,
        "total_marks":       body.total_marks,
        "pass_marks":        body.pass_marks,
        "duration_minutes":  body.duration_minutes,
        "shuffle_questions": body.shuffle_questions,
        "shuffle_options":   body.shuffle_options,
        "instructions":      body.instructions,
        "status":            "DRAFT",
    }

    result = supabase.table("exams").insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create exam")
    return result.data[0]


@router.patch("/{exam_id}")
async def update_exam(
    exam_id: UUID,
    body: ExamUpdate,
    _: dict = Depends(require_faculty),
):
    supabase = get_supabase_admin()
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = supabase.table("exams").update(data).eq("id", str(exam_id)).execute()
    return result.data[0]


@router.delete("/{exam_id}")
async def delete_exam(exam_id: UUID, _: dict = Depends(require_faculty)):
    supabase = get_supabase_admin()
    supabase.table("exams").delete().eq("id", str(exam_id)).execute()
    return {"message": "Exam deleted"}


@router.post("/{exam_id}/questions")
async def add_question_to_exam(
    exam_id: UUID,
    body: QuestionAdd,
    _: dict = Depends(require_faculty),
):
    supabase = get_supabase_admin()
    result = supabase.table("exam_questions").insert({
        "exam_id":     str(exam_id),
        "question_id": body.question_id,
        "order_index": body.order_index,
    }).execute()
    return result.data[0]


@router.delete("/{exam_id}/questions/{question_id}")
async def remove_question_from_exam(
    exam_id: UUID,
    question_id: UUID,
    _: dict = Depends(require_faculty),
):
    supabase = get_supabase_admin()
    supabase.table("exam_questions") \
        .delete() \
        .eq("exam_id", str(exam_id)) \
        .eq("question_id", str(question_id)) \
        .execute()
    return {"message": "Question removed from exam"}


@router.post("/rules")
async def upsert_exam_rules(
    body: ExamRulesUpsert,
    _: dict = Depends(require_faculty),
):
    supabase = get_supabase_admin()
    data = body.model_dump()
    result = supabase.table("exam_rules").upsert(data, on_conflict="exam_id").execute()
    return result.data[0] if result.data else {"message": "Rules saved"}


@router.post("/schedules")
async def create_schedule(
    body: ScheduleCreate,
    _: dict = Depends(require_faculty),
):
    supabase = get_supabase_admin()
    data = body.model_dump(exclude_none=True)
    result = supabase.table("exam_schedules").insert(data).execute()
    return result.data[0]


@router.get("/{exam_id}/schedules")
async def get_exam_schedules(exam_id: UUID, _: dict = Depends(require_faculty)):
    supabase = get_supabase_admin()
    result = (
        supabase.table("exam_schedules")
        .select("*, departments(name,code)")
        .eq("exam_id", str(exam_id))
        .order("start_time")
        .execute()
    )
    return result.data or []