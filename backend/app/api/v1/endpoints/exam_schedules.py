"""
app/api/v1/endpoints/exam_schedules.py
Complete router for exam schedule management.
"""
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.core.security import require_faculty
from app.db.supabase import get_supabase_admin

router = APIRouter()


class ScheduleCreate(BaseModel):
    exam_id: str
    start_time: str
    end_time: str
    registration_deadline: Optional[str] = None
    is_published: bool = False


class ScheduleUpdate(BaseModel):
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    registration_deadline: Optional[str] = None
    is_published: Optional[bool] = None


@router.get("/")
async def list_schedules(
    exam_id: Optional[str] = None,
    is_published: Optional[bool] = None,
    current_user: dict = Depends(require_faculty),
):
    """List all schedules for exams created by this faculty member."""
    supabase = get_supabase_admin()

    # Scope to this faculty's exams only
    exams_result = (
        supabase.table("exams")
        .select("id")
        .eq("created_by", current_user["user_id"])
        .execute()
    )
    faculty_exam_ids = [row["id"] for row in (exams_result.data or [])]
    if not faculty_exam_ids:
        return []

    query = (
        supabase.table("exam_schedules")
        .select(
            "*, "
            "exams(id,title,status,duration_minutes,courses(name,code))"
        )
        .in_("exam_id", faculty_exam_ids)
        .order("start_time", desc=True)
    )
    if exam_id:
        query = query.eq("exam_id", exam_id)
    if is_published is not None:
        query = query.eq("is_published", is_published)

    return query.execute().data or []


@router.get("/{schedule_id}")
async def get_schedule(schedule_id: UUID, _: dict = Depends(require_faculty)):
    supabase = get_supabase_admin()
    result = (
        supabase.table("exam_schedules")
        .select("*, exams(title,status,duration_minutes)")
        .eq("id", str(schedule_id))
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return result.data


@router.post("/")
async def create_schedule(
    body: ScheduleCreate,
    _: dict = Depends(require_faculty),
):
    supabase = get_supabase_admin()
    data = body.model_dump(exclude_none=True)
    result = supabase.table("exam_schedules").insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create schedule")
    return result.data[0]


@router.patch("/{schedule_id}")
async def update_schedule(
    schedule_id: UUID,
    body: ScheduleUpdate,
    _: dict = Depends(require_faculty),
):
    """
    Patch a schedule.
    Key use-case: toggle is_published to make it visible (or hide from) students.
    """
    supabase = get_supabase_admin()
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = (
        supabase.table("exam_schedules")
        .update(data)
        .eq("id", str(schedule_id))
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return result.data[0]


@router.delete("/{schedule_id}")
async def delete_schedule(schedule_id: UUID, _: dict = Depends(require_faculty)):
    supabase = get_supabase_admin()
    supabase.table("exam_schedules").delete().eq("id", str(schedule_id)).execute()
    return {"message": "Schedule deleted"}