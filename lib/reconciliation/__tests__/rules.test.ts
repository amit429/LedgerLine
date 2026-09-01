import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../config";
import { evaluateGroup } from "../rules";
import type { OrderGroup } from "../types";
import { buildOrder, buildPayment } from "./test-helpers";

function group(overrides: Partial<OrderGroup> & { key: string }): OrderGroup {
  return { order: null, charges: [], refunds: [], ...overrides };
}

describe("MISSING_PAYMENT", () => {
  it("flags a completed order with zero charges", () => {
    const order = buildOrder({ orderId: "ORD-1201", status: "completed" });
    const [d] = evaluateGroup(group({ key: "ORD-1201", order }), DEFAULT_CONFIG);
    expect(d.type).toBe("MISSING_PAYMENT");
    expect(d.severity).toBe("critical");
    expect(d.impactCents).toBe(order.netCents);
  });

  it("does not flag a cancelled order with zero charges", () => {
    const order = buildOrder({ orderId: "ORD-9000", status: "cancelled" });
    const result = evaluateGroup(group({ key: "ORD-9000", order }), DEFAULT_CONFIG);
    expect(result).toHaveLength(0);
  });
});

describe("ORPHAN_PAYMENT", () => {
  it("flags a settled charge with no matching order", () => {
    const payment = buildPayment({ orderReference: "ORD-1301", amountCents: 7951 });
    const result = evaluateGroup(
      group({ key: "ORD-1301", order: null, charges: [payment] }),
      DEFAULT_CONFIG
    );
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("ORPHAN_PAYMENT");
    expect(result[0].severity).toBe("critical");
    expect(result[0].impactCents).toBe(7951);
  });
});

describe("DUPLICATE_CHARGE", () => {
  it("flags two settled charges on the same order, impact = sum minus the largest", () => {
    const order = buildOrder({ orderId: "ORD-1501", netCents: 11984 });
    const c1 = buildPayment({ orderReference: "ORD-1501", amountCents: 11984 });
    const c2 = buildPayment({ orderReference: "ORD-1501", amountCents: 11984 });
    const [d] = evaluateGroup(
      group({ key: "ORD-1501", order, charges: [c1, c2] }),
      DEFAULT_CONFIG
    );
    expect(d.type).toBe("DUPLICATE_CHARGE");
    expect(d.impactCents).toBe(11984);
  });
});

describe("CANCELLED_BUT_CHARGED", () => {
  it("flags a settled charge against a cancelled order", () => {
    const order = buildOrder({ orderId: "ORD-1701", status: "cancelled", netCents: 17500 });
    const charge = buildPayment({ orderReference: "ORD-1701", amountCents: 17500 });
    const [d] = evaluateGroup(
      group({ key: "ORD-1701", order, charges: [charge] }),
      DEFAULT_CONFIG
    );
    expect(d.type).toBe("CANCELLED_BUT_CHARGED");
    expect(d.impactCents).toBe(17500);
  });
});

describe("CURRENCY_MISMATCH", () => {
  it("flags equal amounts in different currencies and short-circuits AMOUNT_MISMATCH", () => {
    const order = buildOrder({ orderId: "ORD-1601", currency: "USD", netCents: 21000 });
    const charge = buildPayment({
      orderReference: "ORD-1601",
      currency: "EUR",
      amountCents: 21000,
    });
    const result = evaluateGroup(
      group({ key: "ORD-1601", order, charges: [charge] }),
      DEFAULT_CONFIG
    );
    // Exactly one discrepancy: currency mismatch, never an amount mismatch,
    // even though the numeric amounts are identical.
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("CURRENCY_MISMATCH");
    expect(result[0].impactCents).toBe(21000);
  });
});

describe("AMOUNT_MISMATCH", () => {
  it("flags a charge outside tolerance with a signed delta", () => {
    const order = buildOrder({ orderId: "ORD-1402", netCents: 12762 });
    const charge = buildPayment({ orderReference: "ORD-1402", amountCents: 10912 });
    const [d] = evaluateGroup(
      group({ key: "ORD-1402", order, charges: [charge] }),
      DEFAULT_CONFIG
    );
    expect(d.type).toBe("AMOUNT_MISMATCH");
    expect(d.impactCents).toBe(-1850);
  });

  it("does not flag a charge within tolerance (rounding noise)", () => {
    const order = buildOrder({ orderId: "ORD-1902", netCents: 6865 });
    const charge = buildPayment({ orderReference: "ORD-1902", amountCents: 6863 });
    const result = evaluateGroup(
      group({ key: "ORD-1902", order, charges: [charge] }),
      DEFAULT_CONFIG
    );
    expect(result).toHaveLength(0);
  });
});

describe("UNSETTLED_PAYMENT", () => {
  it("flags a completed order whose only charge failed", () => {
    const order = buildOrder({ orderId: "ORD-2001", netCents: 31000 });
    const charge = buildPayment({ orderReference: "ORD-2001", status: "failed" });
    const [d] = evaluateGroup(
      group({ key: "ORD-2001", order, charges: [charge] }),
      DEFAULT_CONFIG
    );
    expect(d.type).toBe("UNSETTLED_PAYMENT");
    expect(d.impactCents).toBe(31000);
  });

  it("flags a completed order whose only charge is pending", () => {
    const order = buildOrder({ orderId: "ORD-2002", netCents: 6700 });
    const charge = buildPayment({ orderReference: "ORD-2002", status: "pending" });
    const [d] = evaluateGroup(
      group({ key: "ORD-2002", order, charges: [charge] }),
      DEFAULT_CONFIG
    );
    expect(d.type).toBe("UNSETTLED_PAYMENT");
  });
});

describe("PARTIAL_REFUND_GAP", () => {
  it("flags a refunded order where the refund doesn't cover the full charge", () => {
    const order = buildOrder({ orderId: "ORD-1702", status: "refunded", netCents: 24000 });
    const charge = buildPayment({ orderReference: "ORD-1702", type: "charge", amountCents: 24000 });
    const refund = buildPayment({ orderReference: "ORD-1702", type: "refund", amountCents: 12000 });
    const [d] = evaluateGroup(
      group({ key: "ORD-1702", order, charges: [charge], refunds: [refund] }),
      DEFAULT_CONFIG
    );
    expect(d.type).toBe("PARTIAL_REFUND_GAP");
    expect(d.impactCents).toBe(12000);
  });
});

describe("REFUND_STATUS_MISMATCH", () => {
  it("flags a fully refunded order still marked completed", () => {
    const order = buildOrder({ orderId: "ORD-1703", status: "completed", netCents: 9900 });
    const charge = buildPayment({ orderReference: "ORD-1703", type: "charge", amountCents: 9900 });
    const refund = buildPayment({ orderReference: "ORD-1703", type: "refund", amountCents: 9900 });
    const result = evaluateGroup(
      group({ key: "ORD-1703", order, charges: [charge], refunds: [refund] }),
      DEFAULT_CONFIG
    );
    const refundMismatch = result.find((d) => d.type === "REFUND_STATUS_MISMATCH");
    expect(refundMismatch).toBeDefined();
    expect(refundMismatch?.impactCents).toBe(9900);
  });
});

describe("LATE_SETTLEMENT", () => {
  it("flags a charge settling more than 72 hours after the order", () => {
    const order = buildOrder({
      orderId: "ORD-2101",
      netCents: 19000,
      orderDate: new Date("2025-04-07T00:00:00.000Z"),
    });
    const charge = buildPayment({
      orderReference: "ORD-2101",
      amountCents: 19000,
      processedAt: new Date("2025-05-06T00:00:00.000Z"),
    });
    const result = evaluateGroup(
      group({ key: "ORD-2101", order, charges: [charge] }),
      DEFAULT_CONFIG
    );
    const late = result.find((d) => d.type === "LATE_SETTLEMENT");
    expect(late).toBeDefined();
    expect(late?.severity).toBe("low");
    expect(late?.impactCents).toBe(0);
  });

  it("does not flag a refund settling days after its order", () => {
    const order = buildOrder({
      orderId: "ORD-1702",
      status: "refunded",
      netCents: 24000,
      orderDate: new Date("2025-04-28T00:00:00.000Z"),
    });
    const charge = buildPayment({
      orderReference: "ORD-1702",
      type: "charge",
      amountCents: 24000,
      processedAt: new Date("2025-04-28T00:10:00.000Z"),
    });
    const refund = buildPayment({
      orderReference: "ORD-1702",
      type: "refund",
      amountCents: 24000,
      processedAt: new Date("2025-05-01T00:00:00.000Z"), // 3 days later
    });
    const result = evaluateGroup(
      group({ key: "ORD-1702", order, charges: [charge], refunds: [refund] }),
      DEFAULT_CONFIG
    );
    expect(result.some((d) => d.type === "LATE_SETTLEMENT")).toBe(false);
  });
});

describe("DATA_QUALITY", () => {
  it("flags a null customer_email and null discount as one discrepancy", () => {
    const order = buildOrder({
      orderId: "ORD-2201",
      customerEmail: null,
      discountCents: null,
    });
    const charge = buildPayment({ orderReference: "ORD-2201" });
    const [d] = evaluateGroup(
      group({ key: "ORD-2201", order, charges: [charge] }),
      DEFAULT_CONFIG
    );
    expect(d.type).toBe("DATA_QUALITY");
    expect(d.details.missingFields).toEqual(["customer_email", "discount"]);
  });

  it("flags a null processed_at on a payment", () => {
    const order = buildOrder({ orderId: "ORD-2202" });
    const charge = buildPayment({ orderReference: "ORD-2202", processedAt: null });
    const [d] = evaluateGroup(
      group({ key: "ORD-2202", order, charges: [charge] }),
      DEFAULT_CONFIG
    );
    expect(d.type).toBe("DATA_QUALITY");
    expect(d.details.missingFields).toEqual(["processed_at"]);
  });
});

describe("false-positive traps", () => {
  it("does not flag a matched order with no issues", () => {
    const order = buildOrder({ orderId: "ORD-1000", netCents: 10000 });
    const charge = buildPayment({ orderReference: "ORD-1000", amountCents: 10000 });
    const result = evaluateGroup(
      group({ key: "ORD-1000", order, charges: [charge] }),
      DEFAULT_CONFIG
    );
    expect(result).toHaveLength(0);
  });
});
