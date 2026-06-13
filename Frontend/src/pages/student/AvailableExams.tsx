import { useMemo, useState } from "react";
import StudentLayout, { EmptyState, Feedback, PageState } from "../../features/student/StudentLayout";
import { ExamDetailsModal, PageHeading } from "../../features/student/components";
import { apiMessage, formatDate, formatTime } from "../../features/student/format";
import { usePortalAction, useStudentPortal } from "../../features/student/hooks";
import { studentApi } from "../../features/student/api";
import type { StudentSchedule } from "../../features/student/types";

export default function AvailableExams() {
  const portal = useStudentPortal();
  const register = usePortalAction(studentApi.register);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [selected, setSelected] = useState<StudentSchedule | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const exams = useMemo(() => (portal.data?.schedules ?? []).filter((item) => {
    const haystack = `${item.exam.title} ${item.course.name} ${item.course.code}`.toLowerCase();
    const matchesSearch = haystack.includes(search.toLowerCase());
    const currentStatus = item.registration?.status === "REGISTERED" ? "REGISTERED" : item.can_register ? "OPEN" : "CLOSED";
    return matchesSearch && (status === "ALL" || status === currentStatus);
  }), [portal.data?.schedules, search, status]);

  const handleRegister = async (schedule: StudentSchedule) => {
    setError(null); setFeedback(null);
    try {
      await register.mutateAsync(schedule.id);
      setFeedback(`Registration confirmed for ${schedule.exam.title}.`);
    } catch (cause) { setError(apiMessage(cause)); }
  };

  return (
    <StudentLayout>
      <PageState loading={portal.isLoading} error={portal.error}>
        <PageHeading title="Available Exams" subtitle="Published examinations available to your department" />
        <Feedback message={feedback} error={error} />
        <div className="filter-panel">
          <input className="field" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by exam, subject, or course code" />
          <select className="select" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="ALL">All statuses</option><option value="OPEN">Open for registration</option><option value="REGISTERED">Registered</option><option value="CLOSED">Closed</option>
          </select>
        </div>
        {!exams.length ? <EmptyState icon="ti-file-search" title="No matching exams" body="Published exams for your department will appear here." /> :
          <div className="exam-grid">{exams.map((schedule) => (
            <ExamCard key={schedule.id} schedule={schedule} busy={register.isPending} onDetails={() => setSelected(schedule)} onRegister={() => handleRegister(schedule)} />
          ))}</div>}
        {selected && <ExamDetailsModal schedule={selected} onClose={() => setSelected(null)} />}
      </PageState>
    </StudentLayout>
  );
}

function ExamCard({ schedule, busy, onDetails, onRegister }: { schedule: StudentSchedule; busy: boolean; onDetails: () => void; onRegister: () => void }) {
  const registered = schedule.registration?.status === "REGISTERED";
  return <article className="exam-card">
    <div className="exam-card-top"><div><div className="eyebrow">{schedule.course.code || "Course"} · {schedule.course.name || "Subject"}</div><h3>{schedule.exam.title}</h3></div><span className={`status-pill ${registered ? "registered" : schedule.can_register ? "success" : "closed"}`}>{registered ? "Registered" : schedule.eligibility_status}</span></div>
    <div className="meta-line"><span><i className="ti ti-user" />{schedule.faculty_name || "Faculty not assigned"}</span></div>
    <div className="exam-info"><Info label="Date" value={formatDate(schedule.start_time)} /><Info label="Time" value={`${formatTime(schedule.start_time)} – ${formatTime(schedule.end_time)}`} /><Info label="Duration" value={`${schedule.exam.duration_minutes} min`} /><Info label="Deadline" value={formatDate(schedule.registration_deadline || schedule.start_time, true)} /></div>
    <div className="exam-card-footer"><small>{schedule.exam.total_marks} marks</small><div className="card-actions"><button className="btn btn-secondary" onClick={onDetails}>View Details</button>{registered ? <button className="btn btn-secondary" disabled><i className="ti ti-check" />Registered</button> : <button className="btn btn-primary" disabled={!schedule.can_register || busy} onClick={onRegister}>{busy ? "Registering..." : "Register Now"}</button>}</div></div>
  </article>;
}
function Info({ label, value }: { label: string; value: string }) { return <div className="info-tile"><span>{label}</span><strong>{value}</strong></div>; }
