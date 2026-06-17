"""
Exam Registrations.

WHO DOES WHAT:
  - Student clicks "Register" button  → FRONTEND (UI) + BACKEND (POST)
  - Admin/Faculty see registrations   → BACKEND
  - Eligibility check before attempt  → BACKEND (key security gate)
  - Mark student as APPEARED/ABSENT   → BACKEND (Admin/Faculty)
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Literal
from uuid import UUID
from datetime import datetime, timezone

from app.core.security import require_student, require_faculty, get_current_user_with_roles
from app.db.supabase import get_supabase_admin

router = APIRouter()

RegistrationStatus = Literal["REGISTERED", "APPEARED", "ABSENT", "CANCELLED"]


class RegistrationCreate(BaseModel):
    exam_schedule_id: UUID


class StatusUpdate(BaseModel):
    status: RegistrationStatus


@router.get("/")
async def list_registrations(
    exam_schedule_id: Optional[UUID] = None,
    student_id: Optional[UUID] = None,
    current_user: dict = Depends(get_current_user_with_roles),
):
    supabase = get_supabase_admin()
    query = supabase.table("exam_registrations").select(
        "*, users(full_name, email), exam_schedules(start_time, end_time, exams(title))"
    )
    # Students can only see their own registrations
    if "Student" in current_user["roles"] and "Admin" not in current_user["roles"]:
        query = query.eq("student_id", current_user["user_id"])
    else:
        if student_id:
            query = query.eq("student_id", str(student_id))

    if exam_schedule_id:
        query = query.eq("exam_schedule_id", str(exam_schedule_id))

    return query.execute().data


@router.post("/")
async def register_for_exam(
    body: RegistrationCreate,
    current_user: dict = Depends(require_student),
):
    """
    Student self-registers for a scheduled exam.
    BACKEND validates: schedule is published and not already registered.
    """
    supabase = get_supabase_admin()
    schedule_id = str(body.exam_schedule_id)
    student_id = current_user["user_id"]

    # Check schedule exists and is published
    sched = (
        supabase.table("exam_schedules")
        .select("*, exams(status, title)")
        .eq("id", schedule_id)
        .single()
        .execute()
    )
    if not sched.data:
        raise HTTPException(status_code=404, detail="Schedule not found")
    if not sched.data["is_published"]:
        raise HTTPException(status_code=400, detail="Exam schedule is not published yet")
    if sched.data.get("exams", {}).get("status") != "PUBLISHED":
        raise HTTPException(status_code=400, detail="Exam is not active")

    deadline_value = sched.data.get("registration_deadline") or sched.data["start_time"]
    registration_deadline = datetime.fromisoformat(deadline_value)
    if registration_deadline < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Exam registration window has closed")

    # Check not already registered
    existing = (
        supabase.table("exam_registrations")
        .select("id")
        .eq("exam_schedule_id", schedule_id)
        .eq("student_id", student_id)
        .execute()
    )
    if existing.data:
        existing_registration = (
            supabase.table("exam_registrations")
            .select("*")
            .eq("id", existing.data[0]["id"])
            .single()
            .execute()
            .data
        )
        if existing_registration["status"] != "CANCELLED":
            raise HTTPException(status_code=409, detail="Already registered for this exam")
        result = (
            supabase.table("exam_registrations")
            .update({"status": "REGISTERED"})
            .eq("id", existing_registration["id"])
            .execute()
        )
    else:
        result = supabase.table("exam_registrations").insert({
            "exam_schedule_id": schedule_id,
            "student_id": student_id,
            "status": "REGISTERED",
        }).execute()

    registration = result.data[0]
    supabase.table("notifications").insert({
        "user_id": student_id,
        "type": "REGISTRATION_OPEN",
        "title": "Exam registration confirmed",
        "body": f"You are registered for {sched.data.get('exams', {}).get('title', 'the exam')}.",
        "metadata": {"exam_schedule_id": schedule_id},
    }).execute()
    return registration


@router.delete("/{registration_id}")
async def cancel_registration(
    registration_id: UUID,
    current_user: dict = Depends(require_student),
):
    """Student cancels a registration before its registration deadline."""
    supabase = get_supabase_admin()
    registration = (
        supabase.table("exam_registrations")
        .select("*, exam_schedules(*, exams(title))")
        .eq("id", str(registration_id))
        .eq("student_id", current_user["user_id"])
        .single()
        .execute()
    )
    if not registration.data:
        raise HTTPException(status_code=404, detail="Registration not found")
    if registration.data["status"] != "REGISTERED":
        raise HTTPException(status_code=400, detail="Only active registrations can be cancelled")
    schedule = registration.data["exam_schedules"]
    deadline = datetime.fromisoformat(
        schedule.get("registration_deadline") or schedule["start_time"]
    )
    if datetime.now(timezone.utc) > deadline:
        raise HTTPException(status_code=400, detail="Registration cancellation deadline has passed")
    attempt = (
        supabase.table("exam_attempts")
        .select("id")
        .eq("exam_schedule_id", registration.data["exam_schedule_id"])
        .eq("student_id", current_user["user_id"])
        .execute()
    )
    if attempt.data:
        raise HTTPException(status_code=409, detail="Cannot cancel after an attempt has started")
    supabase.table("exam_registrations").update({
        "status": "CANCELLED",
    }).eq("id", str(registration_id)).execute()
    supabase.table("notifications").insert({
        "user_id": current_user["user_id"],
        "type": "EXAM_CANCELLED",
        "title": "Exam registration cancelled",
        "body": f"Your registration for {schedule.get('exams', {}).get('title', 'the exam')} was cancelled.",
        "metadata": {"exam_schedule_id": registration.data["exam_schedule_id"]},
    }).execute()
    return {"cancelled": True}


@router.patch("/{registration_id}/status", dependencies=[Depends(require_faculty)])
async def update_registration_status(registration_id: UUID, body: StatusUpdate):
    """Faculty/Admin update student status (APPEARED, ABSENT, CANCELLED). BACKEND only."""
    supabase = get_supabase_admin()
    result = (
        supabase.table("exam_registrations")
        .update({"status": body.status})
        .eq("id", str(registration_id))
        .execute()
    )
    return result.data[0]


@router.get("/eligibility/{schedule_id}")
async def check_eligibility(
    schedule_id: UUID,
    current_user: dict = Depends(require_student),
):
    """
    Key security gate — check if student is eligible to attempt the exam.
    Frontend calls this before showing the 'Start Exam' button.
    Returns: { eligible: bool, reason: str }
    BACKEND responsibility.
    """
    supabase = get_supabase_admin()
    student_id = current_user["user_id"]

    result = (
        supabase.table("exam_registrations")
        .select("status, exam_schedules(is_published, start_time, end_time)")
        .eq("exam_schedule_id", str(schedule_id))
        .eq("student_id", student_id)
        .execute()
    )

    if not result.data:
        return {"eligible": False, "reason": "Not registered for this exam"}

    reg = result.data[0]
    if reg["status"] != "REGISTERED":
        return {"eligible": False, "reason": f"Registration status is {reg['status']}"}

    sched = reg["exam_schedules"]
    if not sched["is_published"]:
        return {"eligible": False, "reason": "Exam not yet published"}

    now = datetime.now(timezone.utc)
    start = datetime.fromisoformat(sched["start_time"])
    end = datetime.fromisoformat(sched["end_time"])

    if now < start:
        return {"eligible": False, "reason": "Exam has not started yet"}
    if now > end:
        return {"eligible": False, "reason": "Exam window has closed"}

    # Check no existing attempt
    attempt = (
        supabase.table("exam_attempts")
        .select("id, status")
        .eq("exam_schedule_id", str(schedule_id))
        .eq("student_id", student_id)
        .execute()
    )
    if attempt.data:
        a = attempt.data[0]
        if a["status"] == "IN_PROGRESS":
            return {"eligible": True, "reason": "Resume existing attempt", "attempt_id": a["id"]}
        return {"eligible": False, "reason": f"Attempt already exists with status: {a['status']}"}

    return {"eligible": True, "reason": "OK"}