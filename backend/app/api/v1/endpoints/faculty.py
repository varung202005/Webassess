"""
Faculty portal endpoints — aggregate dashboard data and faculty-specific operations.

WHO DOES WHAT:
  - Dashboard aggregate (stats, queues, active sessions)  → BACKEND (this file)
  - Analytics per exam (topic-wise, grade dist)          → BACKEND
  - Faculty views of attempts / results                   → BACKEND
  - Publish all results for an exam                       → BACKEND
"""
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.security import require_faculty
from app.db.supabase import get_supabase_admin

router = APIRouter()


def _single_or_none(query):
    try:
        return query.maybe_single().execute().data
    except Exception:
        return None


# ── Dashboard Aggregate ───────────────────────────────────────────────────────

@router.get("/dashboard")
async def get_faculty_dashboard(current_user: dict = Depends(require_faculty)):
    """Full dashboard data for the faculty portal homepage."""
    supabase = get_supabase_admin()
    user_id = current_user["user_id"]

    # ── Profile ──
    user = (
        supabase.table("users")
        .select("id,full_name,email,phone,profile_photo")
        .eq("id", user_id)
        .single()
        .execute()
        .data
    )
    faculty = _single_or_none(
        supabase.table("faculty")
        .select("department_id,departments(name,code)")
        .eq("user_id", user_id)
    )
    profile = {**user, **(faculty or {})}

    # ── Exams created by this faculty ──
    exams = (
        supabase.table("exams")
        .select("id,title,status,course_id,duration_minutes,total_marks,pass_marks,"
                "semester,created_by,created_at,updated_at,instructions,"
                "shuffle_questions,shuffle_options,courses(name,code)")
        .eq("created_by", user_id)
        .order("created_at", desc=True)
        .execute()
        .data
    )
    exam_ids = [e["id"] for e in exams]
    exam_ids_str = [e["id"] for e in exams]  # keep as list

    # ── Exam counts ──
    status_counts = Counter(e["status"] for e in exams)

    # ── Question stats ──
    questions = (
        supabase.table("questions")
        .select("question_type,is_active")
        .eq("created_by", user_id)
        .execute()
        .data
    )
    active_qs = [q for q in questions if q.get("is_active")]
    by_type = Counter(q["question_type"] for q in active_qs) if active_qs else Counter()

    # ── Grading queue ──
    # Find exams with submitted attempts that have ungraded subjective answers
    pending_grading = 0
    grading_queue = []

    for exam in exams:
        exam_id = exam["id"]
        # Get schedules for this exam
        schedules = supabase.table("exam_schedules").select("id").eq("exam_id", exam_id).execute().data
        schedule_ids = [s["id"] for s in schedules]
        if not schedule_ids:
            continue
        # Get attempts for these schedules
        attempts = (
            supabase.table("exam_attempts")
            .select("id")
            .in_("exam_schedule_id", schedule_ids)
            .in_("status", ["SUBMITTED", "AUTO_SUBMITTED"])
            .execute()
            .data
        )
        attempt_ids = [a["id"] for a in attempts]
        if not attempt_ids:
            continue
        # Get ungraded subjective answers
        ungraded = (
            supabase.table("student_answers")
            .select("id,questions(question_type)")
            .in_("attempt_id", attempt_ids)
            .is_("marks_awarded", "null")
            .execute()
            .data
        )
        subjective_ungraded = [
            a for a in ungraded
            if a.get("questions", {}).get("question_type") in ("SHORT_ANSWER", "LONG_ANSWER")
        ]
        if subjective_ungraded:
            types_pending = set(
                a["questions"]["question_type"] for a in subjective_ungraded
                if a.get("questions")
            )
            pending_grading += len(subjective_ungraded)
            grading_queue.append({
                "exam_id": exam_id,
                "exam_title": exam["title"],
                "course_code": exam.get("courses", {}).get("code", ""),
                "pending_count": len(subjective_ungraded),
                "question_type": ", ".join(sorted(types_pending)),
            })

    # ── Active sessions (currently IN_PROGRESS attempts) ──
    active_sessions = []
    for exam in exams[:5]:  # check last 5 exams
        scheds = supabase.table("exam_schedules").select("id,start_time,end_time").eq("exam_id", exam["id"]).execute().data
        for s in scheds:
            active = (
                supabase.table("exam_attempts")
                .select("id")
                .eq("exam_schedule_id", s["id"])
                .eq("status", "IN_PROGRESS")
                .execute()
                .data
            )
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
                    "exam_title": exam["title"],
                    "course_code": exam.get("courses", {}).get("code", ""),
                    "started_at": s["start_time"],
                    "active_students": len(active),
                    "total_students": total_reg.count or 0,
                    "ends_at": s["end_time"],
                })

    # ── Pending re-evaluations ──
    my_exam_ids = [e["id"] for e in exams]
    reeval = []
    result_ids = []
    if my_exam_ids:
        results = supabase.table("results").select("id,exam_id,student_id,total_score,max_score,percentage").in_("exam_id", my_exam_ids).execute().data
        result_ids = [r["id"] for r in results]
    if result_ids:
        raw_reeval = (
            supabase.table("re_evaluation_requests")
            .select("*,users(full_name,email),results(total_score,max_score,exam_id,exams(title))")
            .in_("result_id", result_ids)
            .order("requested_at", desc=True)
            .execute()
            .data
        )
        reeval = [r for r in raw_reeval if r.get("status") == "PENDING"]

    # ── Notifications ──
    notifications = (
        supabase.table("notifications")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(20)
        .execute()
        .data
    )

    # ── Recent exams (for table on dashboard) ──
    recent_exams = exams[:10]
    # Attach questions_count
    for exam in recent_exams:
        cnt = (
            supabase.table("exam_questions")
            .select("id", count="exact")
            .eq("exam_id", exam["id"])
            .execute()
        )
        exam["questions_count"] = cnt.count or 0

    # ── Upcoming schedules ──
    now = datetime.now(timezone.utc)
    all_schedules = []
    for exam in exams:
        scheds = (
            supabase.table("exam_schedules")
            .select("*,departments(name)")
            .eq("exam_id", exam["id"])
            .order("start_time")
            .execute()
            .data
        )
        all_schedules.extend(scheds)
    # Filter to future/ongoing schedules
    upcoming = [s for s in all_schedules if datetime.fromisoformat(s["end_time"]) >= now]

    # ── Courses / Departments ──
    departments = supabase.table("departments").select("id,name,code").order("name").execute().data
    courses = supabase.table("courses").select("id,name,code").order("name").execute().data

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


# ── Faculty Exam Attempts ─────────────────────────────────────────────────────

@router.get("/exam-attempts/{exam_id}")
async def get_exam_attempts(exam_id: UUID, _: dict = Depends(require_faculty)):
    """All attempts for a given exam, with student info."""
    supabase = get_supabase_admin()
    schedules = (
        supabase.table("exam_schedules")
        .select("id")
        .eq("exam_id", str(exam_id))
        .execute()
        .data
    )
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
    )

    # Attach schedule info
    schedule_map = {
        s["id"]: {
            "start_time": s.get("start_time"),
            "end_time": s.get("end_time"),
        }
        for s in schedules
    }
    for attempt in attempts:
        sched = schedule_map.get(attempt["exam_schedule_id"], {})
        attempt["schedule"] = sched

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
    )

    # Compute rank
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
    )

    if not results:
        return {"message": "No unpublished results found", "published": 0}

    ids = [r["id"] for r in results]
    supabase.table("results").update({"is_published": True}).in_("id", ids).execute()

    # Notify students
    notifications = [
        {
            "user_id": r["student_id"],
            "type": "RESULT_PUBLISHED",
            "title": "Your result is out!",
            "body": f"Your results for {r['exams']['title']} have been published.",
        }
        for r in results
    ]
    if notifications:
        supabase.table("notifications").insert(notifications).execute()

    return {"message": f"Published {len(results)} results", "published": len(results)}


# ── Exam Analytics ────────────────────────────────────────────────────────────

@router.get("/analytics/{exam_id}")
async def get_exam_analytics(exam_id: UUID, _: dict = Depends(require_faculty)):
    """Full analytics for a single exam: stats, grade dist, topic perf."""
    supabase = get_supabase_admin()

    # Exam info
    exam = _single_or_none(
        supabase.table("exams")
        .select("*,courses(name)")
        .eq("id", str(exam_id))
    )
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # Results
    results = (
        supabase.table("results")
        .select("*")
        .eq("exam_id", str(exam_id))
        .eq("is_published", True)
        .execute()
        .data
    )

    total_registered = 0
    total_appeared = len(results)

    # Registration count
    schedules = supabase.table("exam_schedules").select("id").eq("exam_id", str(exam_id)).execute().data
    for s in schedules:
        cnt = (
            supabase.table("exam_registrations")
            .select("id", count="exact")
            .eq("exam_schedule_id", s["id"])
            .eq("status", "REGISTERED")
            .execute()
        )
        total_registered += cnt.count or 0

    if not results:
        return {
            "exam_id": exam_id,
            "exam_title": exam["title"],
            "course_name": (exam.get("courses") or {}).get("name", ""),
            "total_registered": total_registered,
            "total_appeared": 0,
            "average_score": 0,
            "average_percentage": 0,
            "pass_rate": 0,
            "highest_score": 0,
            "highest_scorer": None,
            "median_score": 0,
            "grade_distribution": {},
            "score_distribution": [0] * 20,
            "topic_performance": [],
        }

    scores = [r["total_score"] for r in results]
    percentages = [r["percentage"] for r in results]
    passed = sum(1 for r in results if r["is_passed"])
    max_score = results[0]["max_score"] if results else 0

    avg_score = round(sum(scores) / len(scores), 2)
    avg_pct = round(sum(percentages) / len(percentages), 2)
    pass_rate = round(passed / len(results) * 100, 2)
    highest_score = max(scores)
    sorted_by_pct = sorted(results, key=lambda r: r["percentage"], reverse=True)
    highest_scorer_obj = sorted_by_pct[0] if sorted_by_pct else None
    highest_name = None
    if highest_scorer_obj:
        student = _single_or_none(
            supabase.table("users").select("full_name").eq("id", highest_scorer_obj["student_id"])
        )
        highest_name = student["full_name"] if student else None

    # Median score
    sorted_scores = sorted(scores)
    n = len(sorted_scores)
    median = sorted_scores[n // 2] if n % 2 else (sorted_scores[n // 2 - 1] + sorted_scores[n // 2]) / 2

    # Grade distribution
    grade_dist = Counter(r["grade"] for r in results)
    # Score distribution (buckets of max_score/20)
    bucket_size = max(1, max_score // 10)
    buckets = [0] * 10
    for r in results:
        bucket = min(int(r["percentage"] // 10), 9)
        buckets[bucket] += 1
    score_labels = [f"{i*10}-{(i+1)*10}%" for i in range(10)]

    # Topic-wise performance
    exam_questions = (
        supabase.table("exam_questions")
        .select("question_id,questions(question_type,marks,question_topics(topic,difficulty))")
        .eq("exam_id", str(exam_id))
        .execute()
        .data
    )

    topic_data = defaultdict(lambda: {"total": 0, "correct": 0, "count": 0, "difficulties": set()})

    # Get all answers for this exam
    all_attempts = supabase.table("exam_attempts").select("id").in_("exam_schedule_id", [s["id"] for s in schedules]).execute().data if schedules else []
    attempt_ids = [a["id"] for a in all_attempts]

    if attempt_ids:
        answers = (
            supabase.table("student_answers")
            .select("question_id,is_correct")
            .in_("attempt_id", attempt_ids)
            .execute()
            .data
        )
        # Map question_id to topics
        q_topic_map = {}
        for eq in exam_questions:
            q = eq.get("questions") or {}
            topics = q.get("question_topics") or []
            diff = q.get("difficulty", "MEDIUM")
            if topics:
                for t in topics:
                    topic_name = t.get("topic", "General")
                    q_topic_map[eq["question_id"]] = {"topic": topic_name, "difficulty": diff}
            else:
                q_topic_map[eq["question_id"]] = {"topic": "General", "difficulty": diff}

        for ans in answers:
            qid = ans["question_id"]
            info = q_topic_map.get(qid)
            if info:
                topic_data[info["topic"]]["total"] += 1
                if ans.get("is_correct"):
                    topic_data[info["topic"]]["correct"] += 1
                topic_data[info["topic"]]["count"] += 1
                topic_data[info["topic"]]["difficulties"].add(info["difficulty"])

    topic_performance = []
    for topic, data in sorted(topic_data.items()):
        avg_acc = round((data["correct"] / data["total"]) * 100, 1) if data["total"] > 0 else 0
        # Use most common difficulty
        diff = "MEDIUM"
        if data["difficulties"]:
            diff = sorted(data["difficulties"])[0]
        topic_performance.append({
            "topic": topic,
            "question_count": data["count"],
            "avg_accuracy": avg_acc,
            "difficulty": diff,
        })

    return {
        "exam_id": str(exam_id),
        "exam_title": exam["title"],
        "course_name": (exam.get("courses") or {}).get("name", ""),
        "total_registered": total_registered,
        "total_appeared": total_appeared,
        "average_score": avg_score,
        "average_percentage": avg_pct,
        "pass_rate": pass_rate,
        "highest_score": highest_score,
        "highest_scorer": highest_name,
        "median_score": median,
        "grade_distribution": dict(grade_dist),
        "score_distribution": buckets,
        "score_labels": score_labels,
        "topic_performance": topic_performance,
    }
