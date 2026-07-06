"""
Proctor portal — aggregate dashboard endpoint.
GET /api/v1/proctor/dashboard

CHANGES:
  - Tab switch stats now filtered to CURRENT SESSION attempt IDs only.
    Previously read all rows from browser_activity_logs across all exams
    ever, causing stale counts (e.g. 15) to show on every exam tab.
  - All stats (flagged, face, audio) also scoped to current session attempts.
  - fetch user full_name separately instead of relying on FK join.
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

    # ── Profile ───────────────────────────────────────────────────────────────
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

    active_sessions      = []
    all_live_attempts    = []
    all_session_attempts = []   # every attempt (any status) for currently-active exam schedules

    for sched in all_active_schedules:
        all_result = (
            supabase.table("exam_attempts")
            .select("id,student_id,exam_schedule_id,status")
            .eq("exam_schedule_id", sched["id"])
            .execute()
        )
        all_attempts_raw  = all_result.data or []
        live_attempts_raw = [a for a in all_attempts_raw if a.get("status") == "IN_PROGRESS"]

        student_ids = list({a["student_id"] for a in all_attempts_raw if a.get("student_id")})
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

        live_attempts = [
            {
                "id":               a["id"],
                "student_id":       a["student_id"],
                "exam_schedule_id": a["exam_schedule_id"],
                "users": {"full_name": name_map.get(a["student_id"], "Student")},
            }
            for a in live_attempts_raw
        ]
        # ALL attempts for this schedule, submitted or not — this is what
        # Flagged Attempts / Students Browser Monitoring / Live Alerts stay
        # scoped to, so a student's entries don't disappear the moment they
        # submit. Active Candidates / Live Candidate Feed still use the
        # live-only list above.
        session_attempts = [
            {
                "id":               a["id"],
                "student_id":       a["student_id"],
                "exam_schedule_id": a["exam_schedule_id"],
                "status":           a.get("status"),
                "users": {"full_name": name_map.get(a["student_id"], "Student")},
            }
            for a in all_attempts_raw
        ]

        all_live_attempts.extend(live_attempts)
        all_session_attempts.extend(session_attempts)

        # ── Registered count — active (non-cancelled) registrations ──────────
        registered_count = (
            supabase.table("exam_registrations")
            .select("id", count="exact")
            .eq("exam_schedule_id", sched["id"])
            .eq("status", "REGISTERED")
            .execute()
        ).count or 0

        # ── Completed count — attempts that are no longer in progress
        #    (submitted manually, auto-submitted, or force-submitted) ────────
        completed_count = (
            supabase.table("exam_attempts")
            .select("id", count="exact")
            .eq("exam_schedule_id", sched["id"])
            .neq("status", "IN_PROGRESS")
            .execute()
        ).count or 0

        exam   = sched.get("exams")  or {}
        course = exam.get("courses") or {}
        active_sessions.append({
            "schedule_id":      sched["id"],
            "exam_title":       exam.get("title", "Exam"),
            "course_code":      course.get("code", "—"),
            "active_students":  len(live_attempts),
            "registered_count": registered_count,
            "completed_count":  completed_count,
            "ends_at":         sched["end_time"],
            "active_attempts": live_attempts,
        })

    total_live = len(all_live_attempts)

    # ── Attempt ID scopes ───────────────────────────────────────────────────
    # live_attempt_ids    → only IN_PROGRESS attempts (Active Candidates card,
    #                        Live Candidate Feed).
    # session_attempt_ids → EVERY attempt (any status) tied to a currently
    #                        running exam schedule. Flagged Attempts, the
    #                        Students Browser Monitoring panel, and Live
    #                        Alerts are scoped to this so a student's entries
    #                        stay visible after they submit — they only drop
    #                        off once the exam schedule itself ends.
    live_attempt_ids    = [a["id"] for a in all_live_attempts]
    session_attempt_ids = [a["id"] for a in all_session_attempts]

    # ── Proctoring summary — scoped to the whole session (submitted included)
    if session_attempt_ids:
        all_summaries = (
            supabase.table("proctoring_summary")
            .select(
                "integrity_score,flagged_for_review,"
                "face_absence_count,multi_person_count,"
                "phone_detection_count"
            )
            .in_("attempt_id", session_attempt_ids)
            .execute()
            .data
        ) or []
    else:
        all_summaries = []

    total_flagged       = sum(1 for s in all_summaries if s.get("flagged_for_review"))
    face_absence_events = sum(s.get("face_absence_count",    0) for s in all_summaries)
    multi_person_events = sum(s.get("multi_person_count",    0) for s in all_summaries)
    phone_events        = sum(s.get("phone_detection_count", 0) for s in all_summaries)
    avg_integrity       = (
        sum(s.get("integrity_score", 1.0) for s in all_summaries) / len(all_summaries)
        if all_summaries else 1.0
    )

    # ── Tab switch stats — scoped to live attempts, read from browser_activity_logs
    # browser_activity_logs is upserted live on every BrowserMonitor sync.
    # proctoring_summary.tab_switch_count is only written on exam submission.
    # We filter by session_attempt_ids so we never show stale data from past exams.
    total_tab_switches    = 0
    tab_switches_last_30m = 0
    # Per-student browser monitoring — powers the "Students" panel on the
    # frontend (name + live tab-switch / fullscreen-exit counts).
    student_browser_stats: list = []

    if session_attempt_ids:
        try:
            # Cumulative rows: event_type IS NULL (one row per attempt, always current)
            browser_rows = (
                supabase.table("browser_activity_logs")
                .select("attempt_id,tab_switch_count,fullscreen_exit_count,updated_at")
                .in_("attempt_id", session_attempt_ids)
                .is_("event_type", "null")
                .execute()
                .data
            ) or []
        except Exception:
            # event_type column not yet added (migration pending) — read all rows
            browser_rows = (
                supabase.table("browser_activity_logs")
                .select("attempt_id,tab_switch_count,fullscreen_exit_count,updated_at")
                .in_("attempt_id", session_attempt_ids)
                .execute()
                .data
            ) or []

        total_tab_switches    = sum(r.get("tab_switch_count", 0) for r in browser_rows)
        tab_switches_last_30m = total_tab_switches

        # Narrow to 30-min window if updated_at exists
        try:
            recent_rows = (
                supabase.table("browser_activity_logs")
                .select("tab_switch_count")
                .in_("attempt_id", session_attempt_ids)
                .is_("event_type", "null")
                .gte("updated_at", thirty_min_ago)
                .execute()
                .data
            ) or []
            if recent_rows:
                tab_switches_last_30m = sum(r.get("tab_switch_count", 0) for r in recent_rows)
        except Exception:
            tab_switches_last_30m = total_tab_switches

        # Build attempt_id -> {student_id, exam_schedule_id, name} lookup from
        # EVERY attempt in the running exam schedules — not just live ones —
        # so a submitted student's row still resolves to their name.
        attempt_meta = {
            a["id"]: {
                "student_id":       a["student_id"],
                "exam_schedule_id": a["exam_schedule_id"],
                "name":             a["users"]["full_name"],
            }
            for a in all_session_attempts
        }
        for row in browser_rows:
            meta = attempt_meta.get(row["attempt_id"])
            if not meta:
                continue
            student_browser_stats.append({
                "attempt_id":            row["attempt_id"],
                "exam_schedule_id":      meta["exam_schedule_id"],
                "name":                  meta["name"],
                "tab_switch_count":      row.get("tab_switch_count", 0) or 0,
                "fullscreen_exit_count": row.get("fullscreen_exit_count", 0) or 0,
            })
        student_browser_stats.sort(
            key=lambda r: r["tab_switch_count"] + r["fullscreen_exit_count"],
            reverse=True,
        )

    # ── Audio stats — scoped to the whole session (submitted included) ────────
    total_noise_events    = 0
    noise_events_last_30m = 0

    if session_attempt_ids:
        total_noise_events = (
            supabase.table("audio_monitoring_logs")
            .select("id", count="exact")
            .eq("noise_detected", True)
            .in_("attempt_id", session_attempt_ids)
            .execute()
        ).count or 0

        try:
            noise_events_last_30m = (
                supabase.table("audio_monitoring_logs")
                .select("id", count="exact")
                .eq("noise_detected", True)
                .in_("attempt_id", session_attempt_ids)
                .gte("created_at", thirty_min_ago)
                .execute()
            ).count or 0
        except Exception:
            noise_events_last_30m = total_noise_events

    # ── Flagged attempts — scoped to the whole session (submitted included),
    #    PENDING verdict only ─────────────────────────────────────────────────
    if session_attempt_ids:
        flagged = (
            supabase.table("proctoring_summary")
            .select("*, exam_attempts(student_id, exam_schedule_id)")
            .eq("flagged_for_review", True)
            .eq("proctor_verdict", "PENDING")
            .in_("attempt_id", session_attempt_ids)
            .order("integrity_score", desc=False)
            .execute()
            .data
        ) or []
    else:
        flagged = []

    # Attach student names to flagged rows
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
        "studentBrowserStats": student_browser_stats,
    }