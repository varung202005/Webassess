import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import FacultyLayout from "../../features/faculty/FacultyLayout";
import {
  useExams,
  useExamAttempts,
  useFacultyDashboard,
} from "../../features/faculty/hooks";
import { facultyApi } from "../../features/faculty/api";
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
    queryFn: () => facultyApi.getAttemptDetail(attemptId!),
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

  const statusStyle = !ans.was_answered
    ? { bg: "#f1f2f5", text: "#616573", label: "Skipped" }
    : ans.is_correct
    ? { bg: "#def8ee", text: "#08775b", label: "Correct" }
    : { bg: "#fde8e8", text: "#b91c1c", label: "Wrong" };

  return (
    <div className="q-card" style={{ marginBottom: 8, border: "1px solid var(--c-gray-200)", borderRadius: 8, overflow: "hidden" }}>
      <div className="q-card-hdr" style={{ cursor: "pointer", padding: "10px 14px" }} onClick={() => setExpanded((p) => !p)}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
          <span className="q-num" style={{ flexShrink: 0, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {idx + 1}
          </span>
          <span style={{ fontSize: 12, color: "var(--c-gray-700)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
            {ans.question_text}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span style={{ background: statusStyle.bg, color: statusStyle.text, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4 }}>
            {statusStyle.label}
          </span>
          <span style={{ fontSize: 12, color: "var(--c-gray-500)" }}>{ans.marks_awarded ?? 0}/{ans.max_marks}</span>
          {ans.time_spent_sec > 0 && (
            <span style={{ fontSize: 11, color: "var(--c-gray-400)" }}>⏱ {fmtTime(ans.time_spent_sec)}</span>
          )}
          {ans.is_marked_for_review && (
            <i className="ti ti-flag" style={{ fontSize: 12, color: "var(--c-warning-500)" }} title="Marked for review" />
          )}
          <i className={`ti ti-chevron-${expanded ? "up" : "down"}`} style={{ color: "var(--c-gray-400)", fontSize: 13 }} />
        </div>
      </div>

      {expanded && (
        <div className="q-body" style={{ padding: "12px 14px", borderTop: "1px solid var(--c-gray-100)" }}>
          <div className="q-text" style={{ marginBottom: 12, fontWeight: 500 }}>{ans.question_text}</div>

          {ans.all_options.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {ans.all_options.map((opt) => {
                const isSelected = opt.id === ans.student_selected_option_id;
                const isCorrect = opt.is_correct;
                let bg = "var(--c-gray-50)", borderColor = "var(--c-gray-200)", dotColor = "var(--c-gray-300)";
                if (isCorrect && isSelected) { bg = "#def8ee"; borderColor = "#08775b"; dotColor = "#08775b"; }
                else if (isCorrect) { bg = "#f0fdf7"; borderColor = "#34d399"; dotColor = "#34d399"; }
                else if (isSelected) { bg = "#fde8e8"; borderColor = "#b91c1c"; dotColor = "#b91c1c"; }

                return (
                  <div key={opt.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 6, border: `1.5px solid ${borderColor}`, background: bg, fontSize: 13 }}>
                    <span style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${dotColor}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {isSelected && <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, display: "block" }} />}
                    </span>
                    <span style={{ flex: 1 }}>{opt.option_text}</span>
                    {isCorrect && isSelected && <span style={{ fontSize: 11, color: "#08775b", fontWeight: 600 }}><i className="ti ti-check" /> Correct · Student's answer</span>}
                    {isCorrect && !isSelected && <span style={{ fontSize: 11, color: "#059669", fontWeight: 600 }}><i className="ti ti-check" /> Correct answer</span>}
                    {isSelected && !isCorrect && <span style={{ fontSize: 11, color: "#b91c1c", fontWeight: 600 }}><i className="ti ti-x" /> Student's answer</span>}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "var(--c-gray-600)" }}>
              {ans.was_answered ? (
                <><strong>Student answered:</strong> {ans.student_selected_option_text || "—"}<br /><strong>Correct:</strong> {ans.correct_option_texts.join(", ") || "—"}</>
              ) : (
                <span style={{ color: "var(--c-gray-400)" }}>Not answered</span>
              )}
            </div>
          )}

          {!ans.was_answered && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: "#f1f2f5", borderRadius: 6, fontSize: 12, color: "#616573" }}>
              Student did not attempt this question.
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
    // Log the real error so it's visible in browser console
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

  const { summary, answers, attempt } = data;
  const user = attempt?.users ?? {};
  const student = attempt?.students ?? {};

  const filteredAnswers = answers.filter((a) => {
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
      <div style={{ display: "flex", alignItems: "center", gap: 24, padding: "16px 20px", borderBottom: "1px solid var(--c-gray-100)", background: "var(--c-gray-50)", flexShrink: 0 }}>
        <ScoreRing pct={summary.percentage} passed={summary.is_passed} />
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", flex: 1 }}>
          <StatPill label="Score" value={`${summary.score}/${summary.max_score}`} color="var(--c-primary-700)" />
          <StatPill label="Correct" value={summary.correct} color="var(--c-success-700)" />
          <StatPill label="Wrong" value={summary.incorrect} color="var(--c-danger-700)" />
          <StatPill label="Skipped" value={summary.skipped} />
          <StatPill label="Grade" value={summary.grade || "—"} color={summary.is_passed ? "var(--c-success-700)" : "var(--c-danger-700)"} />
          <StatPill label="Time" value={fmtDuration(summary.time_spent_sec)} />
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
          filteredAnswers.map((ans) => <AnswerCard key={ans.answer_id} ans={ans} idx={answers.indexOf(ans)} />)
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

  return (
    <FacultyLayout activePage="evaluation">
      <div className="page-heading">
        <div>
          <h1>Evaluation</h1>
          <p>Review student attempts and publish results</p>
        </div>
        <div className="heading-actions">
          <select className="select-filter" value={selectedExamId} onChange={(e) => handleExamChange(e.target.value)} style={{ minWidth: 240 }}>
            <option value="">Select an exam…</option>
            {allExams.map((exam: any) => (
              <option key={exam.id} value={exam.id}>{exam.title} ({exam.courses?.code ?? ""})</option>
            ))}
          </select>
          <button className="btn btn-secondary btn-sm" disabled={!selectedExamId}>
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