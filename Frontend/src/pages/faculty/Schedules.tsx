import { useNavigate } from "react-router-dom";
import FacultyLayout from "../../features/faculty/FacultyLayout";
import { PageState } from "../../features/faculty/components";
import { useSchedules } from "../../features/faculty/hooks";
import { formatDate, formatTime } from "../../features/faculty/format";

export default function Schedules() {
  const navigate = useNavigate();
  const { data: schedules, isLoading, isError, error, refetch } = useSchedules({ is_published: true });
  const allSchedules = Array.isArray(schedules) ? schedules : [];

  const now = new Date();
  const upcoming = allSchedules.filter((s) => s.start_time && new Date(s.start_time) > now)
    .sort((a, b) => new Date(a.start_time!).getTime() - new Date(b.start_time!).getTime());
  const ongoing = allSchedules.filter((s) => s.start_time && s.end_time && new Date(s.start_time) <= now && new Date(s.end_time) >= now);
  const past = allSchedules.filter((s) => s.end_time && new Date(s.end_time) < now)
    .sort((a, b) => new Date(b.end_time!).getTime() - new Date(a.end_time!).getTime());

  return (
    <FacultyLayout activePage="schedules">
      <PageState loading={isLoading} error={isError ? error : undefined} onRetry={() => refetch()}>
        <div className="page-heading">
          <div>
            <h1>Exam Schedules</h1>
            <p>{allSchedules.length} total schedules</p>
          </div>
          <div className="heading-actions">
            <button className="btn btn-primary" onClick={() => navigate("/faculty/create-exam")}>
              <i className="ti ti-plus" /> New Schedule
            </button>
          </div>
        </div>

        {allSchedules.length === 0 ? (
          <div className="panel">
            <div className="panel-body">
              <div className="empty-state">
                <i className="ti ti-calendar" />
                <div className="empty-state-title">No schedules found</div>
                <div className="empty-state-text">Create an exam and schedule it to see it here.</div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {ongoing.length > 0 && (
              <div className="panel" style={{ marginBottom: 16 }}>
                <div className="panel-header">
                  <div className="card-title">
                    <i className="ti ti-player-play" style={{ color: "#10B981" }} /> Ongoing ({ongoing.length})
                  </div>
                </div>
                <div className="schedule-list">
                  {ongoing.map((s) => (
                    <div className="schedule-item" key={s.id} onClick={() => navigate(`/faculty/evaluation?examId=${(s as any).exam_id}`)}>
                      <div className="schedule-date">
                        <div className="day">{s.start_time ? new Date(s.start_time).getDate() : "-"}</div>
                        <div className="month">{s.start_time ? new Date(s.start_time).toLocaleString("default", { month: "short" }) : ""}</div>
                      </div>
                      <div className="schedule-divider" />
                      <div className="schedule-info">
                        <div className="schedule-name">{(s as any).exams?.title ?? s.id}</div>
                        <div className="schedule-meta">
                          <span className="schedule-meta-item">
                            <i className="ti ti-clock" /> {s.start_time ? formatTime(s.start_time) : ""} – {s.end_time ? formatTime(s.end_time) : ""}
                          </span>
                        </div>
                      </div>
                      <span className="session-live-badge" style={{ fontSize: "10px", padding: "2px 7px" }}>
                        <div className="live-dot" /> LIVE
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="panel" style={{ marginBottom: 16 }}>
              <div className="panel-header">
                <div className="card-title"><i className="ti ti-calendar-event" /> Upcoming ({upcoming.length})</div>
              </div>
              {upcoming.length === 0 ? (
                <div className="panel-body">
                  <div className="empty-state" style={{ padding: "30px 20px" }}>
                    <i className="ti ti-calendar" />
                    <div className="empty-state-title">No upcoming schedules</div>
                    <div className="empty-state-text">Schedule an exam to appear here.</div>
                  </div>
                </div>
              ) : (
                <div className="schedule-list">
                  {upcoming.map((s) => (
                    <div className="schedule-item" key={s.id}>
                      <div className="schedule-date">
                        <div className="day">{s.start_time ? new Date(s.start_time).getDate() : "-"}</div>
                        <div className="month">{s.start_time ? new Date(s.start_time).toLocaleString("default", { month: "short" }) : ""}</div>
                      </div>
                      <div className="schedule-divider" />
                      <div className="schedule-info">
                        <div className="schedule-name">{(s as any).exams?.title ?? s.id}</div>
                        <div className="schedule-meta">
                          <span className="schedule-meta-item">
                            <i className="ti ti-clock" /> {s.start_time ? `${formatDate(s.start_time)} · ${formatTime(s.start_time)}` : ""}
                          </span>
                          {(s as any).departments?.name && (
                            <span className="schedule-meta-item"><i className="ti ti-building" /> {(s as any).departments.name}</span>
                          )}
                        </div>
                      </div>
                      <span className="badge badge-published">Upcoming</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="panel">
              <div className="panel-header">
                <div className="card-title"><i className="ti ti-history" /> Past ({past.length})</div>
              </div>
              {past.length === 0 ? (
                <div className="panel-body">
                  <div className="empty-state" style={{ padding: "30px 20px" }}>
                    <i className="ti ti-history" />
                    <div className="empty-state-title">No past schedules</div>
                  </div>
                </div>
              ) : (
                <div className="schedule-list">
                  {past.slice(0, 10).map((s) => (
                    <div className="schedule-item" key={s.id}>
                      <div className="schedule-date">
                        <div className="day">{s.start_time ? new Date(s.start_time).getDate() : "-"}</div>
                        <div className="month">{s.start_time ? new Date(s.start_time).toLocaleString("default", { month: "short" }) : ""}</div>
                      </div>
                      <div className="schedule-divider" />
                      <div className="schedule-info">
                        <div className="schedule-name">{(s as any).exams?.title ?? s.id}</div>
                        <div className="schedule-meta">
                          <span className="schedule-meta-item"><i className="ti ti-clock" /> {s.start_time ? formatDate(s.start_time) : ""}</span>
                        </div>
                      </div>
                      <span className="badge badge-draft">Completed</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </PageState>
    </FacultyLayout>
  );
}
