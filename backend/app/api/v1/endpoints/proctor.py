"""
Proctor portal — aggregate dashboard endpoint.
GET /api/v1/proctor/dashboard
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from app.core.security import require_proctor
from app.db.supabase import get_supabase_admin

router = APIRouter()


@router.get("/dashboard")
async def get_proctor_dashboard(current_user: dict = Depends(require_proctor)):
    """Aggregate dashboard data for the proctor portal homepage."""
    supabase = get_supabase_admin()
    user_id  = current_user["user_id"]
    now      = datetime.now(timezone.utc)

    # ── Profile ──────────────────────────────────────────────────────────────
    user = (
        supabase.table("users")
        .select("id,full_name,email,profile_photo")
        .eq("id", user_id)
        .single()
        .execute()
        .data
    )

    # ── Active exam session ───────────────────────────────────────────────────
    active_schedules = (
        supabase.table("exam_schedules")
        .select("id,start_time,end_time,exams(title,courses(code))")
        .eq("is_published", True)
        .lte("start_time", now.isoformat())
        .gte("end_time", now.isoformat())
        .limit(1)
        .execute()
        .data
    )

    active_session = None
    if active_schedules:
        sched = active_schedules[0]
        live_count = (
            supabase.table("exam_attempts")
            .select("id", count="exact")
            .eq("exam_schedule_id", sched["id"])
            .eq("status", "IN_PROGRESS")
            .execute()
        ).count or 0
        exam   = sched.get("exams")  or {}
        course = exam.get("courses") or {}
        active_session = {
            "schedule_id":     sched["id"],
            "exam_title":      exam.get("title", "Exam"),
            "course_code":     course.get("code", "—"),
            "active_students": live_count,
            "ends_at":         sched["end_time"],
        }

    # ── Proctoring summary stats ──────────────────────────────────────────────
    # Single query — pull all columns we need for stats
    all_summaries = (
        supabase.table("proctoring_summary")
        .select(
            "integrity_score,flagged_for_review,"
            "face_absence_count,multi_person_count,"
            "phone_detection_count,tab_switch_count"
        )
        .execute()
        .data
    )

    total_flagged       = sum(1 for s in all_summaries if s.get("flagged_for_review"))
    total_live          = active_session["active_students"] if active_session else 0
    face_absence_events = sum(s.get("face_absence_count",    0) for s in all_summaries)
    multi_person_events = sum(s.get("multi_person_count",    0) for s in all_summaries)
    phone_events        = sum(s.get("phone_detection_count", 0) for s in all_summaries)
    total_tab_switches  = sum(s.get("tab_switch_count",      0) for s in all_summaries)
    avg_integrity       = (
        sum(s.get("integrity_score", 1.0) for s in all_summaries) / len(all_summaries)
        if all_summaries else 1.0
    )

    # browser_activity_logs has no created_at column → use total as the stat
    tab_switches_last_30m = total_tab_switches

    # ── Audio stats ──────────────────────────────────────────────────────────
    # Total noise events (noise_detected = true)
    total_noise_events = (
        supabase.table("audio_monitoring_logs")
        .select("id", count="exact")
        .eq("noise_detected", True)
        .execute()
    ).count or 0

    # noise_events_last_30m: audio_monitoring_logs may or may not have created_at.
    # Try with it; if the column doesn't exist, fall back to total.
    try:
        from datetime import timedelta
        thirty_min_ago = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
        noise_events_last_30m = (
            supabase.table("audio_monitoring_logs")
            .select("id", count="exact")
            .eq("noise_detected", True)
            .gte("created_at", thirty_min_ago)
            .execute()
        ).count or 0
    except Exception:
        noise_events_last_30m = total_noise_events

    # ── Flagged attempts (PENDING verdict only) ───────────────────────────────
    flagged = (
        supabase.table("proctoring_summary")
        .select("*, exam_attempts(student_id, exam_schedule_id, users(full_name))")
        .eq("flagged_for_review", True)
        .eq("proctor_verdict", "PENDING")
        .order("integrity_score", desc=False)
        .execute()
        .data
    )

    # Attach noise_event_count per flagged attempt
    if flagged:
        attempt_ids = [r["attempt_id"] for r in flagged]
        audio_rows  = (
            supabase.table("audio_monitoring_logs")
            .select("attempt_id")
            .eq("noise_detected", True)
            .in_("attempt_id", attempt_ids)
            .execute()
            .data
        )
        noise_counts: dict = {}
        for row in audio_rows:
            aid = row["attempt_id"]
            noise_counts[aid] = noise_counts.get(aid, 0) + 1
        for r in flagged:
            r["noise_event_count"] = noise_counts.get(r["attempt_id"], 0)

    return {
        "profile":       user,
        "activeSession": active_session,
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