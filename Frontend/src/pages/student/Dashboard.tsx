import { useState } from "react";
import { useNavigate } from "react-router-dom";
import StudentLayout, { EmptyState, PageState } from "../../features/student/StudentLayout";
import { PageHeading, StatsRow } from "../../features/student/components";
import { formatDate, formatTime } from "../../features/student/format";
import { useStudentPortal } from "../../features/student/hooks";

type SortKey = "start_time" | "title" | "duration";
type SortDir = "asc" | "desc";

const SORT_LABELS: Record<SortKey, string> = {
  start_time: "Start Time",
  title: "Exam Title",
  duration: "Duration",
};

export default function Dashboard() {
  const portal = useStudentPortal();
  const navigate = useNavigate();
  const data = portal.data;
  const now = Date.now();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("start_time");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Registered upcoming (not yet ended, not attempted)
  const registeredUpcoming = data?.schedules.filter((item) =>
    item.registration?.status === "REGISTERED" &&
    new Date(item.end_time).getTime() > now
  ) ?? [];

  // Available to register: eligible, not registered, registration still open
  const availableToRegister = data?.schedules.filter((item) =>
    item.registration?.status !== "REGISTERED" &&
    item.can_register &&
    new Date(item.end_time).getTime() > now
  ) ?? [];

  const passed = data?.results.filter((item) => item.is_passed).length ?? 0;
  const average = data?.results.length
    ? data.results.reduce((sum, item) => sum + item.percentage, 0) / data.results.length : 0;
  const best = data?.results.reduce((value, item) => Math.max(value, item.percentile ?? 0), 0) ?? 0;
  const previous = data?.results.slice(3, 6) ?? [];
  const previousAverage = previous.length ? previous.reduce((sum, item) => sum + item.percentage, 0) / previous.length : null;
  const trend = previousAverage == null ? null : average - previousAverage;

  // Search & Filter registered upcoming exams
  const q = search.trim().toLowerCase();
  const filteredUpcoming = registeredUpcoming.filter((item) => {
    const matchesSearch =
      !q ||
      item.exam.title.toLowerCase().includes(q) ||
      (item.course?.name && item.course.name.toLowerCase().includes(q)) ||
      (item.course?.code && item.course.code.toLowerCase().includes(q));

    if (!matchesSearch) return false;
    if (statusFilter === "ALL") return true;
    if (statusFilter === "LIVE") {
      const start = new Date(item.start_time).getTime();
      const end = new Date(item.end_time).getTime();
      return now >= start && now <= end;
    }
    if (statusFilter === "REGISTERED") return true;
    return true;
  });

  const sortedUpcoming = [...filteredUpcoming].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "title") {
      cmp = a.exam.title.localeCompare(b.exam.title);
    } else if (sortKey === "duration") {
      cmp = a.exam.duration_minutes - b.exam.duration_minutes;
    } else {
      cmp = new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  return (
    <StudentLayout>
      <PageState loading={portal.isLoading} error={portal.error}>
        <PageHeading
          title="Student Dashboard"
          subtitle={`${data?.profile.departments?.name || "Department not set"} · Semester ${data?.profile.semester || "not set"}`}
        >
          <button className="btn btn-secondary" onClick={() => navigate("/student/registered")}>
            <i className="ti ti-calendar-check" /> My Registered Exams
          </button>
          <button className="btn btn-primary" onClick={() => navigate("/student/exams")}>
            <i className="ti ti-search" /> Browse Exams
          </button>
        </PageHeading>

        {registeredUpcoming.length > 0 && (
          <div
            style={{
              background: "#fff3d8",
              border: "1.5px solid #f5d76e",
              borderRadius: 10,
              padding: "12px 18px",
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <i className="ti ti-alert-triangle" style={{ color: "#94600a", fontSize: 18 }} />
            <span style={{ flex: 1, fontSize: 13, color: "#5a3c00" }}>
              You have <strong>{registeredUpcoming.length}</strong> upcoming registered exam{registeredUpcoming.length !== 1 ? "s" : ""}. Please review the schedule details and log in before start time.
            </span>
          </div>
        )}

        <StatsRow
          items={[
            {
              label: "Upcoming Exams",
              value: String(registeredUpcoming.length),
              icon: "ti-calendar-event",
              color: "danger",
              meta: `${registeredUpcoming.filter((item) => +new Date(item.start_time) < now + 604800000).length} in the next 7 days`,
            },
            {
              label: "Exams Passed",
              value: String(passed),
              icon: "ti-circle-check",
              color: "success",
              meta: `Out of ${data?.results.length ?? 0} published results`,
            },
            {
              label: "Best Percentile",
              value: data?.results.length ? `${best.toFixed(1)}th` : "—",
              icon: "ti-trophy",
              color: "warning",
              meta: data?.results.length ? "Across published results" : "No published results",
            },
            {
              label: "Average Score",
              value: data?.results.length ? `${average.toFixed(1)}%` : "—",
              icon: "ti-chart-line",
              color: "info",
              meta: trend == null ? "Awaiting comparable results" : `${trend >= 0 ? "+" : ""}${trend.toFixed(1)}% vs previous`,
            },
          ]}
        />

        <div className="content-grid">
          <div className="panel" style={{ margin: 0 }}>
            <div className="panel-header">
              <div className="card-title"><i className="ti ti-calendar-check" /> Registered / Upcoming Exams</div>
              <button className="btn btn-sm btn-primary" onClick={() => navigate("/student/registered")}>
                <i className="ti ti-eye" /> View All
              </button>
            </div>

            {registeredUpcoming.length > 0 && (
              <div className="filter-bar" style={{ margin: "0 16px 12px", boxShadow: "none" }}>
                <div className="search-input-wrap">
                  <i className="ti ti-search" />
                  <input
                    className="search-input"
                    type="text"
                    placeholder="Search registered exams..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <select
                  className="select-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  title="Filter by status"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="REGISTERED">Registered</option>
                  <option value="LIVE">Live</option>
                </select>

                <select
                  className="select-filter"
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                  title="Sort by"
                >
                  {Object.entries(SORT_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>Sort: {label}</option>
                  ))}
                </select>

                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                >
                  <i className={`ti ${sortDir === "asc" ? "ti-sort-ascending" : "ti-sort-descending"}`} />
                  {sortDir === "asc" ? "Asc" : "Desc"}
                </button>
              </div>
            )}

            {!sortedUpcoming.length ? (
              <div className="panel-body">
                <EmptyState icon="ti-calendar-off" title="No upcoming registered exams" body="Register for available exams before the deadline." />
              </div>
            ) : (
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Exam</th>
                      <th>Schedule Window</th>
                      <th>Duration</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedUpcoming.slice(0, 5).map((item) => {
                      const start = new Date(item.start_time);
                      const end = new Date(item.end_time);
                      const isLive = start.getTime() <= now && end.getTime() >= now;
                      return (
                        <tr key={item.id}>
                          <td>
                            <div className="table-exam-name">{item.exam.title}</div>
                            <div className="table-exam-meta">{item.course.code || "Course"} · {item.course.name}</div>
                          </td>
                          <td style={{ fontSize: "12.5px" }}>
                            {formatDate(item.start_time, true)}
                          </td>
                          <td>{item.exam.duration_minutes} min</td>
                          <td>
                            {isLive ? (
                              <span className="badge badge-live">
                                Live
                              </span>
                            ) : (
                              <span className="badge badge-registered">Registered</span>
                            )}
                          </td>
                          <td>
                            <div className="table-actions">
                              <button className="btn btn-sm btn-secondary" onClick={() => navigate("/student/registered")}>
                                View
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="panel" style={{ margin: 0 }}>
              <div className="panel-header">
                <div className="card-title"><i className="ti ti-clipboard-list" /> Available to Register</div>
                <button className="card-action" onClick={() => navigate("/student/exams")}>Browse all</button>
              </div>
              {!availableToRegister.length ? (
                <div className="panel-body">
                  <EmptyState icon="ti-file-search" title="No exams available" body="Check back later for new exams open for registration." />
                </div>
              ) : (
                <div className="schedule-list">
                  {availableToRegister.slice(0, 4).map((item) => {
                    const start = new Date(item.start_time);
                    return (
                      <div className="schedule-item" key={item.id} onClick={() => navigate("/student/exams")}>
                        <div className="schedule-date">
                          <div className="day">{start.getDate()}</div>
                          <div className="month">{start.toLocaleString("default", { month: "short" })}</div>
                        </div>
                        <div className="schedule-divider" />
                        <div className="schedule-info">
                          <div className="schedule-name">{item.exam.title}</div>
                          <div className="schedule-meta">
                            <span className="schedule-meta-item"><i className="ti ti-clock" /> {formatTime(item.start_time)}</span>
                            <span className="schedule-meta-item"><i className="ti ti-book" /> {item.course.code || "Course"}</span>
                          </div>
                        </div>
                        <button className="btn btn-sm btn-primary" onClick={(e) => { e.stopPropagation(); navigate("/student/exams"); }}>
                          Register
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="panel" style={{ margin: 0 }}>
              <div className="panel-header">
                <div className="card-title"><i className="ti ti-award" /> Recent Results</div>
                <button className="card-action" onClick={() => navigate("/student/results")}>View all</button>
              </div>
              {(!data?.results || data.results.length === 0) ? (
                <div className="panel-body">
                  <EmptyState icon="ti-award" title="No published results" body="Your exam results will appear here once published." />
                </div>
              ) : (
                <div className="candidate-assessment-list">
                  {data.results.slice(0, 3).map((res) => (
                    <div className="candidate-assessment-item" key={res.id} onClick={() => navigate("/student/results")}>
                      <div className="candidate-assessment-main">
                        <div className="candidate-assessment-title">{res.exam.title}</div>
                        <div className="candidate-assessment-meta">
                          <span>{res.course.code}</span>
                          <span>Score: {res.total_score}/{res.max_score} ({res.percentage.toFixed(1)}%)</span>
                        </div>
                      </div>
                      <span className={`badge ${res.is_passed ? "badge-published" : "badge-danger"}`}>
                        {res.is_passed ? "Passed" : "Failed"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </PageState>
    </StudentLayout>
  );
}
