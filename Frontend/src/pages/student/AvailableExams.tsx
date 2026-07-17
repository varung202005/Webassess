import { useMemo, useState } from "react";
import StudentLayout, { EmptyState, Feedback, PageState } from "../../features/student/StudentLayout";
import { ExamDetailsModal, PageHeading } from "../../features/student/components";
import { apiMessage, formatDate, formatTime } from "../../features/student/format";
import { usePortalAction, useStudentPortal } from "../../features/student/hooks";
import { studentApi } from "../../features/student/api";
import type { StudentSchedule } from "../../features/student/types";

const DISMISSED_KEY = "dismissed_exam_ids";

function loadDismissed(): Set<string> {
  try {
    const stored = localStorage.getItem(DISMISSED_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(ids)));
  } catch {}
}

export default function AvailableExams() {
  const portal = useStudentPortal();
  const register = usePortalAction(studentApi.register);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [selected, setSelected] = useState<StudentSchedule | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const exams = useMemo(() => (portal.data?.schedules ?? []).filter((item) => {
    if (dismissed.has(item.id)) return false;
    const haystack = `${item.exam.title} ${item.course.name} ${item.course.code}`.toLowerCase();
    const matchesSearch = haystack.includes(search.toLowerCase());
    const currentStatus = item.registration?.status === "REGISTERED" ? "REGISTERED" : item.can_register ? "OPEN" : "CLOSED";
    return matchesSearch && (status === "ALL" || status === currentStatus);
  }), [portal.data?.schedules, search, status, dismissed]);

  const handleDismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev).add(id);
      saveDismissed(next);
      return next;
    });
  };

  const handleRegister = async (schedule: StudentSchedule) => {
    setError(null); setFeedback(null);
    setLoadingId(schedule.id);
    try {
      await register.mutateAsync(schedule.id);
      setFeedback(`Registration confirmed for ${schedule.exam.title}.`);
    } catch (cause) { setError(apiMessage(cause)); }
    finally { setLoadingId(null); }
  };

  return (
    <StudentLayout>
      <PageState loading={portal.isLoading} error={portal.error}>
        <PageHeading title="Available Exams" subtitle="Published examinations available to your department" />
        <Feedback message={feedback} error={error} />
        <div className="filter-panel compact-filter-panel">
          <div className="filter-control search-control"><i className="ti ti-search" /><label className="visually-hidden" htmlFor="available-search">Search exams</label><input id="available-search" type="search" className="field" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search exams" /></div>
          <div className="filter-control"><i className="ti ti-adjustments-horizontal" /><label className="visually-hidden" htmlFor="available-status">Exam status</label><select id="available-status" className="select" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="ALL">All statuses</option>
            <option value="OPEN">Open for registration</option>
            <option value="REGISTERED">Registered</option>
            <option value="CLOSED">Closed</option>
          </select>
          </div>
        </div>
        {!exams.length ? <EmptyState icon="ti-file-search" title="No matching exams" body="Published exams for your department will appear here." /> :
          <div className="exam-grid">{exams.map((schedule) => (
            <ExamCard
              key={schedule.id}
              schedule={schedule}
              busy={loadingId === schedule.id}
              onDetails={() => setSelected(schedule)}
              onRegister={() => handleRegister(schedule)}
              onDismiss={() => handleDismiss(schedule.id)}
            />
          ))}</div>}
        {selected && <ExamDetailsModal schedule={selected} onClose={() => setSelected(null)} />}
      </PageState>
    </StudentLayout>
  );
}

function ExamCard({
  schedule, busy, onDetails, onRegister, onDismiss,
}: {
  schedule: StudentSchedule;
  busy: boolean;
  onDetails: () => void;
  onRegister: () => void;
  onDismiss: () => void;
}) {
  const registered = schedule.registration?.status === "REGISTERED";
  return (
    <article className="exam-card">
      <div className="exam-card-top">
        <div>
          <div className="eyebrow">{schedule.course.code || "Course"} · {schedule.course.name || "Subject"}</div>
          <h3>{schedule.exam.title}</h3>
        </div>
        <div className="exam-card-status">
          <span className={`status-pill ${registered ? "registered" : schedule.can_register ? "success" : "closed"}`}>
            {registered ? "Registered" : schedule.eligibility_status}
          </span>
          <button
            className="btn btn-ghost"
            onClick={onDismiss}
            aria-label="Dismiss exam"
            title="Hide this exam"
          >
            <i className="ti ti-x" />
          </button>
        </div>
      </div>
      <div className="meta-line"><span><i className="ti ti-user" />{schedule.faculty_name || "Faculty not assigned"}</span></div>
      <div className="exam-info">
        <Info label="Start" value={`${formatDate(schedule.start_time)} ${formatTime(schedule.start_time)}`} />
        <Info label="End" value={`${formatDate(schedule.end_time)} ${formatTime(schedule.end_time)}`} />
        <Info label="Duration" value={`${schedule.exam.duration_minutes} min`} />
        <Info label="Registration Deadline" value={schedule.registration_deadline ? `${formatDate(schedule.registration_deadline)} ${formatTime(schedule.registration_deadline)}` : "—"} />
      </div>
      <div className="exam-card-footer">
        <small>{schedule.exam.total_marks} marks</small>
        <div className="card-actions">
          <button className="btn btn-secondary" onClick={onDetails}>View Details</button>
          {registered
            ? <button className="btn btn-secondary" disabled><i className="ti ti-check" />Registered</button>
            : <button className="btn btn-primary" disabled={!schedule.can_register || busy} onClick={onRegister}>{busy ? "Registering..." : "Register Now"}</button>
          }
        </div>
      </div>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="info-tile"><span>{label}</span><strong>{value}</strong></div>;
}
