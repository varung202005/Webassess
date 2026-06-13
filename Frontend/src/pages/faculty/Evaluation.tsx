import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import FacultyLayout from "../../features/faculty/FacultyLayout";
import { PageState } from "../../features/faculty/components";
import { useExams, useExamAttempts, usePendingGrading, useFacultyAction, useFacultyDashboard } from "../../features/faculty/hooks";
import { facultyApi } from "../../features/faculty/api";

/* ── Mutations ────────────────────────────────────────────── */
function useSetScore() {
  return useFacultyAction(
    (body: { answer_id: string; marks_awarded: number; change_reason: string }) =>
      facultyApi.setManualScore(body),
    [["grading"], ["student-answers"]],
  );
}

function studentInitials(name: string) {
  return name?.split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 2) ?? "?";
}

/* ── Evaluation Page ──────────────────────────────────────── */
export default function Evaluation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedExamId = searchParams.get("examId") ?? "";

  const { data: portal } = useFacultyDashboard();
  const { data: exams, isLoading: examsLoading } = useExams();
  const allExams = Array.isArray(exams) ? exams : portal?.recentExams ?? [];

  const { data: attemptsData, isLoading: attemptsLoading, refetch: refetchAttempts } = useExamAttempts(selectedExamId);
  const { data: pendingData, isLoading: pendingLoading, refetch: refetchPending } = usePendingGrading(selectedExamId);

  const setScoreMut = useSetScore();

  const allAttempts = Array.isArray(attemptsData) ? attemptsData : [];
  const pendingAnswers = Array.isArray(pendingData) ? pendingData : [];

  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "pending" | "graded">("all");

  const selectedAttempt = allAttempts.find((a) => a.id === selectedAttemptId);
  const studentAnswersForAttempt = pendingAnswers.filter((a) => a.attempt_id === selectedAttemptId);

  // Compute status for each attempt
  const pendingAttemptIds = new Set(
    pendingAnswers.filter((a) => a.marks_awarded == null).map((a) => a.attempt_id),
  );
  const gradedAttemptIds = new Set(
    pendingAnswers.filter((a) => a.marks_awarded != null).map((a) => a.attempt_id),
  );

  const getStatus = (id: string) => {
    if (pendingAttemptIds.has(id)) return "pending";
    if (gradedAttemptIds.has(id)) return "graded";
    return "no-subjective";
  };

  // Filter + search attempts
  const displayedAttempts = useMemo(() => {
    let filtered = allAttempts;
    if (filterTab === "pending") filtered = allAttempts.filter((a) => pendingAttemptIds.has(a.id));
    if (filterTab === "graded") filtered = allAttempts.filter((a) => gradedAttemptIds.has(a.id) && !pendingAttemptIds.has(a.id));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((a) => {
        const user = (a as any).users ?? {};
        const student = (a as any).students ?? {};
        return (user.full_name ?? "").toLowerCase().includes(q) ||
               (student.roll_number ?? "").toLowerCase().includes(q);
      });
    }
    return filtered;
  }, [allAttempts, filterTab, searchQuery, pendingAttemptIds, gradedAttemptIds]);

  const pendingAttempts = allAttempts.filter((a) => pendingAttemptIds.has(a.id));
  const completedAttempts = allAttempts.filter((a) => gradedAttemptIds.has(a.id) && !pendingAttemptIds.has(a.id));

  // Find next pending student (for Save & Next)
  const getNextPendingAttemptId = (currentId: string): string | null => {
    const pendingList = pendingAttempts.filter((a) => a.id !== currentId);
    if (pendingList.length === 0) return null;
    // Find the one after current in the full list
    const idx = allAttempts.findIndex((a) => a.id === currentId);
    for (let i = idx + 1; i < allAttempts.length; i++) {
      if (pendingAttemptIds.has(allAttempts[i].id)) return allAttempts[i].id;
    }
    // Wrap around
    const firstPending = pendingList[0];
    return firstPending?.id ?? null;
  };

  const handleScoreChange = (answerId: string, value: number) => {
    setScores((prev) => ({ ...prev, [answerId]: value }));
  };

  const doSave = async () => {
    setSaving(true);
    try {
      for (const [answerId, marks] of Object.entries(scores)) {
        if (marks != null && marks >= 0) {
          await setScoreMut.mutateAsync({
            answer_id: answerId,
            marks_awarded: marks,
            change_reason: "Manual grading by faculty",
          });
        }
      }
      setScores({});
      await refetchPending();
      await refetchAttempts();
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => { await doSave(); };

  const handleSaveAndNext = async () => {
    const ok = await doSave();
    if (ok && selectedAttemptId) {
      const nextId = getNextPendingAttemptId(selectedAttemptId);
      if (nextId) setSelectedAttemptId(nextId);
    }
  };

  const handleExamChange = (examId: string) => {
    navigate(`/faculty/evaluation?examId=${examId}`);
    setSelectedAttemptId(null);
    setScores({});
  };

  const autoScore = studentAnswersForAttempt
    .filter((a) => a.marks_awarded != null)
    .reduce((sum, a) => sum + (a.marks_awarded ?? 0), 0);
  const manualScoreTotal = Object.entries(scores)
    .filter(([, v]) => v != null && v >= 0)
    .reduce((sum, [, v]) => sum + v, 0);
  const pendingTotal = studentAnswersForAttempt.filter((a) => a.marks_awarded == null).length;

  return (
    <FacultyLayout activePage="evaluation">
      <div className="page-heading">
        <div>
          <h1>Evaluation</h1>
          <p>Grade student subjective answers</p>
        </div>
        <div className="heading-actions">
          <select
            className="select-filter"
            value={selectedExamId}
            onChange={(e) => handleExamChange(e.target.value)}
            style={{ minWidth: 220 }}
          >
            <option value="">Select an exam…</option>
            {allExams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.title} ({exam.courses?.code ?? ""})
              </option>
            ))}
          </select>
          <button className="btn btn-secondary btn-sm" disabled={!selectedExamId}>
            <i className="ti ti-download" /> Export
          </button>
          <button
            className="btn btn-primary btn-sm"
            disabled={!selectedExamId}
            onClick={() => {
              if (window.confirm("Publish all unpublished results for this exam?")) {
                facultyApi.publishAllResults(selectedExamId);
              }
            }}
          >
            <i className="ti ti-send" /> Publish Results
          </button>
        </div>
      </div>

      {!selectedExamId ? (
        <div className="panel">
          <div className="panel-body">
            <div className="empty-state">
              <i className="ti ti-writing" />
              <div className="empty-state-title">Select an exam</div>
              <div className="empty-state-text">Choose an exam from the dropdown to start grading.</div>
            </div>
          </div>
        </div>
      ) : examsLoading || pendingLoading || attemptsLoading ? (
        <div className="loading-state"><span className="spinner" /> Loading evaluation data…</div>
      ) : allAttempts.length === 0 ? (
        <div className="panel">
          <div className="panel-body">
            <div className="empty-state">
              <i className="ti ti-users" />
              <div className="empty-state-title">No attempts found</div>
              <div className="empty-state-text">No student attempts found for this exam.</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grading-layout">
          {/* LEFT: Student list */}
          <div className="student-list-panel">
            <div className="panel-hdr">
              <div className="panel-title">Students</div>
              <div className="search-wrap">
                <i className="ti ti-search" />
                <input
                  className="search-input"
                  placeholder="Search by name or roll no…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="panel-tabs">
              {(["all", "pending", "graded"] as const).map((tab) => (
                <div
                  key={tab}
                  className={`panel-tab ${filterTab === tab ? "active" : ""}`}
                  onClick={() => setFilterTab(tab)}
                >
                  {tab === "all" ? "All" : tab === "pending" ? "Pending" : "Graded"}
                  {" "}({tab === "all" ? allAttempts.length : tab === "pending" ? pendingAttempts.length : completedAttempts.length})
                </div>
              ))}
            </div>
            <div className="student-list">
              {displayedAttempts.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: "#858997", fontSize: 12 }}>
                  No students match this filter.
                </div>
              ) : (
                displayedAttempts.map((attempt) => {
                  const user = (attempt as any).users ?? {};
                  const student = (attempt as any).students ?? {};
                  const name = user.full_name ?? "Unknown Student";
                  const roll = student.roll_number ?? "";
                  const status = getStatus(attempt.id);
                  return (
                    <div
                      className={`student-item ${selectedAttemptId === attempt.id ? "active" : ""}`}
                      key={attempt.id}
                      onClick={() => { setSelectedAttemptId(attempt.id); setScores({}); }}
                    >
                      <div className="s-avatar">{studentInitials(name)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="s-name">{name}</div>
                        <div className="s-roll">{roll}</div>
                      </div>
                      <div className="s-status">
                        {status === "pending" && <span className="badge badge-pending">Pending</span>}
                        {status === "graded" && <span className="badge badge-published">Graded</span>}
                        {status === "no-subjective" && <span className="badge" style={{ background: "#f1f2f5", color: "#616573" }}>No Subj.</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT: Grading panel */}
          <div className="grading-panel">
            {!selectedAttemptId ? (
              <div style={{ padding: 40, textAlign: "center" }}>
                <i className="ti ti-writing" style={{ fontSize: 48, color: "#d1d5db", marginBottom: 12 }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: "#6b6b7b" }}>Select a student</div>
                <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>
                  Choose a student from the left panel to grade their answers.
                </div>
              </div>
            ) : (
              <>
                <div className="grading-hdr">
                  <div className="grading-hdr-left">
                    <div className="g-exam-title">{(selectedAttempt as any)?.users?.full_name ?? "Student"}</div>
                    <div className="g-meta">
                      {pendingTotal} subjective question{pendingTotal !== 1 ? "s" : ""} pending ·{" "}
                      {studentAnswersForAttempt.filter((a) => a.marks_awarded != null).length} graded
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" disabled={!selectedAttemptId} onClick={handleSave}>
                      <i className={`ti ${saving ? "ti-loader spinner" : "ti-device-floppy"}`} />
                      {saving ? "Saving…" : "Save"}
                    </button>
                    <button className="btn btn-success btn-sm" disabled={!selectedAttemptId} onClick={handleSaveAndNext}>
                      <i className="ti ti-check" /> Save & Next
                    </button>
                  </div>
                </div>

                <div className="grading-body">
                  {studentAnswersForAttempt.length === 0 ? (
                    <div className="empty-state" style={{ padding: "30px 20px" }}>
                      <i className="ti ti-circle-check" />
                      <div className="empty-state-title">No subjective answers</div>
                      <div className="empty-state-text">This student has no answers requiring manual grading.</div>
                    </div>
                  ) : (
                    studentAnswersForAttempt.map((answer) => {
                      const qData = (answer as any).questions ?? {};
                      const maxMarks = qData.marks ?? 5;
                      const needsGrading = answer.marks_awarded == null;
                      return (
                        <div className="q-card" key={answer.id}>
                          <div className="q-card-hdr">
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span className="q-num">Q</span>
                              <span className="q-type-badge">{qData.question_type ?? "SUBJECTIVE"}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <div className="q-marks-badge">{maxMarks} marks</div>
                              {needsGrading ? (
                                <span style={{ background: "#fff3d8", color: "#94600a", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4 }}>
                                  Needs Grading
                                </span>
                              ) : (
                                <span style={{ background: "#def8ee", color: "#08775b", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4 }}>
                                  Graded: {answer.marks_awarded}/{maxMarks}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="q-body">
                            {qData.question_text && <div className="q-text">{qData.question_text}</div>}
                            <div className="q-answer-label">Student's Answer</div>
                            <div className={`q-answer-box ${needsGrading ? "is-sa" : ""}`}>
                              {answer.answer_text ?? "(No answer provided)"}
                            </div>
                            {needsGrading && (
                              <div className="score-input-row">
                                <div className="score-label">Score:</div>
                                <input
                                  className="score-input"
                                  type="number"
                                  value={scores[answer.id] ?? ""}
                                  placeholder="—"
                                  min={0}
                                  max={maxMarks}
                                  onChange={(e) => handleScoreChange(answer.id, Number(e.target.value))}
                                />
                                <div className="score-max">/ {maxMarks}</div>
                                <div className="quick-score-btns">
                                  {Array.from({ length: Math.min(maxMarks + 1, 5) }, (_, i) => {
                                    const val = Math.round((maxMarks / 4) * i);
                                    return (
                                      <button className="quick-score-btn" key={val} onClick={() => handleScoreChange(answer.id, val)}>
                                        {val}
                                      </button>
                                    );
                                  })}
                                  <button className="quick-score-btn" onClick={() => handleScoreChange(answer.id, maxMarks)}>
                                    Full ({maxMarks})
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="grading-footer">
                  <div>
                    <div className="grading-score-tally">
                      Total: {autoScore} + <span id="subj-score">{manualScoreTotal > 0 ? manualScoreTotal : "—"}</span> /{" "}
                      {studentAnswersForAttempt.reduce((sum, a) => sum + ((a as any).questions?.marks ?? 5), 0)}
                    </div>
                    <div className="grading-progress">
                      Graded: {studentAnswersForAttempt.filter((a) => a.marks_awarded != null).length} / {studentAnswersForAttempt.length}
                    </div>
                  </div>
                  <button className="btn btn-primary" onClick={handleSave}>
                    <i className="ti ti-device-floppy" /> Save
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </FacultyLayout>
  );
}
