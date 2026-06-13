import { Link, useNavigate } from "react-router-dom";
import StudentLayout, { EmptyState, PageState } from "../../features/student/StudentLayout";
import { CountdownCard, PageHeading } from "../../features/student/components";
import { formatDate, relativeTime } from "../../features/student/format";
import { useStudentPortal } from "../../features/student/hooks";

export default function Dashboard() {
  const portal = useStudentPortal();
  const navigate = useNavigate();
  const data = portal.data;
  const now = Date.now();
  const upcoming = data?.schedules.filter((item) =>
    item.registration?.status === "REGISTERED" && new Date(item.end_time).getTime() > now
  ) ?? [];
  const next = [...upcoming].sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time))[0];
  const passed = data?.results.filter((item) => item.is_passed).length ?? 0;
  const average = data?.results.length
    ? data.results.reduce((sum, item) => sum + item.percentage, 0) / data.results.length : 0;
  const best = data?.results.reduce((value, item) => Math.max(value, item.percentile ?? 0), 0) ?? 0;
  const recent = data?.results.slice(0, 3) ?? [];
  const previous = data?.results.slice(3, 6) ?? [];
  const previousAverage = previous.length ? previous.reduce((sum, item) => sum + item.percentage, 0) / previous.length : null;
  const trend = previousAverage == null ? null : average - previousAverage;

  return (
    <StudentLayout>
      <PageState loading={portal.isLoading} error={portal.error}>
        <PageHeading title={`Welcome back, ${data?.profile.full_name?.split(" ")[0] || "Student"}`} subtitle={`${data?.profile.departments?.name || "Department not set"} · Semester ${data?.profile.semester || "not set"}`}>
          <button className="btn btn-primary" onClick={() => navigate("/student/exams")}><i className="ti ti-search" />Browse Exams</button>
        </PageHeading>
        <div className="stats-grid">
          <Stat label="Upcoming Exams" value={String(upcoming.length)} detail={`${upcoming.filter((item) => +new Date(item.start_time) < now + 604800000).length} in the next 7 days`} icon="ti-calendar-event" />
          <Stat label="Exams Passed" value={String(passed)} detail={`Out of ${data?.results.length ?? 0} published results`} icon="ti-circle-check" color="#08775b" soft="#def8ee" />
          <Stat label="Best Percentile" value={data?.results.length ? `${best.toFixed(1)}th` : "—"} detail={data?.results.length ? "Across published results" : "No published results"} icon="ti-trophy" color="#9a6200" soft="#fff3d8" />
          <Stat label="Average Score" value={data?.results.length ? `${average.toFixed(1)}%` : "—"} detail={trend == null ? "Awaiting comparable results" : `${trend >= 0 ? "+" : ""}${trend.toFixed(1)}% vs previous results`} icon="ti-chart-line" color="#4f55a8" soft="#eeefff" trend={trend} />
        </div>
        <div className="dashboard-grid">
          <section className="panel">
            <div className="panel-header"><i className="ti ti-calendar-event" /><h2>Upcoming Exams</h2><Link to="/student/registered">View all</Link></div>
            <div className="panel-body">
              {!upcoming.length ? <EmptyState icon="ti-calendar-off" title="No upcoming registered exams" body="Browse available exams and register before the deadline." /> :
                upcoming.slice(0, 4).map((item) => (
                  <div className="schedule-row" key={item.id}>
                    <div><div className="eyebrow">{item.course.code || "Course"} · {item.course.name}</div><h3>{item.exam.title}</h3><div className="meta-line"><span><i className="ti ti-calendar" />{formatDate(item.start_time, true)}</span><span><i className="ti ti-clock" />{item.exam.duration_minutes} min</span></div></div>
                    <div className="schedule-actions"><button className="btn btn-secondary" onClick={() => navigate("/student/registered")}>View</button></div>
                  </div>
                ))}
            </div>
          </section>
          <div>
            {next && <CountdownCard schedule={next} />}
            <section className="panel">
              <div className="panel-header"><i className="ti ti-bell" /><h2>Notifications</h2><Link to="/student/notifications">View all</Link></div>
              <div className="panel-body">
                {!data?.notifications.length ? <EmptyState icon="ti-bell-off" title="No notifications" body="Important exam updates will appear here." /> :
                  data.notifications.slice(0, 4).map((item) => (
                    <div className={`notification-item ${item.is_read ? "" : "unread"}`} key={item.id}>
                      <div className="notification-icon"><i className="ti ti-bell" /></div>
                      <div className="notification-copy"><strong>{item.title}</strong><p>{item.body}</p><time>{relativeTime(item.created_at)}</time></div>
                    </div>
                  ))}
              </div>
            </section>
          </div>
        </div>
      </PageState>
    </StudentLayout>
  );
}

function Stat({ label, value, detail, icon, color, soft, trend }: { label: string; value: string; detail: string; icon: string; color?: string; soft?: string; trend?: number | null }) {
  return <div className="stat-card" style={{ "--accent": color, "--soft": soft } as React.CSSProperties}><div className="stat-top"><span>{label}</span><div className="stat-icon"><i className={`ti ${icon}`} /></div></div><div className="stat-value">{value}</div><div className="stat-detail">{detail}</div>{trend != null && <div className="stat-trend"><i className={`ti ti-trending-${trend >= 0 ? "up" : "down"}`} /> {Math.abs(trend).toFixed(1)} point trend</div>}</div>;
}
