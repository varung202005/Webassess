import { useMemo, useState } from "react";
import StudentLayout, { EmptyState, PageState } from "../../features/student/StudentLayout";
import { PageHeading } from "../../features/student/components";
import { formatDate } from "../../features/student/format";
import { useStudentPortal } from "../../features/student/hooks";

export default function History() {
  const portal = useStudentPortal();
  const [subject, setSubject] = useState("ALL");
  const [semester, setSemester] = useState("ALL");
  const [date, setDate] = useState("");
  const subjects = useMemo(() => Array.from(new Set((portal.data?.history ?? []).map((item) => item.schedule?.course?.code).filter(Boolean))), [portal.data?.history]);
  const history = (portal.data?.history ?? []).filter((item) => {
    const attempted = item.submitted_at || item.started_at;
    return (subject === "ALL" || item.schedule?.course?.code === subject)
      && (semester === "ALL" || String(item.schedule?.exam?.semester) === semester)
      && (!date || attempted.slice(0, 10) === date);
  });

  return <StudentLayout><PageState loading={portal.isLoading} error={portal.error}>
    <PageHeading title="Exam History" subtitle="All exam attempts recorded for your account" />
    <div className="filter-panel">
      <select className="select" value={subject} onChange={(event) => setSubject(event.target.value)}><option value="ALL">All subjects</option>{subjects.map((item) => <option key={item} value={item}>{item}</option>)}</select>
      <select className="select" value={semester} onChange={(event) => setSemester(event.target.value)}><option value="ALL">All semesters</option>{Array.from({ length: 12 }, (_, index) => index + 1).map((item) => <option key={item} value={item}>Semester {item}</option>)}</select>
      <input className="field date-field" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
    </div>
    {!history.length ? <EmptyState icon="ti-history-off" title="No attempts found" body="Completed and in-progress exam attempts will appear here." /> :
      <div className="data-panel"><table className="data-table"><thead><tr><th>Exam</th><th>Attempted</th><th>Result</th><th>Status</th><th>Submission</th></tr></thead><tbody>{history.map((item) => <tr key={item.id}>
        <td><div className="history-exam"><span className="history-exam-icon"><i className="ti ti-file-description" /></span><div><strong>{item.schedule?.exam?.title || "Exam unavailable"}</strong><small>{item.schedule?.course?.code} · {item.schedule?.course?.name}</small></div></div></td>
        <td>{formatDate(item.submitted_at || item.started_at, true)}</td>
        <td>{item.result ? "Published" : "Not published"}</td>
        <td><span className={`status-pill ${item.status.toLowerCase()}`}>{item.status.replace(/_/g, " ")}</span></td>
        <td>{item.submission_type || "—"}</td>
      </tr>)}</tbody></table></div>}
  </PageState></StudentLayout>;
}
