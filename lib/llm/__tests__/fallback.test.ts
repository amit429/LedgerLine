import { describe, expect, it } from "vitest";
import { fallbackExplanation } from "../fallback";
import { ExplanationSchema } from "../schema";
import type { DiscrepancyType } from "../../reconciliation/types";

const ALL_TYPES: DiscrepancyType[] = [
  "MISSING_PAYMENT",
  "ORPHAN_PAYMENT",
  "DUPLICATE_CHARGE",
  "CANCELLED_BUT_CHARGED",
  "CURRENCY_MISMATCH",
  "AMOUNT_MISMATCH",
  "UNSETTLED_PAYMENT",
  "PARTIAL_REFUND_GAP",
  "REFUND_STATUS_MISMATCH",
  "LATE_SETTLEMENT",
  "DATA_QUALITY",
  "DUPLICATE_ORDER_ROW",
];

describe("fallbackExplanation", () => {
  it("produces schema-valid output for every discrepancy type with no network call", () => {
    for (const type of ALL_TYPES) {
      const result = fallbackExplanation({
        type,
        order_key: "ORD-1601",
        order_id: "ORD-1601",
        impact_cents: 21000,
      });
      expect(ExplanationSchema.safeParse(result).success).toBe(true);
    }
  });

  it("labels itself low-confidence, since it's a template, not a real read", () => {
    const result = fallbackExplanation({
      type: "MISSING_PAYMENT",
      order_key: "ORD-1201",
      order_id: "ORD-1201",
      impact_cents: 9487,
    });
    expect(result.confidence).toBe("low");
  });

  it("states there is no dollar impact for zero-impact (informational) discrepancies", () => {
    const result = fallbackExplanation({
      type: "DATA_QUALITY",
      order_key: "ORD-2201",
      order_id: "ORD-2201",
      impact_cents: 0,
    });
    expect(result.business_impact).toMatch(/no direct dollar impact/i);
  });

  it("falls back to the order_key when order_id is null (orphan payments)", () => {
    const result = fallbackExplanation({
      type: "ORPHAN_PAYMENT",
      order_key: "ORD-1301",
      order_id: null,
      impact_cents: 7951,
    });
    expect(result.headline).toContain("ORD-1301");
  });
});
