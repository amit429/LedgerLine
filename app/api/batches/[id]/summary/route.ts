import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
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

  // The dashboard reads what the engine already wrote — headline tiles are
  // never re-derived client-side from raw rows.
  const { data: run, error } = await supabase
    .from("reconciliation_runs")
    .select("id, batch_id, config, engine_version, summary, created_at")
    .eq("batch_id", batchId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!run) {
    return NextResponse.json(
      { error: "No reconciliation run found for this batch." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    runId: run.id,
    batchId: run.batch_id,
    config: run.config,
    engineVersion: run.engine_version,
    summary: run.summary,
    createdAt: run.created_at,
  });
}
