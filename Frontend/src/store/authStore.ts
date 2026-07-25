import { create } from "zustand";
import { supabase } from "../lib/supabase";

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

/**
 * Keep token in sync with Supabase's SDK for the lifetime of the app.
 *
 * Without this, token was only ever set once by setSession() at login and
 * never updated again — Supabase silently rotates the access token in the
 * background roughly every hour, and this store had no way of finding out.
 * Any request that fired after a rotation but before the user's next
 * login/refresh would go out with an expired JWT and get a 401, even
 * though the user's session was, from Supabase's point of view, perfectly
 * valid the whole time. This is the actual cause of the intermittent
 * 401s (as opposed to api.ts's retry-on-401, which only papers over it
 * after the fact).
 *
 * Registered once at module load (this file is a singleton import).
 */
supabase.auth.onAuthStateChange((event, session) => {
  if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
    if (session?.access_token) {
      useAuthStore.setState({ token: session.access_token });
    }
  } else if (event === "SIGNED_OUT") {
    useAuthStore.setState({ user: null, token: null, activeRole: null });
  }
});