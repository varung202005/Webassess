import logging
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.security import require_faculty
from app.db.supabase import get_supabase_admin

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _single_or_none(query):
    try:
        return query.maybe_single().execute().data
    except Exception:
        return None


def safe_dt(value: str | None) -> datetime | None:
    """Parse ISO datetime strings safely, handling both naive and tz-aware formats."""
    if not value:
        return None
    try:
        # Python 3.11+ handles "+00:00"; for 3.10 we replace manually
        normalized = value.replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
        # Make timezone-aware if naive
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def safe_dict(obj) -> dict:
    """Return dict or {} — never None."""
    return obj if isinstance(obj, dict) else {}


# ── Dashboard Aggregate ───────────────────────────────────────────────────────

@router.get("/dashboard")
async def get_faculty_dashboard(current_user: dict = Depends(require_faculty)):
    """Full dashboard data for the faculty portal homepage. Never returns 500."""
    supabase = get_supabase_admin()
    user_id = current_user["user_id"]

    # ── Profile ──────────────────────────────────────────────────────────────
    profile = {}
    try:
        user = (
            supabase.table("users")
            .select("id,full_name,email,phone,profile_photo")
            .eq("id", user_id)
            .single()
            .execute()
            .data
        ) or {}
        faculty = _single_or_none(
            supabase.table("faculty")
            .select("department_id,departments(name,code)")
            .eq("user_id", user_id)
        ) or {}
        profile = {**user, **faculty}
    except Exception as e:
        logger.warning("Dashboard: profile fetch failed: %s", e)

    # ── Exams created by this faculty ─────────────────────────────────────────
    exams = []
    try:
        exams = (
            supabase.table("exams")
            .select(
                "id,title,status,course_id,duration_minutes,total_marks,pass_marks,"
                "semester,created_by,created_at,updated_at,instructions,"
                "shuffle_questions,shuffle_options,courses(name,code)"
            )
            .eq("created_by", user_id)
            .order("created_at", desc=True)
            .execute()
            .data
        ) or []
    except Exception as e:
        logger.warning("Dashboard: exams fetch failed: %s", e)

    exam_ids = [e["id"] for e in exams]
    status_counts = Counter(e.get("status") for e in exams)

    # ── Question stats ────────────────────────────────────────────────────────
    questions = []
    try:
        questions = (
            supabase.table("questions")
            .select("question_type,is_active")
            .eq("created_by", user_id)
            .execute()
            .data
        ) or []
    except Exception as e:
        logger.warning("Dashboard: questions fetch failed: %s", e)

    active_qs = [q for q in questions if q.get("is_active")]
    by_type = Counter(q["question_type"] for q in active_qs) if active_qs else Counter()

    # ── Grading queue ─────────────────────────────────────────────────────────
    pending_grading = 0
    grading_queue = []
    try:
        for exam in exams:
            exam_id = exam["id"]
            schedules = (
                supabase.table("exam_schedules")
                .select("id")
                .eq("exam_id", exam_id)
                .execute()
                .data
            ) or []
            schedule_ids = [s["id"] for s in schedules]
            if not schedule_ids:
                continue

            attempts = (
                supabase.table("exam_attempts")
                .select("id")
                .in_("exam_schedule_id", schedule_ids)
                .in_("status", ["SUBMITTED", "AUTO_SUBMITTED"])
                .execute()
                .data
            ) or []
            attempt_ids = [a["id"] for a in attempts]
            if not attempt_ids:
                continue

            ungraded = (
                supabase.table("student_answers")
                .select("id,questions(question_type)")
                .in_("attempt_id", attempt_ids)
                .is_("marks_awarded", "null")
                .execute()
                .data
            ) or []

            subjective_ungraded = [
                a for a in ungraded
                if safe_dict(a.get("questions")).get("question_type") in ("SHORT_ANSWER", "LONG_ANSWER")
            ]
            if subjective_ungraded:
                types_pending = {
                    a["questions"]["question_type"] for a in subjective_ungraded
                    if a.get("questions")
                }
                pending_grading += len(subjective_ungraded)
                grading_queue.append({
                    "exam_id": exam_id,
                    "exam_title": exam.get("title", ""),
                    "course_code": safe_dict(exam.get("courses")).get("code", ""),
                    "pending_count": len(subjective_ungraded),
                    "question_type": ", ".join(sorted(types_pending)),
                })
    except Exception as e:
        logger.warning("Dashboard: grading queue failed: %s", e)

    # ── Active sessions ───────────────────────────────────────────────────────
    active_sessions = []
    try:
        for exam in exams[:5]:
            scheds = (
                supabase.table("exam_schedules")
                .select("id,start_time,end_time")
                .eq("exam_id", exam["id"])
                .execute()
                .data
            ) or []
            for s in scheds:
                active = (
                    supabase.table("exam_attempts")
                    .select("id")
                    .eq("exam_schedule_id", s["id"])
                    .eq("status", "IN_PROGRESS")
                    .execute()
                    .data
                ) or []
                if active:
                    total_reg = (
                        supabase.table("exam_registrations")
                        .select("id", count="exact")
                        .eq("exam_schedule_id", s["id"])
                        .eq("status", "REGISTERED")
                        .execute()
                    )
                    active_sessions.append({
                        "schedule_id": s["id"],
                        "exam_title": exam.get("title", ""),
                        "course_code": safe_dict(exam.get("courses")).get("code", ""),
                        "started_at": s.get("start_time"),
                        "active_students": len(active),
                        "total_students": total_reg.count or 0,
                        "ends_at": s.get("end_time"),
                    })
    except Exception as e:
        logger.warning("Dashboard: active sessions failed: %s", e)

    # ── Pending re-evaluations ────────────────────────────────────────────────
    reeval = []
    try:
        if exam_ids:
            results = (
                supabase.table("results")
                .select("id,exam_id,student_id,total_score,max_score,percentage")
                .in_("exam_id", exam_ids)
                .execute()
                .data
            ) or []
            result_ids = [r["id"] for r in results]
            if result_ids:
                raw_reeval = (
                    supabase.table("re_evaluation_requests")
                    .select("*,users(full_name,email),results(total_score,max_score,exam_id,exams(title))")
                    .in_("result_id", result_ids)
                    .order("requested_at", desc=True)
                    .execute()
                    .data
                ) or []
                reeval = [r for r in raw_reeval if r.get("status") == "PENDING"]
    except Exception as e:
        logger.warning("Dashboard: reevaluations failed: %s", e)

    # ── Notifications ─────────────────────────────────────────────────────────
    notifications = []
    try:
        notifications = (
            supabase.table("notifications")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(20)
            .execute()
            .data
        ) or []
    except Exception as e:
        logger.warning("Dashboard: notifications failed: %s", e)

    # ── Recent exams with question counts ─────────────────────────────────────
    recent_exams = exams[:10]
    try:
        for exam in recent_exams:
            cnt = (
                supabase.table("exam_questions")
                .select("id", count="exact")
                .eq("exam_id", exam["id"])
                .execute()
            )
            exam["questions_count"] = cnt.count or 0
    except Exception as e:
        logger.warning("Dashboard: question counts failed: %s", e)

    # ── Upcoming schedules ────────────────────────────────────────────────────
    # FIX: use safe_dt() to parse ISO strings — this was the primary 500 cause
    upcoming = []
    try:
        now = datetime.now(timezone.utc)
        all_schedules = []
        for exam in exams:
            scheds = (
                supabase.table("exam_schedules")
                .select("*,departments(name),exams(title)")
                .eq("exam_id", exam["id"])
                .order("start_time")
                .execute()
                .data
            ) or []
            all_schedules.extend(scheds)

        for s in all_schedules:
            end_dt = safe_dt(s.get("end_time"))
            if end_dt and end_dt >= now:
                upcoming.append(s)
    except Exception as e:
        logger.warning("Dashboard: upcoming schedules failed: %s", e)

    # ── Master data ───────────────────────────────────────────────────────────
    departments, courses = [], []
    try:
        departments = supabase.table("departments").select("id,name,code").order("name").execute().data or []
        courses = supabase.table("courses").select("id,name,code").order("name").execute().data or []
    except Exception as e:
        logger.warning("Dashboard: master data failed: %s", e)

    return {
        "profile": profile,
        "examCounts": {
            "total": len(exams),
            "draft": status_counts.get("DRAFT", 0),
            "review": status_counts.get("REVIEW", 0),
            "published": status_counts.get("PUBLISHED", 0),
            "archived": status_counts.get("ARCHIVED", 0),
        },
        "questionStats": {
            "total": len(questions),
            "byType": dict(by_type),
            "active": len(active_qs),
        },
        "pendingGrading": pending_grading,
        "pendingReevaluations": len(reeval),
        "activeSessions": active_sessions,
        "gradingQueue": grading_queue,
        "recentExams": recent_exams,
        "upcomingSchedules": upcoming,
        "reevaluationRequests": reeval,
        "notifications": notifications,
        "departments": departments,
        "courses": courses,
    }


# ── Lightweight summary (for fast sidebar badge updates) ─────────────────────

@router.get("/dashboard/summary")
async def get_faculty_summary(current_user: dict = Depends(require_faculty)):
    """Minimal counts only — fast endpoint for badge refreshes."""
    supabase = get_supabase_admin()
    user_id = current_user["user_id"]
    try:
        exams = (
            supabase.table("exams")
            .select("id,status")
            .eq("created_by", user_id)
            .execute()
            .data
        ) or []
        questions = (
            supabase.table("questions")
            .select("id,is_active")
            .eq("created_by", user_id)
            .execute()
            .data
        ) or []
        counts = Counter(e.get("status") for e in exams)
        return {
            "total_exams": len(exams),
            "published_exams": counts.get("PUBLISHED", 0),
            "draft_exams": counts.get("DRAFT", 0),
            "total_questions": len(questions),
            "active_questions": sum(1 for q in questions if q.get("is_active")),
        }
    except Exception as e:
        logger.error("Summary endpoint failed: %s", e)
        return {"total_exams": 0, "published_exams": 0, "draft_exams": 0, "total_questions": 0, "active_questions": 0}


# ── Faculty Exam Attempts ─────────────────────────────────────────────────────

@router.get("/exam-attempts/{exam_id}")
async def get_exam_attempts(exam_id: UUID, _: dict = Depends(require_faculty)):
    """All attempts for a given exam, with student info."""
    supabase = get_supabase_admin()
    schedules = (
        supabase.table("exam_schedules")
        .select("id,start_time,end_time")
        .eq("exam_id", str(exam_id))
        .execute()
        .data
    ) or []
    schedule_ids = [s["id"] for s in schedules]
    if not schedule_ids:
        return []

    attempts = (
        supabase.table("exam_attempts")
        .select("*,users(full_name,email),students(roll_number)")
        .in_("exam_schedule_id", schedule_ids)
        .order("started_at", desc=True)
        .execute()
        .data
    ) or []

    schedule_map = {s["id"]: {"start_time": s.get("start_time"), "end_time": s.get("end_time")} for s in schedules}
    for attempt in attempts:
        attempt["schedule"] = schedule_map.get(attempt["exam_schedule_id"], {})
    return attempts


# ── Faculty Exam Results ──────────────────────────────────────────────────────

@router.get("/exam-results/{exam_id}")
async def get_exam_results(exam_id: UUID, _: dict = Depends(require_faculty)):
    """All results for a given exam with student info."""
    supabase = get_supabase_admin()
    results = (
        supabase.table("results")
        .select("*,users(full_name,email),exams(title)")
        .eq("exam_id", str(exam_id))
        .order("percentage", desc=True)
        .execute()
        .data
    ) or []
    for i, result in enumerate(results):
        result["rank"] = i + 1
    return results


# ── Publish All Results ───────────────────────────────────────────────────────

@router.post("/publish-results/{exam_id}")
async def publish_all_results(exam_id: UUID, _: dict = Depends(require_faculty)):
    """Publish all unpublished results for an exam."""
    supabase = get_supabase_admin()
    results = (
        supabase.table("results")
        .select("id,student_id,exams(title)")
        .eq("exam_id", str(exam_id))
        .eq("is_published", False)
        .execute()
        .data
    ) or []
    if not results:
        return {"message": "No unpublished results found", "published": 0}

    ids = [r["id"] for r in results]
    supabase.table("results").update({"is_published": True}).in_("id", ids).execute()

    notifications = [
        {
            "user_id": r["student_id"],
            "type": "RESULT_PUBLISHED",
            "title": "Your result is out!",
            "body": f"Your results for {safe_dict(r.get('exams')).get('title', 'your exam')} have been published.",
        }
        for r in results
    ]
    if notifications:
        supabase.table("notifications").insert(notifications).execute()
    return {"message": f"Published {len(results)} results", "published": len(results)}


# ── Exam Analytics ────────────────────────────────────────────────────────────

@router.get("/analytics/{exam_id}")
async def get_exam_analytics(exam_id: UUID, _: dict = Depends(require_faculty)):
    """Full analytics for a single exam."""
    supabase = get_supabase_admin()
    exam = _single_or_none(
        supabase.table("exams").select("*,courses(name)").eq("id", str(exam_id))
    )
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    results = (
        supabase.table("results")
        .select("*")
        .eq("exam_id", str(exam_id))
        .eq("is_published", True)
        .execute()
        .data
    ) or []

    total_registered = 0
    schedules = (
        supabase.table("exam_schedules")
        .select("id")
        .eq("exam_id", str(exam_id))
        .execute()
        .data
    ) or []
    for s in schedules:
        cnt = (
            supabase.table("exam_registrations")
            .select("id", count="exact")
            .eq("exam_schedule_id", s["id"])
            .eq("status", "REGISTERED")
            .execute()
        )
        total_registered += cnt.count or 0

    empty = {
        "exam_id": str(exam_id),
        "exam_title": exam.get("title", ""),
        "course_name": safe_dict(exam.get("courses")).get("name", ""),
        "total_registered": total_registered,
        "total_appeared": 0,
        "average_score": 0,
        "average_percentage": 0,
        "pass_rate": 0,
        "highest_score": 0,
        "highest_scorer": None,
        "median_score": 0,
        "grade_distribution": {},
        "score_distribution": [0] * 10,
        "score_labels": [f"{i*10}-{(i+1)*10}%" for i in range(10)],
        "topic_performance": [],
    }

    if not results:
        return empty

    scores = [r["total_score"] for r in results]
    percentages = [r["percentage"] for r in results]
    passed = sum(1 for r in results if r.get("is_passed"))

    avg_score = round(sum(scores) / len(scores), 2)
    avg_pct = round(sum(percentages) / len(percentages), 2)
    pass_rate = round(passed / len(results) * 100, 2)
    highest_score = max(scores)

    sorted_by_pct = sorted(results, key=lambda r: r.get("percentage", 0), reverse=True)
    highest_name = None
    if sorted_by_pct:
        student = _single_or_none(
            supabase.table("users").select("full_name").eq("id", sorted_by_pct[0]["student_id"])
        )
        highest_name = safe_dict(student).get("full_name")

    sorted_scores = sorted(scores)
    n = len(sorted_scores)
    median = sorted_scores[n // 2] if n % 2 else (sorted_scores[n // 2 - 1] + sorted_scores[n // 2]) / 2

    grade_dist = Counter(r.get("grade") for r in results)
    buckets = [0] * 10
    for r in results:
        bucket = min(int((r.get("percentage") or 0) // 10), 9)
        buckets[bucket] += 1

    # Topic performance
    topic_data: dict = defaultdict(lambda: {"total": 0, "correct": 0, "count": 0, "difficulties": set()})
    try:
        exam_questions = (
            supabase.table("exam_questions")
            .select("question_id,questions(question_type,marks,question_topics(topic,difficulty))")
            .eq("exam_id", str(exam_id))
            .execute()
            .data
        ) or []
        schedule_ids = [s["id"] for s in schedules]
        attempt_ids = []
        if schedule_ids:
            all_attempts = (
                supabase.table("exam_attempts")
                .select("id")
                .in_("exam_schedule_id", schedule_ids)
                .execute()
                .data
            ) or []
            attempt_ids = [a["id"] for a in all_attempts]

        if attempt_ids:
            answers = (
                supabase.table("student_answers")
                .select("question_id,is_correct")
                .in_("attempt_id", attempt_ids)
                .execute()
                .data
            ) or []
            q_topic_map = {}
            for eq in exam_questions:
                q = safe_dict(eq.get("questions"))
                topics = q.get("question_topics") or []
                for t in (topics if topics else [{"topic": "General"}]):
                    q_topic_map[eq["question_id"]] = {
                        "topic": t.get("topic", "General"),
                        "difficulty": q.get("difficulty", "MEDIUM"),
                    }

            for ans in answers:
                info = q_topic_map.get(ans["question_id"])
                if info:
                    topic_data[info["topic"]]["total"] += 1
                    if ans.get("is_correct"):
                        topic_data[info["topic"]]["correct"] += 1
                    topic_data[info["topic"]]["count"] += 1
                    topic_data[info["topic"]]["difficulties"].add(info["difficulty"])
    except Exception as e:
        logger.warning("Analytics: topic performance failed: %s", e)

    topic_performance = [
        {
            "topic": topic,
            "question_count": data["count"],
            "avg_accuracy": round((data["correct"] / data["total"]) * 100, 1) if data["total"] > 0 else 0,
            "difficulty": sorted(data["difficulties"])[0] if data["difficulties"] else "MEDIUM",
        }
        for topic, data in sorted(topic_data.items())
    ]

    return {
        **empty,
        "total_appeared": len(results),
        "average_score": avg_score,
        "average_percentage": avg_pct,
        "pass_rate": pass_rate,
        "highest_score": highest_score,
        "highest_scorer": highest_name,
        "median_score": median,
        "grade_distribution": dict(grade_dist),
        "score_distribution": buckets,
        "topic_performance": topic_performance,
    }