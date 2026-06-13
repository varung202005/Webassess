from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    users,
    departments,
    courses,
    questions,
    exams,
    exam_sections,
    exam_rules,
    exam_schedules,
    exam_registrations,
    exam_attempts,
    student_answers,
    grading,
    results,
    re_evaluation,
    proctoring,
    notifications,
    audit_logs,
    admin,
    student,
    faculty,
)

api_router = APIRouter()

# ── Auth ─────────────────────────────────────────────────────────────────────
api_router.include_router(auth.router,                  prefix="/auth",                tags=["Auth"])

# ── Users / Roles ────────────────────────────────────────────────────────────
api_router.include_router(users.router,                 prefix="/users",               tags=["Users"])

# ── Academics ────────────────────────────────────────────────────────────────
api_router.include_router(departments.router,           prefix="/departments",          tags=["Departments"])
api_router.include_router(courses.router,               prefix="/courses",              tags=["Courses"])

# ── Question Bank ────────────────────────────────────────────────────────────
api_router.include_router(questions.router,             prefix="/questions",            tags=["Questions"])

# ── Exam Management ──────────────────────────────────────────────────────────
api_router.include_router(exams.router,                 prefix="/exams",               tags=["Exams"])
api_router.include_router(exam_sections.router,         prefix="/exam-sections",        tags=["Exam Sections"])
api_router.include_router(exam_rules.router,            prefix="/exam-rules",           tags=["Exam Rules"])
api_router.include_router(exam_schedules.router,        prefix="/exam-schedules",       tags=["Exam Schedules"])
api_router.include_router(exam_registrations.router,    prefix="/exam-registrations",   tags=["Exam Registrations"])

# ── Live Exam ─────────────────────────────────────────────────────────────────
api_router.include_router(exam_attempts.router,         prefix="/exam-attempts",        tags=["Exam Attempts"])
api_router.include_router(student_answers.router,       prefix="/student-answers",      tags=["Student Answers"])

# ── Grading & Results ─────────────────────────────────────────────────────────
api_router.include_router(grading.router,               prefix="/grading",             tags=["Grading"])
api_router.include_router(results.router,               prefix="/results",             tags=["Results"])
api_router.include_router(re_evaluation.router,         prefix="/re-evaluation",        tags=["Re-Evaluation"])

# ── Proctoring ────────────────────────────────────────────────────────────────
api_router.include_router(proctoring.router,            prefix="/proctoring",           tags=["Proctoring"])

# ── Notifications ─────────────────────────────────────────────────────────────
api_router.include_router(notifications.router,         prefix="/notifications",        tags=["Notifications"])

# ── Student Portal ────────────────────────────────────────────────────────────
api_router.include_router(student.router,               prefix="/student",              tags=["Student Portal"])

# ── Faculty Portal ────────────────────────────────────────────────────────────
api_router.include_router(faculty.router,               prefix="/faculty",              tags=["Faculty Portal"])

# ── Admin / Audit ─────────────────────────────────────────────────────────────
api_router.include_router(audit_logs.router,            prefix="/audit-logs",           tags=["Audit Logs"])
api_router.include_router(admin.router,                 prefix="/admin",               tags=["Admin"])
