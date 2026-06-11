"""
Courses endpoints.
BACKEND responsibility for all CRUD. Frontend only renders the data.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from uuid import UUID

from app.core.security import require_admin, require_faculty, get_current_user_with_roles
from app.db.supabase import get_supabase_admin

router = APIRouter()


class CourseCreate(BaseModel):
    name: str
    code: str
    department_id: UUID
    credit_hours: int
    is_active: bool = True


class CourseUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    department_id: Optional[UUID] = None
    credit_hours: Optional[int] = None
    is_active: Optional[bool] = None


@router.get("/")
async def list_courses(
    department_id: Optional[UUID] = None,
    is_active: Optional[bool] = None,
    _: dict = Depends(get_current_user_with_roles),
):
    supabase = get_supabase_admin()
    query = supabase.table("courses").select("*, departments(name, code)")
    if department_id:
        query = query.eq("department_id", str(department_id))
    if is_active is not None:
        query = query.eq("is_active", is_active)
    return query.execute().data


@router.get("/{course_id}")
async def get_course(course_id: UUID, _: dict = Depends(get_current_user_with_roles)):
    supabase = get_supabase_admin()
    result = supabase.table("courses").select("*, departments(name)").eq("id", str(course_id)).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Course not found")
    return result.data


@router.post("/", dependencies=[Depends(require_admin)])
async def create_course(body: CourseCreate):
    supabase = get_supabase_admin()
    data = body.model_dump()
    data["department_id"] = str(data["department_id"])
    result = supabase.table("courses").insert(data).execute()
    return result.data[0]


@router.patch("/{course_id}", dependencies=[Depends(require_admin)])
async def update_course(course_id: UUID, body: CourseUpdate):
    supabase = get_supabase_admin()
    data = body.model_dump(exclude_none=True)
    if "department_id" in data:
        data["department_id"] = str(data["department_id"])
    result = supabase.table("courses").update(data).eq("id", str(course_id)).execute()
    return result.data[0]
