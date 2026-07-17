import { useState } from "react";
import StudentLayout, { EmptyState, Feedback, PageState } from "../../features/student/StudentLayout";
import { PageHeading } from "../../features/student/components";
import { studentApi } from "../../features/student/api";
import { apiMessage, relativeTime } from "../../features/student/format";
import { usePortalAction, useStudentPortal } from "../../features/student/hooks";

export default function Notifications() {
  const portal = useStudentPortal();
  const markRead = usePortalAction(studentApi.markNotificationRead);
  const markAll = usePortalAction(studentApi.markAllNotificationsRead);
  const [filter, setFilter] = useState("ALL");
  const [error, setError] = useState<string | null>(null);
  const notifications = (portal.data?.notifications ?? []).filter((item) => filter === "ALL" || !item.is_read);
  const run = async (action: () => Promise<unknown>) => { setError(null); try { await action(); } catch (cause) { setError(apiMessage(cause)); } };
  return <StudentLayout><PageState loading={portal.isLoading} error={portal.error}>
    <PageHeading title="Notifications" subtitle="Exam, result, registration, and re-evaluation updates">
      <button className="btn btn-secondary" disabled={markAll.isPending || !portal.data?.notifications.some((item) => !item.is_read)} onClick={() => run(() => markAll.mutateAsync(undefined))}><i className="ti ti-checks" />Mark all read</button>
    </PageHeading>
    <Feedback error={error} />
    <div className="filter-panel compact-filter-panel"><span className="filter-caption"><i className="ti ti-adjustments-horizontal" />Filter notifications</span><div className="filter-control"><i className="ti ti-bell" /><label className="visually-hidden" htmlFor="notification-filter">Notification status</label><select id="notification-filter" className="select" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="ALL">All notifications</option><option value="UNREAD">Unread only</option></select></div></div>
    {!notifications.length ? <EmptyState icon="ti-bell-off" title="No notifications" body="There are no notifications in this view." /> :
      <section className="panel"><div className="panel-body">{notifications.map((item) => <div className={`notification-item ${item.is_read ? "" : "unread"}`} key={item.id}><div className="notification-icon"><i className="ti ti-bell" /></div><div className="notification-copy"><strong>{item.title}</strong><p>{item.body}</p><time>{relativeTime(item.created_at)}</time></div>{!item.is_read && <button className="btn btn-secondary" disabled={markRead.isPending} onClick={() => run(() => markRead.mutateAsync(item.id))}>Mark read</button>}</div>)}</div></section>}
  </PageState></StudentLayout>;
}
