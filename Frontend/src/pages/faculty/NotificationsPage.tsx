import { useState } from "react";
import FacultyLayout from "../../features/faculty/FacultyLayout";
import { Loading, ErrorBlock, EmptyState, PageHeading } from "../../features/faculty/components";
import { useFacultyDashboard, useFacultyAction } from "../../features/faculty/hooks";
import { facultyApi } from "../../features/faculty/api";
import { relativeTime } from "../../features/faculty/format";

const iconClassMap: Record<string, string> = {
  RESULT_PUBLISHED: "ti ti-circle-check",
  EXAM_CREATED: "ti ti-file-plus",
  EXAM_SCHEDULED: "ti ti-calendar-plus",
  GRADING_COMPLETE: "ti ti-writing",
  REEVALUATION_REQUESTED: "ti ti-refresh-alert",
  REEVALUATION_RESOLVED: "ti ti-check",
  PROCTORING_ALERT: "ti ti-alert-triangle",
  STUDENT_REGISTERED: "ti ti-user-plus",
};

const iconColorMap: Record<string, string> = {
  RESULT_PUBLISHED: "green",
  EXAM_CREATED: "blue",
  EXAM_SCHEDULED: "amber",
  GRADING_COMPLETE: "green",
  REEVALUATION_REQUESTED: "red",
  REEVALUATION_RESOLVED: "green",
  PROCTORING_ALERT: "red",
  STUDENT_REGISTERED: "blue",
};

export default function NotificationsPage() {
  const { data: portal, isLoading, refetch } = useFacultyDashboard();
  const notifications = portal?.notifications ?? [];
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markRead = useFacultyAction(
    (id: string) => facultyApi.markNotificationRead(id),
    [["faculty-portal"]],
  );

  const markAllRead = useFacultyAction(
    () => facultyApi.markAllNotificationsRead(),
    [["faculty-portal"]],
  );

  const handleToggleRead = (id: string, isRead: boolean) => {
    if (!isRead) {
      markRead.mutate(id);
    }
  };

  return (
    <FacultyLayout activePage="notifications">
      <PageHeading
        title="Notifications"
        subtitle={`${unreadCount} unread · ${notifications.length} total`}
        actions={
          unreadCount > 0 ? (
            <button className="btn btn-secondary" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
              <i className="ti ti-check-all" /> Mark All Read
            </button>
          ) : undefined
        }
      />

      {isLoading ? (
        <Loading text="Loading notifications…" />
      ) : notifications.length === 0 ? (
        <EmptyState icon="ti ti-bell" title="No notifications" text="You're all caught up!" />
      ) : (
        <div className="card">
          <div className="activity-list">
            {notifications.map((n) => {
              const iconClass = iconClassMap[n.type] ?? "ti ti-bell";
              const color = iconColorMap[n.type] ?? "blue";
              return (
                <div
                  className={`activity-item ${!n.is_read ? "unread" : ""}`}
                  key={n.id}
                  onClick={() => handleToggleRead(n.id, n.is_read ?? false)}
                  style={{ cursor: "pointer" }}
                >
                  <div className={`activity-icon ${color}`}>
                    <i className={iconClass} />
                  </div>
                  <div className="activity-body">
                    <div className="activity-text">{n.title}</div>
                    {n.body && <div style={{ fontSize: "12px", color: "var(--c-gray-500)", marginTop: 2 }}>{n.body}</div>}
                    <div className="activity-time">{relativeTime(n.created_at)}</div>
                  </div>
                  {!n.is_read && <div className="unread-indicator" />}
                  <button
                    className="action-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleRead(n.id, n.is_read ?? false);
                    }}
                    style={{ flexShrink: 0, alignSelf: "center" }}
                    title="Mark as read"
                  >
                    <i className="ti ti-check" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </FacultyLayout>
  );
}
