import { GoogleGenAI } from "@google/genai";
import type { ZodType } from "zod";
import {
  EXPLANATION_JSON_SCHEMA,
  ExplanationSchema,
  PORTFOLIO_SUMMARY_JSON_SCHEMA,
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
const MODEL = "gemini-2.5-flash";
const TIMEOUT_MS = 10_000;
const MAX_OUTPUT_TOKENS = 500;

/**
 * This module has zero import of anything under lib/reconciliation/* beyond
 * type definitions — it never touches the engine, never receives raw CSV
 * rows, and cannot influence matching. It only turns an already-persisted
 * discrepancy record into prose.
 */
function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return new GoogleGenAI({ apiKey });
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

/**
 * Gemini's `responseJsonSchema` (see schema.ts) only nudges the model —
 * it's not a hard guarantee the way OpenAI's strict structured-output mode
 * is. Parsing and Zod-validating here is what actually enforces the
 * contract: a response with a missing field, a bad enum value, or a
 * too-long headline throws here, which withRetry treats the same as any
 * other failure (retry once, then let the caller fall back to the
 * deterministic template).
 */
function parseStructuredResponse<T>(schema: ZodType<T>, text: string | undefined): T {
  if (!text) {
    throw new Error("Gemini response did not include any text content");
  }
  return schema.parse(JSON.parse(text));
}

export async function requestExplanation(
  system: string,
  user: string
): Promise<Explanation> {
  const client = getClient();
  return withRetry(async () => {
    const response = await client.models.generateContent({
      model: MODEL,
      contents: user,
      config: {
        systemInstruction: system,
        temperature: TEMPERATURE,
        topP: 1,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        responseMimeType: "application/json",
        responseJsonSchema: EXPLANATION_JSON_SCHEMA,
        // This is a restatement task, not one that benefits from
        // deliberation — disabling thinking keeps latency low and avoids
        // the model spending its (small) output-token budget on reasoning
        // it doesn't need instead of the actual JSON.
        thinkingConfig: { thinkingBudget: 0 },
        httpOptions: { timeout: TIMEOUT_MS },
      },
    });
    return parseStructuredResponse(ExplanationSchema, response.text);
  });
}

export async function requestPortfolioSummary(
  system: string,
  user: string
): Promise<PortfolioSummary> {
  const client = getClient();
  return withRetry(async () => {
    const response = await client.models.generateContent({
      model: MODEL,
      contents: user,
      config: {
        systemInstruction: system,
        temperature: TEMPERATURE,
        topP: 1,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        responseMimeType: "application/json",
        responseJsonSchema: PORTFOLIO_SUMMARY_JSON_SCHEMA,
        thinkingConfig: { thinkingBudget: 0 },
        httpOptions: { timeout: TIMEOUT_MS },
      },
    });
    return parseStructuredResponse(PortfolioSummarySchema, response.text);
  });
}
