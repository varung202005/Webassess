import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuthStore, type Role } from "../store/authStore";

interface ProtectedRouteProps {
  roles: Role[];
  children: ReactNode;
}

/**
 * Guards a route to a set of roles. Mirrors "Role-based route guarding"
 * from RESPONSIBILITY_MAP.md (frontend) — the backend still enforces
 * this independently via role-based middleware, this is UX-only.
 */
export default function ProtectedRoute({ roles, children }: ProtectedRouteProps) {
  const activeRole = useAuthStore((s) => s.activeRole);
  const authReady = useAuthStore((s) => s.authReady);

  if (!authReady) return <div className="route-loader">Loading your portal...</div>;
  if (!activeRole) return <Navigate to="/login" replace />;
  if (!roles.includes(activeRole)) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
