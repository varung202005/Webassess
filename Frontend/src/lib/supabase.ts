// Supabase Auth / Realtime client.
//
// Per RESPONSIBILITY_MAP.md (section 1):
//  - Frontend calls supabase.auth.signUp() / signInWithPassword() directly.
//  - Token storage + refresh handled automatically by the SDK.
//  - The backend NEVER sees raw credentials, only the resulting JWT.
//
// 1. Install the SDK:
//      npm install @supabase/supabase-js
//
// 2. Uncomment the import + export below and remove the placeholder.
//
// import { createClient } from "@supabase/supabase-js";
//
// export const supabase = createClient(
//   import.meta.env.VITE_SUPABASE_URL,
//   import.meta.env.VITE_SUPABASE_ANON_KEY
// );

export const supabase = {
  auth: {
    signInWithPassword: async (_args: { email: string; password: string }) => {
      throw new Error("Supabase client not configured — see src/lib/supabase.ts");
    },
    signUp: async (_args: unknown) => {
      throw new Error("Supabase client not configured — see src/lib/supabase.ts");
    },
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: (_cb: (event: string, session: unknown) => void) => ({
      data: { subscription: { unsubscribe: () => {} } },
    }),
    signOut: async () => ({ error: null }),
  },
};
