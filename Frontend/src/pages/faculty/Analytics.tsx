import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import FacultyLayout from "../../features/faculty/FacultyLayout";
import { Loading, ErrorBlock, EmptyState, PageHeading } from "../../features/faculty/components";
import { useExams, useExamAnalytics, useFacultyDashboard } from "../../features/faculty/hooks";

/* ── Color helpers ────────────────────────────────────────── */
const GRADE_COLORS: Record<string, string> = {
  "A+": "#065F46", A: "#059669", B: "#2563EB",
  C: "#D97706", D: "#EA580C", F: "#DC2626",
};
function gradeColor(g: string) { return GRADE_COLORS[g] ?? "#6B7280"; }
function pctColor(pct: number) {
  if (pct >= 70) return "var(--c-success-700)";
  if (pct >= 50) return "var(--c-warning-700)";
  return "var(--c-danger-700)";
}
function diffBadge(d: string) {
  const map: Record<string, { bg: string; color: string }> = {
    EASY: { bg: "#def8ee", color: "#08775b" },
    MEDIUM: { bg: "#fff3d8", color: "#94600a" },
    HARD: { bg: "#fde8e8", color: "#b91c1c" },
  };
  return map[d] ?? { bg: "#f1f2f5", color: "#616573" };
}
function fmtDuration(min: number) {
  if (!min) return "—";
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/* ── Donut chart ──────────────────────────────────────────── */
function DonutChart({ data, size = 140 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "var(--c-gray-100)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "var(--c-gray-400)" }}>
      No data
    </div>
  );
  const cx = size / 2, cy = size / 2, r = size * 0.37, sw = size * 0.15;
  let cum = 0;
  const segments = data.filter((d) => d.value > 0).map((d) => {
    const pct = d.value / total;
    const offset = cum * 2 * Math.PI * r;
    const len = pct * 2 * Math.PI * r;
    cum += pct;
    return { ...d, offset, len };
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--c-gray-100)" strokeWidth={sw} />
      {segments.map((seg, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={sw}
          strokeDasharray={`${seg.len} ${2 * Math.PI * r - seg.len}`}
          strokeDashoffset={-seg.offset} transform={`rotate(-90 ${cx} ${cy})`} />
      ))}
      <text x={cx} y={cy - 3} textAnchor="middle" fontSize={15} fontWeight={700} fill="var(--c-gray-900)">{total}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize={10} fill="var(--c-gray-500)">students</text>
    </svg>
  );
}

/* ── Bar chart ────────────────────────────────────────────── */
function BarChart({ data, height = 140, color = "var(--c-primary-700)" }: { data: { label: string; value: number }[]; height?: number; color?: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height, paddingTop: 8 }}>
      {data.map((d, i) => {
        const pct = (d.value / max) * 100;
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, height: "100%", justifyContent: "flex-end" }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: "var(--c-gray-600)" }}>{d.value || ""}</span>
            <div style={{ width: "100%", maxWidth: 36, height: `${pct}%`, minHeight: d.value > 0 ? 4 : 0, background: color, borderRadius: "3px 3px 0 0" }} />
            <span style={{ fontSize: 9, color: "var(--c-gray-400)", textAlign: "center" }}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Stat card ────────────────────────────────────────────── */
function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-val" style={color ? { color } : {}}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--c-gray-500)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

/* ── Question performance table ───────────────────────────── */
function QuestionPerformanceTable({ questions }: { questions: any[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  if (!questions.length) return (
    <div style={{ padding: 24, textAlign: "center", color: "var(--c-gray-400)", fontSize: 13 }}>No question data available.</div>
  );
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="topic-table">
        <thead>
          <tr>
            <th style={{ width: 40 }}>#</th>
            <th>Question</th>
            <th>Attempted</th>
            <th>Correct</th>
            <th>Wrong</th>
            <th>Skipped</th>
            <th>Accuracy</th>
            <th>Difficulty</th>
          </tr>
        </thead>
        <tbody>
          {questions.map((q: any, idx: number) => {
            const isOpen = expanded === q.question_id;
            const diff = diffBadge(q.difficulty);
            return (
              <>
                <tr key={q.question_id} style={{ cursor: "pointer" }} onClick={() => setExpanded(isOpen ? null : q.question_id)}>
                  <td style={{ color: "var(--c-gray-400)", fontSize: 12 }}>Q{idx + 1}</td>
                  <td style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>
                    <i className={`ti ti-chevron-${isOpen ? "up" : "right"}`} style={{ fontSize: 11, color: "var(--c-gray-400)", marginRight: 6 }} />
                    {q.question_text}
                  </td>
                  <td>{q.total_attempted}</td>
                  <td style={{ color: "var(--c-success-700)", fontWeight: 600 }}>{q.correct_count}</td>
                  <td style={{ color: "var(--c-danger-700)", fontWeight: 600 }}>{q.incorrect_count}</td>
                  <td style={{ color: "var(--c-gray-500)" }}>{q.skipped_count}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div className="perf-bar" style={{ width: 80 }}>
                        <div className="perf-bar-fill" style={{ width: `${q.accuracy_pct}%`, background: pctColor(q.accuracy_pct) }} />
                      </div>
                      <span style={{ fontWeight: 700, fontSize: 12, color: pctColor(q.accuracy_pct) }}>{q.accuracy_pct}%</span>
                    </div>
                  </td>
                  <td>
                    <span style={{ background: diff.bg, color: diff.color, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4 }}>
                      {q.difficulty || "—"}
                    </span>
                  </td>
                </tr>
                {isOpen && q.option_distribution?.length > 0 && (
                  <tr key={`${q.question_id}-detail`}>
                    <td colSpan={8} style={{ padding: "0 16px 12px 40px", background: "var(--c-gray-50)" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--c-gray-600)", marginBottom: 8, paddingTop: 10 }}>Option distribution</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {q.option_distribution.map((opt: any) => (
                          <div key={opt.option_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", borderRadius: 6, background: opt.is_correct ? "#def8ee" : "white", border: `1px solid ${opt.is_correct ? "#08775b" : "var(--c-gray-200)"}` }}>
                            {opt.is_correct
                              ? <i className="ti ti-check" style={{ color: "#08775b", fontSize: 12 }} />
                              : <i className="ti ti-minus" style={{ color: "var(--c-gray-300)", fontSize: 12 }} />}
                            <span style={{ flex: 1, fontSize: 12 }}>{opt.option_text}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ width: 80, height: 6, borderRadius: 3, background: "var(--c-gray-100)", overflow: "hidden" }}>
                                <div style={{ width: `${opt.pick_pct}%`, height: "100%", background: opt.is_correct ? "#08775b" : "var(--c-gray-400)", borderRadius: 3 }} />
                              </div>
                              <span style={{ fontSize: 11, color: "var(--c-gray-500)", minWidth: 56 }}>{opt.pick_count} ({opt.pick_pct}%)</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Main Analytics Page ──────────────────────────────────── */
export default function Analytics() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectedExamId = searchParams.get("examId") ?? "";

  const { data: portal } = useFacultyDashboard();
  const { data: exams } = useExams();
  const allExams = Array.isArray(exams) ? exams : portal?.recentExams ?? [];

  const { data: analytics, isLoading, isError, error, refetch } = useExamAnalytics(selectedExamId);
  const [activeTab, setActiveTab] = useState<"overview" | "questions" | "toppers">("overview");

  const handleExamChange = (examId: string) => {
    navigate(`/faculty/analytics?examId=${examId}`);
    setActiveTab("overview");
  };

  const gradeData = analytics?.grade_distribution
    ? Object.entries(analytics.grade_distribution).map(([label, value]) => ({ label, value: value as number, color: gradeColor(label) }))
    : [];

  const scoreData = analytics?.score_distribution
    ? analytics.score_distribution.map((val: number, i: number) => ({ label: analytics.score_labels?.[i] ?? `${i * 10}–${(i + 1) * 10}%`, value: val }))
    : [];

  return (
    <FacultyLayout activePage="analytics">
      <PageHeading
        title="Exam Analytics"
        subtitle={analytics ? `${analytics.exam_title} · ${analytics.course_name}` : "Select an exam to view analytics"}
        actions={
          <div className="exam-action-bar">
            <select className="select-filter" value={selectedExamId} onChange={(e) => handleExamChange(e.target.value)} style={{ minWidth: 240 }}>
              <option value="">Select an exam…</option>
              {allExams.map((exam: any) => (
                <option key={exam.id} value={exam.id}>{exam.title}</option>
              ))}
            </select>
            <button className="btn btn-secondary btn-sm" disabled={!analytics}>
              <i className="ti ti-download" /> Export
            </button>
          </div>
        }
      />

      {!selectedExamId ? (
        <div style={{ paddingTop: 40 }}>
          <EmptyState icon="ti ti-chart-bar" title="Select an exam" text="Choose an exam from the dropdown to view analytics." />
        </div>
      ) : isLoading ? (
        <Loading text="Loading analytics…" />
      ) : isError ? (
        <ErrorBlock error={error} onRetry={() => refetch()} />
      ) : !analytics ? (
        <EmptyState icon="ti ti-chart-bar" title="No data" text="No analytics data available." />
      ) : (
        <>
          {/* Exam meta strip */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", padding: "10px 16px", background: "var(--c-gray-50)", borderRadius: 8, border: "1px solid var(--c-gray-100)", fontSize: 12 }}>
            {[
              { label: "Total Marks", value: analytics.total_marks },
              { label: "Pass Marks", value: analytics.pass_marks },
              { label: "Duration", value: fmtDuration(analytics.duration_minutes) },
              { label: "Course", value: analytics.course_code || analytics.course_name || "—" },
            ].map((m) => (
              <div key={m.label} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ color: "var(--c-gray-400)" }}>{m.label}:</span>
                <span style={{ fontWeight: 600, color: "var(--c-gray-800)" }}>{m.value}</span>
              </div>
            ))}
          </div>

          {/* Stats row */}
          <div className="stats-row analytics">
            <StatCard label="Registered" value={analytics.total_registered} sub="enrolled students" />
            <StatCard label="Appeared" value={analytics.total_appeared}
              sub={`${analytics.total_registered > 0 ? Math.round((analytics.total_appeared / analytics.total_registered) * 100) : 0}% of registered`} />
            <StatCard label="Pass Rate" value={`${analytics.pass_rate}%`}
              sub={`${analytics.passed} passed · ${analytics.failed} failed`}
              color={analytics.pass_rate >= 70 ? "var(--c-success-700)" : analytics.pass_rate >= 50 ? "var(--c-warning-700)" : "var(--c-danger-700)"} />
            <StatCard label="Avg Score" value={analytics.average_score} sub={`${analytics.average_percentage}% avg`} />
            <StatCard label="Highest" value={analytics.highest_score} sub={analytics.highest_scorer ?? "—"} color="var(--c-success-700)" />
            <StatCard label="Lowest" value={analytics.lowest_score} sub={analytics.lowest_scorer ?? "—"} color="var(--c-danger-700)" />
            <StatCard label="Median" value={analytics.median_score}
              sub={`${analytics.total_marks > 0 ? Math.round((analytics.median_score / analytics.total_marks) * 100) : 0}%`} />
          </div>

          {/* Tabs */}
          <div className="panel-tabs" style={{ marginBottom: 16 }}>
            {([
              { key: "overview", label: "Overview" },
              { key: "questions", label: `Questions (${analytics.question_performance?.length ?? 0})` },
              { key: "toppers", label: `Top Students (${analytics.topper_list?.length ?? 0})` },
            ] as const).map((t) => (
              <div key={t.key} className={`panel-tab ${activeTab === t.key ? "active" : ""}`} onClick={() => setActiveTab(t.key)}>
                {t.label}
              </div>
            ))}
          </div>

          {/* ── Overview ── */}
          {activeTab === "overview" && (
            <>
              <div className="chart-grid">
                <div className="chart-card">
                  <div className="chart-hdr"><div><div className="chart-title">Grade Distribution</div><div className="chart-sub">Students by grade band</div></div></div>
                  <div style={{ display: "flex", alignItems: "center", gap: 24, justifyContent: "center", padding: "8px 0" }}>
                    <DonutChart data={gradeData} size={140} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      {gradeData.map((g) => (
                        <div key={g.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 2, background: g.color, display: "inline-block" }} />
                          <span style={{ fontWeight: 600, minWidth: 24 }}>{g.label}</span>
                          <span style={{ color: "var(--c-gray-500)" }}>
                            {g.value} ({gradeData.reduce((s, d) => s + d.value, 0) > 0 ? Math.round((g.value / gradeData.reduce((s, d) => s + d.value, 0)) * 100) : 0}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="chart-card">
                  <div className="chart-hdr"><div><div className="chart-title">Score Distribution</div><div className="chart-sub">Students per percentage band</div></div></div>
                  <BarChart data={scoreData} color="var(--c-primary-700)" />
                </div>

                <div className="chart-card">
                  <div className="chart-hdr"><div><div className="chart-title">Pass vs Fail</div><div className="chart-sub">Overall result split</div></div></div>
                  <div style={{ display: "flex", alignItems: "center", gap: 24, justifyContent: "center", padding: "8px 0" }}>
                    <DonutChart data={[
                      { label: "Pass", value: analytics.passed, color: "var(--c-success-500)" },
                      { label: "Fail", value: analytics.failed, color: "var(--c-danger-500)" },
                    ]} size={140} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {[
                        { label: "Pass", value: analytics.passed, color: "var(--c-success-500)" },
                        { label: "Fail", value: analytics.failed, color: "var(--c-danger-500)" },
                      ].map((d) => (
                        <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 2, background: d.color, display: "inline-block" }} />
                          <span style={{ fontSize: 12 }}>{d.label} — <strong>{d.value}</strong></span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {analytics.topic_performance?.length > 0 && (
                <div className="chart-card" style={{ marginTop: 0 }}>
                  <div className="chart-hdr"><div><div className="chart-title">Topic-wise Performance</div><div className="chart-sub">Average accuracy per topic</div></div></div>
                  <table className="topic-table">
                    <thead><tr><th>Topic</th><th>Questions</th><th>Avg Accuracy</th><th>Performance</th><th>Difficulty</th></tr></thead>
                    <tbody>
                      {analytics.topic_performance.map((topic: any, idx: number) => {
                        const diff = diffBadge(topic.difficulty);
                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight: 600 }}>{topic.topic}</td>
                            <td>{topic.question_count}</td>
                            <td style={{ fontWeight: 700, color: pctColor(topic.avg_accuracy) }}>{topic.avg_accuracy}%</td>
                            <td style={{ minWidth: 140 }}>
                              <div className="perf-bar">
                                <div className="perf-bar-fill" style={{ width: `${topic.avg_accuracy}%`, background: pctColor(topic.avg_accuracy) }} />
                              </div>
                            </td>
                            <td>
                              <span style={{ background: diff.bg, color: diff.color, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4 }}>{topic.difficulty}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* ── Questions ── */}
          {activeTab === "questions" && (
            <div className="chart-card">
              <div className="chart-hdr"><div><div className="chart-title">Question-wise Performance</div><div className="chart-sub">Click a row to expand option distribution</div></div></div>
              <QuestionPerformanceTable questions={analytics.question_performance ?? []} />
            </div>
          )}

          {/* ── Toppers ── */}
          {activeTab === "toppers" && (
            <div className="chart-card">
              <div className="chart-hdr"><div><div className="chart-title">Top Students</div><div className="chart-sub">Ranked by score</div></div></div>
              {analytics.topper_list?.length > 0 ? (
                <table className="topic-table">
                  <thead><tr><th style={{ width: 48 }}>Rank</th><th>Name</th><th>Roll No.</th><th>Score</th><th>Percentage</th><th>Grade</th><th>Result</th></tr></thead>
                  <tbody>
                    {analytics.topper_list.map((s: any) => (
                      <tr key={s.rank}>
                        <td>
                          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: "50%", background: s.rank === 1 ? "#FDE68A" : s.rank === 2 ? "#E5E7EB" : s.rank === 3 ? "#FED7AA" : "var(--c-gray-100)", fontSize: 11, fontWeight: 700, color: s.rank <= 3 ? "#374151" : "var(--c-gray-500)" }}>
                            {s.rank}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{s.name}</td>
                        <td style={{ color: "var(--c-gray-500)" }}>{s.roll_number || "—"}</td>
                        <td style={{ fontWeight: 700 }}>{s.score}/{analytics.total_marks}</td>
                        <td style={{ fontWeight: 700, color: pctColor(s.percentage) }}>{s.percentage}%</td>
                        <td>
                          <span style={{ background: `${gradeColor(s.grade)}20`, color: gradeColor(s.grade), fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 4 }}>{s.grade}</span>
                        </td>
                        <td>
                          <span style={{ background: s.is_passed ? "#def8ee" : "#fde8e8", color: s.is_passed ? "#08775b" : "#b91c1c", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4 }}>
                            {s.is_passed ? "Pass" : "Fail"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: 24, textAlign: "center", color: "var(--c-gray-400)", fontSize: 13 }}>No results available yet.</div>
              )}
            </div>
          )}
        </>
      )}
    </FacultyLayout>
  );
}
