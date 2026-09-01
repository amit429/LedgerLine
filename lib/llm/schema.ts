import { z } from "zod";

/**
 * Mirrors RECON_PLAN's structured-output contract exactly. The LLM never
 * decides whether two records match — it only restates an already-final
 * deterministic result in plain language, so every field here describes
 * *this specific discrepancy*, not a judgment call.
 */
export const ExplanationSchema = z.object({
  headline: z.string().max(120),
  likely_cause: z.string(),
  business_impact: z.string(),
  recommended_action: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
});
export type Explanation = z.infer<typeof ExplanationSchema>;

export const PortfolioBulletSchema = z.object({
  headline: z.string().max(120),
  detail: z.string(),
});

export const PortfolioSummarySchema = z.object({
  bullets: z.array(PortfolioBulletSchema).min(1).max(3),
});
export type PortfolioSummary = z.infer<typeof PortfolioSummarySchema>;

/**
 * Gemini's `responseJsonSchema` only supports a subset of JSON Schema (no
 * `maxLength`, notably — see lib/llm/client.ts) and is a request-time hint
 * to the model, not the enforcement boundary. The Zod schemas above are
 * re-applied to every response before it's accepted, regardless of
 * provider, so a keyword Gemini ignores doesn't weaken validation — it just
 * means a violation is caught after the call instead of prevented during
 * it, same as it would be for any provider without strict schema support.
 */
function toProviderJsonSchema(schema: z.ZodType): unknown {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  delete jsonSchema.$schema;
  return jsonSchema;
}

export const EXPLANATION_JSON_SCHEMA = toProviderJsonSchema(ExplanationSchema);
export const PORTFOLIO_SUMMARY_JSON_SCHEMA = toProviderJsonSchema(PortfolioSummarySchema);
