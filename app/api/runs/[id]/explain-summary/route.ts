import { NextResponse } from "next/server";
import { requestPortfolioSummary } from "@/lib/llm/client";
import { PortfolioSummarySchema } from "@/lib/llm/schema";
import { isRateLimited } from "@/lib/llm/rate-limit";
import { buildPortfolioPrompt, type PortfolioTopItem } from "@/lib/llm/prompts";
import type { ReconSummary } from "@/lib/reconciliation/types";
import { createClient } from "@/lib/supabase/server";

const FALLBACK_SUMMARY = {
  bullets: [
    {
      headline: "Portfolio briefing unavailable",
      detail:
        "The explanation service didn't respond in time. The deterministic results below are unaffected — filter or sort the discrepancies table directly.",
    },
  ],
};

export async function POST(
  request: Request,
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

  const { data: run } = await supabase
    .from("reconciliation_runs")
    .select("id, summary, llm_briefing")
    .eq("id", id)
    .single();

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const regenerate = new URL(request.url).searchParams.get("regenerate") === "true";
  if (run.llm_briefing && !regenerate) {
    const parsed = PortfolioSummarySchema.safeParse(run.llm_briefing);
    if (parsed.success) {
      return NextResponse.json({ summary: parsed.data, cached: true, fallback: false });
    }
  }

  if (await isRateLimited(supabase, user.id)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a few minutes." },
      { status: 429 }
    );
  }

  const { data: topDiscrepancies } = await supabase
    .from("discrepancies")
    .select("type, order_id, order_key, impact_cents")
    .eq("run_id", id)
    .order("impact_cents", { ascending: false })
    .limit(20);

  const topItems: PortfolioTopItem[] = [...(topDiscrepancies ?? [])]
    .sort((a, b) => Math.abs(b.impact_cents) - Math.abs(a.impact_cents))
    .slice(0, 5)
    .map((d) => ({
      type: d.type,
      orderId: d.order_id,
      orderKey: d.order_key,
      impactCents: d.impact_cents,
    }));

  const summary = run.summary as ReconSummary;
  const { system, user: userPrompt } = buildPortfolioPrompt(summary, topItems);

  try {
    const portfolioSummary = await requestPortfolioSummary(system, userPrompt);
    await supabase
      .from("reconciliation_runs")
      .update({
        llm_briefing: portfolioSummary,
        llm_briefing_generated_at: new Date().toISOString(),
      })
      .eq("id", id);
    return NextResponse.json({ summary: portfolioSummary, cached: false, fallback: false });
  } catch {
    return NextResponse.json({ summary: FALLBACK_SUMMARY, cached: false, fallback: true });
  }
}
