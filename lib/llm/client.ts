import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import {
  ExplanationSchema,
  PortfolioSummarySchema,
  type Explanation,
  type PortfolioSummary,
} from "./schema";

/**
 * This is a deterministic classification being restated in plain English,
 * not a creative task. Near-zero temperature keeps the same discrepancy
 * producing the same explanation across reloads — that matters because the
 * explanation sits next to a number someone will act on. Not exactly 0: a
 * little variance avoids stilted, templated-sounding phrasing.
 */
const TEMPERATURE = 0.2;
const MODEL = "gpt-4o-mini";
const TIMEOUT_MS = 10_000;
const MAX_TOKENS = 500;

/**
 * This module has zero import of anything under lib/reconciliation/* beyond
 * type definitions — it never touches the engine, never receives raw CSV
 * rows, and cannot influence matching. It only turns an already-persisted
 * discrepancy record into prose.
 */
function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return new OpenAI({ apiKey });
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    // Zod-validate-then-retry-once per RECON_PLAN's failure-handling spec.
    // A second attempt absorbs one-off malformed or refused completions
    // without immediately falling back to the template.
    return await fn().catch(() => {
      throw error;
    });
  }
}

export async function requestExplanation(
  system: string,
  user: string
): Promise<Explanation> {
  const client = getClient();
  return withRetry(async () => {
    const completion = await client.chat.completions.parse(
      {
        model: MODEL,
        temperature: TEMPERATURE,
        top_p: 1,
        max_tokens: MAX_TOKENS,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: zodResponseFormat(ExplanationSchema, "explanation"),
      },
      { timeout: TIMEOUT_MS }
    );

    const parsed = completion.choices[0]?.message?.parsed;
    if (!parsed) {
      throw new Error("LLM response did not include a parsed explanation");
    }
    return parsed;
  });
}

export async function requestPortfolioSummary(
  system: string,
  user: string
): Promise<PortfolioSummary> {
  const client = getClient();
  return withRetry(async () => {
    const completion = await client.chat.completions.parse(
      {
        model: MODEL,
        temperature: TEMPERATURE,
        top_p: 1,
        max_tokens: MAX_TOKENS,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: zodResponseFormat(PortfolioSummarySchema, "portfolio_summary"),
      },
      { timeout: TIMEOUT_MS }
    );

    const parsed = completion.choices[0]?.message?.parsed;
    if (!parsed) {
      throw new Error("LLM response did not include a parsed portfolio summary");
    }
    return parsed;
  });
}
