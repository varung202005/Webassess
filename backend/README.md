# Online Exam Portal — FastAPI Backend

## Tech Stack
- **Framework**: FastAPI + Uvicorn
- **Database**: Supabase (PostgreSQL) — 25 tables
- **Auth**: Supabase Auth (JWT verification via PyJWT)
- **Python**: 3.11+

## Project Structure

```
exam_portal/
├── app/
│   ├── main.py                     # FastAPI app, CORS, router mount
│   ├── core/
│   │   ├── config.py               # Settings from .env
│   │   └── security.py             # JWT decode, role guards (require_admin etc.)
│   ├── db/
│   │   └── supabase.py             # Admin + anon Supabase clients
│   ├── api/
│   │   └── v1/
│   │       ├── router.py           # Mounts all endpoint routers
│   │       └── endpoints/
│   │           ├── auth.py         # /auth — me, assign-role
│   │           ├── users.py        # /users — CRUD, activate
│   │           ├── departments.py  # /departments
│   │           ├── courses.py      # /courses
│   │           ├── questions.py    # /questions — question bank
│   │           ├── exams.py        # /exams — create, manage, status, questions
│   │           ├── exam_sections.py
│   │           ├── exam_rules.py
│   │           ├── exam_schedules.py
│   │           ├── exam_registrations.py  # eligibility check
│   │           ├── exam_attempts.py       # start, submit, log events, timeline
│   │           ├── student_answers.py     # auto-save UPSERT, navigate log
│   │           ├── grading.py             # manual grading queue + score update
│   │           ├── results.py             # publish, stats, my results
│   │           ├── re_evaluation.py
│   │           ├── proctoring.py          # face/browser/audio logs, summary, verdict
│   │           ├── notifications.py
│   │           ├── audit_logs.py
│   │           └── admin.py               # dashboard stats
│   └── services/
│       └── grading_service.py      # Auto-grade MCQ/TRUE_FALSE, calculate_grade()
├── requirements.txt
├── .env.example
├── .gitignore
└── RESPONSIBILITY_MAP.md           # Who does what: Backend vs Frontend
```

## Setup

### 1. Clone & create virtual environment
```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your Supabase credentials
```

Get these from **Supabase Dashboard → Settings → API**:
- `SUPABASE_URL` — your project URL
- `SUPABASE_SERVICE_ROLE_KEY` — service role key (NEVER expose to frontend)
- `SUPABASE_ANON_KEY` — anon/public key
- `SUPABASE_JWT_SECRET` — JWT secret (Settings → API → JWT Settings)

### 3. Run the server
```bash
uvicorn app.main:app --reload --port 8000
```

### 4. View API docs
Open: http://localhost:8000/api/v1/docs

---

## Authentication Flow

```
Frontend                          Backend
   │                                 │
   ├─ supabase.auth.signUp() ───────►│ (Supabase Auth — not your backend)
   │  (with metadata.full_name)      │
   │                                 │
   │  ◄─── DB trigger syncs ─────────┤ handle_new_user() → public.users
   │                                 │
   ├─ supabase.auth.signIn() ───────►│ (Supabase Auth)
   │  ◄─── JWT token ────────────────│
   │                                 │
   ├─ GET /api/v1/auth/me ──────────►│ Decode JWT, fetch profile + roles
   │  Authorization: Bearer <token>  │
   │  ◄─── { user, roles } ──────────│
```

Every subsequent API call must include:
```
Authorization: Bearer <supabase_access_token>
```

---

## Role Guards (used in endpoints)

| Guard | Allows |
|---|---|
| `require_admin` | Admin only |
| `require_faculty` | Admin + Faculty |
| `require_proctor` | Admin + Proctor |
| `require_student` | Student only |
| `require_any` | Any authenticated user |
| `get_current_user_with_roles` | Any — returns user + roles |

---

## Critical Design Rules (from DB Phase decisions)

1. **Never hard-delete questions** — use `is_active = FALSE`
2. **Always UPSERT student_answers** — never plain INSERT
3. **Log tables are append-only** — never UPDATE navigation_logs or submission_logs
4. **Timer lives in frontend** — backend does NOT track remaining time
5. **Students never see proctoring data** — role-checked in every proctoring endpoint
6. **Grading logs are immutable** — every score change is documented (change_reason required)
7. **Effective marks = COALESCE(marks_override, questions.marks)** — computed in Python
