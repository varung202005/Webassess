import { useEffect, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { useAuthStore, type Role } from "../store/authStore";

const API_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

function normalizeRole(role: string): Role | null {
  const value = role.toUpperCase();
  return ["STUDENT", "FACULTY", "PROCTOR", "ADMIN", "CANDIDATE"].includes(value)
    ? (value as Role)
    : null;
}

export default function AuthBootstrap({ children }: { children: ReactNode }) {
  const setSession = useAuthStore((state) => state.setSession);
  const setAuthReady = useAuthStore((state) => state.setAuthReady);
  const clearSession = useAuthStore((state) => state.signOut);

  useEffect(() => {
    let active = true;

    const syncSession = async (accessToken?: string) => {
      if (!accessToken) {
        if (active) clearSession();
        return;
      }
      try {
        const response = await fetch(`${API_URL}/api/v1/auth/me`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) throw new Error("Unable to load account profile");
        const payload = await response.json() as {
          user: { id: string; full_name?: string; email: string };
          roles: string[];
        };
        const roles = payload.roles.map(normalizeRole).filter(Boolean) as Role[];
        if (!roles.length) throw new Error("No portal role is assigned to this account");
        if (active) {
          setSession({
            id: payload.user.id,
            fullName: payload.user.full_name ?? "",
            email: payload.user.email,
            roles,
          }, accessToken);
        }
      } catch {
        if (active) clearSession();
      } finally {
        if (active) setAuthReady(true);
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      void syncSession(data.session?.access_token);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncSession(session?.access_token);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [clearSession, setAuthReady, setSession]);

  return <>{children}</>;
}
