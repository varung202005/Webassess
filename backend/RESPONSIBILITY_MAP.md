# Online Exam Portal — Backend vs Frontend Responsibility Map

## Legend
- 🔵 BACKEND only (you)
- 🟢 FRONTEND only (your teammate)  
- 🟡 BOTH (frontend sends the request, backend processes it)

---

## 1. Auth & Identity

| Feature | Who |
|---|---|
| Signup form UI | 🟢 FRONTEND |
| `supabase.auth.signUp()` call with `full_name` in metadata | 🟢 FRONTEND |
| Login form UI | 🟢 FRONTEND |
| `supabase.auth.signIn()` call | 🟢 FRONTEND |
| Token storage (localStorage / cookie) | 🟢 FRONTEND |
| Token refresh | 🟢 FRONTEND (Supabase SDK does it automatically) |
| Sync auth.users → public.users | 🔵 BACKEND (DB trigger — already done in Phase 1) |
| `GET /auth/me` — fetch profile + roles on app load | 🟡 BOTH |
| `POST /auth/assign-role` — Admin assigns role to user | 🟡 BOTH |
| Role-based route guarding (show/hide pages) | 🟢 FRONTEND |
| Role-based middleware (protect API) | 🔵 BACKEND |

---

## 2. User Management

| Feature | Who |
|---|---|
| User list table UI | 🟢 FRONTEND |
| `GET /users/` — fetch all users | 🔵 BACKEND |
| Profile edit form | 🟢 FRONTEND |
| `PATCH /users/me` — save profile changes | 🟡 BOTH |
| Profile photo upload to Supabase Storage | 🟢 FRONTEND (direct to Storage) |
| Save photo URL after upload | 🟡 BOTH (`PATCH /users/me` with `profile_photo` URL) |
| Activate / deactivate user buttons | 🟢 FRONTEND (button) |
| `PATCH /users/{id}/activate` or `/deactivate` | 🔵 BACKEND |

---

## 3. Departments & Courses

| Feature | Who |
|---|---|
| Department list UI | 🟢 FRONTEND |
| `GET /departments/` | 🔵 BACKEND |
| Department create/edit form | 🟢 FRONTEND |
| `POST /departments/` / `PATCH /departments/{id}` | 🟡 BOTH |
| Course list with department filter | 🟢 FRONTEND |
| `GET /courses/` with ?department_id= | 🔵 BACKEND |
| Course CRUD | 🟡 BOTH |

---

## 4. Question Bank

| Feature | Who |
|---|---|
| Question creation form (type selector, options builder) | 🟢 FRONTEND |
| `POST /questions/` (with options + topics in one call) | 🟡 BOTH |
| Question list with filters (type, difficulty, course) | 🟢 FRONTEND (renders) |
| `GET /questions/?course_id=&difficulty=` | 🔵 BACKEND |
| Edit question form | 🟢 FRONTEND |
| `PATCH /questions/{id}` | 🟡 BOTH |
| Soft delete (deactivate) button | 🟢 FRONTEND |
| `DELETE /questions/{id}` (sets is_active=FALSE) | 🔵 BACKEND |
| Correct answer marking UI | 🟢 FRONTEND |
| is_correct stored in question_options | 🔵 BACKEND |

---

## 5. Exam Management (Faculty Dashboard)

| Feature | Who |
|---|---|
| Exam creation form | 🟢 FRONTEND |
| `POST /exams/` | 🟡 BOTH |
| Exam status display (DRAFT/REVIEW/PUBLISHED badge) | 🟢 FRONTEND |
| Status transition buttons (Submit for Review, Publish) | 🟢 FRONTEND |
| `PATCH /exams/{id}/status` — validates transition | 🔵 BACKEND |
| Add questions to exam (drag-drop or select) | 🟢 FRONTEND |
| `POST /exams/{id}/questions` | 🟡 BOTH |
| Reorder questions (order_index) | 🟢 FRONTEND (drag-drop UI) |
| `PATCH /exam-questions` to save new order_index | 🟡 BOTH |
| Exam sections UI (create groups) | 🟢 FRONTEND |
| `POST /exam-sections/` | 🟡 BOTH |
| Exam rules form (tab limits, proctoring toggles) | 🟢 FRONTEND |
| `POST /exam-rules/` | 🟡 BOTH |

---

## 6. Scheduling & Registration

| Feature | Who |
|---|---|
| Schedule creation form (datetime picker, dept) | 🟢 FRONTEND |
| `POST /exam-schedules/` | 🟡 BOTH |
| Publish toggle switch | 🟢 FRONTEND |
| `PATCH /exam-schedules/{id}` with is_published=true | 🟡 BOTH |
| Auto-stamp published_at | 🔵 BACKEND (DB trigger) |
| Student sees available exams list | 🟢 FRONTEND |
| `GET /exam-schedules/?is_published=true` | 🔵 BACKEND |
| "Register" button | 🟢 FRONTEND |
| `POST /exam-registrations/` — validates window, dedup | 🔵 BACKEND |
| Check eligibility before showing "Start Exam" | 🔵 BACKEND (`GET /exam-registrations/eligibility/{id}`) |

---

## 7. Live Exam (Most Critical Section)

| Feature | Who |
|---|---|
| "Start Exam" button | 🟢 FRONTEND |
| `POST /exam-attempts/start` — creates attempt, validates | 🔵 BACKEND |
| Fetch exam questions for display | 🔵 BACKEND (`GET /exams/{id}/questions`) |
| Render MCQ / MSQ / TRUE_FALSE / text questions | 🟢 FRONTEND |
| Countdown timer display | 🟢 FRONTEND (JavaScript timer, NOT server) |
| Auto-save interval (every N seconds) | 🟢 FRONTEND (setInterval) |
| `POST /student-answers/save` — UPSERT answer | 🟡 BOTH |
| Navigate between questions | 🟢 FRONTEND |
| `POST /student-answers/navigate` — log navigation action | 🟡 BOTH |
| Mark for review checkbox | 🟢 FRONTEND |
| is_marked_for_review saved via `/save` | 🟡 BOTH |
| Question palette (answered/skipped/flagged colors) | 🟢 FRONTEND |
| Tab switch detection (visibilitychange event) | 🟢 FRONTEND |
| `POST /exam-attempts/{id}/log-event?event_type=TAB_SWITCH_WARNING` | 🟡 BOTH |
| Fullscreen enforcement and exit detection | 🟢 FRONTEND |
| `POST /exam-attempts/{id}/log-event?event_type=FULLSCREEN_EXIT` | 🟡 BOTH |
| "Submit" button | 🟢 FRONTEND |
| `POST /exam-attempts/submit` — grades + creates result | 🔵 BACKEND |
| Resume on reconnect (restore answers) | 🟢 FRONTEND (`GET /student-answers/{attempt_id}`) |

---

## 8. Proctoring

| Feature | Who |
|---|---|
| Request camera/mic (MediaDevices API) | 🟢 FRONTEND |
| Run face detection ML model (face-api.js etc.) | 🟢 FRONTEND |
| Send face detection result to backend | 🟡 BOTH (`POST /proctoring/face`) |
| Store face verification logs (append-only) | 🔵 BACKEND |
| Detect tab switches / fullscreen exits | 🟢 FRONTEND |
| `POST /proctoring/browser` — send cumulative counts | 🟡 BOTH |
| Audio noise detection (WebAudio API) | 🟢 FRONTEND |
| `POST /proctoring/audio` | 🟡 BOTH |
| Compute integrity score | 🔵 BACKEND (`POST /proctoring/summary/{attempt_id}`) |
| Proctor review dashboard (flagged students) | 🟢 FRONTEND |
| `GET /proctoring/flagged` | 🔵 BACKEND |
| Proctor sets verdict | 🟡 BOTH (`PATCH /proctoring/verdict/{attempt_id}`) |
| Hide all proctoring from students | 🔵 BACKEND (RLS + role check) |

---

## 9. Results & Grading

| Feature | Who |
|---|---|
| Auto-grade MCQ/TRUE_FALSE on submit | 🔵 BACKEND (grading_service.py) |
| Grading queue for subjective answers | 🟢 FRONTEND (renders list) |
| `GET /grading/pending/{exam_id}` | 🔵 BACKEND |
| Score input form (faculty) | 🟢 FRONTEND |
| `PATCH /grading/score` — save score + write audit log | 🔵 BACKEND |
| Grade recalculation after manual score | 🔵 BACKEND |
| Publish result toggle (Admin) | 🟢 FRONTEND |
| `PATCH /results/{id}/publish` + notify student | 🔵 BACKEND |
| Student scorecard page | 🟢 FRONTEND |
| `GET /results/my` (filtered to published) | 🔵 BACKEND |
| Exam analytics (pass rate, grade dist) | 🟢 FRONTEND (charts) |
| `GET /results/exam/{id}/stats` | 🔵 BACKEND |
| Re-evaluation request form | 🟢 FRONTEND |
| `POST /re-evaluation/` | 🟡 BOTH |
| Faculty resolves re-eval | 🟡 BOTH (`PATCH /re-evaluation/{id}`) |
| Notify student of re-eval resolution | 🔵 BACKEND (auto in PATCH handler) |

---

## 10. Notifications

| Feature | Who |
|---|---|
| Send notifications on key events | 🔵 BACKEND (auto inside endpoints) |
| Notification bell UI + unread count | 🟢 FRONTEND |
| Real-time new notifications | 🟢 FRONTEND (Supabase Realtime subscription) |
| `GET /notifications/?unread_only=true` | 🔵 BACKEND |
| Mark as read | 🟡 BOTH (`PATCH /notifications/{id}/read`) |

---

## 11. Audit & Admin

| Feature | Who |
|---|---|
| Audit logging on DB changes | 🔵 BACKEND (DB trigger — already done Phase 10) |
| `GET /audit-logs/` (Admin only) | 🔵 BACKEND |
| Admin dashboard stats card | 🟢 FRONTEND |
| `GET /admin/dashboard` | 🔵 BACKEND |
| Audit log viewer UI (table with filters) | 🟢 FRONTEND |

---

## Summary Counts

| Responsibility | Count |
|---|---|
| 🔵 Backend only | ~40 features |
| 🟢 Frontend only | ~35 features |
| 🟡 Both (shared) | ~25 features |

---

## Key Rules for Coordination

1. **Frontend calls Supabase Auth SDK directly** — login, signup, token refresh. Never goes through your backend for auth.
2. **Every protected backend call needs `Authorization: Bearer <token>`** — frontend always sends the Supabase JWT.
3. **Auto-save is frontend-driven** — setInterval every `auto_save_interval_sec` seconds, hits `POST /student-answers/save`.
4. **Timer is frontend-only** — backend does NOT track remaining time. Frontend submits when timer hits 0 with `submission_type=AUTO`.
5. **File uploads (profile photos, snapshots) go directly to Supabase Storage** from frontend — backend only stores the URL.
6. **Proctoring ML runs in the browser** — backend only receives the result, not raw video/audio.
7. **Supabase Realtime for notifications** — frontend subscribes to the `notifications` table for the current user. No polling needed.
