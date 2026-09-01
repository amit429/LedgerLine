import { RULE_DESCRIPTIONS } from "../reconciliation/rule-descriptions";
import type { Discrepancy, ReconSummary } from "../reconciliation/types";

const SHARED_SYSTEM_PREAMBLE = `You explain already-finalized payments reconciliation results to a revenue-operations reviewer at an online store. The matching decision is final and was made by a deterministic rules engine before you were called — you are not deciding whether records match, only restating a structured result in plain language. Reason only from the fields given to you; if the evidence is insufficient to say something with confidence, say so rather than inventing detail. Do not mention any company name.`;

function formatCents(cents: number | null): string {
  if (cents === null) return "unknown";
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

/**
 * Only the structured discrepancy fields are sent — never the raw CSV rows,
 * and never the order's customer_email, which is the one PII field in this
 * dataset and isn't needed to explain a rule-based mismatch.
 */
export function buildExplanationPrompt(discrepancy: {
  type: Discrepancy["type"];
  severity: Discrepancy["severity"];
  order_key: string;
  order_id: string | null;
  expected_cents: number | null;
  actual_cents: number | null;
  impact_cents: number;
  currency: string | null;
  details: Record<string, unknown>;
}): { system: string; user: string } {
  const rule = RULE_DESCRIPTIONS[discrepancy.type];

  const system = `${SHARED_SYSTEM_PREAMBLE}

For each discrepancy, return:
- headline: one sentence, plain language, under 120 characters
- likely_cause: your best read of what happened, grounded only in the fields given
- business_impact: what this means in dollar terms for the business
- recommended_action: a concrete next step someone could take today
- confidence: "high" if the fields fully explain the situation, "medium" if there's a plausible read but some ambiguity, "low" if the fields leave real uncertainty`;

  const user = `Discrepancy record:
- type: ${discrepancy.type} (${rule.label})
- rule condition: ${rule.condition}
- severity: ${discrepancy.severity}
- order: ${discrepancy.order_id ?? discrepancy.order_key}
- expected amount: ${formatCents(discrepancy.expected_cents)}
- actual amount: ${formatCents(discrepancy.actual_cents)}
- impact: ${formatCents(discrepancy.impact_cents)}
- currency: ${discrepancy.currency ?? "n/a — see rule condition"}
- additional details: ${JSON.stringify(discrepancy.details)}

Explain this one discrepancy.`;

  return { system, user };
}

export interface PortfolioTopItem {
  type: Discrepancy["type"];
  orderId: string | null;
  orderKey: string;
  impactCents: number;
}

export function buildPortfolioPrompt(
  summary: Pick<ReconSummary, "totalOrders" | "totalPayments" | "valueInDisputeCents" | "moneyAtRiskCents">,
  topItems: PortfolioTopItem[]
): { system: string; user: string } {
  const system = `${SHARED_SYSTEM_PREAMBLE}

Write a 1-3 bullet "here's your week" briefing summarizing the overall reconciliation run, not any single discrepancy. Each bullet needs a short headline and one sentence of detail. Group similar discrepancies together rather than listing every single one — a reviewer wants the shape of the problem, not a transcript.`;

  const topList = topItems
    .map(
      (item) =>
        `- ${item.type} on ${item.orderId ?? item.orderKey}: ${formatCents(item.impactCents)}`
    )
    .join("\n");

  const user = `Run summary:
- ${summary.totalOrders} orders, ${summary.totalPayments} payments
- value in dispute: ${formatCents(summary.valueInDisputeCents)}
- money at risk: ${formatCents(summary.moneyAtRiskCents)}

Largest discrepancies in this run:
${topList}

Write the briefing.`;

  return { system, user };
}
