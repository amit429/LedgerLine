import { RULE_DESCRIPTIONS } from "../reconciliation/rule-descriptions";
import type { Discrepancy } from "../reconciliation/types";
import type { Explanation } from "./schema";

function formatCents(cents: number | null): string {
  if (cents === null) return "an unknown amount";
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

/**
 * Built purely from the discrepancy's own fields, no network call. Used
 * when the LLM is unreachable, times out, or returns something that
 * doesn't validate after a retry — the UI degrades to this instead of
 * breaking, and the deterministic numbers next to it are unaffected either
 * way.
 */
export function fallbackExplanation(discrepancy: {
  type: Discrepancy["type"];
  order_key: string;
  order_id: string | null;
  impact_cents: number;
}): Explanation {
  const rule = RULE_DESCRIPTIONS[discrepancy.type];
  const orderLabel = discrepancy.order_id ?? discrepancy.order_key;

  return {
    headline: `${rule.label} on ${orderLabel}`,
    likely_cause: `${rule.blurb} (rule condition: ${rule.condition}).`,
    business_impact:
      discrepancy.impact_cents === 0
        ? "This is an informational flag with no direct dollar impact."
        : `${formatCents(discrepancy.impact_cents)} is affected by this discrepancy.`,
    recommended_action:
      "Review the paired order and payment records for this order and decide how to resolve it.",
    confidence: "low",
  };
}
