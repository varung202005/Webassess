"""
Exam Rules — 1:1 with exams. Controls proctoring, tab rules, auto-save.
BACKEND responsibility.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from app.core.security import require_faculty
from app.db.supabase import get_supabase_admin

router = APIRouter()


class ExamRulesCreate(BaseModel):
    exam_id: UUID
    allow_backtrack: bool = True
    allow_review_flag: bool = True
    max_tab_switches: int = 3
    require_fullscreen: bool = False
    enable_proctoring: bool = False
    camera_required: bool = False
    microphone_required: bool = False
    auto_save_interval_sec: int = 30


class ExamRulesUpdate(BaseModel):
    allow_backtrack: Optional[bool] = None
    allow_review_flag: Optional[bool] = None
    max_tab_switches: Optional[int] = None
    require_fullscreen: Optional[bool] = None
    enable_proctoring: Optional[bool] = None
    camera_required: Optional[bool] = None
    microphone_required: Optional[bool] = None
    auto_save_interval_sec: Optional[int] = None


@router.get("/{exam_id}")
async def get_rules(exam_id: UUID, _: dict = Depends(require_faculty)):
    supabase = get_supabase_admin()
    result = supabase.table("exam_rules").select("*").eq("exam_id", str(exam_id)).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Exam rules not found")
    return result.data


@router.post("/")
async def create_rules(body: ExamRulesCreate, _: dict = Depends(require_faculty)):
    supabase = get_supabase_admin()
    data = body.model_dump()
    data["exam_id"] = str(data["exam_id"])
    result = supabase.table("exam_rules").upsert(data, on_conflict="exam_id").execute()
    return result.data[0]


@router.patch("/{exam_id}")
async def update_rules(exam_id: UUID, body: ExamRulesUpdate, _: dict = Depends(require_faculty)):
    supabase = get_supabase_admin()
    data = body.model_dump(exclude_none=True)
    result = supabase.table("exam_rules").update(data).eq("exam_id", str(exam_id)).execute()
    return result.data[0]
