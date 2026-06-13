import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../store/authStore";
import { useStudentPortal } from "./hooks";
import { initials } from "./format";
import "./student.css";

const navGroups = [
  {
    label: "Main",
    items: [
      ["/student/dashboard", "ti-layout-dashboard", "Dashboard"],
      ["/student/exams", "ti-clipboard-list", "Available Exams"],
      ["/student/registered", "ti-calendar-check", "Registered Exams"],
      ["/student/history", "ti-history", "Exam History"],
    ],
  },
  {
    label: "Results",
    items: [
      ["/student/results", "ti-award", "My Results"],
      ["/student/re-evaluation", "ti-refresh", "Re-Evaluation"],
    ],
  },
  {
    label: "Account",
    items: [
      ["/student/notifications", "ti-bell", "Notifications"],
      ["/student/profile", "ti-user-circle", "Profile"],
    ],
  },
];

const routeTitles: Record<string, string> = {
  "/student/dashboard": "Dashboard",
  "/student/exams": "Available Exams",
  "/student/registered": "Registered Exams",
  "/student/history": "Exam History",
  "/student/results": "My Results",
  "/student/re-evaluation": "Re-Evaluation",
  "/student/notifications": "Notifications",
  "/student/profile": "Profile",
};

export default function StudentLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("student-sidebar") === "collapsed");
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const signOut = useAuthStore((state) => state.signOut);
  const { data } = useStudentPortal();
  const profile = data?.profile;
  const unread = data?.notifications.filter((item) => !item.is_read).length ?? 0;

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("student-sidebar", next ? "collapsed" : "expanded");
  };

  const logout = async () => {
    await supabase.auth.signOut();
    signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className={`student-app ${collapsed ? "sidebar-collapsed" : ""}`}>
      {mobileOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}
      <aside className={`student-sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="student-brand">
          <div className="brand-mark">E</div>
          <div className="brand-copy"><strong>EXAM.TIET</strong><span>Student Portal</span></div>
          <button className="sidebar-toggle" onClick={toggleCollapsed} aria-label="Toggle sidebar">
            <i className={`ti ti-${collapsed ? "chevrons-right" : "chevrons-left"}`} />
          </button>
        </div>
        <nav className="student-nav">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-label">{group.label}</div>
              {group.items.map(([to, icon, label]) => (
                <NavLink key={to} to={to} className={({ isActive }) => `student-nav-link ${isActive ? "active" : ""}`}>
                  <i className={`ti ${icon}`} />
                  <span>{label}</span>
                  {to === "/student/notifications" && unread > 0 && <b>{unread}</b>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-profile">
          {profile?.profile_photo
            ? <img src={profile.profile_photo} alt="" className="avatar" />
            : <div className="avatar">{initials(profile?.full_name)}</div>}
          <div className="profile-copy">
            <strong>{profile?.full_name || "Student"}</strong>
            <span>{profile?.roll_number || profile?.email || "Account loading"}</span>
          </div>
          <button onClick={logout} title="Sign out"><i className="ti ti-logout" /></button>
        </div>
      </aside>

      <div className="student-main">
        <header className="student-topbar">
          <button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <i className="ti ti-menu-2" />
          </button>
          <div className="topbar-title">
            <span>Student Portal</span>
            <strong>{routeTitles[location.pathname] ?? "Exam"}</strong>
          </div>
          <div className="topbar-actions">
            <button className="topbar-icon" onClick={() => navigate("/student/notifications")} aria-label="Notifications">
              <i className="ti ti-bell" />
              {unread > 0 && <span>{unread > 9 ? "9+" : unread}</span>}
            </button>
            <button className="topbar-user" onClick={() => navigate("/student/profile")}>
              {profile?.profile_photo
                ? <img src={profile.profile_photo} alt="" className="avatar small" />
                : <div className="avatar small">{initials(profile?.full_name)}</div>}
              <span>{profile?.full_name || "Student"}</span>
            </button>
          </div>
        </header>
        <main className="student-content">{children}</main>
      </div>
    </div>
  );
}

export function PageState({
  loading,
  error,
  children,
}: {
  loading: boolean;
  error?: unknown;
  children: ReactNode;
}) {
  if (loading) {
    return <div className="state-card"><span className="spinner" /> Loading student data...</div>;
  }
  if (error) {
    return <div className="state-card error"><i className="ti ti-alert-circle" /> {error instanceof Error ? error.message : "Unable to load this page."}</div>;
  }
  return <>{children}</>;
}

export function EmptyState({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="empty-state">
      <i className={`ti ${icon}`} />
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

export function Feedback({ message, error }: { message?: string | null; error?: string | null }) {
  if (!message && !error) return null;
  return <div className={`feedback ${error ? "error" : "success"}`}><i className={`ti ti-${error ? "alert-circle" : "circle-check"}`} />{error || message}</div>;
}
