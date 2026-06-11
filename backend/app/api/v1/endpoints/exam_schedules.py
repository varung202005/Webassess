"""
Exam Schedules — when and to which department an exam is available.

WHO DOES WHAT:
  - Schedule form (dates, dept)   → FRONTEND (UI) + BACKEND (POST)
  - Publish toggle                → BACKEND only (triggers published_at stamp)
  - Student: see available exams  → BACKEND (filter is_published=TRUE + student's dept)
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, model_validator
from typing import Optional
from uuid import UUID
from datetime import datetime

from app.core.security import require_faculty, require_admin, get_current_user_with_roles
from app.db.supabase import get_supabase_admin

router = APIRouter()


class ScheduleCreate(BaseModel):
    exam_id: UUID
    department_id: UUID
    start_time: datetime
    end_time: datetime
    is_published: bool = False

    @model_validator(mode="after")
    def validate_times(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class ScheduleUpdate(BaseModel):
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    department_id: Optional[UUID] = None
    is_published: Optional[bool] = None


@router.get("/")
async def list_schedules(
    exam_id: Optional[UUID] = None,
    is_published: Optional[bool] = None,
    current_user: dict = Depends(get_current_user_with_roles),
):
    supabase = get_supabase_admin()
    query = supabase.table("exam_schedules").select("*, exams(title, duration_minutes), departments(name)")
    if exam_id:
        query = query.eq("exam_id", str(exam_id))
    if is_published is not None:
        query = query.eq("is_published", is_published)
    return query.execute().data


@router.get("/{schedule_id}")
async def get_schedule(schedule_id: UUID, _: dict = Depends(get_current_user_with_roles)):
    supabase = get_supabase_admin()
    result = (
        supabase.table("exam_schedules")
        .select("*, exams(title, duration_minutes, instructions, exam_rules(*)), departments(name)")
        .eq("id", str(schedule_id))
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return result.data


@router.post("/", dependencies=[Depends(require_faculty)])
async def create_schedule(body: ScheduleCreate):
    supabase = get_supabase_admin()
    data = {
        "exam_id": str(body.exam_id),
        "department_id": str(body.department_id),
        "start_time": body.start_time.isoformat(),
        "end_time": body.end_time.isoformat(),
        "is_published": body.is_published,
    }
    result = supabase.table("exam_schedules").insert(data).execute()
    return result.data[0]


@router.patch("/{schedule_id}", dependencies=[Depends(require_faculty)])
async def update_schedule(schedule_id: UUID, body: ScheduleUpdate):
    """
    Updating is_published to TRUE auto-stamps published_at via DB trigger (set_published_at).
    BACKEND responsibility.
    """
    supabase = get_supabase_admin()
    data = body.model_dump(exclude_none=True)
    if "start_time" in data:
        data["start_time"] = data["start_time"].isoformat()
    if "end_time" in data:
        data["end_time"] = data["end_time"].isoformat()
    if "department_id" in data:
        data["department_id"] = str(data["department_id"])
    result = supabase.table("exam_schedules").update(data).eq("id", str(schedule_id)).execute()
    return result.data[0]
