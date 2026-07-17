import { useState } from "react";
import StudentLayout, { EmptyState, Feedback, PageState } from "../../features/student/StudentLayout";
import { PageHeading } from "../../features/student/components";
import { studentApi } from "../../features/student/api";
import { apiMessage, formatDate, reevaluationLabel } from "../../features/student/format";
import { usePortalAction, useStudentPortal } from "../../features/student/hooks";
import type { Result } from "../../features/student/types";

export default function ReEvaluation() {
  const portal = useStudentPortal();
  const request = usePortalAction(({ resultId, reason }: { resultId: string; reason: string }) => studentApi.requestReevaluation(resultId, reason));
  const [selected, setSelected] = useState<Result | null>(null);
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestedIds = new Set(portal.data?.reevaluations.map((item) => item.result_id));
  const eligible = portal.data?.results.filter((item) => !requestedIds.has(item.id)) ?? [];

  const submit = async () => {
    if (!selected) return;
    setError(null);
    try {
      await request.mutateAsync({ resultId: selected.id, reason });
      setFeedback("Re-evaluation request submitted.");
      setSelected(null); setReason("");
    } catch (cause) { setError(apiMessage(cause)); }
  };

  return <StudentLayout><PageState loading={portal.isLoading} error={portal.error}>
    <PageHeading title="Re-Evaluation" subtitle="Request a review and track its progress" />
    <Feedback message={feedback} error={error} />
    <section className="panel panel-spaced"><div className="panel-header"><h2>Eligible Results</h2></div><div className="panel-body">
      {!eligible.length ? <EmptyState icon="ti-checks" title="No eligible results" body="Every published result has already been requested or no results are available." /> :
        eligible.map((result) => <div className="schedule-row" key={result.id}><div><div className="eyebrow">{result.course.code} · {result.percentage.toFixed(2)}%</div><h3>{result.exam.title}</h3><div className="meta-line"><span>{result.total_score} / {result.max_score} marks</span></div></div><div className="schedule-actions"><button className="btn btn-primary" onClick={() => setSelected(result)}>Request Re-Evaluation</button></div></div>)}
    </div></section>
    <section className="panel"><div className="panel-header"><h2>Request History</h2></div><div className="panel-body">
      {!portal.data?.reevaluations.length ? <EmptyState icon="ti-refresh-off" title="No requests submitted" body="Your request history will appear here." /> :
        portal.data.reevaluations.map((item) => {
          const result = portal.data?.results.find((entry) => entry.id === item.result_id);
          return <div className="schedule-row" key={item.id}><div><div className="eyebrow">{result?.course.code || "Result"} · {formatDate(item.requested_at)}</div><h3>{result?.exam.title || "Published result"}</h3><div className="meta-line"><span>{item.reason}</span>{item.reviewer_notes && <span>Reviewer: {item.reviewer_notes}</span>}</div></div><span className={`status-pill ${item.status.toLowerCase()}`}>{reevaluationLabel(item.status)}</span></div>;
        })}
    </div></section>
    {selected && <div className="modal-backdrop"><section className="modal"><div className="modal-header"><h2>Request Re-Evaluation</h2><button onClick={() => setSelected(null)}><i className="ti ti-x" /></button></div><div className="modal-body"><p className="request-result-summary">{selected.exam.title} · {selected.total_score}/{selected.max_score}</p><textarea className="textarea" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain the specific grading concern (minimum 10 characters)" /></div><div className="modal-footer"><button className="btn btn-secondary" onClick={() => setSelected(null)}>Cancel</button><button className="btn btn-primary" disabled={reason.trim().length < 10 || request.isPending} onClick={submit}>{request.isPending ? "Submitting..." : "Submit Request"}</button></div></section></div>}
  </PageState></StudentLayout>;
}
