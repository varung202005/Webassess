import { useNavigate } from "react-router-dom";
import FacultyLayout from "../../features/faculty/FacultyLayout";
import { PageState } from "../../features/faculty/components";
import { useSchedules } from "../../features/faculty/hooks";
import { formatDate, formatTime } from "../../features/faculty/format";

export default function Schedules() {
  const navigate = useNavigate();

  // FIX: Removed `{ is_published: true }` filter — this was hiding all
  // unpublished/draft schedules. Faculty should see ALL their schedules.
  // The backend /api/v1/schedules/ endpoint already filters by created_by
  // (via the faculty JWT), so only this faculty's schedules are returned.
  const { data: schedules, isLoading, isError, error, refetch } = useSchedules();
  const allSchedules = Array.isArray(schedules) ? schedules : [];

  const now = new Date();

  const ongoing = allSchedules.filter(
    (s) =>
      s.start_time &&
      s.end_time &&
      new Date(s.start_time) <= now &&
      new Date(s.end_time) >= now
  );

  const upcoming = allSchedules
    .filter((s) => s.start_time && new Date(s.start_time) > now)
    .sort(
      (a, b) =>
        new Date(a.start_time!).getTime() - new Date(b.start_time!).getTime()
    );

  const past = allSchedules
    .filter((s) => s.end_time && new Date(s.end_time) < now)
    .sort(
      (a, b) =>
        new Date(b.end_time!).getTime() - new Date(a.end_time!).getTime()
    );

  // Schedules that have no start/end time yet (just created, not fully configured)
  const drafts = allSchedules.filter((s) => !s.start_time);

  const statusBadge = (s: any) => {
    const isLive =
      s.start_time &&
      s.end_time &&
      new Date(s.start_time) <= now &&
      new Date(s.end_time) >= now;
    if (isLive)
      return (
        <span
          className="session-live-badge"
          style={{ fontSize: "10px", padding: "2px 7px" }}
        >
          <div className="live-dot" /> LIVE
        </span>
      );
    if (!s.is_published)
      return <span className="badge badge-draft">Unpublished</span>;
    if (new Date(s.start_time) > now)
      return <span className="badge badge-published">Upcoming</span>;
    return <span className="badge badge-draft">Completed</span>;
  };

  const ScheduleRow = ({ s }: { s: any }) => (
    <div
      className="schedule-item"
      key={s.id}
      onClick={() =>
        navigate(`/faculty/evaluation?examId=${s.exam_id ?? s.exams?.id}`)
      }
      style={{ cursor: "pointer" }}
    >
      <div className="schedule-date">
        <div className="day">
          {s.start_time ? new Date(s.start_time).getDate() : "—"}
        </div>
        <div className="month">
          {s.start_time
            ? new Date(s.start_time).toLocaleString("default", {
                month: "short",
              })
            : ""}
        </div>
      </div>
      <div className="schedule-divider" />
      <div className="schedule-info">
        <div className="schedule-name">
          {s.exams?.title ?? s.exam_id ?? s.id}
        </div>
        <div className="schedule-meta">
          {s.start_time && (
            <span className="schedule-meta-item">
              <i className="ti ti-clock" />{" "}
              {formatDate(s.start_time)} · {formatTime(s.start_time)}
              {s.end_time ? ` – ${formatTime(s.end_time)}` : ""}
            </span>
          )}
          {s.departments?.name && (
            <span className="schedule-meta-item">
              <i className="ti ti-building" /> {s.departments.name}
            </span>
          )}
          {!s.is_published && (
            <span className="schedule-meta-item" style={{ color: "#f59e0b" }}>
              <i className="ti ti-eye-off" /> Not published to students
            </span>
          )}
        </div>
      </div>
      {statusBadge(s)}
    </div>
  );

  const SectionPanel = ({
    title,
    icon,
    items,
    emptyText,
    color,
  }: {
    title: string;
    icon: string;
    items: any[];
    emptyText: string;
    color?: string;
  }) => (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-header">
        <div className="card-title">
          <i className={`ti ${icon}`} style={color ? { color } : {}} />{" "}
          {title}{" "}
          <span
            style={{
              fontSize: 13,
              fontWeight: 400,
              color: "#888",
              marginLeft: 4,
            }}
          >
            ({items.length})
          </span>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="panel-body">
          <div className="empty-state" style={{ padding: "24px 20px" }}>
            <i className="ti ti-calendar" />
            <div className="empty-state-title">{emptyText}</div>
          </div>
        </div>
      ) : (
        <div className="schedule-list">
          {items.map((s) => (
            <ScheduleRow key={s.id} s={s} />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <FacultyLayout activePage="schedules">
      <PageState
        loading={isLoading}
        error={isError ? error : undefined}
        onRetry={() => refetch()}
      >
        <div className="page-heading">
          <div>
            <h1>Exam Schedules</h1>
            <p>
              {allSchedules.length} total ·{" "}
              {ongoing.length > 0 && (
                <span style={{ color: "#10b981", fontWeight: 600 }}>
                  {ongoing.length} live now ·{" "}
                </span>
              )}
              {upcoming.length} upcoming · {past.length} completed
            </p>
          </div>
          <div className="heading-actions">
            <button
              className="btn btn-primary"
              onClick={() => navigate("/faculty/create-exam")}
            >
              <i className="ti ti-plus" /> New Exam
            </button>
          </div>
        </div>

        {allSchedules.length === 0 ? (
          <div className="panel">
            <div className="panel-body">
              <div className="empty-state">
                <i className="ti ti-calendar" />
                <div className="empty-state-title">No schedules yet</div>
                <div className="empty-state-text">
                  Create an exam and add a schedule to see it here.
                </div>
                <button
                  className="btn btn-primary"
                  style={{ marginTop: 16 }}
                  onClick={() => navigate("/faculty/create-exam")}
                >
                  <i className="ti ti-plus" /> Create Exam
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {ongoing.length > 0 && (
              <SectionPanel
                title="Live Now"
                icon="ti-player-play"
                items={ongoing}
                emptyText=""
                color="#10b981"
              />
            )}

            <SectionPanel
              title="Upcoming"
              icon="ti-calendar-event"
              items={upcoming}
              emptyText="No upcoming schedules. Create an exam and add a schedule."
            />

            {drafts.length > 0 && (
              <SectionPanel
                title="Draft Schedules"
                icon="ti-file-pencil"
                items={drafts}
                emptyText=""
                color="#f59e0b"
              />
            )}

            <SectionPanel
              title="Past"
              icon="ti-history"
              items={past.slice(0, 20)}
              emptyText="No past schedules."
            />
          </>
        )}
      </PageState>
    </FacultyLayout>
  );
}