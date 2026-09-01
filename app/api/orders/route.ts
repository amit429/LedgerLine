import { NextResponse } from "next/server";
import { getActiveBatchId } from "@/lib/batches/active-batch";
import { MATCHED_OUTCOME, outcomeForType } from "@/lib/reconciliation/outcome";
import type { DiscrepancyType } from "@/lib/reconciliation/types";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_PAGE_SIZE = 25;
const ALLOWED_PAGE_SIZES = new Set([10, 25, 50, 100]);

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
  const status = url.searchParams.get("status");
  const outcomeFilter = url.searchParams.get("outcome"); // "matched" | "flagged"
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const requestedPageSize = Number(url.searchParams.get("pageSize"));
  const PAGE_SIZE = ALLOWED_PAGE_SIZES.has(requestedPageSize)
    ? requestedPageSize
    : DEFAULT_PAGE_SIZE;

  const batchId = batchIdParam ?? (await getActiveBatchId(supabase));

  if (!batchId) {
    return NextResponse.json({ rows: [], total: 0, page: 1, pageSize: PAGE_SIZE });
  }

  const [{ data: orders, error: ordersError }, { data: run }] = await Promise.all([
    supabase.from("orders").select("*").eq("batch_id", batchId).order("order_date"),
    supabase
      .from("reconciliation_runs")
      .select("id")
      .eq("batch_id", batchId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (ordersError) {
    return NextResponse.json({ error: ordersError.message }, { status: 500 });
  }

  const outcomeByOrderKey = new Map<string, ReturnType<typeof outcomeForType>>();
  if (run) {
    const { data: discrepancies } = await supabase
      .from("discrepancies")
      .select("order_key, type")
      .eq("run_id", run.id);
    for (const d of discrepancies ?? []) {
      if (!outcomeByOrderKey.has(d.order_key)) {
        outcomeByOrderKey.set(d.order_key, outcomeForType(d.type as DiscrepancyType));
      }
    }
  }

  let rows = (orders ?? []).map((o) => ({
    ...o,
    outcome: outcomeByOrderKey.get(o.order_key) ?? MATCHED_OUTCOME,
  }));

  if (status) {
    rows = rows.filter((o) => o.status === status);
  }
  if (outcomeFilter === "matched") {
    rows = rows.filter((o) => o.outcome.label === MATCHED_OUTCOME.label);
  } else if (outcomeFilter === "flagged") {
    rows = rows.filter((o) => o.outcome.label !== MATCHED_OUTCOME.label);
  }
  if (q) {
    rows = rows.filter(
      (o) =>
        o.order_id.toLowerCase().includes(q) ||
        (o.customer_email ?? "").toLowerCase().includes(q)
    );
  }

  const total = rows.length;
  const start = (page - 1) * PAGE_SIZE;
  const paged = rows.slice(start, start + PAGE_SIZE);

  return NextResponse.json({ rows: paged, total, page, pageSize: PAGE_SIZE });
}
