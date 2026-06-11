# EXAM.TIET — Frontend (React + Vite)

Frontend scaffold for the Online Examination Portal, built around the
finalized Postgres ERD (`online_exam_portal_erd_v3.html`) and
`RESPONSIBILITY_MAP.md`. The 12 high-fidelity HTML mockups you supplied
have been converted into routed React pages so the whole app can be
clicked through end-to-end.

## 1. Color system — strict Red & White

Every page now pulls from a **single** token file:
`src/styles/tokens.css`. All Navy (`--c-navy-*`), Blue (`--c-blue-*`) and
Purple (`--c-purple-*`) variables that appeared in
`faculty-dashboard.html`, `live-exam.html` and `question-bank.html` have
been **remapped to the Deep Academic Red primary scale** (or removed), so
the whole app is now strictly Red + White/Gray + status colors:

| Token | Hex | Use |
|---|---|---|
| `--c-primary-900` | `#6B0A1F` | Darkest accents |
| `--c-primary-800` | `#9D102D` | Hover states |
| `--c-primary-700` | `#B31234` | Sidebar, primary buttons, brand |
| `--c-primary-600` | `#C41E3A` | Links, active states |
| `--c-primary-100` | `#FDE8EC` | Soft tints / badges |
| `--c-primary-50`  | `#FEF4F6` | Subtle backgrounds |
| `--c-gray-50…900` | … | Neutrals, text, borders |
| `--c-success/warning/danger-*` | … | Status colors |

Do not reintroduce navy/blue/purple tokens — extend the primary or gray
scales instead.

## 2. Sitemap / Routes

| Route | Page | Role |
|---|---|---|
| `/login` | Login | Public |
| `/student/dashboard` | Student Dashboard | STUDENT |
| `/student/exams` | Available Exams | STUDENT |
| `/student/registered` | Registered Exams *(placeholder)* | STUDENT |
| `/student/history` | Exam History *(placeholder)* | STUDENT |
| `/student/results` | Results | STUDENT |
| `/exam/live` | Live Exam (full-screen) | STUDENT |
| `/faculty/dashboard` | Faculty Dashboard | FACULTY |
| `/faculty/question-bank` | Question Bank | FACULTY |
| `/faculty/create-exam` | Exam Creation Wizard | FACULTY |
| `/faculty/evaluation` | Evaluation / Re-evaluation | FACULTY |
| `/faculty/analytics` | Analytics (Chart.js) | FACULTY |
| `/proctor/dashboard` | Proctor Dashboard | PROCTOR |
| `/admin/dashboard` | Admin Dashboard | ADMIN |

Route table lives in `src/routes/routes.ts`. Role guarding is in
`src/routes/ProtectedRoute.tsx`.

### Reviewing the build without a backend
A **dev navigation rail** is pinned to the bottom of every screen
(`src/components/DevNav.tsx`). Click **"Login as STUDENT / FACULTY /
PROCTOR / ADMIN"** to set a mock session in the Zustand auth store, then
jump to any route. Remove `<DevNav />` from `App.tsx` before shipping.

## 3. How the mockups were converted

Each original `*.html` mockup was split into:
- `<style>` → page-scoped CSS (rendered via `<style>` in the component)
- `<body>` → page markup (rendered via `dangerouslySetInnerHTML`)
- `<script>` → page-scoped vanilla JS (re-injected via a `<script>` tag
  on mount)

…and wrapped by `src/components/LegacyPage.tsx`. All cross-page
`location.href` / `onclick` navigation was rewritten to the new SPA
routes (e.g. `faculty-dashboard.html` → `/faculty/dashboard`).

**This is a starting point, not the final architecture.** Per the
"Phase-wise Build Plan" below, each `LegacyPage` should be progressively
broken down into:
- `features/<domain>/components/*` — real React components (replace
  `dangerouslySetInnerHTML` blocks)
- `features/<domain>/api.ts` — TanStack Query hooks calling
  `src/lib/api.ts`
- `features/<domain>/types.ts` — types generated from the ERD tables
- Forms → React Hook Form + Zod (see `faculty-create-exam` wizard,
  `question-bank` create-question form)

## 4. API integration (summary)

Full detail in `RESPONSIBILITY_MAP.md`. Key points wired into the
scaffold:

- `src/lib/supabase.ts` — Supabase Auth/Realtime client placeholder.
  `npm install @supabase/supabase-js` and uncomment to activate. Frontend
  calls `supabase.auth.signInWithPassword()` / `signUp()` directly —
  **never** through the backend.
- `src/lib/api.ts` — typed `fetch` wrapper that attaches
  `Authorization: Bearer <token>` from `useAuthStore` to every backend
  call (`GET/POST/PATCH/DELETE` helpers).
- `src/store/authStore.ts` — Zustand store holding `user`, `activeRole`,
  `token`. Populate from `GET /auth/me` after Supabase sign-in.

| Page | Primary endpoints |
|---|---|
| Student Dashboard | `GET /exam-schedules/?is_published=true`, `GET /notifications/?unread_only=true`, `GET /results/my` |
| Available Exams | `GET /exam-schedules/?is_published=true`, `GET /exam-registrations/eligibility/{id}`, `POST /exam-registrations/` |
| Live Exam | `POST /exam-attempts/start`, `GET /exams/{id}/questions`, `POST /student-answers/save`, `POST /student-answers/navigate`, `POST /exam-attempts/{id}/log-event`, `POST /exam-attempts/submit`, proctoring: `POST /proctoring/face|browser|audio` |
| Results | `GET /results/my`, `POST /re-evaluation/` |
| Faculty Dashboard | `GET /exams/?created_by=me`, `GET /grading/pending/{exam_id}`, `GET /re-evaluation/?status=PENDING` |
| Question Bank | `GET /questions/?course_id=&difficulty=`, `POST /questions/`, `PATCH /questions/{id}`, `DELETE /questions/{id}` |
| Create Exam (wizard) | `POST /exams/`, `POST /exam-sections/`, `POST /exams/{id}/questions`, `POST /exam-rules/`, `PATCH /exams/{id}/status`, `POST /exam-schedules/` |
| Evaluation | `GET /grading/pending/{exam_id}`, `PATCH /grading/score`, `PATCH /re-evaluation/{id}` |
| Analytics | `GET /results/exam/{id}/stats` |
| Proctor Dashboard | `GET /proctoring/flagged`, `PATCH /proctoring/verdict/{attempt_id}` |
| Admin Dashboard | `GET /admin/dashboard`, `GET /users/`, `GET /departments/`, `GET /courses/`, `GET /audit-logs/` |

## 5. Folder structure

```
src/
├── components/      # LegacyPage, PlaceholderPage, DevNav, shared UI
├── lib/              # api.ts (REST), supabase.ts (auth)
├── pages/
│   ├── auth/         # Login
│   ├── student/      # Dashboard, AvailableExams, Results, Registered, History
│   ├── faculty/       # Dashboard, QuestionBank, CreateExam, Evaluation, Analytics
│   ├── proctor/       # Dashboard
│   ├── admin/          # Dashboard
│   └── exam/            # LiveExam (full-screen)
├── routes/            # routes.ts, ProtectedRoute.tsx
├── store/              # authStore.ts (Zustand)
├── styles/              # tokens.css, base.css
├── App.tsx
└── main.tsx
```

## 6. Getting started

```bash
npm install
cp .env.example .env   # fill in Supabase + API URL
npm run dev
```

Build: `npm run build` · Preview: `npm run preview`

> SPA routing: configure your host to fall back to `index.html` for all
> paths (Netlify `_redirects: /* /index.html 200`, Vercel rewrites, or
> nginx `try_files $uri /index.html`).

## 7. Phase-wise build plan (suggested)

1. **Auth** — wire Supabase, `GET /auth/me`, role-based redirect after
   login (replace hardcoded redirect in `pages/auth/Login.tsx`).
2. **Shells** — extract a shared `AppShell` (Sidebar/Header/Notifications)
   from the duplicated markup in each `LegacyPage` into
   `src/layouts/AppShell.tsx`; keep per-role nav config.
3. **Student flow** — Available Exams → Registration → Live Exam →
   Results, backed by React Query.
4. **Faculty flow** — Question Bank CRUD (React Hook Form + Zod) → Exam
   Wizard (`exams`, `exam_sections`, `exam_questions`, `exam_rules`) →
   Scheduling → Evaluation → Analytics (Recharts, replacing the Chart.js
   CDN usage in `faculty/Analytics.tsx`).
5. **Proctor** — flagged attempts list, verdict actions, integrity score
   visualizations.
6. **Admin** — users/roles/departments/courses CRUD tables, audit log
   viewer, system settings.
7. **Hardening** — loading/empty/error states for every data table,
   pagination + filters + export, accessibility pass, code-splitting
   (the current bundle is ~530KB — split per-route with
   `React.lazy`).
