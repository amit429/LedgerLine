import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseOrdersCsv, parsePaymentsCsv } from "../../csv/parse";
import { DEFAULT_CONFIG } from "../config";
import { reconcile } from "../engine";
import { MONEY_AFFECTING_TYPES } from "../types";

const FIXTURES_DIR = join(__dirname, "..", "..", "..", "fixtures");

function loadResult() {
  const ordersCsv = readFileSync(join(FIXTURES_DIR, "orders.csv"), "utf-8");
  const paymentsCsv = readFileSync(join(FIXTURES_DIR, "payments.csv"), "utf-8");

  const { rows: orderRows, errors: orderErrors } = parseOrdersCsv(ordersCsv);
  const { rows: paymentRows, errors: paymentErrors } = parsePaymentsCsv(paymentsCsv);

  expect(orderErrors).toEqual([]);
  expect(paymentErrors).toEqual([]);

  return reconcile(orderRows, paymentRows, DEFAULT_CONFIG);
}

describe("reconcile() against the real dataset", () => {
  it("dedupes ORD-1004 down to 184 unique orders and keeps 187 payments", () => {
    const result = loadResult();
    expect(result.orders).toHaveLength(184);
    expect(result.payments).toHaveLength(187);
    expect(result.summary.totalOrders).toBe(184);
    expect(result.summary.totalPayments).toBe(187);
  });

  it("computes total order value excluding the cancelled order and the deduped row", () => {
    const result = loadResult();
    // Independently verified against the raw CSV: unique, non-cancelled
    // orders sum to exactly $42,094.65. (Summing all 185 raw rows without
    // deduping — as the static UI mockup illustratively does — instead
    // double-counts ORD-1004 and yields $42,296.99, which is the exact
    // pitfall RECON_PLAN warns against.)
    expect(result.summary.totalOrderValueCents).toBe(4_209_465);
  });

  it("counts 16 disputed orders and 164 cleanly reconciled orders", () => {
    const result = loadResult();
    // 184 total - 16 disputed (money-affecting) - 4 informational-only
    // (ORD-1004 dup, ORD-2101 late settlement, ORD-2201/2202 data quality)
    // = 164 clean.
    expect(result.summary.disputedOrderCount).toBe(16);
    expect(result.summary.reconciledOrderCount).toBe(164);
  });

  it("finds exactly the 19 seeded money-affecting discrepancies", () => {
    const result = loadResult();
    const moneyAffecting = result.discrepancies.filter((d) =>
      (MONEY_AFFECTING_TYPES as readonly string[]).includes(d.type)
    );
    expect(moneyAffecting).toHaveLength(19);
  });

  it("matches the exact count per money-affecting discrepancy class", () => {
    const result = loadResult();
    const counts = Object.fromEntries(
      Object.entries(result.summary.byType).map(([type, v]) => [type, v.count])
    );
    expect(counts).toMatchObject({
      MISSING_PAYMENT: 4,
      ORPHAN_PAYMENT: 3,
      DUPLICATE_CHARGE: 2,
      CANCELLED_BUT_CHARGED: 1,
      CURRENCY_MISMATCH: 2,
      AMOUNT_MISMATCH: 3,
      UNSETTLED_PAYMENT: 2,
      PARTIAL_REFUND_GAP: 1,
      REFUND_STATUS_MISMATCH: 1,
      LATE_SETTLEMENT: 1,
      DATA_QUALITY: 2,
      DUPLICATE_ORDER_ROW: 1,
    });
  });

  it("produces zero false positives on the reference-formatting trap (ORD-1801/1802)", () => {
    const result = loadResult();
    const flagged = result.discrepancies.filter((d) =>
      ["ORD-1801", "ORD-1802"].includes(d.orderKey)
    );
    expect(flagged).toHaveLength(0);
  });

  it("produces zero false positives on the rounding-noise trap (ORD-1901/1902/1903)", () => {
    const result = loadResult();
    const flagged = result.discrepancies.filter((d) =>
      ["ORD-1901", "ORD-1902", "ORD-1903"].includes(d.orderKey)
    );
    expect(flagged).toHaveLength(0);
  });

  it("computes value in dispute as the sum of net_amount for orders with a money-affecting discrepancy", () => {
    const result = loadResult();
    // Independently verified: 39235 + 41944 + 24858 + 35500 + 17500 +
    // 24000 + 9900 + 37700 = 230637 ($2,306.37).
    expect(result.summary.valueInDisputeCents).toBe(230_637);
  });

  it("computes money at risk as the sum of |impact| over critical+high severity only", () => {
    const result = loadResult();
    // Independently verified: critical (147893) + high (60050) = 207943
    // ($2,079.43). Excludes the medium-severity REFUND_STATUS_MISMATCH
    // ($99.00) by design.
    expect(result.summary.moneyAtRiskCents).toBe(207_943);
  });

  it("flags currency mismatch, not amount mismatch, for ORD-1601/1602", () => {
    const result = loadResult();
    const types1601 = result.discrepancies
      .filter((d) => d.orderKey === "ORD-1601")
      .map((d) => d.type);
    const types1602 = result.discrepancies
      .filter((d) => d.orderKey === "ORD-1602")
      .map((d) => d.type);
    expect(types1601).toEqual(["CURRENCY_MISMATCH"]);
    expect(types1602).toEqual(["CURRENCY_MISMATCH"]);
  });
});
