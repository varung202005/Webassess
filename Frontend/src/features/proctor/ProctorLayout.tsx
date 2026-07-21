import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { useProctorDashboard } from "./hooks";
import { initials } from "./format";
import "./proctor.css";

const navItems = [
  { key: "dashboard", label: "Dashboard", icon: "ti-layout-dashboard", path: "/proctor/dashboard" },
];

interface ProctorLayoutProps {
  activePage: string;
  children: React.ReactNode;
}

export default function ProctorLayout({ activePage, children }: ProctorLayoutProps) {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("proctor-sidebar") === "collapsed"
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const location   = useLocation();
  const navigate   = useNavigate();
  const signOut    = useAuthStore((s) => s.signOut);
  const { data: portal } = useProctorDashboard();
  const profile = portal?.profile;

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("proctor-sidebar", next ? "collapsed" : "expanded");
  };

  const logout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className={`proctor-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      {mobileOpen && (
        <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMobileOpen(false)} />
      )}

      {/* ── Sidebar ── */}
      <aside className={`proctor-sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-logo">
          <div className="brand-mark">
            <img src="/auth-assets/tiet-logo.png" alt="TIET" />
          </div>
          <div className="brand-copy">
            <strong>WebAssess</strong>
            <span>Proctor Portal</span>
          </div>
          <button className="sidebar-toggle" onClick={toggleCollapsed} aria-label="Toggle sidebar">
            <i className={`ti ti-${collapsed ? "chevrons-right" : "chevrons-left"}`} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-group">
            <div className="nav-label">Monitoring</div>
            {navItems.map((item) => (
              <button
                key={item.key}
                className={`nav-item ${activePage === item.key ? "active" : ""}`}
                onClick={() => navigate(item.path)}
              >
                <i className={`ti ${item.icon}`} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </nav>

        <div className="sidebar-bottom">
          <div className="user-avatar">{profile ? initials(profile.full_name) : "PR"}</div>
          <div className="user-info">
            <div className="user-name">{profile?.full_name ?? "Proctor"}</div>
            <div className="user-role">Proctor</div>
          </div>
          <button className="sidebar-logout" onClick={logout} title="Sign out">
            <i className="ti ti-logout" />
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="proctor-main">
        <header className="proctor-header">
          <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <i className="ti ti-menu-2" />
          </button>
          <div className="breadcrumbs">
            <span>Proctor Portal</span>
            <span className="sep">/</span>
            <span className="current">Dashboard</span>
          </div>
          <div className="header-actions">
            <span className="role-badge">PROCTOR</span>
            <div className="header-user" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div className="header-avatar">{profile ? initials(profile.full_name) : "PR"}</div>
              <span className="header-user-name">{profile?.full_name?.split(" ")[0] ?? "Proctor"}</span>
            </div>
          </div>
        </header>
        <main className="proctor-content">{children}</main>
      </div>
    </div>
  );
}
