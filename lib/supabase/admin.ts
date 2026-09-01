import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client. Bypasses Row Level Security entirely — server-only,
 * used solely by scripts/tests that need to set up fixtures across users
 * (e.g. seeding the demo account, or the cross-user RLS test). Never import
 * this from application request code.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
