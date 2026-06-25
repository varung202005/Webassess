/**
 * Schedules.tsx — Faculty Schedules Management
 *
 * THIS FILE FIXES the student visibility problem:
 *   1. "Publish Exam" button  → patches exam status to PUBLISHED
 *   2. "Publish Schedule" toggle → patches schedule is_published to true
 *
 * Both gates must be open before students can see an exam.
 *
 * Drop this file at:  src/pages/faculty/Schedules.tsx
 * (replaces whatever was there before)
 */

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import FacultyLayout from "../../features/faculty/FacultyLayout";
import { PageState, EmptyState, Feedback } from "../../features/faculty/components";
import { useFacultyDashboard, useSchedules, QUERY_KEYS } from "../../features/faculty/hooks";
import { facultyApi } from "../../features/faculty/api";
import { formatDate, formatTime } from "../../features/faculty/format";
import type { ExamSchedule } from "../../features/faculty/types";

// ─── tiny local types ────────────────────────────────────────────────────────

interface ScheduleRow extends ExamSchedule {
  exam_status?: string;
  exam_title?: string;
  exam_duration?: number;
  course_code?: string;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function windowStatus(row: ScheduleRow): "UPCOMING" | "OPEN" | "CLOSED" {
  const now = Date.now();
  const start = new Date(row.start_time).getTime();
  const end = new Date(row.end_time).getTime();
  if (now < start) return "UPCOMING";
  if (now <= end) return "OPEN";
  return "CLOSED";
}

function apiMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err ?? "Unknown error");
}

// ─── PublishGate ─────────────────────────────────────────────────────────────
// Visual indicator showing which of the two gates are open / closed

function PublishGate({
  examPublished,
  schedulePublished,
}: {
  examPublished: boolean;
  schedulePublished: boolean;
}) {
  const gate = (label: string, open: boolean) => (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 7px",
        borderRadius: 99,
        background: open ? "#def8ee" : "#fde8ec",
        color: open ? "#08775b" : "#a30f2e",
      }}
    >
      <i className={`ti ti-${open ? "circle-check" : "circle-x"}`} />
      {label}
    </span>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {gate("Exam published", examPublished)}
      {gate("Schedule live", schedulePublished)}
    </div>
  );
}

// ─── ScheduleCard ─────────────────────────────────────────────────────────────

function ScheduleCard({
  row,
  onPublishExam,
  onToggleSchedule,
  busy,
}: {
  row: ScheduleRow;
  onPublishExam: (examId: string) => void;
  onToggleSchedule: (scheduleId: string, current: boolean) => void;
  busy: boolean;
}) {
  const ws = windowStatus(row);
  const examPublished = row.exam_status === "PUBLISHED";
  const schedulePublished = !!row.is_published;
  const studentsCanSee = examPublished && schedulePublished;

  const wsColor: Record<string, string> = {
    UPCOMING: "#4f55a8",
    OPEN: "#08775b",
    CLOSED: "#888",
  };

  return (
    <div
      style={{
        background: "#fff",
        border: `1.5px solid ${studentsCanSee ? "#b6e8d3" : "#eceef2"}`,
        borderRadius: 12,
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        boxShadow: studentsCanSee ? "0 0 0 3px #def8ee44" : undefined,
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#8b1a1a",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 3,
            }}
          >
            {row.course_code || "No course"}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1d26", lineHeight: 1.3 }}>
            {row.exam_title || row.exam_id}
          </div>
        </div>
        <span
          style={{
            flexShrink: 0,
            fontSize: 11,
            fontWeight: 700,
            padding: "3px 10px",
            borderRadius: 99,
            background: `${wsColor[ws]}18`,
            color: wsColor[ws],
          }}
        >
          {ws}
        </span>
      </div>

      {/* Time info */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 10,
          background: "#f8f9fc",
          borderRadius: 8,
          padding: "10px 14px",
        }}
      >
        {[
          ["Start", `${formatDate(row.start_time)} ${formatTime(row.start_time)}`],
          ["End", `${formatDate(row.end_time)} ${formatTime(row.end_time)}`],
          ["Duration", row.exam_duration ? `${row.exam_duration} min` : "—"],
        ].map(([label, value]) => (
          <div key={label}>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1d26" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Publish gates */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <PublishGate examPublished={examPublished} schedulePublished={schedulePublished} />

        {studentsCanSee ? (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#08775b",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <i className="ti ti-eye" /> Visible to students
          </span>
        ) : (
          <span style={{ fontSize: 12, color: "#888" }}>
            <i className="ti ti-eye-off" style={{ marginRight: 4 }} />
            Hidden from students
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {/* Gate 1: Publish exam */}
        {!examPublished && (
          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={() => onPublishExam(row.exam_id)}
            style={{ flex: 1, minWidth: 160 }}
          >
            <i className="ti ti-send" />
            {busy ? "Publishing…" : "Publish Exam"}
          </button>
        )}
        {examPublished && (
          <div
            style={{
              flex: 1,
              minWidth: 160,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 8,
              background: "#def8ee",
              color: "#08775b",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <i className="ti ti-circle-check" /> Exam Published
          </div>
        )}

        {/* Gate 2: Publish/unpublish schedule */}
        <button
          className={schedulePublished ? "btn btn-secondary" : "btn btn-primary"}
          disabled={busy || !examPublished}
          title={!examPublished ? "Publish the exam first" : undefined}
          onClick={() => onToggleSchedule(row.id, schedulePublished)}
          style={{ flex: 1, minWidth: 160 }}
        >
          <i className={`ti ti-${schedulePublished ? "eye-off" : "eye"}`} />
          {busy
            ? "Saving…"
            : schedulePublished
            ? "Unpublish Schedule"
            : "Publish Schedule"}
        </button>
      </div>

      {!examPublished && (
        <p style={{ margin: 0, fontSize: 12, color: "#888", fontStyle: "italic" }}>
          ① Publish the exam first, then ② publish the schedule — students need both gates open.
        </p>
      )}
    </div>
  );
}

// ─── CreateScheduleModal ──────────────────────────────────────────────────────

interface NewScheduleForm {
  exam_id: string;
  start_time: string;
  end_time: string;
  registration_deadline: string;
  is_published: boolean;
}

function CreateScheduleModal({
  exams,
  onClose,
  onCreated,
}: {
  exams: Array<{ id: string; title: string; status: string }>;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<NewScheduleForm>({
    exam_id: "",
    start_time: "",
    end_time: "",
    registration_deadline: "",
    is_published: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (patch: Partial<NewScheduleForm>) => setForm((f) => ({ ...f, ...patch }));

  const validate = () => {
    if (!form.exam_id) return "Select an exam.";
    if (!form.start_time) return "Set a start time.";
    if (!form.end_time) return "Set an end time.";
    if (new Date(form.end_time) <= new Date(form.start_time))
      return "End time must be after start time.";
    return null;
  };

  const submit = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    setError("");
    try {
      await facultyApi.createExamSchedule({
        exam_id: form.exam_id,
        start_time: new Date(form.start_time).toISOString(),
        end_time: new Date(form.end_time).toISOString(),
        registration_deadline: form.registration_deadline
          ? new Date(form.registration_deadline).toISOString()
          : null,
        is_published: form.is_published,
      });
      onCreated();
    } catch (e) {
      setError(apiMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const selectedExam = exams.find((e) => e.id === form.exam_id);
  const examIsDraft = selectedExam && selectedExam.status !== "PUBLISHED";

  return (
    <div className="modal-backdrop" onMouseDown={(ev) => ev.target === ev.currentTarget && onClose()}>
      <section className="modal" style={{ maxWidth: 540 }} role="dialog" aria-modal>
        <div className="modal-header">
          <h2>New Exam Schedule</h2>
          <button onClick={onClose}><i className="ti ti-x" /></button>
        </div>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Exam selector */}
          <div className="form-field">
            <label>Exam *</label>
            <select
              className="form-select"
              value={form.exam_id}
              onChange={(e) => set({ exam_id: e.target.value })}
            >
              <option value="">Select exam…</option>
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.title} {ex.status !== "PUBLISHED" ? `(${ex.status})` : "✓"}
                </option>
              ))}
            </select>
            {examIsDraft && (
              <div
                style={{
                  marginTop: 6,
                  padding: "8px 10px",
                  borderRadius: 7,
                  background: "#fff3d8",
                  color: "#94600a",
                  fontSize: 12,
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                }}
              >
                <i className="ti ti-alert-triangle" />
                This exam is still DRAFT. You can create the schedule now, but students
                won't see it until you publish the exam.
              </div>
            )}
          </div>

          {/* Times */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="form-field">
              <label>Start Time *</label>
              <input
                type="datetime-local"
                className="form-input"
                value={form.start_time}
                onChange={(e) => set({ start_time: e.target.value })}
              />
            </div>
            <div className="form-field">
              <label>End Time *</label>
              <input
                type="datetime-local"
                className="form-input"
                value={form.end_time}
                onChange={(e) => set({ end_time: e.target.value })}
              />
            </div>
          </div>

          <div className="form-field">
            <label>Registration Deadline (optional)</label>
            <input
              type="datetime-local"
              className="form-input"
              value={form.registration_deadline}
              onChange={(e) => set({ registration_deadline: e.target.value })}
            />
            <span style={{ fontSize: 11, color: "#888", marginTop: 3, display: "block" }}>
              Defaults to exam start time if left blank.
            </span>
          </div>

          {/* Publish immediately */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              borderRadius: 8,
              background: form.is_published ? "#def8ee" : "#f8f9fc",
              cursor: "pointer",
              border: `1px solid ${form.is_published ? "#b6e8d3" : "#eceef2"}`,
            }}
          >
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(e) => set({ is_published: e.target.checked })}
            />
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>Publish schedule immediately</div>
              <div style={{ fontSize: 12, color: "#676b79" }}>
                Students will see this exam once the exam itself is also published.
              </div>
            </div>
          </label>

          {error && (
            <div className="form-error">
              <i className="ti ti-alert-circle" /> {error}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={saving} onClick={submit}>
            {saving ? <><span className="spinner-sm" /> Creating…</> : <><i className="ti ti-check" /> Create Schedule</>}
          </button>
        </div>
      </section>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Schedules() {
  const queryClient = useQueryClient();
  const { data: portal, isLoading: portalLoading } = useFacultyDashboard();
  const { data: schedules = [], isLoading: schedulesLoading, error } = useSchedules();

  const [busy, setBusy] = useState<string | null>(null); // scheduleId or examId being mutated
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<"ALL" | "PUBLISHED" | "DRAFT">("ALL");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dashboard });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schedules() });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.exams() });
  };

  const toast = (msg: string, isError = false) => {
    setFeedback(isError ? null : msg);
    setFeedbackError(isError ? msg : null);
    setTimeout(() => { setFeedback(null); setFeedbackError(null); }, 4000);
  };

  // ── Publish exam (status → PUBLISHED) ──────────────────────────────────────
  const handlePublishExam = async (examId: string) => {
    setBusy(examId);
    try {
      await facultyApi.updateExam(examId, { status: "PUBLISHED" });
      invalidate();
      toast("Exam published! Now publish the schedule to make it visible to students.");
    } catch (e) {
      toast(apiMsg(e), true);
    } finally {
      setBusy(null);
    }
  };

  // ── Toggle schedule is_published ────────────────────────────────────────────
  const handleToggleSchedule = async (scheduleId: string, currentlyPublished: boolean) => {
    setBusy(scheduleId);
    try {
      await facultyApi.updateSchedule(scheduleId, { is_published: !currentlyPublished });
      invalidate();
      toast(
        currentlyPublished
          ? "Schedule unpublished — students can no longer see this exam."
          : "Schedule published! Students can now register and take this exam."
      );
    } catch (e) {
      toast(apiMsg(e), true);
    } finally {
      setBusy(null);
    }
  };

  // ── Enrich schedules with exam info from portal ────────────────────────────
  const exams = portal?.recentExams ?? [];

  const enriched: ScheduleRow[] = schedules.map((s) => {
    const exam = exams.find((e) => e.id === s.exam_id);
    return {
      ...s,
      exam_status: exam?.status,
      exam_title: exam?.title ?? s.exam_id,
      exam_duration: exam?.duration_minutes,
      course_code: (exam as any)?.courses?.code,
    };
  });

  const filtered = enriched.filter((s) => {
    if (filter === "PUBLISHED") return s.is_published && s.exam_status === "PUBLISHED";
    if (filter === "DRAFT") return !s.is_published || s.exam_status !== "PUBLISHED";
    return true;
  });

  const isLoading = portalLoading || schedulesLoading;

  return (
    <FacultyLayout activePage="schedules">
      <PageState loading={isLoading} error={error} onRetry={() => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schedules() })}>
        {/* Header */}
        <div className="page-heading">
          <div>
            <h1>Exam Schedules</h1>
            <p>Publish exams and schedules to make them visible to students</p>
          </div>
          <div className="heading-actions">
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              <i className="ti ti-plus" /> New Schedule
            </button>
          </div>
        </div>

        <Feedback message={feedback} error={feedbackError} />

        {/* Two-gate explainer banner */}
        <div
          style={{
            background: "#fffbf0",
            border: "1.5px solid #f5d76e",
            borderRadius: 10,
            padding: "14px 18px",
            marginBottom: 20,
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
          }}
        >
          <i className="ti ti-info-circle" style={{ color: "#94600a", fontSize: 18, marginTop: 1 }} />
          <div style={{ fontSize: 13, color: "#5a3c00", lineHeight: 1.6 }}>
            <strong>Students need both gates open to see an exam:</strong>
            <br />
            ① Exam status must be <strong>PUBLISHED</strong> (not DRAFT) &nbsp;·&nbsp;
            ② Schedule must have <strong>is_published = true</strong>
            <br />
            Use the buttons on each card below to open both gates.
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {(["ALL", "PUBLISHED", "DRAFT"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "6px 16px",
                borderRadius: 99,
                border: "1.5px solid",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                background: filter === f ? "#8b1a1a" : "#fff",
                color: filter === f ? "#fff" : "#555",
                borderColor: filter === f ? "#8b1a1a" : "#ddd",
              }}
            >
              {f === "ALL" ? `All (${enriched.length})` : f === "PUBLISHED" ? `Live (${enriched.filter((s) => s.is_published && s.exam_status === "PUBLISHED").length})` : `Needs action (${enriched.filter((s) => !s.is_published || s.exam_status !== "PUBLISHED").length})`}
            </button>
          ))}
        </div>

        {/* Cards */}
        {!filtered.length ? (
          <EmptyState
            icon="ti-calendar-off"
            title={filter === "ALL" ? "No schedules yet" : "Nothing in this filter"}
            text={
              filter === "ALL"
                ? "Create a schedule below, then publish the exam and the schedule."
                : "Try switching to 'All'."
            }
            action={
              filter === "ALL" ? (
                <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                  <i className="ti ti-plus" /> Create Schedule
                </button>
              ) : undefined
            }
          />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
              gap: 16,
            }}
          >
            {filtered.map((row) => (
              <ScheduleCard
                key={row.id}
                row={row}
                onPublishExam={handlePublishExam}
                onToggleSchedule={handleToggleSchedule}
                busy={busy === row.id || busy === row.exam_id}
              />
            ))}
          </div>
        )}

        {/* Create schedule modal */}
        {showCreate && (
          <CreateScheduleModal
            exams={exams.map((e) => ({ id: e.id, title: e.title, status: e.status ?? "DRAFT" }))}
            onClose={() => setShowCreate(false)}
            onCreated={() => {
              setShowCreate(false);
              invalidate();
              toast("Schedule created! Remember to publish both the exam and the schedule.");
            }}
          />
        )}
      </PageState>
    </FacultyLayout>
  );
}