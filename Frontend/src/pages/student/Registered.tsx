import { useState } from "react";
import { useNavigate } from "react-router-dom";
import StudentLayout, { EmptyState, Feedback, PageState } from "../../features/student/StudentLayout";
import { ExamDetailsModal, PageHeading } from "../../features/student/components";
import { studentApi } from "../../features/student/api";
import { apiMessage, formatDate, formatTime } from "../../features/student/format";
import { usePortalAction, useStudentPortal } from "../../features/student/hooks";
import type { StudentSchedule } from "../../features/student/types";
import { requestExamFullscreen } from "../../lib/fullscreen";

export default function Registered() {
  const portal = useStudentPortal();
  const cancel = usePortalAction(studentApi.cancelRegistration);
  const navigate = useNavigate();
  const [selected, setSelected] = useState<StudentSchedule | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const registered = (portal.data?.schedules ?? []).filter((item) => item.registration?.status === "REGISTERED" && item.window_status !== "CLOSED");

  const start = async (schedule: StudentSchedule) => {
    setError(null);
    try {
      // Keep this in the click handler before any network await so browsers
      // retain the user gesture required by the Fullscreen API.
      await requestExamFullscreen();
      const eligibility = await studentApi.eligibility(schedule.id);
      if (!eligibility.eligible) throw new Error(eligibility.reason);
      navigate(`/exam/preflight/${schedule.id}`);
    } catch (cause) { setError(apiMessage(cause)); }
  };
  const cancelRegistration = async (schedule: StudentSchedule) => {
    if (!schedule.registration || !window.confirm(`Cancel registration for ${schedule.exam.title}?`)) return;
    setError(null);
    try { await cancel.mutateAsync(schedule.registration.id); setFeedback("Registration cancelled."); }
    catch (cause) { setError(apiMessage(cause)); }
  };

  return <StudentLayout><PageState loading={portal.isLoading} error={portal.error}>
    <PageHeading title="Registered Exams" subtitle="Your upcoming examinations and current start eligibility" />
    <Feedback message={feedback} error={error} />
    {!registered.length ? <EmptyState icon="ti-calendar-off" title="No registered exams" body="Register for an available exam to see it here." /> :
      <div className="exam-grid">{registered.map((schedule) => {
        const cancelDeadline = new Date(schedule.registration_deadline || schedule.start_time).getTime();
        const canStart = schedule.window_status === "OPEN"
          && (!schedule.attempt || schedule.attempt.status === "IN_PROGRESS");
        return <article className="exam-card" key={schedule.id}>
          <div className="exam-card-top"><div><div className="eyebrow">{schedule.course.code} · {schedule.course.name}</div><h3>{schedule.exam.title}</h3></div><span className={`status-pill ${schedule.window_status.toLowerCase()}`}>{schedule.attempt?.status === "IN_PROGRESS" ? "In Progress" : schedule.window_status}</span></div>
          <div className="exam-info"><Info label="Starts" value={formatDate(schedule.start_time, true)} /><Info label="Ends" value={formatDate(schedule.end_time, true)} /><Info label="Duration" value={`${schedule.exam.duration_minutes} min`} /><Info label="Status" value={schedule.attempt?.status === "IN_PROGRESS" ? "Resume available" : schedule.eligibility_status} /></div>
          <div className="exam-card-footer"><small>{schedule.faculty_name || "Faculty not assigned"}</small><div className="card-actions"><button className="btn btn-secondary" onClick={() => setSelected(schedule)}>Details</button>{Date.now() <= cancelDeadline && !schedule.attempt && <button className="btn btn-danger" disabled={cancel.isPending} onClick={() => cancelRegistration(schedule)}>Cancel</button>}<button className="btn btn-primary" disabled={!canStart} onClick={() => start(schedule)}>{schedule.attempt?.status === "IN_PROGRESS" ? "Resume Exam" : "Start Exam"}</button></div></div>
        </article>;
      })}</div>}
    {selected && <ExamDetailsModal schedule={selected} onClose={() => setSelected(null)} />}
  </PageState></StudentLayout>;
}
function Info({ label, value }: { label: string; value: string }) { return <div className="info-tile"><span>{label}</span><strong>{value}</strong></div>; }
