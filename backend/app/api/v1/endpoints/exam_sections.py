"""
Exam Sections — grouped question sets within an exam.
BACKEND responsibility for all CRUD.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from app.core.security import require_faculty
from app.db.supabase import get_supabase_admin

router = APIRouter()


class SectionCreate(BaseModel):
    exam_id: UUID
    title: str
    marks_per_section: Optional[int] = None
    question_count: Optional[int] = None
    order_index: int


@router.post("/")
async def create_section(body: SectionCreate, _: dict = Depends(require_faculty)):
    supabase = get_supabase_admin()
    data = body.model_dump()
    data["exam_id"] = str(data["exam_id"])
    result = supabase.table("exam_sections").insert(data).execute()
    return result.data[0]


@router.patch("/{section_id}")
async def update_section(section_id: UUID, body: dict, _: dict = Depends(require_faculty)):
    supabase = get_supabase_admin()
    result = supabase.table("exam_sections").update(body).eq("id", str(section_id)).execute()
    return result.data[0]


@router.delete("/{section_id}")
async def delete_section(section_id: UUID, _: dict = Depends(require_faculty)):
    """
    Deleting a section sets exam_questions.section_id = NULL (ON DELETE SET NULL).
    Questions remain in the exam — only ungrouped.
    """
    supabase = get_supabase_admin()
    supabase.table("exam_sections").delete().eq("id", str(section_id)).execute()
    return {"message": "Section deleted. Questions remain in exam (ungrouped)."}
