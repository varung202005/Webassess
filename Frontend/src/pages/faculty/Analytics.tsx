import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import FacultyLayout from "../../features/faculty/FacultyLayout";
import { Loading, ErrorBlock, EmptyState, PageHeading } from "../../features/faculty/components";
import { useExams, useExamAnalytics, useFacultyDashboard } from "../../features/faculty/hooks";

/* ── Color palette ────────────────────────────────────────── */
const GRADE_COLORS: Record<string, string> = {
  A: "#065F46",
  B: "#B31234",
  C: "#F59E0B",
  D: "#EF4444",
  F: "#6B7280",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  EASY: "var(--c-success-500)",
  MEDIUM: "var(--c-warning-500)",
  HARD: "var(--c-danger-500)",
  "VERY HARD": "#6B7280",
};

function initials(name: string) {
  return name?.split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 2) ?? "?";
}

/* ── Donut Chart (SVG) ────────────────────────────────────── */
function DonutChart({
  data,
  size = 160,
}: {
  data: Array<{ label: string; value: number; color: string }>;
  size?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: "var(--c-gray-100)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          color: "var(--c-gray-500)",
        }}
      >
        No data
      </div>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const strokeWidth = size * 0.16;

  let cumulative = 0;
  const segments = data
    .filter((d) => d.value > 0)
    .map((d) => {
      const pct = d.value / total;
      const offset = cumulative * 2 * Math.PI * r;
      const len = pct * 2 * Math.PI * r;
      cumulative += pct;
      return { ...d, pct, offset, len };
    });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--c-gray-100)" strokeWidth={strokeWidth} />
      {segments.map((seg, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={seg.color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${seg.len} ${2 * Math.PI * r - seg.len}`}
          strokeDashoffset={-seg.offset}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: "stroke-dasharray 0.3s" }}
        />
      ))}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize={14} fontWeight={700} fill="var(--c-gray-900)">
        {total}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize={11} fill="var(--c-gray-500)">
        Students
      </text>
    </svg>
  );
}

/* ── Bar Chart (simple div-based) ──────────────────────────── */
function BarChart({
  data,
  height = 160,
  barColor = "var(--c-primary-700)",
}: {
  data: Array<{ label: string; value: number }>;
  height?: number;
  barColor?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height, paddingTop: 8 }}>
      {data.map((d, i) => {
        const pct = (d.value / max) * 100;
        return (
          <div
            key={i}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              height: "100%",
              justifyContent: "flex-end",
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--c-gray-600)" }}>
              {d.value}
            </span>
            <div
              style={{
                width: "100%",
                maxWidth: 40,
                height: `${pct}%`,
                minHeight: 4,
                background: barColor,
                borderRadius: "3px 3px 0 0",
                transition: "height 0.3s",
              }}
            />
            <span
              style={{
                fontSize: 9,
                color: "var(--c-gray-500)",
                textAlign: "center",
                lineHeight: 1.2,
                maxWidth: 56,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {d.label}
            </span>
          </div>
        );
      })}
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

  const handleExamChange = (examId: string) => {
    navigate(`/faculty/analytics?examId=${examId}`);
  };

  const gradeData = analytics?.grade_distribution
    ? Object.entries(analytics.grade_distribution).map(([label, value]) => ({
        label,
        value,
        color: GRADE_COLORS[label] ?? "var(--c-gray-500)",
      }))
    : [];

  const scoreData = analytics?.score_distribution
    ? analytics.score_distribution.map((val, i) => ({
        label: analytics.score_labels?.[i] ?? `${i * 10}-${(i + 1) * 10}%`,
        value: val,
      }))
    : [];

  return (
    <FacultyLayout activePage="analytics">
      <PageHeading
        title="Exam Analytics"
        subtitle={analytics ? `${analytics.exam_title} · ${analytics.course_name}` : "Select an exam to view analytics"}
        actions={
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <select
              className="select-filter"
              value={selectedExamId}
              onChange={(e) => handleExamChange(e.target.value)}
              style={{ minWidth: 240 }}
            >
              <option value="">Select an exam…</option>
              {allExams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.title} ({exam.courses?.code ?? ""})
                </option>
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
          <EmptyState
            icon="ti ti-chart-bar"
            title="Select an exam"
            text="Choose an exam from the dropdown to view analytics."
          />
        </div>
      ) : isLoading ? (
        <Loading text="Loading analytics…" />
      ) : isError ? (
        <ErrorBlock error={error} onRetry={() => refetch()} />
      ) : !analytics ? (
        <EmptyState icon="ti ti-chart-bar" title="No data" text="No analytics data available for this exam." />
      ) : (
        <>
          {/* Stats Row */}
          <div className="stats-row analytics">
            <div className="stat-card">
              <div className="stat-label">Appeared</div>
              <div className="stat-val">{analytics.total_appeared}</div>
              <div style={{ fontSize: 12, color: "var(--c-gray-500)", marginTop: 4 }}>
                of {analytics.total_registered} registered
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Average Score</div>
              <div className="stat-val">{analytics.average_score}</div>
              <div style={{ fontSize: 12, color: "var(--c-gray-500)", marginTop: 4 }}>
                {analytics.average_percentage}% avg
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Pass Rate</div>
              <div
                className="stat-val"
                style={{
                  color:
                    analytics.pass_rate >= 70
                      ? "var(--c-success-700)"
                      : analytics.pass_rate >= 50
                        ? "var(--c-warning-700)"
                        : "var(--c-danger-700)",
                }}
              >
                {analytics.pass_rate}%
              </div>
              <div className="stat-trend trend-up" style={{ marginTop: 6 }}>
                <i className="ti ti-trending-up" /> {analytics.total_appeared > 0 ? `${Math.round(analytics.passed / analytics.total_appeared * 100)}% passed` : "N/A"}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Highest Score</div>
              <div className="stat-val">{analytics.highest_score}</div>
              <div style={{ fontSize: 12, color: "var(--c-gray-500)", marginTop: 4 }}>
                {analytics.highest_scorer ?? "-"}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Median Score</div>
              <div className="stat-val">{analytics.median_score}</div>
              <div style={{ fontSize: 12, color: "var(--c-gray-500)", marginTop: 4 }}>
                {analytics.max_score > 0 ? `${Math.round((analytics.median_score / analytics.max_score) * 100)}%` : ""}
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="chart-grid">
            <div className="chart-card">
              <div className="chart-hdr">
                <div>
                  <div className="chart-title">Grade Distribution</div>
                  <div className="chart-sub">Students by grade band</div>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 24,
                  justifyContent: "center",
                  padding: "8px 0",
                }}
              >
                <DonutChart data={gradeData} size={140} />
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {gradeData.map((g) => (
                    <div
                      key={g.label}
                      style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}
                    >
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 2,
                          background: g.color,
                          display: "inline-block",
                        }}
                      />
                      <span style={{ fontWeight: 500, minWidth: 20 }}>{g.label}</span>
                      <span style={{ color: "var(--c-gray-500)" }}>
                        {g.value} ({Math.round((g.value / gradeData.reduce((s, d) => s + d.value, 0)) * 100)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-hdr">
                <div>
                  <div className="chart-title">Score Distribution</div>
                  <div className="chart-sub">Percentage bands</div>
                </div>
              </div>
              <BarChart data={scoreData} barColor="var(--c-primary-700)" />
            </div>
          </div>

          {/* Topic Performance Table */}
          <div className="chart-card">
            <div className="chart-hdr">
              <div>
                <div className="chart-title">Topic-wise Performance</div>
                <div className="chart-sub">Average accuracy per topic</div>
              </div>
            </div>
            {analytics.topic_performance && analytics.topic_performance.length > 0 ? (
              <table className="topic-table">
                <thead>
                  <tr>
                    <th>Topic</th>
                    <th>Questions</th>
                    <th>Avg Accuracy</th>
                    <th>Performance</th>
                    <th>Difficulty</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.topic_performance.map((topic, idx) => {
                    const barColor =
                      topic.avg_accuracy >= 70
                        ? "var(--c-success-500)"
                        : topic.avg_accuracy >= 50
                          ? "var(--c-warning-500)"
                          : "var(--c-danger-500)";
                    const diffColor =
                      topic.difficulty === "EASY"
                        ? "var(--c-success-500)"
                        : topic.difficulty === "MEDIUM"
                          ? "var(--c-warning-500)"
                          : "var(--c-danger-500)";
                    const diffBg =
                      topic.difficulty === "EASY"
                        ? "var(--c-success-100)"
                        : topic.difficulty === "MEDIUM"
                          ? "var(--c-warning-100)"
                          : "var(--c-danger-100)";
                    return (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>{topic.topic}</td>
                        <td>{topic.question_count}</td>
                        <td
                          style={{
                            fontWeight: 700,
                            color:
                              topic.avg_accuracy >= 70
                                ? "var(--c-success-700)"
                                : topic.avg_accuracy >= 50
                                  ? "var(--c-warning-700)"
                                  : "var(--c-danger-700)",
                          }}
                        >
                          {topic.avg_accuracy}%
                        </td>
                        <td style={{ minWidth: 160 }}>
                          <div className="perf-bar">
                            <div
                              className="perf-bar-fill"
                              style={{
                                width: `${topic.avg_accuracy}%`,
                                background: barColor,
                              }}
                            />
                          </div>
                        </td>
                        <td>
                          <span
                            style={{
                              background: diffBg,
                              color: diffColor,
                              fontSize: 11,
                              fontWeight: 600,
                              padding: "2px 8px",
                              borderRadius: 4,
                            }}
                          >
                            {topic.difficulty}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: 20, textAlign: "center", color: "var(--c-gray-500)" }}>
                No topic performance data available.
              </div>
            )}
          </div>
        </>
      )}
    </FacultyLayout>
  );
}
