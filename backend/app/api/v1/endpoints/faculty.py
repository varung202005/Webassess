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


def safe_dt(value) -> datetime | None:
    if not value:
        return None
    try:
        normalized = str(value).replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def safe_dict(obj) -> dict:
    return obj if isinstance(obj, dict) else {}


# ── Dashboard ─────────────────────────────────────────────────────────────────

@router.get("/dashboard")
async def get_faculty_dashboard(current_user: dict = Depends(require_faculty)):
    """Full dashboard data for the faculty portal homepage."""
    supabase = get_supabase_admin()
    user_id = current_user["user_id"]

    profile = {}
    try:
        user = (
            supabase.table("users")
            .select("id,full_name,email,phone,profile_photo")
            .eq("id", user_id).single().execute().data
        ) or {}
        faculty = _single_or_none(
            supabase.table("faculty")
            .select("department_id,departments(name,code)")
            .eq("user_id", user_id)
        ) or {}
        profile = {**user, **faculty}
    except Exception as e:
        logger.warning("Dashboard: profile fetch failed: %s", e)

    exams = []
    try:
        exams = (
            supabase.table("exams")
            .select(
                "id,title,status,exam_type,course_id,duration_minutes,total_marks,pass_marks,"
                "created_by,created_at,updated_at,instructions,shuffle_questions,shuffle_options,"
                "courses(name,code)"
            )
            .eq("created_by", user_id)
            .order("created_at", desc=True)
            .execute().data
        ) or []
    except Exception as e:
        logger.warning("Dashboard: exams fetch failed: %s", e)

    exam_ids = [e["id"] for e in exams]
    status_counts = Counter(e.get("status") for e in exams)

    questions = []
    try:
        questions = (
            supabase.table("questions")
            .select("question_type,is_active")
            .eq("created_by", user_id)
            .execute().data
        ) or []
    except Exception as e:
        logger.warning("Dashboard: questions fetch failed: %s", e)

    active_qs = [q for q in questions if q.get("is_active")]
    by_type = Counter(q["question_type"] for q in active_qs) if active_qs else Counter()

    # Active sessions
    active_sessions = []
    try:
        for exam in exams:
            scheds = (
                supabase.table("exam_schedules")
                .select("id,start_time,end_time")
                .eq("exam_id", exam["id"])
                .execute().data
            ) or []
            for s in scheds:
                active = (
                    supabase.table("exam_attempts")
                    .select("id")
                    .eq("exam_schedule_id", s["id"])
                    .eq("status", "IN_PROGRESS")
                    .execute().data
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

    # Pending re-evaluations
    reeval = []
    try:
        if exam_ids:
            results = (
                supabase.table("results")
                .select("id,exam_id,student_id,total_score,max_score,percentage")
                .in_("exam_id", exam_ids)
                .execute().data
            ) or []
            result_ids = [r["id"] for r in results]
            if result_ids:
                # Use explicit FK hint — re_evaluation_requests has two FKs to users
                raw_reeval = (
                    supabase.table("re_evaluation_requests")
                    .select("*,users!re_evaluation_requests_student_id_fkey(full_name,email),results(total_score,max_score,exam_id,exams(title))")
                    .in_("result_id", result_ids)
                    .order("requested_at", desc=True)
                    .execute().data
                ) or []
                reeval = [r for r in raw_reeval if r.get("status") == "PENDING"]
    except Exception as e:
        logger.warning("Dashboard: reevaluations failed: %s", e)

    notifications = []
    try:
        notifications = (
            supabase.table("notifications")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(20)
            .execute().data
        ) or []
    except Exception as e:
        logger.warning("Dashboard: notifications failed: %s", e)

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

    upcoming = []
    try:
        now = datetime.now(timezone.utc)
        for exam in exams:
            scheds = (
                supabase.table("exam_schedules")
                .select("*,departments(name),exams(title)")
                .eq("exam_id", exam["id"])
                .order("start_time")
                .execute().data
            ) or []
            for s in scheds:
                end_dt = safe_dt(s.get("end_time"))
                if end_dt and end_dt >= now:
                    upcoming.append(s)
    except Exception as e:
        logger.warning("Dashboard: upcoming schedules failed: %s", e)

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
        "pendingGrading": 0,
        "pendingReevaluations": len(reeval),
        "activeSessions": active_sessions,
        "gradingQueue": [],
        "recentExams": recent_exams,
        "upcomingSchedules": upcoming,
        "reevaluationRequests": reeval,
        "notifications": notifications,
        "departments": departments,
        "courses": courses,
    }


@router.get("/dashboard/summary")
async def get_faculty_summary(current_user: dict = Depends(require_faculty)):
    supabase = get_supabase_admin()
    user_id = current_user["user_id"]
    try:
        exams = (
            supabase.table("exams").select("id,status").eq("created_by", user_id).execute().data
        ) or []
        questions = (
            supabase.table("questions").select("id,is_active").eq("created_by", user_id).execute().data
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


# ── Exam Attempts (Faculty view) ──────────────────────────────────────────────

@router.get("/exam-attempts/{exam_id}")
async def get_exam_attempts(exam_id: UUID, _: dict = Depends(require_faculty)):
    """
    All attempts for a given exam with student info.
    Steps:
      1. Get schedule_ids for the exam.
      2. Fetch attempts joined with users (valid FK: exam_attempts.user_id → users.id).
      3. Fetch students rows by user_ids (students.user_id → users.id) separately,
         because exam_attempts has NO direct FK to students.
    """
    supabase = get_supabase_admin()

    schedules = (
        supabase.table("exam_schedules")
        .select("id,start_time,end_time")
        .eq("exam_id", str(exam_id))
        .execute().data
    ) or []
    schedule_ids = [s["id"] for s in schedules]
    if not schedule_ids:
        return []

    # Step 1: attempts + users only (valid FK)
    attempts = (
        supabase.table("exam_attempts")
        .select("*,users(full_name,email)")
        .in_("exam_schedule_id", schedule_ids)
        .order("started_at", desc=True)
        .execute().data
    ) or []

    if not attempts:
        return []

    # Step 2: fetch student profiles by user_id (roll_number, semester, section).
    # Wrapped in try/except — table name may differ per schema.
    user_ids = list({a["user_id"] for a in attempts if a.get("user_id")})
    student_map: dict = {}
    if user_ids:
        try:
            students = (
                supabase.table("students")
                .select("user_id,roll_number,semester,section")
                .in_("user_id", user_ids)
                .execute().data
            ) or []
            student_map = {s["user_id"]: s for s in students}
        except Exception:
            # If the students table doesn't exist or has a different name,
            # roll_number will just be empty — non-fatal.
            student_map = {}

    # Step 3: attach student info + schedule info
    schedule_map = {
        s["id"]: {"start_time": s.get("start_time"), "end_time": s.get("end_time")}
        for s in schedules
    }
    for attempt in attempts:
        attempt["students"] = student_map.get(attempt.get("user_id"), {})
        attempt["schedule"] = schedule_map.get(attempt.get("exam_schedule_id"), {})

    return attempts


# ── Per-attempt detail (objective summary) ───────────────────────────────────

@router.get("/attempt-detail/{attempt_id}")
async def get_attempt_detail(attempt_id: UUID, _: dict = Depends(require_faculty)):
    """
    Full objective-only detail for one attempt.
    exam_attempts has no direct FK to students — fetch student info separately via user_id.
    """
    supabase = get_supabase_admin()

    # Step 1: attempt + user only (valid FK)
    attempt = _single_or_none(
        supabase.table("exam_attempts")
        .select("*,users(full_name,email)")
        .eq("id", str(attempt_id))
    )
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    # Step 2: fetch student profile separately via user_id.
    # Wrapped in try/except — table name may differ per schema.
    student_info = {}
    if attempt.get("user_id"):
        try:
            student_info = _single_or_none(
                supabase.table("students")
                .select("user_id,roll_number,semester,section")
                .eq("user_id", attempt["user_id"])
            ) or {}
        except Exception:
            student_info = {}
    attempt["students"] = student_info

    result = _single_or_none(
        supabase.table("results")
        .select("*")
        .eq("attempt_id", str(attempt_id))
    )

    # Fetch answers — try with nested join first, fall back to flat if join name differs
    answers = []
    try:
        answers = (
            supabase.table("student_answers")
            .select(
                "id,question_id,selected_option_id,selected_option_ids,answer_text,"
                "is_correct,marks_awarded,time_spent_sec,is_marked_for_review,"
                "questions(id,question_text,question_type,marks,difficulty,"
                "options(id,option_text,is_correct))"
            )
            .eq("attempt_id", str(attempt_id))
            .execute().data
        ) or []
    except Exception as e:
        logger.warning("attempt-detail: answers join failed (%s), trying flat fetch", e)
        try:
            answers = (
                supabase.table("student_answers")
                .select("id,question_id,selected_option_id,selected_option_ids,"
                        "answer_text,is_correct,marks_awarded,time_spent_sec,is_marked_for_review")
                .eq("attempt_id", str(attempt_id))
                .execute().data
            ) or []
        except Exception as e2:
            logger.error("attempt-detail: flat fetch also failed: %s", e2)
            answers = []

    # If answers have no nested question data, fetch questions separately
    need_questions = answers and "questions" not in answers[0]
    if need_questions:
        q_ids = list({a["question_id"] for a in answers if a.get("question_id")})
        q_map: dict = {}
        if q_ids:
            try:
                q_rows = (
                    supabase.table("questions")
                    .select("id,question_text,question_type,marks,difficulty")
                    .in_("id", q_ids)
                    .execute().data
                ) or []
                # fetch options separately too
                opt_rows = (
                    supabase.table("options")
                    .select("id,question_id,option_text,is_correct")
                    .in_("question_id", q_ids)
                    .execute().data
                ) or []
                opts_by_q: dict = defaultdict(list)
                for o in opt_rows:
                    opts_by_q[o["question_id"]].append(o)
                for q in q_rows:
                    q["options"] = opts_by_q.get(q["id"], [])
                    q_map[q["id"]] = q
            except Exception as e:
                logger.warning("attempt-detail: separate question fetch failed: %s", e)
        for a in answers:
            a["questions"] = q_map.get(a.get("question_id"), {})

    enriched = []
    for ans in answers:
        q = safe_dict(ans.get("questions"))
        options = q.get("options") or []
        correct_options = [o for o in options if o.get("is_correct")]
        selected_option = next(
            (o for o in options if o["id"] == ans.get("selected_option_id")), None
        )
        enriched.append({
            "answer_id": ans["id"],
            "question_id": ans.get("question_id", ""),
            "question_text": q.get("question_text", ""),
            "question_type": q.get("question_type", ""),
            "max_marks": q.get("marks", 1),
            "difficulty": q.get("difficulty", ""),
            "all_options": options,
            "student_selected_option_id": ans.get("selected_option_id"),
            "student_selected_option_text": safe_dict(selected_option).get("option_text", ""),
            "correct_option_ids": [o["id"] for o in correct_options],
            "correct_option_texts": [o["option_text"] for o in correct_options],
            "is_correct": ans.get("is_correct"),
            "marks_awarded": ans.get("marks_awarded", 0),
            "time_spent_sec": ans.get("time_spent_sec", 0),
            "is_marked_for_review": ans.get("is_marked_for_review", False),
            "was_answered": ans.get("selected_option_id") is not None,
        })

    try:
        total_questions_in_exam = (
            supabase.table("exam_questions")
            .select("id", count="exact")
            .eq("exam_id", attempt.get("exam_id", ""))
            .execute()
        ).count or len(enriched)
    except Exception:
        total_questions_in_exam = len(enriched)

    answered = sum(1 for a in enriched if a["was_answered"])
    correct = sum(1 for a in enriched if a["is_correct"])
    skipped = total_questions_in_exam - answered

    return {
        "attempt": attempt,
        "result": result,
        "answers": enriched,
        "summary": {
            "total_questions": total_questions_in_exam,
            "attempted": answered,
            "correct": correct,
            "incorrect": answered - correct,
            "skipped": skipped,
            "score": safe_dict(result).get("total_score", 0),
            "max_score": safe_dict(result).get("max_score", 0),
            "percentage": safe_dict(result).get("percentage", 0),
            "grade": safe_dict(result).get("grade", ""),
            "is_passed": safe_dict(result).get("is_passed", False),
            "is_published": safe_dict(result).get("is_published", False),
            "time_spent_sec": attempt.get("total_time_spent_sec", 0),
            "submission_type": attempt.get("submission_type", ""),
        },
    }


# ── Exam Results ──────────────────────────────────────────────────────────────

@router.get("/exam-results/{exam_id}")
async def get_exam_results(exam_id: UUID, _: dict = Depends(require_faculty)):
    """All results for a given exam with student info and rank."""
    supabase = get_supabase_admin()
    results = (
        supabase.table("results")
        .select("*,users(full_name,email),exams(title)")
        .eq("exam_id", str(exam_id))
        .order("percentage", desc=True)
        .execute().data
    ) or []
    for i, result in enumerate(results):
        result["rank"] = i + 1
    return results


# ── Publish Results ───────────────────────────────────────────────────────────

@router.post("/publish-results/{exam_id}")
async def publish_all_results(exam_id: UUID, _: dict = Depends(require_faculty)):
    """Publish all unpublished results for an exam and notify students."""
    supabase = get_supabase_admin()
    results = (
        supabase.table("results")
        .select("id,student_id,exams(title)")
        .eq("exam_id", str(exam_id))
        .eq("is_published", False)
        .execute().data
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
            "body": f"Results for {safe_dict(r.get('exams')).get('title', 'your exam')} have been published.",
        }
        for r in results
    ]
    if notifications:
        supabase.table("notifications").insert(notifications).execute()

    return {"message": f"Published {len(results)} results", "published": len(results)}


# ── Analytics ─────────────────────────────────────────────────────────────────

@router.get("/analytics/{exam_id}")
async def get_exam_analytics(exam_id: UUID, _: dict = Depends(require_faculty)):
    """
    Full analytics for a single exam (objective-only).
    Faculty sees all submitted results regardless of publish status.
    """
    supabase = get_supabase_admin()

    exam = _single_or_none(
        supabase.table("exams").select("*,courses(name,code)").eq("id", str(exam_id))
    )
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # results → users is valid; results has NO direct FK to students.
    # Fetch roll numbers separately via student_id (= user_id on students table).
    results = (
        supabase.table("results")
        .select("*,users(full_name,email)")
        .eq("exam_id", str(exam_id))
        .order("percentage", desc=True)
        .execute().data
    ) or []

    # Attach roll numbers — wrapped in try/except since table name may differ.
    roll_map: dict = {}
    if results:
        result_user_ids = list({r["student_id"] for r in results if r.get("student_id")})
        if result_user_ids:
            try:
                students_rows = (
                    supabase.table("students")
                    .select("user_id,roll_number")
                    .in_("user_id", result_user_ids)
                    .execute().data
                ) or []
                roll_map = {s["user_id"]: s.get("roll_number", "") for s in students_rows}
            except Exception:
                roll_map = {}
        for r in results:
            r["students"] = {"roll_number": roll_map.get(r.get("student_id"), "")}

    # Count registrations across all schedules
    schedules = (
        supabase.table("exam_schedules")
        .select("id")
        .eq("exam_id", str(exam_id))
        .execute().data
    ) or []
    schedule_ids = [s["id"] for s in schedules]

    total_registered = 0
    for s in schedules:
        cnt = (
            supabase.table("exam_registrations")
            .select("id", count="exact")
            .eq("exam_schedule_id", s["id"])
            .eq("status", "REGISTERED")
            .execute()
        )
        total_registered += cnt.count or 0

    empty_base = {
        "exam_id": str(exam_id),
        "exam_title": exam.get("title", ""),
        "course_name": safe_dict(exam.get("courses")).get("name", ""),
        "course_code": safe_dict(exam.get("courses")).get("code", ""),
        "total_marks": exam.get("total_marks", 0),
        "pass_marks": exam.get("pass_marks", 0),
        "duration_minutes": exam.get("duration_minutes", 0),
        "total_registered": total_registered,
        "total_appeared": 0,
        "passed": 0,
        "failed": 0,
        "average_score": 0,
        "average_percentage": 0,
        "pass_rate": 0,
        "highest_score": 0,
        "highest_scorer": None,
        "lowest_score": 0,
        "lowest_scorer": None,
        "median_score": 0,
        "grade_distribution": {},
        "score_distribution": [0] * 10,
        "score_labels": [f"{i * 10}–{(i + 1) * 10}%" for i in range(10)],
        "topic_performance": [],
        "question_performance": [],
        "topper_list": [],
    }

    if not results:
        return empty_base

    scores = [r["total_score"] for r in results]
    percentages = [float(r["percentage"] or 0) for r in results]
    passed_count = sum(1 for r in results if r.get("is_passed"))
    failed_count = len(results) - passed_count

    avg_score = round(sum(scores) / len(scores), 2)
    avg_pct = round(sum(percentages) / len(percentages), 2)
    pass_rate = round(passed_count / len(results) * 100, 2)

    highest_result = results[0]
    lowest_result = results[-1]

    sorted_scores = sorted(scores)
    n = len(sorted_scores)
    median = (
        sorted_scores[n // 2]
        if n % 2
        else (sorted_scores[n // 2 - 1] + sorted_scores[n // 2]) / 2
    )

    grade_dist = Counter(r.get("grade") for r in results if r.get("grade"))
    buckets = [0] * 10
    for r in results:
        bucket = min(int((float(r.get("percentage") or 0)) // 10), 9)
        buckets[bucket] += 1

    # Topper list (top 10)
    topper_list = []
    for i, r in enumerate(results[:10]):
        user = safe_dict(r.get("users"))
        student = safe_dict(r.get("students"))
        topper_list.append({
            "rank": i + 1,
            "name": user.get("full_name", "Unknown"),
            "roll_number": student.get("roll_number", ""),
            "score": r["total_score"],
            "percentage": float(r.get("percentage") or 0),
            "grade": r.get("grade", ""),
            "is_passed": r.get("is_passed", False),
        })

    # ── Question-wise performance ──────────────────────────────────────────────
    # FIX: exam_questions declared at this scope so topic aggregation can use it
    question_performance = []
    exam_questions = []

    try:
        exam_questions = (
            supabase.table("exam_questions")
            .select(
                "question_id,order_index,"
                "questions(question_text,question_type,marks,difficulty,"
                "options(id,option_text,is_correct))"
            )
            .eq("exam_id", str(exam_id))
            .order("order_index")
            .execute().data
        ) or []

        attempt_ids = []
        if schedule_ids:
            all_attempts = (
                supabase.table("exam_attempts")
                .select("id")
                .in_("exam_schedule_id", schedule_ids)
                .in_("status", ["SUBMITTED", "AUTO_SUBMITTED"])
                .execute().data
            ) or []
            attempt_ids = [a["id"] for a in all_attempts]

        if attempt_ids:
            answers = (
                supabase.table("student_answers")
                .select("question_id,is_correct,selected_option_id,marks_awarded")
                .in_("attempt_id", attempt_ids)
                .execute().data
            ) or []

            ans_by_q: dict = defaultdict(list)
            for a in answers:
                ans_by_q[a["question_id"]].append(a)

            for eq in exam_questions:
                q = safe_dict(eq.get("questions"))
                q_id = eq["question_id"]
                q_answers = ans_by_q.get(q_id, [])
                options = q.get("options") or []
                correct_options = [o for o in options if o.get("is_correct")]

                total_ans = len(q_answers)
                correct_ans = sum(1 for a in q_answers if a.get("is_correct"))
                skipped = len(attempt_ids) - total_ans

                option_dist = Counter(
                    a.get("selected_option_id") for a in q_answers if a.get("selected_option_id")
                )
                option_stats = [
                    {
                        "option_id": o["id"],
                        "option_text": o["option_text"],
                        "is_correct": o.get("is_correct", False),
                        "pick_count": option_dist.get(o["id"], 0),
                        "pick_pct": (
                            round(option_dist.get(o["id"], 0) / total_ans * 100, 1)
                            if total_ans > 0 else 0
                        ),
                    }
                    for o in options
                ]

                question_performance.append({
                    "question_id": q_id,
                    "order_index": eq.get("order_index", 0),
                    "question_text": q.get("question_text", ""),
                    "question_type": q.get("question_type", ""),
                    "marks": q.get("marks", 1),
                    "difficulty": q.get("difficulty", ""),
                    "correct_option_texts": [o["option_text"] for o in correct_options],
                    "total_attempted": total_ans,
                    "correct_count": correct_ans,
                    "incorrect_count": total_ans - correct_ans,
                    "skipped_count": skipped,
                    "accuracy_pct": round(correct_ans / total_ans * 100, 1) if total_ans > 0 else 0,
                    "option_distribution": option_stats,
                })
    except Exception as e:
        logger.warning("Analytics: question performance failed: %s", e)

    # ── Topic-wise performance ─────────────────────────────────────────────────
    # FIX: exam_questions is now in scope; removed the broken `if 'exam_questions' in dir()` guard
    topic_performance = []
    try:
        topic_data: dict = defaultdict(lambda: {"total": 0, "correct": 0, "difficulties": []})

        # Try question_topics table first for real topic names
        qt_map: dict = {}
        if exam_questions:
            q_ids = [eq["question_id"] for eq in exam_questions]
            try:
                qt_rows = (
                    supabase.table("question_topics")
                    .select("question_id,topic,difficulty")
                    .in_("question_id", q_ids)
                    .execute().data
                ) or []
                qt_map = {r["question_id"]: r for r in qt_rows}
            except Exception:
                pass  # table may not exist — fall back to difficulty grouping

        for qp in question_performance:
            qt = qt_map.get(qp["question_id"])
            topic_name = qt["topic"] if qt else (qp.get("difficulty") or "UNKNOWN")
            topic_data[topic_name]["total"] += qp["total_attempted"]
            topic_data[topic_name]["correct"] += qp["correct_count"]
            topic_data[topic_name]["difficulties"].append(
                (qt or {}).get("difficulty", qp.get("difficulty", "MEDIUM"))
            )

        topic_performance = [
            {
                "topic": topic,
                "question_count": sum(
                    1 for qp in question_performance
                    if (qt_map.get(qp["question_id"], {}).get("topic") or qp.get("difficulty") or "UNKNOWN") == topic
                ),
                "avg_accuracy": (
                    round(data["correct"] / data["total"] * 100, 1)
                    if data["total"] > 0 else 0
                ),
                "difficulty": (
                    Counter(data["difficulties"]).most_common(1)[0][0]
                    if data["difficulties"] else "MEDIUM"
                ),
            }
            for topic, data in sorted(topic_data.items())
        ]
    except Exception as e:
        logger.warning("Analytics: topic performance failed: %s", e)

    highest_user = safe_dict(highest_result.get("users"))
    lowest_user = safe_dict(lowest_result.get("users"))

    return {
        **empty_base,
        "total_appeared": len(results),
        "passed": passed_count,
        "failed": failed_count,
        "average_score": avg_score,
        "average_percentage": avg_pct,
        "pass_rate": pass_rate,
        "highest_score": max(scores),
        "highest_scorer": highest_user.get("full_name"),
        "lowest_score": min(scores),
        "lowest_scorer": lowest_user.get("full_name"),
        "median_score": median,
        "grade_distribution": dict(grade_dist),
        "score_distribution": buckets,
        "score_labels": [f"{i * 10}–{(i + 1) * 10}%" for i in range(10)],
        "topic_performance": topic_performance,
        "question_performance": question_performance,
        "topper_list": topper_list,
    }