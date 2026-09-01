import type { SupabaseClient } from "@supabase/supabase-js";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_HOUR = 30;

/**
 * A production version of this would use Redis for a real sliding-window
 * counter shared across serverless instances. For this scope, counting
 * discrepancies.llm_generated_at timestamps in the trailing hour reuses
 * data already being persisted for caching, instead of standing up a new
 * counter table or an in-memory bucket that wouldn't survive across
 * serverless invocations anyway.
 */
export async function isRateLimited(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count } = await supabase
    .from("discrepancies")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("llm_generated_at", since);

  return (count ?? 0) >= MAX_PER_HOUR;
}
