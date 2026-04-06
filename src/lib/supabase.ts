import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase admin client.
 * Uses the SERVICE ROLE key — bypasses Row Level Security.
 * Only ever called from API routes (server-side). Never exposed to the browser.
 */
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
