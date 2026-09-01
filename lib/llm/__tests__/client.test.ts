import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const generateContentMock = vi.fn();

vi.mock("@google/genai", () => ({
  GoogleGenAI: class MockGoogleGenAI {
    models = { generateContent: generateContentMock };
  },
}));

describe("requestExplanation", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
    generateContentMock.mockReset();
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  it("retries once on a malformed (non-JSON) response, then throws", async () => {
    // Simulates the model returning text that fails JSON.parse or the Zod
    // schema — response.text is a string, but not a valid Explanation.
    generateContentMock.mockResolvedValue({ text: "not json" });

    const { requestExplanation } = await import("../client");
    await expect(requestExplanation("system", "user")).rejects.toThrow();

    // One initial attempt + exactly one retry, not an unbounded loop.
    expect(generateContentMock).toHaveBeenCalledTimes(2);
  });

  it("retries once when the response has no text content, then throws", async () => {
    generateContentMock.mockResolvedValue({ text: undefined });

    const { requestExplanation } = await import("../client");
    await expect(requestExplanation("system", "user")).rejects.toThrow();
    expect(generateContentMock).toHaveBeenCalledTimes(2);
  });

  it("succeeds without retrying when the first response parses cleanly", async () => {
    const explanation = {
      headline: "Test",
      likely_cause: "Test",
      business_impact: "Test",
      recommended_action: "Test",
      confidence: "high" as const,
    };
    generateContentMock.mockResolvedValue({ text: JSON.stringify(explanation) });

    const { requestExplanation } = await import("../client");
    const result = await requestExplanation("system", "user");

    expect(result).toEqual(explanation);
    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });

  it("retries once when the response is valid JSON but fails schema validation", async () => {
    // Missing required fields / wrong enum value — valid JSON, invalid
    // Explanation. This is the case Gemini's responseJsonSchema can't
    // catch on its own (no maxLength support), so Zod is the real gate.
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({ headline: "Test", confidence: "extremely-high" }),
    });

    const { requestExplanation } = await import("../client");
    await expect(requestExplanation("system", "user")).rejects.toThrow();
    expect(generateContentMock).toHaveBeenCalledTimes(2);
  });

  it("throws immediately when no API key is configured, before any network call", async () => {
    delete process.env.GEMINI_API_KEY;
    const { requestExplanation } = await import("../client");
    await expect(requestExplanation("system", "user")).rejects.toThrow(
      /GEMINI_API_KEY/
    );
    expect(generateContentMock).not.toHaveBeenCalled();
  });
});
