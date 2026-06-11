import { Link, useLocation } from "react-router-dom";
import { ROUTES } from "../routes/routes";
import { useAuthStore, type Role } from "../store/authStore";

const ROLE_USERS: Record<Role, { id: string; fullName: string; email: string }> = {
  STUDENT: { id: "demo-student", fullName: "Aarav Sharma", email: "102417042@thapar.edu" },
  FACULTY: { id: "demo-faculty", fullName: "Dr. Neha Kapoor", email: "neha.kapoor@thapar.edu" },
  PROCTOR: { id: "demo-proctor", fullName: "Rohit Verma", email: "rohit.verma@thapar.edu" },
  ADMIN: { id: "demo-admin", fullName: "System Admin", email: "admin@thapar.edu" },
};

/**
 * Quick-jump rail shown at the bottom of every screen so the converted
 * mockups can be reviewed end-to-end without a backend. Not part of the
 * production UI — remove once real auth/navigation is wired up.
 */
export default function DevNav() {
  const location = useLocation();
  const { activeRole, setSession, setActiveRole } = useAuthStore();

  const loginAs = (role: Role) => {
    const u = ROLE_USERS[role];
    setSession({ ...u, roles: [role] }, "dev-mock-token");
    setActiveRole(role);
  };

  return (
    <nav className="devnav">
      <b>EXAM.TIET dev nav · role: {activeRole ?? "none"}</b>
      {(Object.keys(ROLE_USERS) as Role[]).map((r) => (
        <a key={r} onClick={() => loginAs(r)} className={activeRole === r ? "active" : ""}>
          Login as {r}
        </a>
      ))}
      <span style={{ width: 1, alignSelf: "stretch", background: "rgba(255,255,255,0.15)", margin: "0 4px" }} />
      {ROUTES.map((r) => (
        <Link key={r.path} to={r.path} className={location.pathname === r.path ? "active" : ""}>
          {r.label}
        </Link>
      ))}
    </nav>
  );
}
