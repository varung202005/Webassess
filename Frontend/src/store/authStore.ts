import { create } from "zustand";

export type Role = "STUDENT" | "FACULTY" | "PROCTOR" | "ADMIN" | "CANDIDATE";

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  roles: Role[];
}

export function preferredRole(roles: Role[]): Role | null {
  const priority: Role[] = ["ADMIN", "PROCTOR", "FACULTY", "STUDENT", "CANDIDATE"];
  return priority.find((role) => roles.includes(role)) ?? roles[0] ?? null;
}

interface AuthState {
  user: AuthUser | null;
  activeRole: Role | null;
  /** Supabase access token, set after the auth provider verifies the session. */
  token: string | null;
  authReady: boolean;
  setSession: (user: AuthUser, token: string) => void;
  setAuthReady: (ready: boolean) => void;
  setActiveRole: (role: Role) => void;
  signOut: () => void;
}

/**
 * Session state used by the UI and API client.
 *
 * Supabase owns token persistence and refresh. This store intentionally
 * remains in-memory so a stale JWT cannot be restored before AuthBootstrap
 * verifies the current Supabase session with `/auth/me`.
 */
export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  activeRole: null,
  token: null,
  authReady: false,
  setSession: (user, token) =>
    set({ user, token, activeRole: preferredRole(user.roles), authReady: true }),
  setAuthReady: (authReady) => set({ authReady }),
  setActiveRole: (role) => set({ activeRole: role }),
  signOut: () => set({ user: null, token: null, activeRole: null, authReady: true }),
}));
