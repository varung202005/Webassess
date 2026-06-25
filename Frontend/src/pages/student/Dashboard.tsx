import type { CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import StudentLayout, { EmptyState, PageState } from "../../features/student/StudentLayout";
import { CountdownCard, PageHeading } from "../../features/student/components";
import { formatDate } from "../../features/student/format";
import { useStudentPortal } from "../../features/student/hooks";
import type { StudentSchedule } from "../../features/student/types";

export default function Dashboard() {
  const portal = useStudentPortal();
  const navigate = useNavigate();
  const data = portal.data;
  const now = Date.now();
  const futureNotAttempted = data?.schedules.filter((item) => !item.attempt && new Date(item.end_time).getTime() > now) ?? [];
  const registeredExams = futureNotAttempted
    .filter((item) => item.registration?.status === "REGISTERED")
    .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time));
  const availableExams = futureNotAttempted
    .filter((item) => item.registration?.status !== "REGISTERED" && item.can_register)
    .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time));
  const upcomingCount = registeredExams.length + availableExams.length;
  const next = registeredExams[0];
  const passed = data?.results.filter((item) => item.is_passed).length ?? 0;
  const average = data?.results.length
    ? data.results.reduce((sum, item) => sum + item.percentage, 0) / data.results.length : 0;
  const best = data?.results.reduce((value, item) => Math.max(value, item.percentile ?? 0), 0) ?? 0;
  const previous = data?.results.slice(3, 6) ?? [];
  const previousAverage = previous.length ? previous.reduce((sum, item) => sum + item.percentage, 0) / previous.length : null;
  const trend = previousAverage == null ? null : average - previousAverage;
  const departmentLabel = data?.profile.departments?.name || "Department not set";
  const semesterLabel = data?.profile.semester ? `Semester ${data.profile.semester}` : "Semester not set";
  const profileMissing = !data?.profile.departments?.name || !data?.profile.semester;

  return (
    <StudentLayout>
      <PageState loading={portal.isLoading} error={portal.error}>
        <PageHeading title={`Welcome back, ${data?.profile.full_name?.split(" ")[0] || "Student"}`} subtitle={`${departmentLabel} · ${semesterLabel}`} subtitleTone={profileMissing ? "warning" : "default"}>
          <button className="btn btn-primary" onClick={() => navigate("/student/exams")}><i className="ti ti-search" />Browse Exams</button>
        </PageHeading>
        <div className="stats-grid">
          <Stat label="Upcoming Exams" value={String(upcomingCount)} detail={`${registeredExams.filter((item) => +new Date(item.start_time) < now + 604800000).length} registered in the next 7 days`} icon="ti-calendar-event" />
          <Stat label="Exams Passed" value={String(passed)} detail={`Out of ${data?.results.length ?? 0} published results`} icon="ti-circle-check" color="#08775b" soft="#def8ee" />
          <Stat label="Best Percentile" value={data?.results.length ? `${best.toFixed(1)}th` : "—"} detail={data?.results.length ? "Across published results" : "No published results"} icon="ti-trophy" color="#9a6200" soft="#fff3d8" />
          <Stat label="Average Score" value={data?.results.length ? `${average.toFixed(1)}%` : "—"} detail={trend == null ? "Awaiting comparable results" : `${trend >= 0 ? "+" : ""}${trend.toFixed(1)}% vs previous results`} icon="ti-chart-line" color="#4f55a8" soft="#eeefff" trend={trend} />
        </div>
        <div className="dashboard-grid">
          <div className="dashboard-left">
            <section className="panel">
              <div className="panel-header"><i className="ti ti-calendar-event" /><h2>Upcoming Exams</h2></div>
              <div className="panel-body dashboard-upcoming">
                <ExamListSection
                  title="Registered Exams"
                  exams={registeredExams.slice(0, 4)}
                  emptyTitle="No registered exams"
                  emptyBody="Registered exams you have not attempted yet will appear here."
                  actionLabel="View"
                  onAction={() => navigate("/student/registered")}
                  viewAllTo="/student/registered"
                />
                <ExamListSection
                  title="Available to Register"
                  exams={availableExams.slice(0, 4)}
                  emptyTitle="No exams available"
                  emptyBody="Eligible exams you have not registered for will appear here."
                  actionLabel="Register"
                  onAction={() => navigate("/student/exams")}
                  viewAllTo="/student/exams"
                />
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

function ExamListSection({
  title,
  exams,
  emptyTitle,
  emptyBody,
  actionLabel,
  onAction,
  viewAllTo,
}: {
  title: string;
  exams: StudentSchedule[];
  emptyTitle: string;
  emptyBody: string;
  actionLabel: string;
  onAction: () => void;
  viewAllTo: string;
}) {
  return (
    <section className="upcoming-section">
      <div className="subsection-header">
        <h3>{title}</h3>
        <Link to={viewAllTo}>View all</Link>
      </div>
      {!exams.length ? <EmptyState icon="ti-calendar-off" title={emptyTitle} body={emptyBody} /> :
        exams.map((item) => (
          <div className="schedule-row" key={item.id}>
            <div><div className="eyebrow">{item.course.code || "Course"} · {item.course.name}</div><h3>{item.exam.title}</h3><div className="meta-line"><span><i className="ti ti-calendar" />{formatDate(item.start_time, true)}</span><span><i className="ti ti-clock" />{item.exam.duration_minutes} min</span></div></div>
            <div className="schedule-actions"><button className="btn btn-secondary" onClick={onAction}>{actionLabel}</button></div>
          </div>
        ))}
    </section>
  );
}

function Stat({ label, value, detail, icon, color, soft, trend }: { label: string; value: string; detail: string; icon: string; color?: string; soft?: string; trend?: number | null }) {
  return <div className="stat-card" style={{ "--accent": color, "--soft": soft } as CSSProperties}><div className="stat-top"><span>{label}</span><div className="stat-icon"><i className={`ti ${icon}`} /></div></div><div className="stat-value">{value}</div><div className="stat-detail">{detail}</div>{trend != null && <div className="stat-trend"><i className={`ti ti-trending-${trend >= 0 ? "up" : "down"}`} /> {Math.abs(trend).toFixed(1)} point trend</div>}</div>;
}
