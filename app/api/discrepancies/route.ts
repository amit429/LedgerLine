import { NextResponse } from "next/server";
import type { DiscrepancyType, Severity } from "@/lib/reconciliation/types";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 20;

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
  const typeParam = url.searchParams.get("type");
  const severityParam = url.searchParams.get("severity");
  const q = url.searchParams.get("q")?.trim() ?? "";
  const sort = url.searchParams.get("sort") ?? "impact_desc";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const exportAll = url.searchParams.get("export") === "true";

  // Resolve the run to read from: the given batch's latest run, or the
  // user's most recent batch's latest run if no batchId was given. RLS
  // scopes every query below to the caller's own rows.
  let batchId = batchIdParam;
  if (!batchId) {
    const { data: latestBatch } = await supabase
      .from("import_batches")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    batchId = latestBatch?.id ?? null;
  }

  if (!batchId) {
    return NextResponse.json({ rows: [], total: 0, page: 1, pageSize: PAGE_SIZE, runId: null });
  }

  const { data: run } = await supabase
    .from("reconciliation_runs")
    .select("id")
    .eq("batch_id", batchId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!run) {
    return NextResponse.json({ rows: [], total: 0, page: 1, pageSize: PAGE_SIZE, runId: null });
  }

  let query = supabase.from("discrepancies").select("*").eq("run_id", run.id);

  if (typeParam) {
    query = query.in("type", typeParam.split(",") as DiscrepancyType[]);
  }
  if (severityParam) {
    query = query.in("severity", severityParam.split(",") as Severity[]);
  }
  if (q) {
    const like = `%${q}%`;
    query = query.or(
      `order_key.ilike.${like},order_id.ilike.${like},transaction_refs.cs.{${q}}`
    );
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];

  // A run realistically holds dozens of rows, not millions — sorting by
  // |impact| in JS avoids needing a raw-SQL abs() query and is plenty fast
  // at this scale.
  rows.sort((a, b) => {
    switch (sort) {
      case "impact_asc":
        return Math.abs(a.impact_cents) - Math.abs(b.impact_cents);
      case "detected_asc":
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case "detected_desc":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case "impact_desc":
      default:
        return Math.abs(b.impact_cents) - Math.abs(a.impact_cents);
    }
  });

  if (exportAll) {
    return NextResponse.json({ rows, total: rows.length, page: 1, pageSize: rows.length, runId: run.id });
  }

  const start = (page - 1) * PAGE_SIZE;
  const paged = rows.slice(start, start + PAGE_SIZE);

  return NextResponse.json({
    rows: paged,
    total: rows.length,
    page,
    pageSize: PAGE_SIZE,
    runId: run.id,
  });
}
