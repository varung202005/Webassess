import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Role = "STUDENT" | "FACULTY" | "PROCTOR" | "ADMIN" | "CANDIDATE";

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  roles: Role[];
}

interface AuthState {
  user: AuthUser | null;
  activeRole: Role | null;
  /** Supabase access token — set by the auth provider on sign-in */
  token: string | null;
  authReady: boolean;
  setSession: (user: AuthUser, token: string) => void;
  setAuthReady: (ready: boolean) => void;
  setActiveRole: (role: Role) => void;
  signOut: () => void;
}

/**
 * Lightweight client-side auth/session store.
 *
 * In production this is populated from `supabase.auth.getSession()` /
 * `GET /auth/me` (see RESPONSIBILITY_MAP.md, section 1). Persisted to
 * localStorage only so role-based navigation can be reviewed without a
 * live backend — replace with the Supabase session listener before
 * shipping.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      activeRole: null,
      token: null,
      authReady: false,
      setSession: (user, token) =>
        set({ user, token, activeRole: user.roles[0] ?? null, authReady: true }),
      setAuthReady: (authReady) => set({ authReady }),
      setActiveRole: (role) => set({ activeRole: role }),
      signOut: () => set({ user: null, token: null, activeRole: null, authReady: true }),
    }),
    { name: "exam-tiet-auth" }
  )
);
