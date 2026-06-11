// Supabase Auth / Realtime client.
//
// Per RESPONSIBILITY_MAP.md (section 1):
//  - Frontend calls supabase.auth.signUp() / signInWithPassword() directly.
//  - Token storage + refresh handled automatically by the SDK.
//  - The backend NEVER sees raw credentials, only the resulting JWT.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. " +
      "Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);