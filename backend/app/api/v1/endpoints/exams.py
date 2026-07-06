"""
exams.py
KEY CHANGE in update_exam():
  When status is patched to "PUBLISHED", we also flip is_published=True on
  every exam_schedules row linked to that exam — in the same request.
  This is the only change; everything else is identical to the original.
"""

import logging
from datetime import datetime, timedelta
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
    exam_type: str = "MID_SEMESTER"
    total_marks: int
    pass_marks: int
    duration_minutes: int
    shuffle_questions: bool = False
    shuffle_options: bool = False
    instructions: Optional[str] = None
    status: str = "DRAFT"
    # Optional: kept for backwards compat but wizard no longer sends this
    publish_immediately: bool = False
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    registration_deadline: Optional[str] = None


class ExamUpdate(BaseModel):
    title: Optional[str] = None
    course_id: Optional[str] = None
    exam_type: Optional[str] = None
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
    department_id: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
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
            "exam_type,created_by,created_at,updated_at,instructions,"
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
        .select("*, courses(name,code), exam_questions(*, questions(*))")
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

    # Honour explicit status field first; fall back to publish_immediately flag
    if body.status and body.status != "DRAFT":
        status = body.status
    elif body.publish_immediately:
        status = "PUBLISHED"
    else:
        status = "DRAFT"

    data = {
        "created_by":        current_user["user_id"],
        "title":             body.title,
        "course_id":         body.course_id,
        "exam_type":         body.exam_type,
        "total_marks":       body.total_marks,
        "pass_marks":        body.pass_marks,
        "duration_minutes":  body.duration_minutes,
        "shuffle_questions": body.shuffle_questions,
        "shuffle_options":   body.shuffle_options,
        "instructions":      body.instructions,
        "status":            status,
    }

    result = supabase.table("exams").insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create exam")
    exam = result.data[0]
    exam_id = exam["id"]

    # If publish_immediately was used (legacy path), auto-create a published schedule
    if status == "PUBLISHED" and body.publish_immediately:
        now = datetime.utcnow()
        start = (
            datetime.fromisoformat(body.start_time.replace("Z", ""))
            if body.start_time
            else now
        )
        end = (
            datetime.fromisoformat(body.end_time.replace("Z", ""))
            if body.end_time
            else start + timedelta(minutes=body.duration_minutes)
        )
        reg_deadline = (
            datetime.fromisoformat(body.registration_deadline.replace("Z", ""))
            if body.registration_deadline
            else start
        )
        schedule_data = {
            "exam_id":               exam_id,
            "start_time":            start.isoformat(),
            "end_time":              end.isoformat(),
            "registration_deadline": reg_deadline.isoformat(),
            "is_published":          True,
        }
        supabase.table("exam_schedules").insert(schedule_data).execute()
        logger.info("Auto-created published schedule for exam %s", exam_id)

    return exam


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

    result = (
        supabase.table("exams")
        .update(data)
        .eq("id", str(exam_id))
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Exam not found")

    # KEY FIX: when the faculty clicks Publish on the dashboard, status becomes
    # "PUBLISHED". At that point we also flip is_published=True on every linked
    # schedule row — because the student portal filters on BOTH fields:
    #   exams.status == "PUBLISHED"  AND  exam_schedules.is_published == True
    if data.get("status") == "PUBLISHED":
        supabase.table("exam_schedules") \
            .update({"is_published": True}) \
            .eq("exam_id", str(exam_id)) \
            .execute()
        logger.info(
            "Flipped is_published=True on all schedules for exam %s", exam_id
        )

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
