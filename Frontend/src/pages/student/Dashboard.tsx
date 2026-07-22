import { Link, useNavigate } from "react-router-dom";
import StudentLayout, { EmptyState, PageState } from "../../features/student/StudentLayout";
import { CountdownCard, PageHeading } from "../../features/student/components";
import { formatDate } from "../../features/student/format";
import { useStudentPortal } from "../../features/student/hooks";

export default function Dashboard() {
  const portal = useStudentPortal();
  const navigate = useNavigate();
  const data = portal.data;
  const now = Date.now();

  // Registered upcoming (not yet ended, not attempted)
  const registeredUpcoming = data?.schedules.filter((item) =>
    item.registration?.status === "REGISTERE" &&
    new Date(item.end_time).getTime() > now
  ) ?? [];

  // Available to register: eligible, not registered, registration still open
  const availableToRegister = data?.schedules.filter((item) =>
    item.registration?.status !== "REGISTERED" &&
    item.can_register &&
    new Date(item.end_time).getTime() > now
  ) ?? [];

  const next = [...registeredUpcoming].sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time))[0];

  const passed = data?.results.filter((item) => item.is_passed).length ?? 0;
  const average = data?.results.length
    ? data.results.reduce((sum, item) => sum + item.percentage, 0) / data.results.length : 0;
  const best = data?.results.reduce((value, item) => Math.max(value, item.percentile ?? 0), 0) ?? 0;
  const previous = data?.results.slice(3, 6) ?? [];
  const previousAverage = previous.length ? previous.reduce((sum, item) => sum + item.percentage, 0) / previous.length : null;
  const trend = previousAverage == null ? null : average - previousAverage;

  return (
    <StudentLayout>
      <PageState loading={portal.isLoading} error={portal.error}>
        <PageHeading
          title={`Welcome back, ${data?.profile.full_name?.split(" ")[0] || "Student"}`}
          subtitle={`${data?.profile.departments?.name || "Department not set"} · Semester ${data?.profile.semester || "not set"}`}
        >
          <button className="btn btn-primary" onClick={() => navigate("/student/exams")}>
            <i className="ti ti-search" />Browse Exams
          </button>
        </PageHeading>

        <div className="dashboard-section-title">
          <span>Overview</span>
          <p>Your current examination activity</p>
        </div>
        <div className="stats-grid dashboard-stats">
          <Stat
            label="Upcoming Exams"
            value={String(registeredUpcoming.length)}
            detail={`${registeredUpcoming.filter((item) => +new Date(item.start_time) < now + 604800000).length} in the next 7 days`}
            icon="ti-calendar-event"
          />
          <Stat label="Exams Passed" value={String(passed)} detail={`Out of ${data?.results.length ?? 0} published results`} icon="ti-circle-check" />
          <Stat label="Best Percentile" value={data?.results.length ? `${best.toFixed(1)}th` : "—"} detail={data?.results.length ? "Across published results" : "No published results"} icon="ti-trophy" />
          <Stat label="Average Score" value={data?.results.length ? `${average.toFixed(1)}%` : "—"} detail={trend == null ? "Awaiting comparable results" : `${trend >= 0 ? "+" : ""}${trend.toFixed(1)}% vs previous results`} icon="ti-chart-line" trend={trend} />
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-left dashboard-exam-groups">
            {/* Section 1: Registered Upcoming */}
            <section className="panel">
              <div className="panel-header">
                <i className="ti ti-calendar-check" />
                <h2>Registered/Upcoming Exams</h2>
                <Link to="/student/registered">View all</Link>
              </div>
              <div className="panel-body">
                {!registeredUpcoming.length
                  ? <EmptyState icon="ti-calendar-off" title="No upcoming registered exams" body="Register for available exams before the deadline." />
                  : registeredUpcoming.slice(0, 3).map((item) => (
                    <div className="schedule-row" key={item.id}>
                      <div>
                        <div className="eyebrow">{item.course.code || "Course"} · {item.course.name}</div>
                        <h3>{item.exam.title}</h3>
                        <div className="meta-line">
                          <span><i className="ti ti-calendar" />{formatDate(item.start_time, true)}</span>
                          <span><i className="ti ti-clock" />{item.exam.duration_minutes} min</span>
                        </div>
                      </div>
                      <div className="schedule-actions">
                        <button className="btn btn-secondary" onClick={() => navigate("/student/registered")}>View</button>
                      </div>
                    </div>
                  ))}
              </div>
            </section>

            {/* Section 2: Available to Register */}
            <section className="panel dashboard-section">
              <div className="panel-header">
                <i className="ti ti-clipboard-list" />
                <h2>Available to Register</h2>
                <Link to="/student/exams">Browse all</Link>
              </div>
              <div className="panel-body">
                {!availableToRegister.length
                  ? <EmptyState icon="ti-file-search" title="No exams available" body="Check back later for new exams open for registration." />
                  : availableToRegister.slice(0, 3).map((item) => (
                    <div className="schedule-row" key={item.id}>
                      <div>
                        <div className="eyebrow">{item.course.code || "Course"} · {item.course.name}</div>
                        <h3>{item.exam.title}</h3>
                        <div className="meta-line">
                          <span><i className="ti ti-calendar" />{formatDate(item.start_time, true)}</span>
                          <span><i className="ti ti-clock" />{item.exam.duration_minutes} min</span>
                        </div>
                      </div>
                      <div className="schedule-actions">
                        <button className="btn btn-primary" onClick={() => navigate("/student/exams")}>Register</button>
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          </div>

          <div className="dashboard-right">
            {next && <CountdownCard schedule={next} />}
          </div>
        </div>
      </PageState>
    </StudentLayout>
  );
}

function Stat({ label, value, detail, icon, trend }: {
  label: string; value: string; detail: string; icon: string;
  trend?: number | null;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top"><span>{label}</span><div className="stat-icon"><i className={`ti ${icon}`} /></div></div>
      <div className="stat-metric"><div className="stat-value">{value}</div><div className="stat-detail">{detail}</div></div>
      {trend != null && <div className="stat-trend"><i className={`ti ti-trending-${trend >= 0 ? "up" : "down"}`} /> {Math.abs(trend).toFixed(1)} point trend</div>}
    </div>
  );
}
