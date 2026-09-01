import { NextResponse } from "next/server";
import { getActiveBatchId } from "@/lib/batches/active-batch";
import {
  MATCHED_OUTCOME,
  REFERENCE_NORMALISED_OUTCOME,
  outcomeForType,
} from "@/lib/reconciliation/outcome";
import type { DiscrepancyType } from "@/lib/reconciliation/types";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 25;

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const batchIdParam = url.searchParams.get("batchId");
  const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const type = url.searchParams.get("type");
  const status = url.searchParams.get("status");
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);

  const batchId = batchIdParam ?? (await getActiveBatchId(supabase));

  if (!batchId) {
    return NextResponse.json({ rows: [], total: 0, page: 1, pageSize: PAGE_SIZE });
  }

  const [{ data: payments, error: paymentsError }, { data: run }] = await Promise.all([
    supabase.from("payments").select("*").eq("batch_id", batchId).order("processed_at"),
    supabase
      .from("reconciliation_runs")
      .select("id")
      .eq("batch_id", batchId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (paymentsError) {
    return NextResponse.json({ error: paymentsError.message }, { status: 500 });
  }

  const outcomeByRef = new Map<string, ReturnType<typeof outcomeForType>>();
  if (run) {
    const { data: discrepancies } = await supabase
      .from("discrepancies")
      .select("transaction_refs, type")
      .eq("run_id", run.id);
    for (const d of discrepancies ?? []) {
      for (const ref of d.transaction_refs) {
        if (!outcomeByRef.has(ref)) {
          outcomeByRef.set(ref, outcomeForType(d.type as DiscrepancyType));
        }
      }
    }
  }

  let rows = (payments ?? []).map((p) => {
    const discrepancyOutcome = outcomeByRef.get(p.transaction_ref);
    if (discrepancyOutcome) {
      return { ...p, outcome: discrepancyOutcome };
    }
    // Not tied to any discrepancy — but the raw reference may still have
    // needed trim/uppercase normalization to resolve to its order at all
    // (e.g. "ord-1801 "), which is worth surfacing even though it's
    // deliberately not a flagged discrepancy.
    const wasNormalized = p.order_reference !== p.order_key;
    return { ...p, outcome: wasNormalized ? REFERENCE_NORMALISED_OUTCOME : MATCHED_OUTCOME };
  });

  if (type) {
    rows = rows.filter((p) => p.type === type);
  }
  if (status) {
    rows = rows.filter((p) => p.status === status);
  }
  if (q) {
    rows = rows.filter(
      (p) =>
        p.transaction_ref.toLowerCase().includes(q) ||
        p.order_reference.toLowerCase().includes(q)
    );
  }

  const total = rows.length;
  const start = (page - 1) * PAGE_SIZE;
  const paged = rows.slice(start, start + PAGE_SIZE);

  return NextResponse.json({ rows: paged, total, page, pageSize: PAGE_SIZE });
}
