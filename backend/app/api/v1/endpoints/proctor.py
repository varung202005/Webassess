"""
Proctor portal — aggregate dashboard endpoint.
GET /api/v1/proctor/dashboard

Fix: fetch user full_name separately instead of relying on
     exam_attempts → users FK join (which silently fails if FK
     isn't defined in Supabase schema cache).
"""
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from app.core.security import require_proctor
from app.db.supabase import get_supabase_admin

router = APIRouter()


@router.get("/dashboard")
async def get_proctor_dashboard(current_user: dict = Depends(require_proctor)):
    supabase = get_supabase_admin()
    user_id  = current_user["user_id"]
    now      = datetime.now(timezone.utc)
    thirty_min_ago = (now - timedelta(minutes=30)).isoformat()

    # ── Profile ──────────────────────────────────────────────────────────────
    user = (
        supabase.table("users")
        .select("id,full_name,email,profile_photo")
        .eq("id", user_id)
        .single()
        .execute()
        .data
    )

    # ── ALL active exam schedules ─────────────────────────────────────────────
    all_active_schedules = (
        supabase.table("exam_schedules")
        .select("id,start_time,end_time,exams(title,courses(code))")
        .eq("is_published", True)
        .lte("start_time", now.isoformat())
        .gte("end_time",   now.isoformat())
        .execute()
        .data
    ) or []

    active_sessions   = []
    all_live_attempts = []

    for sched in all_active_schedules:
        # Step 1: get attempts (no join — just raw columns)
        live_result = (
            supabase.table("exam_attempts")
            .select("id,student_id,exam_schedule_id,status")
            .eq("exam_schedule_id", sched["id"])
            .eq("status", "IN_PROGRESS")
            .execute()
        )
        live_attempts_raw = live_result.data or []

        # Step 2: fetch user names for those student_ids separately
        student_ids = list({a["student_id"] for a in live_attempts_raw if a.get("student_id")})
        name_map: dict[str, str] = {}
        if student_ids:
            user_rows = (
                supabase.table("users")
                .select("id,full_name")
                .in_("id", student_ids)
                .execute()
                .data
            ) or []
            name_map = {r["id"]: r["full_name"] for r in user_rows}

        # Step 3: assemble attempts in the shape the frontend expects
        live_attempts = [
            {
                "id":               a["id"],
                "student_id":       a["student_id"],
                "exam_schedule_id": a["exam_schedule_id"],
                "users": {
                    "full_name": name_map.get(a["student_id"], "Student")
                },
            }
            for a in live_attempts_raw
        ]

        all_live_attempts.extend(live_attempts)

        exam   = sched.get("exams")  or {}
        course = exam.get("courses") or {}
        active_sessions.append({
            "schedule_id":     sched["id"],
            "exam_title":      exam.get("title", "Exam"),
            "course_code":     course.get("code", "—"),
            "active_students": len(live_attempts),
            "ends_at":         sched["end_time"],
            "active_attempts": live_attempts,
        })

    total_live = len(all_live_attempts)

    # ── Proctoring summary stats ──────────────────────────────────────────────
    all_summaries = (
        supabase.table("proctoring_summary")
        .select(
            "integrity_score,flagged_for_review,"
            "face_absence_count,multi_person_count,"
            "phone_detection_count,tab_switch_count"
        )
        .execute()
        .data
    ) or []

    total_flagged       = sum(1 for s in all_summaries if s.get("flagged_for_review"))
    face_absence_events = sum(s.get("face_absence_count",    0) for s in all_summaries)
    multi_person_events = sum(s.get("multi_person_count",    0) for s in all_summaries)
    phone_events        = sum(s.get("phone_detection_count", 0) for s in all_summaries)
    total_tab_switches  = sum(s.get("tab_switch_count",      0) for s in all_summaries)
    avg_integrity       = (
        sum(s.get("integrity_score", 1.0) for s in all_summaries) / len(all_summaries)
        if all_summaries else 1.0
    )
    tab_switches_last_30m = total_tab_switches

    # ── Audio stats ───────────────────────────────────────────────────────────
    total_noise_events = (
        supabase.table("audio_monitoring_logs")
        .select("id", count="exact")
        .eq("noise_detected", True)
        .execute()
    ).count or 0

    try:
        noise_events_last_30m = (
            supabase.table("audio_monitoring_logs")
            .select("id", count="exact")
            .eq("noise_detected", True)
            .gte("created_at", thirty_min_ago)
            .execute()
        ).count or 0
    except Exception:
        noise_events_last_30m = total_noise_events

    # ── Flagged attempts (PENDING only) ───────────────────────────────────────
    flagged = (
        supabase.table("proctoring_summary")
        .select("*, exam_attempts(student_id, exam_schedule_id)")
        .eq("flagged_for_review", True)
        .eq("proctor_verdict", "PENDING")
        .order("integrity_score", desc=False)
        .execute()
        .data
    ) or []

    # Attach student names to flagged rows (same pattern — separate query)
    if flagged:
        flagged_student_ids = list({
            r["exam_attempts"]["student_id"]
            for r in flagged
            if r.get("exam_attempts") and r["exam_attempts"].get("student_id")
        })
        if flagged_student_ids:
            flagged_users = (
                supabase.table("users")
                .select("id,full_name")
                .in_("id", flagged_student_ids)
                .execute()
                .data
            ) or []
            flagged_name_map = {r["id"]: r["full_name"] for r in flagged_users}
            for r in flagged:
                if r.get("exam_attempts"):
                    sid = r["exam_attempts"].get("student_id")
                    r["exam_attempts"]["users"] = {
                        "full_name": flagged_name_map.get(sid, "Student")
                    }

        # Attach noise counts
        attempt_ids = [r["attempt_id"] for r in flagged]
        audio_rows  = (
            supabase.table("audio_monitoring_logs")
            .select("attempt_id")
            .eq("noise_detected", True)
            .in_("attempt_id", attempt_ids)
            .execute()
            .data
        ) or []
        noise_counts: dict = {}
        for row in audio_rows:
            aid = row["attempt_id"]
            noise_counts[aid] = noise_counts.get(aid, 0) + 1
        for r in flagged:
            r["noise_event_count"] = noise_counts.get(r["attempt_id"], 0)

    return {
        "profile":        user,
        "activeSessions": active_sessions,
        "activeSession":  active_sessions[0] if active_sessions else None,
        "stats": {
            "total_flagged":         total_flagged,
            "total_live":            total_live,
            "tab_switches_last_30m": tab_switches_last_30m,
            "avg_integrity":         round(avg_integrity, 4),
            "face_absence_events":   face_absence_events,
            "multi_person_events":   multi_person_events,
            "phone_events":          phone_events,
            "total_tab_switches":    total_tab_switches,
            "noise_events_last_30m": noise_events_last_30m,
            "total_noise_events":    total_noise_events,
        },
        "flagged": flagged,
    }