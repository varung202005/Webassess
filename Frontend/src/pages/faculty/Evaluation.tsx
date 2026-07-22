import { useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import FacultyLayout from "../../features/faculty/FacultyLayout";
import {
  useExams,
  useExamAttempts,
  useFacultyDashboard,
} from "../../features/faculty/hooks";
import { facultyApi } from "../../features/faculty/api";
import { downloadExcel } from "../../lib/exportExcel";
import { useQuery } from "@tanstack/react-query";

/* ── Types ────────────────────────────────────────────────── */
interface AttemptDetail {
  attempt: Record<string, any>;
  result: Record<string, any> | null;
  answers: AnswerDetail[];
  summary: {
    total_questions: number;
    attempted: number;
    correct: number;
    incorrect: number;
    skipped: number;
    score: number;
    max_score: number;
    percentage: number;
    grade: string;
    is_passed: boolean;
    is_published: boolean;
    time_spent_sec: number;
    submission_type: string;
  };
}

interface AnswerDetail {
  answer_id: string;
  question_id: string;
  question_text: string;
  question_type: string;
  max_marks: number;
  difficulty: string;
  all_options: { id: string; option_text: string; is_correct: boolean }[];
  student_selected_option_id: string | null;
  student_selected_option_text: string;
  correct_option_ids: string[];
  correct_option_texts: string[];
  is_correct: boolean | null;
  marks_awarded: number;
  time_spent_sec: number;
  is_marked_for_review: boolean;
  was_answered: boolean;
}

/* ── Helpers ──────────────────────────────────────────────── */
function studentInitials(name: string) {
  return (
    name
      ?.split(/\s+/)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ?? "?"
  );
}

function fmtTime(sec: number) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function fmtDuration(sec: number) {
  if (!sec) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/* ── Hook: attempt detail via React Query ─────────────────── */
function useAttemptDetail(attemptId: string | null) {
  return useQuery<AttemptDetail>({
    queryKey: ["attempt-detail", attemptId],
    queryFn: () => facultyApi.getAttemptDetail(attemptId!) as unknown as Promise<AttemptDetail>,
    enabled: !!attemptId,
    staleTime: 30_000,
  });
}

/* ── Stat pill ────────────────────────────────────────────── */
function StatPill({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="stat-pill">
      <div className="stat-pill-val" style={color ? { color } : {}}>{value}</div>
      <div className="stat-pill-label">{label}</div>
    </div>
  );
}

/* ── Score ring ───────────────────────────────────────────── */
function ScoreRing({ pct, passed }: { pct: number; passed: boolean }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const fill = Math.min(pct / 100, 1) * circ;
  const color = passed ? "var(--c-success-500)" : "var(--c-danger-500)";
  return (
    <svg width={88} height={88} viewBox="0 0 88 88" style={{ flexShrink: 0 }}>
      <circle cx={44} cy={44} r={r} fill="none" stroke="var(--c-gray-100)" strokeWidth={8} />
      <circle
        cx={44} cy={44} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={`${fill} ${circ - fill}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
      />
      <text x={44} y={40} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--c-gray-900)">{pct}%</text>
      <text x={44} y={54} textAnchor="middle" fontSize={10} fill={color} fontWeight={600}>{passed ? "PASS" : "FAIL"}</text>
    </svg>
  );
}

/* ── Answer card ──────────────────────────────────────────── */
function AnswerCard({ ans, idx }: { ans: AnswerDetail; idx: number }) {
  const [expanded, setExpanded] = useState(false);

  const status = !ans.was_answered
    ? { bg: "#f3f4f6", text: "#6b7280", label: "Skipped" }
    : ans.is_correct
    ? { bg: "#dcfce7", text: "#15803d", label: "Correct" }
    : { bg: "#fee2e2", text: "#dc2626", label: "Wrong" };

  return (
    <div style={{ marginBottom: 10, border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", background: "white" }}>
      {/* Collapsed header */}
      <div
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer", userSelect: "none" }}
        onClick={() => setExpanded((p) => !p)}
      >
        <span style={{ width: 28, height: 28, borderRadius: "50%", background: status.bg, color: status.text, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
          {idx + 1}
        </span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {ans.question_text || "(No question text)"}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {ans.difficulty && (
            <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 4, border: "1px solid #e5e7eb", color: "#9ca3af" }}>
              {ans.difficulty}
            </span>
          )}
          <span style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>
            {ans.marks_awarded ?? 0}<span style={{ color: "#d1d5db" }}>/{ans.max_marks}</span>
          </span>
          {ans.time_spent_sec > 0 && (
            <span style={{ fontSize: 11, color: "#9ca3af" }}>⏱ {fmtTime(ans.time_spent_sec)}</span>
          )}
          <span style={{ background: status.bg, color: status.text, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
            {status.label}
          </span>
          <i className={`ti ti-chevron-${expanded ? "up" : "down"}`} style={{ color: "#9ca3af", fontSize: 13 }} />
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div style={{ borderTop: "1px solid #f3f4f6", padding: "16px" }}>
          {/* Question text */}
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 14, lineHeight: 1.6 }}>
            {ans.question_text}
          </div>

          {/* Options */}
          {ans.all_options.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ans.all_options.map((opt) => {
                const isSelected = opt.id === ans.student_selected_option_id;
                const isCorrect = opt.is_correct;

                let bg = "#fafafa", border = "1.5px solid #e5e7eb", textColor = "#374151";
                let icon: ReactNode = null;

                if (isCorrect && isSelected) {
                  bg = "#f0fdf4"; border = "1.5px solid #16a34a"; textColor = "#14532d";
                  icon = <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>✓ Correct</span>;
                } else if (isCorrect) {
                  bg = "#f0fdf4"; border = "1.5px dashed #4ade80"; textColor = "#166534";
                  icon = <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>✓ Correct answer</span>;
                } else if (isSelected) {
                  bg = "#fff1f2"; border = "1.5px solid #f87171"; textColor = "#7f1d1d";
                  icon = <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>✗ Student picked</span>;
                }

                return (
                  <div key={opt.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, background: bg, border, fontSize: 13, color: textColor }}>
                    <span style={{
                      width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                      border: `2px solid ${isCorrect ? "#16a34a" : isSelected ? "#dc2626" : "#d1d5db"}`,
                      background: isSelected ? (isCorrect ? "#16a34a" : "#dc2626") : "white",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {isSelected && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "white", display: "block" }} />}
                    </span>
                    <span style={{ flex: 1, lineHeight: 1.5 }}>{opt.option_text}</span>
                    {icon}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Fallback — options not loaded, show text summary */
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ padding: "10px 14px", borderRadius: 8, background: ans.was_answered ? "#fff1f2" : "#f9fafb", border: `1.5px solid ${ans.was_answered ? "#fca5a5" : "#e5e7eb"}`, fontSize: 13 }}>
                <span style={{ color: "#9ca3af", marginRight: 6 }}>Student answered:</span>
                <span style={{ fontWeight: 600, color: ans.was_answered ? "#dc2626" : "#9ca3af" }}>
                  {ans.student_selected_option_text || (ans.was_answered ? "—" : "Not answered")}
                </span>
              </div>
              {ans.correct_option_texts.length > 0 && (
                <div style={{ padding: "10px 14px", borderRadius: 8, background: "#f0fdf4", border: "1.5px solid #86efac", fontSize: 13 }}>
                  <span style={{ color: "#9ca3af", marginRight: 6 }}>Correct answer:</span>
                  <span style={{ fontWeight: 600, color: "#166534" }}>{ans.correct_option_texts.join(", ")}</span>
                </div>
              )}
            </div>
          )}

          {!ans.was_answered && (
            <div style={{ marginTop: 10, padding: "8px 14px", background: "#f9fafb", borderRadius: 8, fontSize: 12, color: "#9ca3af", border: "1px dashed #e5e7eb" }}>
              Student did not attempt this question
            </div>
          )}
          {ans.is_marked_for_review && (
            <div style={{ marginTop: 8, fontSize: 11, color: "#d97706", display: "flex", alignItems: "center", gap: 4 }}>
              <i className="ti ti-flag" /> Marked for review
            </div>
          )}
        </div>
      )}
    </div>
  );
}


/* ── Student detail panel ─────────────────────────────────── */
function StudentDetailPanel({ attemptId }: { attemptId: string }) {
  const { data, isLoading, isError, error } = useAttemptDetail(attemptId);
  const [filter, setFilter] = useState<"all" | "correct" | "wrong" | "skipped">("all");

  if (isLoading) return (
    <div className="grading-panel loading-state" style={{ padding: 40 }}>
      <span className="spinner" /> Loading student responses…
    </div>
  );

  if (isError || !data) {
    if (isError) console.error("[attempt-detail] fetch failed:", error);
    return (
      <div className="grading-panel" style={{ padding: 32, textAlign: "center", color: "var(--c-gray-500)" }}>
        <i className="ti ti-alert-circle" style={{ fontSize: 32, marginBottom: 8, display: "block" }} />
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Failed to load attempt details.</div>
        {isError && (
          <div style={{ fontSize: 11, color: "var(--c-danger-600)", background: "var(--c-danger-50)", padding: "8px 12px", borderRadius: 6, maxWidth: 400, margin: "0 auto", textAlign: "left", wordBreak: "break-all" }}>
            {String((error as any)?.message ?? error)}
          </div>
        )}
      </div>
    );
  }

  // FIX: access properties individually to avoid destructuring type errors
  const summary = data.summary;
  const answers = data.answers;
  const attempt = data.attempt;

  const user = attempt?.users ?? {};
  const student = attempt?.students ?? {};

  // FIX: explicit type annotation on filter callback parameter
  const filteredAnswers = answers.filter((a: AnswerDetail) => {
    if (filter === "correct") return a.is_correct === true;
    if (filter === "wrong") return a.was_answered && a.is_correct === false;
    if (filter === "skipped") return !a.was_answered;
    return true;
  });

  return (
    <div className="grading-panel" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div className="grading-hdr">
        <div className="grading-hdr-left">
          <div className="g-exam-title">{user.full_name ?? "Student"}</div>
          <div className="g-meta">
            {student.roll_number && <span style={{ marginRight: 10 }}>Roll: {student.roll_number}</span>}
            {student.semester && <span style={{ marginRight: 10 }}>Sem {student.semester}</span>}
            {student.section && <span style={{ marginRight: 10 }}>Sec {student.section}</span>}
            {attempt?.submitted_at ? `Submitted: ${new Date(attempt.submitted_at).toLocaleString()}` : ""}
            {summary.submission_type && (
              <span style={{ marginLeft: 8, color: summary.submission_type === "AUTO_SUBMITTED" ? "var(--c-warning-600)" : "inherit" }}>
                · {summary.submission_type === "AUTO_SUBMITTED" ? "Auto-submitted" : "Manual"}
              </span>
            )}
          </div>
        </div>
        <div>
          {summary.is_published ? (
            <span style={{ background: "#def8ee", color: "#08775b", fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 6 }}>
              <i className="ti ti-check" /> Result Published
            </span>
          ) : (
            <span style={{ background: "#fff3d8", color: "#94600a", fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 6 }}>
              <i className="ti ti-clock" /> Not Published
            </span>
          )}
        </div>
      </div>

      {/* Score summary */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--c-gray-100)", background: "var(--c-gray-50)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* Ring */}
          <ScoreRing pct={summary.percentage} passed={summary.is_passed} />

          {/* Stats grid */}
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px 20px" }}>
            {[
              { label: "Score", value: `${summary.score} / ${summary.max_score}`, color: "var(--c-primary-700)" },
              { label: "Grade", value: summary.grade || "—", color: summary.is_passed ? "var(--c-success-700)" : "var(--c-danger-700)" },
              { label: "Time Spent", value: fmtDuration(summary.time_spent_sec), color: undefined },
              { label: "Correct", value: summary.correct, color: "var(--c-success-700)" },
              { label: "Wrong", value: summary.incorrect, color: "var(--c-danger-700)" },
              { label: "Skipped", value: summary.skipped, color: "var(--c-gray-500)" },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: "var(--c-gray-400)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
                  {label}
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, color: color ?? "var(--c-gray-900)" }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="panel-tabs" style={{ padding: "0 20px", flexShrink: 0 }}>
        {([
          { key: "all", label: `All (${answers.length})` },
          { key: "correct", label: `Correct (${summary.correct})` },
          { key: "wrong", label: `Wrong (${summary.incorrect})` },
          { key: "skipped", label: `Skipped (${summary.skipped})` },
        ] as const).map((t) => (
          <div key={t.key} className={`panel-tab ${filter === t.key ? "active" : ""}`} onClick={() => setFilter(t.key)}>
            {t.label}
          </div>
        ))}
      </div>

      {/* Scrollable answer list */}
      <div className="grading-body" style={{ flex: 1, overflowY: "auto", padding: "14px 20px" }}>
        {filteredAnswers.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--c-gray-400)", padding: 32, fontSize: 13 }}>No answers in this category.</div>
        ) : (
          // FIX: explicit type annotation on map callback parameter
          filteredAnswers.map((ans: AnswerDetail) => <AnswerCard key={ans.answer_id} ans={ans} idx={answers.indexOf(ans)} />)
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ */
export default function Evaluation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedExamId = searchParams.get("examId") ?? "";

  const { data: portal } = useFacultyDashboard();
  const { data: exams, isLoading: examsLoading } = useExams();
  const allExams = Array.isArray(exams) ? exams : portal?.recentExams ?? [];

  const { data: attemptsData, isLoading: attemptsLoading, refetch: refetchAttempts } = useExamAttempts(selectedExamId);
  const allAttempts: any[] = Array.isArray(attemptsData) ? attemptsData : [];

  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishDone, setPublishDone] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "submitted" | "in_progress">("all");

  const handleExamChange = (examId: string) => {
    navigate(`/faculty/evaluation?examId=${examId}`);
    setSelectedAttemptId(null);
    setPublishDone(false);
    setFilterTab("all");
    setSearchQuery("");
  };

  const handlePublish = async () => {
    if (!selectedExamId) return;
    if (!window.confirm("Publish all results for this exam? Students will be notified.")) return;
    setPublishing(true);
    try {
      const res = await facultyApi.publishAllResults(selectedExamId);
      setPublishDone(true);
      alert(`✓ Published ${res?.published ?? 0} result(s).`);
      await refetchAttempts();
    } catch {
      alert("Failed to publish results. Please try again.");
    } finally {
      setPublishing(false);
    }
  };

  const submittedCount = allAttempts.filter((a) => ["SUBMITTED", "AUTO_SUBMITTED"].includes(a.status)).length;
  const inProgressCount = allAttempts.filter((a) => a.status === "IN_PROGRESS").length;

  const displayedAttempts = (() => {
    let base =
      filterTab === "submitted" ? allAttempts.filter((a) => ["SUBMITTED", "AUTO_SUBMITTED"].includes(a.status))
      : filterTab === "in_progress" ? allAttempts.filter((a) => a.status === "IN_PROGRESS")
      : allAttempts;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      base = base.filter((a) => (a.users?.full_name ?? "").toLowerCase().includes(q) || (a.students?.roll_number ?? "").toLowerCase().includes(q));
    }
    return base;
  })();

  const exportAttempts = () => {
    const examTitle = allExams.find((exam: any) => exam.id === selectedExamId)?.title ?? "exam-attempts";
    downloadExcel(`${examTitle}-attempts`, [{ name: "Attempts", rows: displayedAttempts.map((attempt) => ({
      Student: attempt.users?.full_name ?? "", Roll_Number: attempt.students?.roll_number ?? "", Email: attempt.users?.email ?? "",
      Status: attempt.status ?? "", Started_At: attempt.started_at ?? "", Submitted_At: attempt.submitted_at ?? "",
      Score: attempt.total_score ?? attempt.score ?? "", Percentage: attempt.percentage ?? "",
    })) }]);
  };

  return (
    <FacultyLayout activePage="evaluation">
      <div className="page-heading">
        <div>
          <h1>Evaluation</h1>
          <p>Review student attempts and publish results</p>
        </div>
        <div className="heading-actions exam-action-bar">
          <select className="select-filter" value={selectedExamId} onChange={(e) => handleExamChange(e.target.value)} style={{ minWidth: 240 }}>
            <option value="">Select an exam…</option>
            {allExams.map((exam: any) => (
              <option key={exam.id} value={exam.id}>{exam.title}</option>
            ))}
          </select>
          <button className="btn btn-secondary btn-sm" disabled={!selectedExamId} onClick={exportAttempts}>
            <i className="ti ti-download" /> Export
          </button>
          <button className="btn btn-primary btn-sm" disabled={!selectedExamId || publishing} onClick={handlePublish}>
            {publishing ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Publishing…</>
              : publishDone ? <><i className="ti ti-check" /> Published</>
              : <><i className="ti ti-send" /> Publish Results</>}
          </button>
        </div>
      </div>

      {!selectedExamId ? (
        <div className="panel"><div className="panel-body"><div className="empty-state">
          <i className="ti ti-writing" />
          <div className="empty-state-title">Select an exam</div>
          <div className="empty-state-text">Choose an exam from the dropdown to review student attempts.</div>
        </div></div></div>
      ) : examsLoading || attemptsLoading ? (
        <div className="loading-state"><span className="spinner" /> Loading attempts…</div>
      ) : allAttempts.length === 0 ? (
        <div className="panel"><div className="panel-body"><div className="empty-state">
          <i className="ti ti-users" />
          <div className="empty-state-title">No attempts yet</div>
          <div className="empty-state-text">No students have attempted this exam yet.</div>
        </div></div></div>
      ) : (
        <div className="grading-layout">
          {/* LEFT */}
          <div className="student-list-panel">
            <div className="panel-hdr">
              <div className="panel-title">
                Students
                <span style={{ marginLeft: 8, background: "var(--c-gray-100)", color: "var(--c-gray-600)", fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 10 }}>
                  {allAttempts.length}
                </span>
              </div>
              <div className="search-wrap">
                <i className="ti ti-search" />
                <input className="search-input" placeholder="Name or roll number…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
            </div>
            <div className="panel-tabs">
              {([
                { key: "all", label: "All", count: allAttempts.length },
                { key: "submitted", label: "Submitted", count: submittedCount },
                { key: "in_progress", label: "In Progress", count: inProgressCount },
              ] as const).map((t) => (
                <div key={t.key} className={`panel-tab ${filterTab === t.key ? "active" : ""}`} onClick={() => setFilterTab(t.key)}>
                  {t.label} ({t.count})
                </div>
              ))}
            </div>
            <div className="student-list">
              {displayedAttempts.length === 0 ? (
                <div style={{ padding: 20, textAlign: "center", color: "#858997", fontSize: 12 }}>No students match this filter.</div>
              ) : (
                displayedAttempts.map((attempt: any) => {
                  const name = attempt.users?.full_name ?? "Unknown Student";
                  const roll = attempt.students?.roll_number ?? "";
                  const isSubmitted = ["SUBMITTED", "AUTO_SUBMITTED"].includes(attempt.status);
                  return (
                    <div key={attempt.id} className={`student-item ${selectedAttemptId === attempt.id ? "active" : ""}`} onClick={() => setSelectedAttemptId(attempt.id)}>
                      <div className="s-avatar">{studentInitials(name)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="s-name">{name}</div>
                        <div className="s-roll">{roll}</div>
                      </div>
                      <div className="s-status">
                        {isSubmitted
                          ? <span className="badge badge-published">Submitted</span>
                          : <span className="badge" style={{ background: "#fff3d8", color: "#94600a" }}>In Progress</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT */}
          {!selectedAttemptId ? (
            <div className="grading-panel" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ textAlign: "center" }}>
                <i className="ti ti-user-search" style={{ fontSize: 48, color: "#d1d5db", marginBottom: 12, display: "block" }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: "#6b6b7b" }}>Select a student</div>
                <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>Click a student on the left to view their attempt.</div>
              </div>
            </div>
          ) : (
            <StudentDetailPanel attemptId={selectedAttemptId} />
          )}
        </div>
      )}
    </FacultyLayout>
  );
}
