import { useState } from "react";
import FacultyLayout from "../../features/faculty/FacultyLayout";
import { Loading, ErrorBlock, EmptyState, PageHeading } from "../../features/faculty/components";
import { usePendingReevaluations, useFacultyAction } from "../../features/faculty/hooks";
import { facultyApi } from "../../features/faculty/api";
import { relativeTime, statusBadgeClass, statusLabel } from "../../features/faculty/format";

function useResolveReevaluation() {
  return useFacultyAction(
    ({ requestId, ...body }: { requestId: string; status: string; faculty_notes: string }) =>
      facultyApi.resolveReevaluation(requestId, body),
    [["faculty-pending-reevaluations"]],
  );
}

export default function Reevaluations() {
  const { data: reevaluations, isLoading, isError, error, refetch } = usePendingReevaluations();
  const resolveMut = useResolveReevaluation();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const allRequests = Array.isArray(reevaluations) ? reevaluations : [];
  const pending = allRequests.filter((r) => r.status === "PENDING");
  const resolved = allRequests.filter((r) => r.status !== "PENDING");

  const handleResolve = async (requestId: string, status: string) => {
    await resolveMut.mutateAsync({ requestId, status, faculty_notes: notes });
    setExpandedId(null);
    setNotes("");
    refetch();
  };

  return (
    <FacultyLayout activePage="reevaluations">
      <PageHeading
        title="Re-evaluation Requests"
        subtitle={`${pending.length} pending · ${resolved.length} resolved`}
      />

      {isLoading ? (
        <Loading text="Loading re-evaluation requests…" />
      ) : isError ? (
        <ErrorBlock error={error} onRetry={() => refetch()} />
      ) : allRequests.length === 0 ? (
        <EmptyState icon="ti ti-refresh-alert" title="No re-evaluation requests" text="There are no re-evaluation requests to review." />
      ) : (
        <>
          {/* Pending */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <div className="card-title">
                <i className="ti ti-refresh-alert" /> Pending Requests ({pending.length})
              </div>
            </div>
            {pending.length === 0 ? (
              <div className="card-body">
                <EmptyState icon="ti ti-circle-check" title="All resolved!" />
              </div>
            ) : (
              <div>
                {pending.map((r) => {
                  const studentName = (r as any).users?.full_name ?? "Unknown";
                  const studentEmail = (r as any).users?.email ?? "";
                  const resultInfo = (r as any).results ?? {};
                  const examTitle = resultInfo.exams?.title ?? "";
                  return (
                    <div key={r.id}>
                      <div className="re-eval-item" onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                        <div style={{ flex: 1 }}>
                          <div className="re-eval-student">{studentName}</div>
                          <div className="re-eval-meta">
                            {examTitle} · Score: {resultInfo.total_score}/{resultInfo.max_score}
                            {studentEmail && ` · ${studentEmail}`}
                          </div>
                        </div>
                        <span className="badge badge-pending" style={{ flexShrink: 0 }}>Pending</span>
                        <i className={`ti ti-chevron-${expandedId === r.id ? "up" : "down"}`} style={{ color: "var(--c-gray-400)" }} />
                      </div>

                      {expandedId === r.id && (
                        <div style={{ padding: "16px 20px", background: "var(--c-gray-50)", borderBottom: "1px solid var(--c-border)" }}>
                          <div style={{ fontSize: 13, color: "var(--c-gray-700)", marginBottom: 12 }}>
                            <strong>Reason:</strong> {r.reason ?? "No reason provided"}
                          </div>
                          <div style={{ marginBottom: 12 }}>
                            <label className="form-label" style={{ fontSize: 12, marginBottom: 4 }}>
                              Faculty Notes
                            </label>
                            <textarea
                              className="form-control"
                              rows={3}
                              placeholder="Add notes about the resolution…"
                              value={notes}
                              onChange={(e) => setNotes(e.target.value)}
                              style={{ fontSize: 13 }}
                            />
                          </div>
                          <div style={{ display: "flex", gap: 10 }}>
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => handleResolve(r.id, "RESOLVED")}
                            >
                              <i className="ti ti-check" /> Approve & Resolve
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleResolve(r.id, "REJECTED")}
                            >
                              <i className="ti ti-x" /> Reject
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Resolved */}
          {resolved.length > 0 && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <i className="ti ti-check" /> Resolved ({resolved.length})
                </div>
              </div>
              <div>
                {resolved.map((r) => (
                  <div className="re-eval-item" key={r.id}>
                    <div style={{ flex: 1 }}>
                      <div className="re-eval-student">{(r as any).users?.full_name ?? "Unknown"}</div>
                      <div className="re-eval-meta">
                        {(r as any).results?.exams?.title ?? ""} · Status: {r.status}
                      </div>
                    </div>
                    <span className={`badge ${r.status === "RESOLVED" ? "badge-resolved" : "badge-draft"}`}>
                      {r.status}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--c-gray-500)" }}>
                      {r.resolved_at ? relativeTime(r.resolved_at) : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </FacultyLayout>
  );
}
