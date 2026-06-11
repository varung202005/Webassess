"""
Departments endpoints.
BACKEND responsibility for all CRUD. Frontend only renders the data.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from uuid import UUID

from app.core.security import require_admin, get_current_user_with_roles
from app.db.supabase import get_supabase_admin

router = APIRouter()


class DepartmentCreate(BaseModel):
    name: str
    code: str
    head_user_id: Optional[UUID] = None


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    head_user_id: Optional[UUID] = None


@router.get("/")
async def list_departments(_: dict = Depends(get_current_user_with_roles)):
    supabase = get_supabase_admin()
    result = supabase.table("departments").select("*, users(full_name)").execute()
    return result.data


@router.post("/", dependencies=[Depends(require_admin)])
async def create_department(body: DepartmentCreate):
    supabase = get_supabase_admin()
    data = body.model_dump(exclude_none=True)
    if "head_user_id" in data:
        data["head_user_id"] = str(data["head_user_id"])
    result = supabase.table("departments").insert(data).execute()
    return result.data[0]


@router.patch("/{dept_id}", dependencies=[Depends(require_admin)])
async def update_department(dept_id: UUID, body: DepartmentUpdate):
    supabase = get_supabase_admin()
    data = body.model_dump(exclude_none=True)
    if "head_user_id" in data:
        data["head_user_id"] = str(data["head_user_id"])
    result = supabase.table("departments").update(data).eq("id", str(dept_id)).execute()
    return result.data[0]


@router.delete("/{dept_id}", dependencies=[Depends(require_admin)])
async def delete_department(dept_id: UUID):
    supabase = get_supabase_admin()
    supabase.table("departments").delete().eq("id", str(dept_id)).execute()
    return {"message": "Department deleted"}
