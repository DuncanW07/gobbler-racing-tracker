import "server-only";
import { createClient } from "@supabase/supabase-js";

// Server-only Supabase client. The browser never talks to Supabase directly:
// every request goes through this app's server, which checks the session first.
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase environment variables are not set.");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
