"""Admin control center endpoints."""
import logging
import secrets
import string
from collections import Counter
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.config import settings
from app.core.security import require_admin
from app.db.supabase import get_supabase_admin
from app.services.email_service import send_account_credentials, send_candidate_invitation

logger = logging.getLogger(__name__)
router = APIRouter()


VALID_ROLES = {"Admin", "Faculty", "Proctor", "Student", "Candidate"}
MANAGED_ACCOUNT_ROLES = {"Admin", "Faculty", "Student"}


class RoleChangeRequest(BaseModel):
    role: str


class CandidateEntry(BaseModel):
    full_name: str
    email: str
    phone: Optional[str] = None
    temp_password: Optional[str] = None


class ManagedAccountEntry(BaseModel):
    full_name: str
    email: str
    phone: Optional[str] = None
    password: Optional[str] = None


class CreateManagedAccountRequest(ManagedAccountEntry):
    role: str


class BulkCreateManagedAccountsRequest(BaseModel):
    role: str
    users: list[ManagedAccountEntry]


class AdminAssignCandidatesRequest(BaseModel):
    exam_schedule_id: UUID
    candidates: list[CandidateEntry]


def _generate_temp_password(length: int = 10) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _absolute_login_url(token: str) -> str:
    return f"{settings.FRONTEND_URL.rstrip('/')}/login?token={token}"


def _login_url() -> str:
    return f"{settings.FRONTEND_URL.rstrip('/')}/login"


def _count(supabase, table: str, **eq_filters) -> int:
    query = supabase.table(table).select("id", count="exact")
    for key, value in eq_filters.items():
        query = query.eq(key, value)
    return query.execute().count or 0


def _role_lookup(supabase) -> dict[str, str]:
    roles = supabase.table("roles").select("id,name").execute().data or []
    return {row["name"]: row["id"] for row in roles}


def _user_role_map(supabase, user_ids: list[str]) -> dict[str, list[str]]:
    if not user_ids:
        return {}
    rows = (
        supabase.table("user_roles")
        .select("user_id,roles(name)")
        .in_("user_id", user_ids)
        .execute()
        .data
    ) or []
    role_map: dict[str, list[str]] = {}
    for row in rows:
        role_name = (row.get("roles") or {}).get("name")
        if role_name:
            role_map.setdefault(row["user_id"], []).append(role_name)
    return role_map


def _normalize_managed_role(role: str) -> str:
    role_name = role.strip().title()
    if role_name not in MANAGED_ACCOUNT_ROLES:
        raise HTTPException(
            status_code=400,
            detail="Admin-managed account creation only supports Admin, Faculty, and Student. Candidates must be assigned to an exam.",
        )
    return role_name


def _create_or_update_managed_account(supabase, role_name: str, entry: ManagedAccountEntry) -> dict:
    email = entry.email.strip().lower()
    full_name = entry.full_name.strip()
    if not full_name or "@" not in email:
        return {"email": email, "status": "error", "error": "Valid name and email are required"}

    roles = _role_lookup(supabase)
    role_id = roles.get(role_name)
    if not role_id:
        return {"email": email, "status": "error", "error": f"{role_name} role not found"}

    password = entry.password or _generate_temp_password()
    existing = supabase.table("users").select("id").eq("email", email).execute().data or []

    try:
        if existing:
            user_id = existing[0]["id"]
            supabase.auth.admin.update_user_by_id(user_id, {"password": password})
            supabase.table("users").update({
                "full_name": full_name,
                "phone": entry.phone,
                "is_active": True,
                "is_verified": True,
            }).eq("id", user_id).execute()
        else:
            auth_resp = supabase.auth.admin.create_user({
                "email": email,
                "password": password,
                "email_confirm": True,
                "user_metadata": {"full_name": full_name, "role": role_name.lower()},
            })
            user_id = auth_resp.user.id
            supabase.table("users").upsert({
                "id": user_id,
                "full_name": full_name,
                "email": email,
                "phone": entry.phone,
                "password_hash": "managed_by_supabase_auth",
                "is_active": True,
                "is_verified": True,
            }, on_conflict="id").execute()

        supabase.table("user_roles").delete().eq("user_id", user_id).execute()
        supabase.table("user_roles").insert({"user_id": user_id, "role_id": role_id}).execute()

        email_result = send_account_credentials({
            "full_name": full_name,
            "email": email,
            "password": password,
            "role": role_name,
            "login_url": _login_url(),
        })
        return {
            "email": email,
            "user_id": user_id,
            "role": role_name,
            "status": "created",
            "email_status": "sent" if email_result.sent else "skipped" if email_result.skipped else "failed",
            "email_error": email_result.error,
        }
    except Exception as exc:
        logger.warning("Managed account creation failed for %s: %s", email, exc)
        return {"email": email, "status": "error", "error": str(exc)}


@router.get("/dashboard")
async def admin_dashboard(_: dict = Depends(require_admin)):
    supabase = get_supabase_admin()
    now = datetime.now(timezone.utc).isoformat()

    users = (
        supabase.table("users")
        .select("id,full_name,email,phone,is_active,is_verified,created_at")
        .order("created_at", desc=True)
        .limit(50)
        .execute()
        .data
    ) or []
    role_map = _user_role_map(supabase, [row["id"] for row in users])
    for user in users:
        user["roles"] = role_map.get(user["id"], [])

    roles = supabase.table("roles").select("id,name").order("name").execute().data or []
    departments = supabase.table("departments").select("id,name,code").order("name").execute().data or []
    courses = supabase.table("courses").select("id,name,code").order("name").execute().data or []

    exams = (
        supabase.table("exams")
        .select("id,title,status,exam_type,created_at,courses(code,name)")
        .order("created_at", desc=True)
        .limit(25)
        .execute()
        .data
    ) or []
    exam_counts = Counter(row.get("status") for row in exams)

    schedules = (
        supabase.table("exam_schedules")
        .select("id,start_time,end_time,is_published,exams(id,title,exam_type,status,courses(code,name))")
        .order("start_time", desc=True)
        .limit(100)
        .execute()
        .data
    ) or []
    active_schedules = [
        row for row in schedules
        if row.get("is_published") and str(row.get("start_time") or "") <= now <= str(row.get("end_time") or "")
    ]
    entrance_schedules = [
        row for row in schedules
        if str((row.get("exams") or {}).get("exam_type", "")).upper() == "ENTRANCE"
    ]

    audit_logs = (
        supabase.table("audit_logs")
        .select("*,users(full_name,email)")
        .order("created_at", desc=True)
        .limit(10)
        .execute()
        .data
    ) or []

    return {
        "stats": {
            "total_users": _count(supabase, "users"),
            "active_users": _count(supabase, "users", is_active=True),
            "total_exams": _count(supabase, "exams"),
            "active_exams": len(active_schedules),
            "total_attempts": _count(supabase, "exam_attempts"),
            "flagged_attempts": _count(supabase, "proctoring_summary", flagged_for_review=True),
            "pending_reeval": _count(supabase, "re_evaluation_requests", status="PENDING"),
            "departments": len(departments),
            "courses": len(courses),
        },
        "roles": roles,
        "users": users,
        "departments": departments,
        "courses": courses,
        "exams": exams,
        "examCounts": dict(exam_counts),
        "schedules": schedules,
        "entranceSchedules": entrance_schedules,
        "auditLogs": audit_logs,
    }


@router.patch("/users/{user_id}/role")
async def change_user_role(
    user_id: UUID,
    body: RoleChangeRequest,
    current_user: dict = Depends(require_admin),
):
    role_name = body.role.strip().title()
    if role_name not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Role must be one of: {', '.join(sorted(VALID_ROLES))}")
    if str(user_id) == current_user["user_id"] and role_name != "Admin":
        raise HTTPException(status_code=400, detail="You cannot remove your own Admin access")

    supabase = get_supabase_admin()
    roles = _role_lookup(supabase)
    role_id = roles.get(role_name)
    if not role_id:
        raise HTTPException(status_code=404, detail=f"{role_name} role not found")

    existing = supabase.table("users").select("id,email").eq("id", str(user_id)).single().execute().data
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")

    current_roles = _user_role_map(supabase, [str(user_id)]).get(str(user_id), [])
    current_role = current_roles[0] if current_roles else None
    allowed_pair = {current_role, role_name} <= {"Student", "Candidate"}
    if not allowed_pair:
        raise HTTPException(
            status_code=400,
            detail="Only Student and Candidate roles can be switched. Create a new Admin or Faculty account explicitly.",
        )

    supabase.table("user_roles").delete().eq("user_id", str(user_id)).execute()
    supabase.table("user_roles").insert({"user_id": str(user_id), "role_id": role_id}).execute()
    return {"message": "Role updated", "user_id": str(user_id), "role": role_name}


@router.post("/users")
async def create_managed_account(
    body: CreateManagedAccountRequest,
    _: dict = Depends(require_admin),
):
    role_name = _normalize_managed_role(body.role)
    supabase = get_supabase_admin()
    result = _create_or_update_managed_account(supabase, role_name, body)
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/users/bulk")
async def bulk_create_managed_accounts(
    body: BulkCreateManagedAccountsRequest,
    _: dict = Depends(require_admin),
):
    if not body.users:
        raise HTTPException(status_code=400, detail="At least one user is required")
    role_name = _normalize_managed_role(body.role)
    supabase = get_supabase_admin()
    results = [_create_or_update_managed_account(supabase, role_name, entry) for entry in body.users]
    return {
        "created": len([row for row in results if row["status"] == "created"]),
        "failed": len([row for row in results if row["status"] == "error"]),
        "emails_sent": len([row for row in results if row.get("email_status") == "sent"]),
        "emails_failed": len([row for row in results if row.get("email_status") == "failed"]),
        "emails_skipped": len([row for row in results if row.get("email_status") == "skipped"]),
        "results": results,
    }


@router.get("/candidate-schedules")
async def list_candidate_schedules(_: dict = Depends(require_admin)):
    supabase = get_supabase_admin()
    return (
        supabase.table("exam_schedules")
        .select("id,start_time,end_time,is_published,exams(id,title,exam_type,status,duration_minutes,courses(code,name))")
        .order("start_time", desc=True)
        .execute()
        .data
    ) or []


@router.get("/candidates/{exam_schedule_id}")
async def list_candidate_assignments(exam_schedule_id: UUID, _: dict = Depends(require_admin)):
    supabase = get_supabase_admin()
    schedule_id = str(exam_schedule_id)
    assignments = (
        supabase.table("candidate_exam_assignments")
        .select("id,candidate_id,status,created_at,invitation_token,users(full_name,email,phone)")
        .eq("exam_schedule_id", schedule_id)
        .order("created_at")
        .execute()
        .data
    ) or []

    candidate_ids = [row["candidate_id"] for row in assignments]
    attempts_map = {}
    if candidate_ids:
        attempts = (
            supabase.table("exam_attempts")
            .select("id,student_id,status,started_at,submitted_at,total_score")
            .eq("exam_schedule_id", schedule_id)
            .in_("student_id", candidate_ids)
            .execute()
            .data
        ) or []
        attempts_map = {row["student_id"]: row for row in attempts}

    return [
        {
            "assignment_id": row["id"],
            "candidate_id": row["candidate_id"],
            "full_name": (row.get("users") or {}).get("full_name", ""),
            "email": (row.get("users") or {}).get("email", ""),
            "phone": (row.get("users") or {}).get("phone"),
            "invitation_status": row["status"],
            "invitation_token": row["invitation_token"],
            "login_url": f"/login?token={row['invitation_token']}",
            "assigned_at": row["created_at"],
            "attempt_status": (attempts_map.get(row["candidate_id"]) or {}).get("status"),
            "started_at": (attempts_map.get(row["candidate_id"]) or {}).get("started_at"),
            "submitted_at": (attempts_map.get(row["candidate_id"]) or {}).get("submitted_at"),
        }
        for row in assignments
    ]


@router.post("/candidates/assign")
async def assign_candidates(
    body: AdminAssignCandidatesRequest,
    current_user: dict = Depends(require_admin),
):
    if not body.candidates:
        raise HTTPException(status_code=400, detail="At least one candidate is required")

    supabase = get_supabase_admin()
    schedule_id = str(body.exam_schedule_id)
    admin_id = current_user["user_id"]

    sched = (
        supabase.table("exam_schedules")
        .select("id,exams(title,duration_minutes)")
        .eq("id", schedule_id)
        .single()
        .execute()
        .data
    )
    if not sched:
        raise HTTPException(status_code=404, detail="Schedule not found")

    roles = _role_lookup(supabase)
    candidate_role_id = roles.get("Candidate")
    if not candidate_role_id:
        raise HTTPException(status_code=500, detail="Candidate role not found")

    results = []
    for entry in body.candidates:
        email = entry.email.strip().lower()
        full_name = entry.full_name.strip()
        if not full_name or "@" not in email:
            results.append({"email": email, "status": "error", "error": "Valid name and email are required"})
            continue

        temp_password = entry.temp_password or _generate_temp_password()
        existing = supabase.table("users").select("id").eq("email", email).execute().data or []

        if existing:
            user_id = existing[0]["id"]
            try:
                supabase.auth.admin.update_user_by_id(user_id, {"password": temp_password})
                supabase.table("users").update({
                    "full_name": full_name,
                    "phone": entry.phone,
                    "is_active": True,
                    "is_verified": True,
                }).eq("id", user_id).execute()
            except Exception as exc:
                logger.warning("Candidate password update failed for %s: %s", email, exc)
                results.append({"email": email, "status": "error", "error": str(exc)})
                continue
        else:
            try:
                auth_resp = supabase.auth.admin.create_user({
                    "email": email,
                    "password": temp_password,
                    "email_confirm": True,
                    "user_metadata": {"full_name": full_name, "role": "candidate"},
                })
                user_id = auth_resp.user.id
            except Exception as exc:
                logger.warning("Candidate auth creation failed for %s: %s", email, exc)
                results.append({"email": email, "status": "error", "error": str(exc)})
                continue

            supabase.table("users").upsert({
                "id": user_id,
                "full_name": full_name,
                "email": email,
                "phone": entry.phone,
                "password_hash": "managed_by_supabase_auth",
                "is_active": True,
                "is_verified": True,
            }, on_conflict="id").execute()

        supabase.table("user_roles").delete().eq("user_id", user_id).execute()
        supabase.table("user_roles").insert({"user_id": user_id, "role_id": candidate_role_id}).execute()

        existing_assignment = (
            supabase.table("candidate_exam_assignments")
            .select("id,invitation_token")
            .eq("exam_schedule_id", schedule_id)
            .eq("candidate_id", user_id)
            .execute()
            .data
        ) or []
        if existing_assignment:
            assignment_id = existing_assignment[0]["id"]
            token = existing_assignment[0]["invitation_token"]
        else:
            assignment = (
                supabase.table("candidate_exam_assignments")
                .insert({
                    "exam_schedule_id": schedule_id,
                    "candidate_id": user_id,
                    "invited_by": admin_id,
                    "status": "INVITED",
                })
                .execute()
                .data[0]
            )
            assignment_id = assignment["id"]
            token = assignment["invitation_token"]

        payload = {
            "candidate_name": full_name,
            "candidate_email": email,
            "exam_name": sched["exams"]["title"],
            "exam_duration_minutes": sched["exams"]["duration_minutes"],
            "login_url": _absolute_login_url(token),
            "temp_password": temp_password,
            "invitation_token": token,
        }
        email_result = send_candidate_invitation(payload)
        results.append({
            "email": email,
            "user_id": user_id,
            "assignment_id": assignment_id,
            "status": "assigned",
            "email_status": "sent" if email_result.sent else "skipped" if email_result.skipped else "failed",
            "email_error": email_result.error,
            "invitation_payload": payload,
        })

    return {
        "assigned": len([row for row in results if row["status"] == "assigned"]),
        "emails_sent": len([row for row in results if row.get("email_status") == "sent"]),
        "emails_failed": len([row for row in results if row.get("email_status") == "failed"]),
        "emails_skipped": len([row for row in results if row.get("email_status") == "skipped"]),
        "results": results,
    }
