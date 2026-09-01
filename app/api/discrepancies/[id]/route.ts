import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: discrepancy } = await supabase
    .from("discrepancies")
    .select("*, reconciliation_runs(batch_id)")
    .eq("id", id)
    .single();

  if (!discrepancy) {
    return NextResponse.json({ error: "Discrepancy not found" }, { status: 404 });
  }

  // supabase-js's embed inference isn't reliable without generated
  // Database types — handle both the single-object and array shape.
  const runRelation = discrepancy.reconciliation_runs as
    | { batch_id: string }
    | { batch_id: string }[]
    | null;
  const runEmbed = Array.isArray(runRelation) ? runRelation[0] : runRelation;
  const batchId = runEmbed?.batch_id;

  const [{ data: order }, { data: payments }] = await Promise.all([
    batchId
      ? supabase
          .from("orders")
          .select("raw")
          .eq("batch_id", batchId)
          .eq("order_key", discrepancy.order_key)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    batchId && discrepancy.transaction_refs.length > 0
      ? supabase
          .from("payments")
          .select("raw")
          .eq("batch_id", batchId)
          .in("transaction_ref", discrepancy.transaction_refs)
      : Promise.resolve({ data: [] }),
  ]);

  const { reconciliation_runs: _omit, ...discrepancyFields } = discrepancy;
  void _omit;

  return NextResponse.json({
    discrepancy: discrepancyFields,
    order: order?.raw ?? null,
    payments: (payments ?? []).map((p) => p.raw),
  });
}
