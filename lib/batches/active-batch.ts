import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolves the batch a user is actively looking at: the batch behind
 * their most recent *reconciliation run*, not just their most recently
 * uploaded batch. Those differ whenever an upload was never reconciled
 * (abandoned mid-wizard, or a fresh upload sitting unreconciled) — without
 * this distinction, every page that means "latest batch" would silently
 * pick up an unreconciled one and show all its orders/payments as
 * "Matched" (no discrepancies computed yet) instead of surfacing that
 * nothing has been reconciled.
 */
export async function getActiveBatchId(
  supabase: SupabaseClient
): Promise<string | null> {
  const { data: run } = await supabase
    .from("reconciliation_runs")
    .select("batch_id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return run?.batch_id ?? null;
}
