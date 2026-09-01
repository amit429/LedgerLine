import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const parseMock = vi.fn();

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = { completions: { parse: parseMock } };
  },
}));

vi.mock("openai/helpers/zod", () => ({
  zodResponseFormat: () => ({}),
}));

describe("requestExplanation", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
    parseMock.mockReset();
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it("retries once on a malformed (unparsed) response, then throws", async () => {
    // Simulates the model returning something that fails strict schema
    // validation — the SDK surfaces this as a missing `.parsed`.
    parseMock.mockResolvedValue({ choices: [{ message: { parsed: null } }] });

    const { requestExplanation } = await import("../client");
    await expect(requestExplanation("system", "user")).rejects.toThrow();

    // One initial attempt + exactly one retry, not an unbounded loop.
    expect(parseMock).toHaveBeenCalledTimes(2);
  });

  it("succeeds without retrying when the first response parses cleanly", async () => {
    const explanation = {
      headline: "Test",
      likely_cause: "Test",
      business_impact: "Test",
      recommended_action: "Test",
      confidence: "high" as const,
    };
    parseMock.mockResolvedValue({ choices: [{ message: { parsed: explanation } }] });

    const { requestExplanation } = await import("../client");
    const result = await requestExplanation("system", "user");

    expect(result).toEqual(explanation);
    expect(parseMock).toHaveBeenCalledTimes(1);
  });

  it("throws immediately when no API key is configured, before any network call", async () => {
    delete process.env.OPENAI_API_KEY;
    const { requestExplanation } = await import("../client");
    await expect(requestExplanation("system", "user")).rejects.toThrow(
      /OPENAI_API_KEY/
    );
    expect(parseMock).not.toHaveBeenCalled();
  });
});
