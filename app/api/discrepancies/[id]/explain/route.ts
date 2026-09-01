import { NextResponse } from "next/server";
import { requestExplanation } from "@/lib/llm/client";
import { fallbackExplanation } from "@/lib/llm/fallback";
import { buildExplanationPrompt } from "@/lib/llm/prompts";
import { isRateLimited } from "@/lib/llm/rate-limit";
import { createClient } from "@/lib/supabase/server";

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

  const { data: discrepancy } = await supabase
    .from("discrepancies")
    .select(
      "id, type, severity, order_key, order_id, expected_cents, actual_cents, impact_cents, currency, details, llm_explanation"
    )
    .eq("id", id)
    .single();

  if (!discrepancy) {
    return NextResponse.json({ error: "Discrepancy not found" }, { status: 404 });
  }

  const regenerate = new URL(request.url).searchParams.get("regenerate") === "true";
  if (discrepancy.llm_explanation && !regenerate) {
    return NextResponse.json({
      explanation: discrepancy.llm_explanation,
      cached: true,
      fallback: false,
    });
  }

  if (await isRateLimited(supabase, user.id)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a few minutes." },
      { status: 429 }
    );
  }

  const { system, user: userPrompt } = buildExplanationPrompt(discrepancy);

  try {
    const explanation = await requestExplanation(system, userPrompt);
    await supabase
      .from("discrepancies")
      .update({ llm_explanation: explanation, llm_generated_at: new Date().toISOString() })
      .eq("id", id);
    return NextResponse.json({ explanation, cached: false, fallback: false });
  } catch {
    // Timeout, malformed/refused response after retry, or an error from
    // Gemini all land here. The deterministic template keeps the UI
    // functional and is deliberately not cached — it's cheap to regenerate
    // and a later attempt might succeed with the real model instead.
    const explanation = fallbackExplanation(discrepancy);
    return NextResponse.json({ explanation, cached: false, fallback: true });
  }
}
