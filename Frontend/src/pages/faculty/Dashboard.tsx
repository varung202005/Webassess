/**
 * Dashboard.tsx — Faculty Dashboard
 *
 * Publish button behaviour:
 *   • Calls ONLY: PATCH /api/v1/exams/{id}  →  { status: "PUBLISHED" }
 *   • Does NOT touch exam-schedules — the schedule was already created
 *     (with is_published: false) when the faculty completed the Create Exam
 *     wizard. Visibility to students is controlled purely by exam.status.
 *
 * Unpublish button behaviour:
 *   • Calls ONLY: PATCH /api/v1/exams/{id}/status  →  { status: "DRAFT" }
 *   • Hides the exam from students again without touching schedules/data.
 *
 * "Remove from list" (✕) behaviour:
 *   • CLIENT-SIDE ONLY. Stores the exam id in localStorage under
 *     "faculty-hidden-exams" and filters it out of THIS dashboard widget.
 *   • Does NOT call any delete endpoint. The exam, its questions, schedules,
 *     attempts, results, and analytics are completely untouched and remain
 *     fully visible/functional in Evaluation, Analytics, Results, etc.
 *   • Restorable any time via the "Show N removed" toggle at the bottom of
 *     the My Exams panel.
 *   • Scoped per-browser (localStorage) — if cross-device persistence is
 *     ever needed, replace with a `hidden_from_dashboard` field on the exam
 *     and a small PATCH call instead of localStorage.
 *
 * Drop this file at:  src/pages/faculty/Dashboard.tsx
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import FacultyLayout from "../../features/faculty/FacultyLayout";
import { PageState, StatsRow } from "../../features/faculty/components";
import { useFacultyDashboard, QUERY_KEYS } from "../../features/faculty/hooks";
import { facultyApi } from "../../features/faculty/api";
import { formatDate, formatTime, relativeTime, statusBadgeClass, statusLabel } from "../../features/faculty/format";
import type { ExamSchedule, FacultyDashboard } from "../../features/faculty/types";
import CandidateManager from "./CandidateManager";

function initials(name: string) {
  return name?.split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 2) ?? "F";
}

function apiMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err ?? "Unknown error");
}

/* ── Hidden exams (dashboard-only, client-side) ─────────────
 * Purely cosmetic list-declutter. Never sent to the backend and never
 * affects Evaluation / Analytics / Results, which all fetch by examId. */
const HIDDEN_EXAMS_KEY = "faculty-hidden-exams";

function getHiddenExamIds(): string[] {
  try {
    const raw = localStorage.getItem(HIDDEN_EXAMS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setHiddenExamIds(ids: string[]) {
  try {
    localStorage.setItem(HIDDEN_EXAMS_KEY, JSON.stringify(ids));
  } catch {
    // localStorage unavailable — fail silently, hiding just won't persist
  }
}

/* ── Session Banner ────────────────────────────────────── */
function SessionBanner({ sessions }: { sessions: FacultyDashboard["activeSessions"] }) {
  if (!sessions || sessions.length === 0) return null;
  const s = sessions[0];
  const endsIn = s.ends_at
    ? (() => {
        const diff = new Date(s.ends_at).getTime() - Date.now();
        if (diff <= 0) return "Ending now";
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        return `Ends in ${h}h ${m}m`;
      })()
    : "";
  return (
    <div className="session-banner">
      <i className="ti ti-device-desktop-analytics session-banner-icon" />
      <div className="session-banner-info">
        <div className="session-banner-title">{s.exam_title} — {s.course_code}</div>
        <div className="session-banner-sub">{s.active_students} students in progress · {endsIn}</div>
      </div>
      <div className="session-live-badge">
        <div className="live-dot" /> LIVE
      </div>
      <button
        className="btn btn-sm"
        style={{ background: "rgba(255,255,255,0.12)", color: "#fff", borderColor: "rgba(255,255,255,0.2)", flexShrink: 0 }}
        onClick={() => window.location.hash = "#/faculty/evaluation"}
      >
        <i className="ti ti-eye" /> Monitor
      </button>
    </div>
  );
}

/* ── Stats ──────────────────────────────────────────────── */
function DashboardStats({ portal }: { portal: FacultyDashboard }) {
  return (
    <StatsRow
      items={[
        { label: "Total Questions", value: portal.questionStats?.total ?? 0, icon: "ti ti-books", meta: `${portal.questionStats?.active ?? 0} active` },
        { label: "Active Exams", value: portal.examCounts?.total ?? 0, icon: "ti ti-file-description", meta: `${portal.examCounts?.published ?? 0} published · ${portal.examCounts?.draft ?? 0} draft` },
        { label: "Pending Grading", value: portal.pendingGrading ?? 0, icon: "ti ti-clock", color: "warning", meta: "Subjective answers awaiting review" },
        { label: "Re-evaluations", value: portal.pendingReevaluations ?? 0, icon: "ti ti-refresh-alert", color: "danger", meta: "Awaiting review" },
      ]}
    />
  );
}

/* ── Exams Table ────────────────────────────────────────── */
/*
 * Publish flow — single API call:
 *   PATCH /api/v1/exams/{examId}  →  { status: "PUBLISHED" }
 *
 * Unpublish flow — single API call:
 *   PATCH /api/v1/exams/{examId}/status  →  { status: "DRAFT" }
 *
 * The schedule already exists (created during wizard Step 4).
 * We do NOT touch exam-schedules here — student visibility is
 * driven entirely by exam.status === "PUBLISHED".
 *
 * "Remove from list" is client-side only (see HIDDEN_EXAMS_KEY above) —
 * it never calls the backend and never affects any other page.
 */
function ExamsTable({
  exams,
  onView,
  onPublished,
}: {
  exams: FacultyDashboard["recentExams"];
  onView: (id: string) => void;
  onPublished: () => void;
}) {
  const navigate = useNavigate();
  const [publishing, setPublishing] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [hiddenIds, setHiddenIdsState] = useState<string[]>(() => getHiddenExamIds());
  const [showHidden, setShowHidden] = useState(false);

  const handlePublish = async (exam: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setPublishError(null);
    setPublishing(exam.id);
    try {
      await facultyApi.updateExam(exam.id, { status: "PUBLISHED" });
      onPublished();
    } catch (err) {
      setPublishError(apiMsg(err));
    } finally {
      setPublishing(null);
    }
  };

  const handleUnpublish = async (exam: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Unpublish "${exam.title}"? Students will no longer be able to see or attempt it.`)) return;
    setPublishError(null);
    setPublishing(exam.id);
    try {
      await facultyApi.updateExam(exam.id, { status: "DRAFT" });
      onPublished();
    } catch (err) {
      setPublishError(apiMsg(err));
    } finally {
      setPublishing(null);
    }
  };

  const handleEdit = (exam: any, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/faculty/create-exam?examId=${exam.id}&edit=true`);
  };

  const handleHide = (exam: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = [...hiddenIds, exam.id];
    setHiddenExamIds(next);
    setHiddenIdsState(next);
  };

  const handleUnhide = (examId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = hiddenIds.filter((id) => id !== examId);
    setHiddenExamIds(next);
    setHiddenIdsState(next);
  };

  if (!exams || exams.length === 0) {
    return (
      <div className="panel-body">
        <div className="empty-state" style={{ padding: "30px 20px" }}>
          <i className="ti ti-file-description" />
          <div className="empty-state-title">No exams yet</div>
          <div className="empty-state-text">Create your first exam to get started.</div>
        </div>
      </div>
    );
  }

  const visibleExamsAll = exams.filter((e) => !hiddenIds.includes(e.id));
  const hiddenExams = exams.filter((e) => hiddenIds.includes(e.id));
  const displayedExams = showAll ? visibleExamsAll : visibleExamsAll.slice(0, 5);

  return (
    <>
      {publishError && (
        <div
          style={{
            margin: "0 16px 8px",
            padding: "8px 12px",
            background: "#fde8ec",
            color: "#a30f2e",
            borderRadius: 7,
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <i className="ti ti-alert-circle" /> {publishError}
        </div>
      )}

      {visibleExamsAll.length === 0 ? (
        <div className="panel-body">
          <div className="empty-state" style={{ padding: "30px 20px" }}>
            <i className="ti ti-eye-off" />
            <div className="empty-state-title">All exams removed from this list</div>
            <div className="empty-state-text">They're still fully active everywhere else.</div>
            {hiddenExams.length > 0 && (
              <button className="btn btn-sm btn-secondary" style={{ marginTop: 12 }} onClick={() => setShowHidden(true)}>
                <i className="ti ti-eye" /> Show {hiddenExams.length} removed
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="data-table-wrap" style={{ maxHeight: showAll ? 480 : "none", overflowY: showAll ? "auto" : "visible" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Exam</th>
                <th>Status</th>
                <th>Questions</th>
                <th>Duration</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {displayedExams.map((exam) => {
                const isDraft = exam.status === "DRAFT" || !exam.status;
                const isPublished = exam.status === "PUBLISHED";
                const isBusy = publishing === exam.id;
                return (
                  <tr key={exam.id}>
                    <td>
                      <div className="table-exam-name">{exam.title}</div>
                      <div className="table-exam-meta">{exam.courses?.code} · {exam.courses?.name}</div>
                    </td>
                    <td>
                      <span className={`badge ${statusBadgeClass(exam.status)}`}>
                        {statusLabel(exam.status)}
                      </span>
                    </td>
                    <td>{exam.questions_count ?? "-"}</td>
                    <td>{exam.duration_minutes ? `${exam.duration_minutes} min` : "-"}</td>
                    <td style={{ fontSize: "12.5px" }}>
                      {exam.updated_at ? formatDate(exam.updated_at) : "-"}
                    </td>
                    <td>
                      <div className="table-actions" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {isDraft && (
                          <button
                            className="btn btn-sm btn-primary"
                            disabled={isBusy}
                            onClick={(e) => handlePublish(exam, e)}
                            title="Publish exam — makes it visible to students"
                            style={{ whiteSpace: "nowrap" }}
                          >
                            {publishing === exam.id ? (
                              <><span className="spinner-sm" /> Publishing…</>
                            ) : (
                              <><i className="ti ti-send" /> Publish</>
                            )}
                          </button>
                        )}
                        {isPublished && (
                          <button
                            className="btn btn-sm btn-secondary"
                            disabled={isBusy}
                            onClick={(e) => handleUnpublish(exam, e)}
                            title="Unpublish — hide from students, keeps all data intact"
                            style={{ whiteSpace: "nowrap" }}
                          >
                            {publishing === exam.id ? (
                              <><span className="spinner-sm" /> …</>
                            ) : (
                              <><i className="ti ti-eye-off" /> Unpublish</>
                            )}
                          </button>
                        )}
                        <button
                          className="action-btn"
                          data-tip="Edit"
                          onClick={(e) => handleEdit(exam, e)}
                          title="Edit exam"
                          disabled={isBusy}
                        >
                          <i className="ti ti-pencil" />
                        </button>
                        <button
                          className="action-btn primary"
                          data-tip="View"
                          onClick={() => onView(exam.id)}
                          title="View / Grade"
                        >
                          <i className="ti ti-eye" />
                        </button>
                        <button
                          className="action-btn"
                          data-tip="Remove from list"
                          onClick={(e) => handleHide(exam, e)}
                          title="Remove from this list only — exam, results, and analytics stay fully intact"
                          style={{ color: "#a30f2e" }}
                        >
                          <i className="ti ti-x" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(visibleExamsAll.length > 5 || hiddenExams.length > 0) && (
        <div style={{ padding: "10px 17px", borderTop: "1px solid #eceef2", display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          {visibleExamsAll.length > 5 && (
            <button className="btn btn-sm btn-secondary" style={{ flex: 1, minWidth: 160 }} onClick={() => setShowAll((p) => !p)}>
              {showAll ? (
                <><i className="ti ti-chevron-up" /> Show less</>
              ) : (
                <><i className="ti ti-chevron-down" /> Show all {visibleExamsAll.length} exams</>
              )}
            </button>
          )}
          {hiddenExams.length > 0 && (
            <button className="btn btn-sm btn-secondary" style={{ flex: 1, minWidth: 160 }} onClick={() => setShowHidden((p) => !p)}>
              <i className="ti ti-eye" /> {showHidden ? "Hide" : "Show"} {hiddenExams.length} removed
            </button>
          )}
        </div>
      )}

      {showHidden && hiddenExams.length > 0 && (
        <div style={{ padding: "10px 17px", borderTop: "1px solid #eceef2" }}>
          {hiddenExams.map((exam) => (
            <div key={exam.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}>
              <span style={{ color: "#6e7280" }}>
                {exam.title} <span className={`badge ${statusBadgeClass(exam.status)}`} style={{ marginLeft: 6, fontSize: 10 }}>{statusLabel(exam.status)}</span>
              </span>
              <button className="btn btn-sm btn-secondary" onClick={(e) => handleUnhide(exam.id, e)}>
                <i className="ti ti-arrow-back-up" /> Restore
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ── Upcoming Schedules ────────────────────────────────── */
function UpcomingSchedules({ schedules }: { schedules: FacultyDashboard["upcomingSchedules"] }) {
  if (!schedules || schedules.length === 0) {
    return (
      <div className="panel" style={{ margin: 0 }}>
        <div className="panel-header"><div className="card-title"><i className="ti ti-calendar-event" /> Upcoming Exams</div></div>
        <div className="panel-body">
          <div className="empty-state" style={{ padding: "30px 20px" }}>
            <i className="ti ti-calendar" />
            <div className="empty-state-title">No upcoming exams</div>
            <div className="empty-state-text">Create and publish an exam to see it here.</div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="panel" style={{ margin: 0 }}>
      <div className="panel-header">
        <div className="card-title"><i className="ti ti-calendar-event" /> Upcoming Exams</div>
        <span className="card-action">View all</span>
      </div>
      <div className="schedule-list">
        {schedules.map((s) => {
          const start = s.start_time ? new Date(s.start_time) : null;
          const end = s.end_time ? new Date(s.end_time) : null;
          const now = new Date();
          const isLive = start && end && start <= now && end >= now;
          return (
            <div className="schedule-item" key={s.id}>
              <div className="schedule-date">
                <div className="day">{start?.getDate()}</div>
                <div className="month">{start?.toLocaleString("default", { month: "short" })}</div>
              </div>
              <div className="schedule-divider" />
              <div className="schedule-info">
                <div className="schedule-name">{s.exams?.title ?? s.id}</div>
                <div className="schedule-meta">
                  {start && <span className="schedule-meta-item"><i className="ti ti-clock" /> {formatTime(start.toISOString())}</span>}
                  {s.departments?.name && <span className="schedule-meta-item"><i className="ti ti-building" /> {s.departments.name}</span>}
                </div>
              </div>
              {isLive ? (
                <span className="session-live-badge" style={{ fontSize: "10px", padding: "2px 7px" }}>
                  <div className="live-dot" /> LIVE
                </span>
              ) : (
                <span className="badge badge-published">Scheduled</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Candidate Assessments ────────────────────────────── */
function CandidateAssessments({
  schedules,
  onManage,
}: {
  schedules: FacultyDashboard["upcomingSchedules"];
  onManage: (schedule: ExamSchedule) => void;
}) {
  const entranceSchedules = (schedules ?? []).filter((schedule) => {
    const exam = schedule.exams;
    return exam?.exam_type === "ENTRANCE" && exam?.status === "PUBLISHED";
  });

  return (
    <div className="panel" style={{ margin: 0 }}>
      <div className="panel-header">
        <div className="card-title"><i className="ti ti-users-plus" /> Candidate Assessments</div>
      </div>

      {entranceSchedules.length === 0 ? (
        <div className="panel-body">
          <div className="empty-state" style={{ padding: "30px 20px" }}>
            <i className="ti ti-user-plus" />
            <div className="empty-state-title">No entrance assessment ready</div>
            <div className="empty-state-text">Create and publish an entrance exam schedule to upload candidate CSVs.</div>
          </div>
        </div>
      ) : (
        <div className="candidate-assessment-list">
          {entranceSchedules.map((schedule) => {
            const start = schedule.start_time ? new Date(schedule.start_time) : null;
            const end = schedule.end_time ? new Date(schedule.end_time) : null;
            return (
              <div className="candidate-assessment-item" key={schedule.id}>
                <div className="candidate-assessment-main">
                  <div className="candidate-assessment-title">{schedule.exams?.title ?? "Entrance Assessment"}</div>
                  <div className="candidate-assessment-meta">
                    {start && <span>{formatDate(start.toISOString())} at {formatTime(start.toISOString())}</span>}
                    {end && <span>Ends {formatTime(end.toISOString())}</span>}
                    <span>{schedule.candidate_count ?? 0} candidates</span>
                  </div>
                </div>
                <span className="badge badge-published">Entrance</span>
                <button className="btn btn-sm btn-primary" onClick={() => onManage(schedule)}>
                  <i className="ti ti-upload" /> Manage Candidates
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Grading Queue ─────────────────────────────────────── */
function GradingQueue({ queue, onNavigate }: { queue: FacultyDashboard["gradingQueue"]; onNavigate: (examId: string) => void }) {
  if (!queue || queue.length === 0) {
    return (
      <div className="panel" style={{ margin: 0 }}>
        <div className="panel-header"><div className="card-title"><i className="ti ti-writing" /> Grading Queue</div></div>
        <div className="panel-body">
          <div className="empty-state" style={{ padding: "30px 20px" }}>
            <i className="ti ti-circle-check" />
            <div className="empty-state-title">All graded!</div>
            <div className="empty-state-text">No pending subjective answers.</div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="panel" style={{ margin: 0 }}>
      <div className="panel-header">
        <div className="card-title"><i className="ti ti-writing" /> Grading Queue</div>
        <span className="badge badge-pending">{queue.reduce((a, b) => a + b.pending_count, 0)} pending</span>
      </div>
      <div>
        {queue.map((item) => (
          <div className="grading-item" key={item.exam_id} onClick={() => onNavigate(item.exam_id)}>
            <div className="grading-course-badge">{item.course_code}</div>
            <div className="grading-info">
              <div className="grading-name">{item.exam_title}</div>
              <div className="grading-count">{item.pending_count} ungraded · {item.question_type}</div>
            </div>
            <div className="grading-action">
              <button className="btn btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); onNavigate(item.exam_id); }}>
                Grade
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Pass Rates ─────────────────────────────────────────── */
function PassRateSection({ exams }: { exams: FacultyDashboard["recentExams"] }) {
  if (!exams || exams.length === 0) return null;
  return (
    <div className="panel">
      <div className="panel-header"><div className="card-title"><i className="ti ti-chart-bar" /> Exams Overview</div></div>
      <div style={{ padding: "12px 17px" }}>
        {exams.slice(0, 6).map((exam) => {
          const pct = exam.total_marks ? Math.min(100, (exam.pass_marks / exam.total_marks) * 100) : 0;
          const barColor = pct >= 40 ? "#10B981" : pct >= 30 ? "#F59E0B" : "#EF4444";
          return (
            <div className="progress-row" key={exam.id}>
              <div className="progress-label">{exam.courses?.code ?? "Exam"} {exam.title?.slice(0, 20)}</div>
              <div className="progress-bar-wrap">
                <div className="progress-bar" style={{ width: `${pct}%`, background: barColor }} />
              </div>
              <div className="progress-val">{exam.total_marks ?? "-"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Re-evaluation Requests ────────────────────────────── */
function ReevalSection({ requests }: { requests: FacultyDashboard["reevaluationRequests"] }) {
  if (!requests || requests.length === 0) {
    return (
      <div className="panel">
        <div className="panel-header"><div className="card-title"><i className="ti ti-refresh-alert" /> Re-evaluation Requests</div></div>
        <div className="panel-body">
          <div className="empty-state" style={{ padding: "30px 20px" }}>
            <i className="ti ti-circle-check" />
            <div className="empty-state-title">No pending re-evaluations</div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="panel">
      <div className="panel-header">
        <div className="card-title"><i className="ti ti-refresh-alert" /> Re-evaluation Requests</div>
        <span className="badge badge-pending">{requests.length} pending</span>
      </div>
      <div>
        {requests.map((r) => (
          <div className="re-eval-item" key={r.id}>
            <div>
              <div className="re-eval-student">{(r.users as any)?.full_name ?? "Unknown"}</div>
              <div className="re-eval-meta">{(r.results as any)?.exams?.title ?? ""} · Score: {(r.results as any)?.total_score ?? "-"}</div>
            </div>
            <div className="re-eval-reason">"{r.reason?.slice(0, 40)}{r.reason && r.reason.length > 40 ? "…" : ""}"</div>
            <span className="badge badge-pending" style={{ flexShrink: 0, marginLeft: "auto" }}>Pending</span>
          </div>
        ))}
      </div>
      <div style={{ padding: "10px 17px", borderTop: "1px solid #eceef2", textAlign: "center" }}>
        <button className="btn btn-sm btn-secondary" style={{ width: "100%" }} onClick={() => window.location.hash = "#/faculty/reevaluations"}>
          <i className="ti ti-list-check" /> Review All Requests
        </button>
      </div>
    </div>
  );
}

/* ── Recent Activity ────────────────────────────────────── */
function RecentActivity({ notifications }: { notifications: FacultyDashboard["notifications"] }) {
  if (!notifications || notifications.length === 0) {
    return (
      <div className="panel">
        <div className="panel-header"><div className="card-title"><i className="ti ti-activity" /> Recent Activity</div></div>
        <div className="panel-body">
          <div className="empty-state" style={{ padding: "30px 20px" }}>
            <i className="ti ti-bell" />
            <div className="empty-state-title">No recent activity</div>
          </div>
        </div>
      </div>
    );
  }
  const iconClassMap: Record<string, string> = {
    RESULT_PUBLISHED: "ti ti-circle-check",
    EXAM_CREATED: "ti ti-file-plus",
    EXAM_SCHEDULED: "ti ti-calendar-plus",
    GRADING_COMPLETE: "ti ti-writing",
    REEVALUATION_REQUESTED: "ti ti-refresh-alert",
    REEVALUATION_RESOLVED: "ti ti-check",
  };
  const colorMap: Record<string, string> = {
    RESULT_PUBLISHED: "green", EXAM_CREATED: "blue", EXAM_SCHEDULED: "amber",
    GRADING_COMPLETE: "green", REEVALUATION_REQUESTED: "red", REEVALUATION_RESOLVED: "green",
  };
  return (
    <div className="panel">
      <div className="panel-header"><div className="card-title"><i className="ti ti-activity" /> Recent Activity</div></div>
      <div className="activity-list">
        {notifications.map((n) => (
          <div className="activity-item" key={n.id}>
            <div className={`activity-icon ${colorMap[n.type] ?? "blue"}`}>
              <i className={iconClassMap[n.type] ?? "ti ti-bell"} />
            </div>
            <div className="activity-body">
              <div className="activity-text">{n.title}</div>
              {n.body && <div style={{ fontSize: "12px", color: "#6e7280", marginTop: 2 }}>{n.body}</div>}
              <div className="activity-time">{relativeTime(n.created_at)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Dashboard Page ─────────────────────────────────────── */
export default function Dashboard() {
  const { data: portal, isLoading, isError, error, refetch } = useFacultyDashboard();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [candidateSchedule, setCandidateSchedule] = useState<ExamSchedule | null>(null);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboard });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.exams() });
  };

  return (
    <FacultyLayout activePage="dashboard">
      <PageState loading={isLoading} error={isError ? error : undefined} onRetry={() => refetch()}>
        {portal && (
          <>
            <SessionBanner sessions={portal.activeSessions} />
            <div className="page-heading">
              <div>
                <h1>Faculty Dashboard</h1>
                <p>{portal.departments?.length ? `${portal.departments.length} departments · ` : ""}{portal.courses?.length ?? 0} courses</p>
              </div>
              <div className="heading-actions">
                <button className="btn btn-secondary" onClick={() => navigate("/faculty/question-bank")}>
                  <i className="ti ti-plus" /> New Question
                </button>
                <button className="btn btn-primary" onClick={() => navigate("/faculty/create-exam")}>
                  <i className="ti ti-file-plus" /> Create Exam
                </button>
              </div>
            </div>

            {/* Draft exams banner */}
            {(portal.examCounts?.draft ?? 0) > 0 && (
              <div
                style={{
                  background: "#fff3d8",
                  border: "1.5px solid #f5d76e",
                  borderRadius: 10,
                  padding: "12px 18px",
                  marginBottom: 20,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <i className="ti ti-alert-triangle" style={{ color: "#94600a", fontSize: 18 }} />
                <span style={{ flex: 1, fontSize: 13, color: "#5a3c00" }}>
                  You have <strong>{portal.examCounts?.draft}</strong> draft exam
                  {(portal.examCounts?.draft ?? 0) !== 1 ? "s" : ""}.
                  Students cannot see draft exams. Click <strong>Publish</strong> on any row below to make it live.
                </span>
              </div>
            )}

            <DashboardStats portal={portal} />

            <div className="content-grid">
              <div className="panel">
                <div className="panel-header">
                  <div className="card-title"><i className="ti ti-file-description" /> My Exams</div>
                  <button className="btn btn-sm btn-primary" onClick={() => navigate("/faculty/create-exam")}>
                    <i className="ti ti-plus" /> New
                  </button>
                </div>
                <ExamsTable
                  exams={portal.recentExams}
                  onView={(id) => navigate(`/faculty/evaluation?examId=${id}`)}
                  onPublished={invalidateAll}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <UpcomingSchedules schedules={portal.upcomingSchedules} />
                <CandidateAssessments schedules={portal.upcomingSchedules} onManage={setCandidateSchedule} />
                <GradingQueue queue={portal.gradingQueue} onNavigate={(examId) => navigate(`/faculty/evaluation?examId=${examId}`)} />
              </div>
            </div>

            <div className="content-grid-3col">
              <PassRateSection exams={portal.recentExams} />
              <ReevalSection requests={portal.reevaluationRequests} />
              <RecentActivity notifications={portal.notifications} />
            </div>

            {candidateSchedule && (
              <div className="modal-backdrop" role="presentation" onClick={() => setCandidateSchedule(null)}>
                <div className="modal candidate-manager-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <h2>Manage Candidates</h2>
                    <button className="modal-close" onClick={() => setCandidateSchedule(null)} aria-label="Close">
                      <i className="ti ti-x" />
                    </button>
                  </div>
                  <div className="modal-body">
                    <CandidateManager
                      examScheduleId={candidateSchedule.id}
                      examTitle={candidateSchedule.exams?.title ?? "Entrance Assessment"}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </PageState>
    </FacultyLayout>
  );
}