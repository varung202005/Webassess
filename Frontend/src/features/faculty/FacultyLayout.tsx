/**
 * FacultyLayout.tsx
 *
 * CHANGES vs original:
 *   • "Schedules" nav item removed from the Insights group entirely.
 *     Publishing and schedule management now happens inline via the
 *     Dashboard Publish button — no dedicated Schedules page needed.
 *
 * Drop this file at:  src/features/faculty/FacultyLayout.tsx
 */

import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { useFacultyDashboard } from "./hooks";
import { initials, relativeTime } from "./format";
import { facultyApi } from "./api";
import type { Notification } from "./types";
import "./faculty.css";

// ─── Nav groups — Schedules intentionally removed ───────────────────────────
const navGroups = [
  {
    label: "Main",
    items: [
      { key: "dashboard",   label: "Dashboard",  icon: "ti-layout-dashboard", path: "/faculty/dashboard" },
      { key: "create-exam", label: "Create Exam", icon: "ti-file-plus",        path: "/faculty/create-exam" },
      { key: "evaluation",  label: "Evaluation",  icon: "ti-writing",          path: "/faculty/evaluation" },
    ],
  },
  {
    label: "Insights",
    items: [
      // "Schedules" removed — scheduling info surfaces on the Dashboard
      { key: "analytics", label: "Analytics", icon: "ti-device-desktop-analytics", path: "/faculty/analytics" },
    ],
  },
  {
    label: "Management",
    items: [
      { key: "reevaluations", label: "Re-evaluations", icon: "ti-refresh-alert", path: "/faculty/reevaluations" },
      { key: "notifications", label: "Notifications",  icon: "ti-bell",          path: "/faculty/notifications" },
    ],
  },
];

const routeTitles: Record<string, string> = {
  "/faculty/dashboard":     "Dashboard",
  "/faculty/create-exam":   "Create Exam",
  "/faculty/evaluation":    "Evaluation",
  "/faculty/analytics":     "Analytics",
  "/faculty/reevaluations": "Re-evaluations",
  "/faculty/notifications": "Notifications",
};

interface FacultyLayoutProps {
  activePage: string;
  children: React.ReactNode;
  pageTitle?: string;
  breadcrumbs?: string[];
  actions?: React.ReactNode;
}

export default function FacultyLayout({ activePage, children }: FacultyLayoutProps) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("faculty-sidebar") === "collapsed");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const signOut = useAuthStore((state) => state.signOut);
  const { data: portal } = useFacultyDashboard();

  const profile = portal?.profile;
  const notifications = portal?.notifications ?? [];
  const unreadCount = notifications.filter((n: Notification) => !n.is_read).length;

  useEffect(() => setMobileOpen(false), [location.pathname]);
  useEffect(() => setNotifOpen(false), [location.pathname]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("faculty-sidebar", next ? "collapsed" : "expanded");
  };

  const logout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className={`faculty-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      {mobileOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}

      <aside className={`faculty-sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-logo">
          <div className="brand-mark">E</div>
          <div className="brand-copy">
            <strong>EXAM.TIET</strong>
            <span>Faculty Portal</span>
          </div>
          <button className="sidebar-toggle" onClick={toggleCollapsed} aria-label="Toggle sidebar">
            <i className={`ti ti-${collapsed ? "chevrons-right" : "chevrons-left"}`} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-label">{group.label}</div>
              {group.items.map((item) => (
                <button
                  key={item.key}
                  className={`nav-item ${activePage === item.key ? "active" : ""}`}
                  onClick={() => navigate(item.path)}
                >
                  <i className={`ti ${item.icon}`} />
                  <span>{item.label}</span>
                  {item.key === "notifications" && unreadCount > 0 && (
                    <span className="nav-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="user-avatar">{profile ? initials(profile.full_name) : "F"}</div>
          <div className="user-info">
            <div className="user-name">{profile?.full_name ?? "Faculty"}</div>
            <div className="user-role">{profile?.departments?.name ?? "Faculty"}</div>
          </div>
          <button className="sidebar-logout" onClick={logout} title="Sign out">
            <i className="ti ti-logout" />
          </button>
        </div>
      </aside>

      <div className="faculty-main">
        <header className="faculty-header">
          <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <i className="ti ti-menu-2" />
          </button>
          <div className="breadcrumbs">
            <span>Faculty Portal</span>
            <span className="sep">/</span>
            <span className="current">{routeTitles[location.pathname] ?? "Dashboard"}</span>
          </div>

          <div className="header-actions">
            <div className="notif-wrapper">
              <button className="icon-btn" onClick={() => setNotifOpen((p) => !p)} data-tip="Notifications">
                <i className="ti ti-bell" />
                {unreadCount > 0 && <span className="notif-dot" />}
              </button>
              {notifOpen && (
                <>
                  <div className="notif-overlay" onClick={() => setNotifOpen(false)} />
                  <div className="notif-dropdown">
                    <div className="notif-header">
                      <div className="notif-title">
                        Notifications
                        {unreadCount > 0 && <span className="notif-count">{unreadCount}</span>}
                      </div>
                    </div>
                    <div className="notif-list">
                      {notifications.length === 0 && (
                        <div className="notif-empty">No notifications</div>
                      )}
                      {notifications.slice(0, 5).map((n: Notification) => (
                        <div key={n.id} className={`notif-item ${!n.is_read ? "unread" : ""}`}>
                          <div className="notif-icon-wrap">
                            <i className={`ti ti-${notifIcon(n.type)}`} />
                          </div>
                          <div className="notif-body">
                            <div className="notif-text">{n.title}</div>
                            <div className="notif-meta">{n.body}</div>
                            <div className="notif-time">{relativeTime(n.created_at)}</div>
                          </div>
                          {!n.is_read && <div className="unread-indicator" />}
                        </div>
                      ))}
                    </div>
                    <div className="notif-footer">
                      <button className="notif-view-all" onClick={() => { setNotifOpen(false); navigate("/faculty/notifications"); }}>
                        View all notifications
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <span className="role-badge">FACULTY</span>

            <button className="header-user" onClick={() => navigate("/faculty/profile")}>
              <div className="header-avatar">{profile ? initials(profile.full_name) : "F"}</div>
              <span className="header-user-name">{profile?.full_name?.split(" ")[0] ?? "Faculty"}</span>
            </button>
          </div>
        </header>

        <main className="faculty-content">{children}</main>
      </div>
    </div>
  );
}

function notifIcon(type: string): string {
  const map: Record<string, string> = {
    RESULT_PUBLISHED: "check",
    EXAM_SCHEDULED: "calendar-plus",
    REEVALUATION_REQUESTED: "refresh-alert",
    REEVALUATION_RESOLVED: "check",
    GRADING_COMPLETE: "writing",
    PROCTORING_ALERT: "alert-triangle",
  };
  return map[type] ?? "bell";
}