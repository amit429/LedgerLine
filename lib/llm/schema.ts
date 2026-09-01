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
