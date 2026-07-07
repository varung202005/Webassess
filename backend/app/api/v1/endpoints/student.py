"""Student portal read models and student-only workflows."""
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.security import require_student, require_exam_taker
from app.db.supabase import get_supabase_admin

router = APIRouter()


class StudentProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    phone: Optional[str] = Field(default=None, max_length=30)
    profile_photo: Optional[str] = None
    roll_number: Optional[str] = Field(default=None, max_length=50)
    department_id: Optional[UUID] = None
    semester: Optional[int] = Field(default=None, ge=1, le=12)


def _single_or_none(query):
    try:
        return query.maybe_single().execute().data
    except Exception:
        return None


def _student_profile(supabase, user_id: str) -> dict:
    user = (
        supabase.table("users")
        .select("id,full_name,email,phone,profile_photo")
        .eq("id", user_id)
        .single()
        .execute()
        .data
    )
    academic = _single_or_none(
        supabase.table("students")
        .select("roll_number,department_id,semester,departments(name,code)")
        .eq("user_id", user_id)
    )
    return {**user, **(academic or {})}


def _portal_data(supabase, user_id: str) -> dict:
    profile = _student_profile(supabase, user_id)
    schedules = (
        supabase.table("exam_schedules")
        .select("*")
        .eq("is_published", True)
        .order("start_time")
        .execute()
        .data
    )
    if profile.get("department_id"):
        schedules = [
            row for row in schedules
            if row.get("department_id") == profile["department_id"]
        ]

    exam_ids = list({row["exam_id"] for row in schedules})
    exams = []
    if exam_ids:
        exams = supabase.table("exams").select("*").in_("id", exam_ids).execute().data
    exam_map = {
        row["id"]: row for row in exams
        if str(row.get("exam_type", "")).upper() != "ENTRANCE"
    }
    schedules = [
        schedule for schedule in schedules
        if schedule.get("exam_id") in exam_map
    ]
    exams = list(exam_map.values())

    course_ids = list({row["course_id"] for row in exams if row.get("course_id")})
    courses = []
    if course_ids:
        courses = supabase.table("courses").select("id,name,code,department_id").in_("id", course_ids).execute().data
    course_map = {row["id"]: row for row in courses}

    faculty_ids = list({row["created_by"] for row in exams if row.get("created_by")})
    faculty = []
    if faculty_ids:
        faculty = supabase.table("users").select("id,full_name").in_("id", faculty_ids).execute().data
    faculty_map = {row["id"]: row["full_name"] for row in faculty}

    registrations = (
        supabase.table("exam_registrations")
        .select("*")
        .eq("student_id", user_id)
        .execute()
        .data
    )
    registration_map = {row["exam_schedule_id"]: row for row in registrations}

    attempts = (
        supabase.table("exam_attempts")
        .select("*")
        .eq("student_id", user_id)
        .order("started_at", desc=True)
        .execute()
        .data
    )
    attempt_map = {row["exam_schedule_id"]: row for row in attempts}

    now = datetime.now(timezone.utc)
    enriched_schedules = []
    for schedule in schedules:
        exam = exam_map.get(schedule["exam_id"], {})
        course = course_map.get(exam.get("course_id"), {})
        registration = registration_map.get(schedule["id"])
        attempt = attempt_map.get(schedule["id"])
        start = datetime.fromisoformat(schedule["start_time"])
        end = datetime.fromisoformat(schedule["end_time"])
        registration_deadline = schedule.get("registration_deadline")
        deadline = datetime.fromisoformat(registration_deadline) if registration_deadline else start
        active_exam = exam.get("status") == "PUBLISHED"
        has_active_registration = registration and registration["status"] != "CANCELLED"
        can_register = (
            active_exam
            and now <= deadline
            and not has_active_registration
        )
        enriched_schedules.append({
            **schedule,
            "registration_deadline": registration_deadline,
            "exam": exam,
            "course": course,
            "faculty_name": faculty_map.get(exam.get("created_by")),
            "registration": registration,
            "attempt": attempt,
            "can_register": can_register,
            "eligibility_status": (
                "Inactive exam" if not active_exam
                else "Already attempted" if attempt and attempt["status"] != "IN_PROGRESS"
                else "Registered" if registration and registration["status"] == "REGISTERED"
                else "Registration closed" if now > deadline
                else "Eligible"
            ),
            "window_status": (
                "UPCOMING" if now < start
                else "OPEN" if now <= end
                else "CLOSED"
            ),
        })

    results = (
        supabase.table("results")
        .select("*")
        .eq("student_id", user_id)
        .eq("is_published", True)
        .order("published_at", desc=True)
        .execute()
        .data
    )
    result_exam_ids = list({row["exam_id"] for row in results})
    missing_exam_ids = [exam_id for exam_id in result_exam_ids if exam_id not in exam_map]
    if missing_exam_ids:
        extra_exams = supabase.table("exams").select("*").in_("id", missing_exam_ids).execute().data
        exam_map.update({row["id"]: row for row in extra_exams})
        missing_course_ids = [
            row["course_id"] for row in extra_exams
            if row.get("course_id") and row["course_id"] not in course_map
        ]
        if missing_course_ids:
            extra_courses = supabase.table("courses").select("id,name,code,department_id").in_("id", missing_course_ids).execute().data
            course_map.update({row["id"]: row for row in extra_courses})

    enriched_results = []
    for result in results:
        exam = exam_map.get(result["exam_id"], {})
        if str(exam.get("exam_type", "")).upper() == "ENTRANCE":
            continue
        peers = (
            supabase.table("results")
            .select("student_id,percentage")
            .eq("exam_id", result["exam_id"])
            .eq("is_published", True)
            .order("percentage", desc=True)
            .execute()
            .data
        )
        rank = next(
            (index + 1 for index, peer in enumerate(peers) if peer["student_id"] == user_id),
            None,
        )
        below = sum(1 for peer in peers if peer["percentage"] < result["percentage"])
        percentile = round((below / len(peers)) * 100, 2) if peers else None
        enriched_results.append({
            **result,
            "rank": rank,
            "percentile": percentile,
            "exam": exam,
            "course": course_map.get(exam.get("course_id"), {}),
        })

    schedule_map = {row["id"]: row for row in enriched_schedules}
    history = []
    for attempt in attempts:
        schedule = schedule_map.get(attempt["exam_schedule_id"])
        if not schedule:
            raw_schedule = _single_or_none(
                supabase.table("exam_schedules").select("*").eq("id", attempt["exam_schedule_id"])
            )
            if raw_schedule:
                exam = _single_or_none(
                    supabase.table("exams").select("*").eq("id", raw_schedule["exam_id"])
                ) or {}
                if str(exam.get("exam_type", "")).upper() == "ENTRANCE":
                    continue
                course = _single_or_none(
                    supabase.table("courses").select("id,name,code").eq("id", exam.get("course_id"))
                ) if exam.get("course_id") else {}
                schedule = {**raw_schedule, "exam": exam, "course": course or {}}
        elif str((schedule.get("exam") or {}).get("exam_type", "")).upper() == "ENTRANCE":
            continue
        result = next((row for row in enriched_results if row["attempt_id"] == attempt["id"]), None)
        history.append({**attempt, "schedule": schedule, "result": result})

    notifications = (
        supabase.table("notifications")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
        .data
    )
    reevaluations = (
        supabase.table("re_evaluation_requests")
        .select("*")
        .eq("student_id", user_id)
        .order("requested_at", desc=True)
        .execute()
        .data
    )
    departments = supabase.table("departments").select("id,name,code").order("name").execute().data

    return {
        "profile": profile,
        "schedules": enriched_schedules,
        "registrations": registrations,
        "attempts": attempts,
        "history": history,
        "results": enriched_results,
        "notifications": notifications,
        "reevaluations": reevaluations,
        "departments": departments,
    }


@router.get("/portal")
async def get_student_portal(current_user: dict = Depends(require_student)):
    return _portal_data(get_supabase_admin(), current_user["user_id"])


@router.patch("/profile")
async def update_student_profile(
    body: StudentProfileUpdate,
    current_user: dict = Depends(require_student),
):
    supabase = get_supabase_admin()
    user_id = current_user["user_id"]
    data = body.model_dump(exclude_unset=True)
    user_update = {
        key: data[key]
        for key in ("full_name", "phone", "profile_photo")
        if key in data
    }
    if user_update:
        supabase.table("users").update(user_update).eq("id", user_id).execute()

    academic_update = {
        key: str(data[key]) if key == "department_id" and data[key] else data[key]
        for key in ("roll_number", "department_id", "semester")
        if key in data
    }
    if academic_update:
        try:
            supabase.table("students").upsert(
                {"user_id": user_id, **academic_update},
                on_conflict="user_id",
            ).execute()
        except Exception as exc:
            raise HTTPException(
                status_code=503,
                detail="Student academic profile storage is not installed. Apply backend/migrations/20260613_student_portal.sql.",
            ) from exc
    return _student_profile(supabase, user_id)


@router.get("/exam-session/{schedule_id}")
async def get_exam_session(
    schedule_id: UUID,
    current_user: dict = Depends(require_exam_taker),
):
    supabase = get_supabase_admin()
    user_id = current_user["user_id"]
    attempt = _single_or_none(
        supabase.table("exam_attempts")
        .select("*")
        .eq("exam_schedule_id", str(schedule_id))
        .eq("student_id", user_id)
    )
    if not attempt or attempt["status"] != "IN_PROGRESS":
        raise HTTPException(status_code=403, detail="No active attempt for this exam")

    schedule = (
        supabase.table("exam_schedules")
        .select("*")
        .eq("id", str(schedule_id))
        .single()
        .execute()
        .data
    )
    exam = (
        supabase.table("exams")
        .select("*,courses(name,code),exam_rules(*)")
        .eq("id", schedule["exam_id"])
        .single()
        .execute()
        .data
    )
    rows = (
        supabase.table("exam_questions")
        .select(
            "order_index,marks_override,"
            "questions(id,question_text,question_type,marks,negative_marks,question_options(id,option_text,order_index)),"
            "exam_sections(id,title)"
        )
        .eq("exam_id", exam["id"])
        .order("order_index")
        .execute()
        .data
    )
    started = datetime.fromisoformat(attempt["started_at"])
    duration_deadline = started + timedelta(minutes=exam["duration_minutes"])
    close_deadline = datetime.fromisoformat(schedule["end_time"])
    effective_deadline = min(duration_deadline, close_deadline)
    return {
        "attempt": attempt,
        "schedule": schedule,
        "exam": exam,
        "questions": rows,
        "effective_deadline": effective_deadline.isoformat(),
        "timer_policy": "EARLIEST_OF_DURATION_OR_SCHEDULE_CLOSE",
    }
