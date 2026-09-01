import { NextResponse } from "next/server";
import { discrepancyToInsertRow } from "@/lib/batches/serialize";
import { DEFAULT_CONFIG, DEFAULT_CONFIG_INPUT, ENGINE_VERSION } from "@/lib/reconciliation/config";
import {
  buildDuplicateOrderRowDiscrepancy,
  computeSummary,
  reconcile,
} from "@/lib/reconciliation/engine";
import type { RawOrderRow, RawPaymentRow } from "@/lib/reconciliation/types";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: batchId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // RLS scopes this to the caller's own batch; a batch belonging to another
  // user (or a nonexistent one) simply returns no row here, not an error —
  // treated as 404 rather than leaking whether the id exists.
  const { data: batch } = await supabase
    .from("import_batches")
    .select("id, duplicate_order_keys")
    .eq("id", batchId)
    .single();

  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  const [{ data: orderRows, error: ordersError }, { data: paymentRows, error: paymentsError }] =
    await Promise.all([
      supabase.from("orders").select("raw").eq("batch_id", batchId),
      supabase.from("payments").select("raw").eq("batch_id", batchId),
    ]);

  if (ordersError || paymentsError) {
    return NextResponse.json(
      { error: ordersError?.message ?? paymentsError?.message },
      { status: 500 }
    );
  }

  // `raw` is the untouched, Zod-validated CSV row stored at ingest time —
  // feeding it straight back into reconcile() reuses the exact same pure
  // function and normalization path the engine's own tests run against,
  // rather than a second read-side mapping that could drift from it.
  const orders = (orderRows ?? []).map((r) => r.raw as RawOrderRow);
  const payments = (paymentRows ?? []).map((r) => r.raw as RawPaymentRow);

  const result = reconcile(orders, payments, DEFAULT_CONFIG);

  // Duplicate order rows are removed before insert (the orders table's
  // UNIQUE constraint only ever admits one copy), so reconcile() can't see
  // them to flag on its own — re-attach the flag from what ingest recorded,
  // then recompute the summary so an order gaining even this informational
  // discrepancy stops counting as "clean" in valueReconciledCents.
  const duplicateOrderKeys: string[] = batch.duplicate_order_keys ?? [];
  const discrepancies = [...result.discrepancies];
  for (const key of duplicateOrderKeys) {
    const order = result.orders.find((o) => o.orderKey === key);
    discrepancies.push(buildDuplicateOrderRowDiscrepancy(key, order?.orderId ?? null));
  }
  const summary = computeSummary(result.orders, result.payments, discrepancies);

  const { data: run, error: runError } = await supabase
    .from("reconciliation_runs")
    .insert({
      batch_id: batchId,
      user_id: user.id,
      config: DEFAULT_CONFIG_INPUT,
      engine_version: ENGINE_VERSION,
      summary,
    })
    .select("id, created_at")
    .single();

  if (runError || !run) {
    return NextResponse.json(
      { error: runError?.message ?? "Failed to persist reconciliation run." },
      { status: 500 }
    );
  }

  if (discrepancies.length > 0) {
    const discrepancyRows = discrepancies.map((d) =>
      discrepancyToInsertRow(d, run.id, user.id)
    );
    const { error: discrepanciesError } = await supabase
      .from("discrepancies")
      .insert(discrepancyRows);

    if (discrepanciesError) {
      return NextResponse.json({ error: discrepanciesError.message }, { status: 500 });
    }
  }

  await supabase
    .from("import_batches")
    .update({ status: "reconciled" })
    .eq("id", batchId);

  return NextResponse.json(
    { runId: run.id, createdAt: run.created_at, summary },
    { status: 201 }
  );
}
