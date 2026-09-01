import type {
  Discrepancy,
  DiscrepancyType,
  NormalizedPayment,
  OrderGroup,
  ReconConfig,
  Severity,
} from "./types";

const SEVERITY_BY_TYPE: Record<DiscrepancyType, Severity> = {
  MISSING_PAYMENT: "critical",
  ORPHAN_PAYMENT: "critical",
  DUPLICATE_CHARGE: "critical",
  CANCELLED_BUT_CHARGED: "critical",
  CURRENCY_MISMATCH: "critical",
  AMOUNT_MISMATCH: "high",
  UNSETTLED_PAYMENT: "high",
  PARTIAL_REFUND_GAP: "high",
  REFUND_STATUS_MISMATCH: "medium",
  LATE_SETTLEMENT: "low",
  DATA_QUALITY: "low",
  DUPLICATE_ORDER_ROW: "low",
};

function makeDiscrepancy(
  type: DiscrepancyType,
  group: OrderGroup,
  fields: Pick<
    Discrepancy,
    | "transactionRefs"
    | "expectedCents"
    | "actualCents"
    | "impactCents"
    | "currency"
    | "details"
  >
): Discrepancy {
  return {
    type,
    severity: SEVERITY_BY_TYPE[type],
    orderKey: group.key,
    orderId: group.order?.orderId ?? null,
    ...fields,
  };
}

/**
 * Evaluates the 11 group-scoped rules (everything except
 * DUPLICATE_ORDER_ROW, which is derived from the dedupe step in engine.ts,
 * not from a single group). Rules run in RECON_PLAN's exact order; the one
 * ordering constraint that matters structurally is CURRENCY_MISMATCH (5)
 * before AMOUNT_MISMATCH (6) — ORD-1601/1602 have numerically equal
 * amounts across different currencies, so an amount-only check would pass
 * them as matched. Currency short-circuits amount by construction below:
 * the single-settled-charge branch checks currency before amount and
 * returns early on a mismatch.
 */
export function evaluateGroup(
  group: OrderGroup,
  config: ReconConfig
): Discrepancy[] {
  const discrepancies: Discrepancy[] = [];
  const { order, charges, refunds } = group;

  const settledCharges = charges.filter((c) => c.status === "settled");
  const nonSettledCharges = charges.filter((c) => c.status !== "settled");
  const settledRefunds = refunds.filter((r) => r.status === "settled");

  // Rule 2: ORPHAN_PAYMENT — a payment key with no matching order at all.
  if (!order) {
    const allPayments = [...charges, ...refunds];
    discrepancies.push(
      makeDiscrepancy("ORPHAN_PAYMENT", group, {
        transactionRefs: allPayments.map((p) => p.transactionRef),
        expectedCents: null,
        actualCents: sumCents(allPayments),
        impactCents: sumCents(allPayments),
        currency: allPayments[0]?.currency ?? null,
        details: { paymentCount: allPayments.length },
      })
    );
    // An orphan payment has no order fields to inspect for rule 11, but its
    // own timestamp can still be missing.
    discrepancies.push(...dataQualityForPayments(group, [...charges, ...refunds]));
    return discrepancies;
  }

  // Rules 1, 3, 4, 5, 6, 7: mutually exclusive by settled-charge count.
  if (settledCharges.length === 0 && charges.length === 0) {
    // Rule 1: MISSING_PAYMENT. A cancelled order legitimately has no
    // charge, so this only fires for orders that were expected to be paid.
    if (order.status === "completed") {
      discrepancies.push(
        makeDiscrepancy("MISSING_PAYMENT", group, {
          transactionRefs: [],
          expectedCents: order.netCents,
          actualCents: 0,
          impactCents: order.netCents,
          currency: order.currency,
          details: {},
        })
      );
    }
  } else if (settledCharges.length === 0 && charges.length > 0) {
    // Rule 7: UNSETTLED_PAYMENT — a charge exists but never settled.
    if (order.status === "completed") {
      discrepancies.push(
        makeDiscrepancy("UNSETTLED_PAYMENT", group, {
          transactionRefs: nonSettledCharges.map((c) => c.transactionRef),
          expectedCents: order.netCents,
          actualCents: 0,
          impactCents: order.netCents,
          currency: order.currency,
          details: {
            statuses: nonSettledCharges.map((c) => c.status),
          },
        })
      );
    }
  } else if (settledCharges.length >= 2) {
    // Rule 3: DUPLICATE_CHARGE — impact is the sum of settled charges beyond
    // the single largest one (assumed legitimate).
    const total = sumCents(settledCharges);
    const largest = Math.max(...settledCharges.map((c) => c.amountCents));
    discrepancies.push(
      makeDiscrepancy("DUPLICATE_CHARGE", group, {
        transactionRefs: settledCharges.map((c) => c.transactionRef),
        expectedCents: largest,
        actualCents: total,
        impactCents: total - largest,
        currency: settledCharges[0].currency,
        details: { chargeCount: settledCharges.length },
      })
    );
  } else {
    // Exactly one settled charge: cancelled / currency / amount checks.
    const charge = settledCharges[0];

    if (order.status === "cancelled") {
      // Rule 4: CANCELLED_BUT_CHARGED.
      discrepancies.push(
        makeDiscrepancy("CANCELLED_BUT_CHARGED", group, {
          transactionRefs: [charge.transactionRef],
          expectedCents: 0,
          actualCents: charge.amountCents,
          impactCents: charge.amountCents,
          currency: charge.currency,
          details: {},
        })
      );
    } else if (charge.currency !== order.currency) {
      // Rule 5: CURRENCY_MISMATCH. Short-circuits rule 6 — comparing 210
      // USD to 210 EUR is meaningless, so amount is not evaluated below.
      discrepancies.push(
        makeDiscrepancy("CURRENCY_MISMATCH", group, {
          transactionRefs: [charge.transactionRef],
          expectedCents: order.netCents,
          actualCents: charge.amountCents,
          impactCents: order.netCents,
          currency: null,
          details: {
            orderCurrency: order.currency,
            paymentCurrency: charge.currency,
          },
        })
      );
    } else if (order.status === "completed") {
      // Rule 6: AMOUNT_MISMATCH.
      const delta = charge.amountCents - order.netCents;
      const tolerance = config.amountToleranceCents(order.netCents);
      if (Math.abs(delta) > tolerance) {
        discrepancies.push(
          makeDiscrepancy("AMOUNT_MISMATCH", group, {
            transactionRefs: [charge.transactionRef],
            expectedCents: order.netCents,
            actualCents: charge.amountCents,
            impactCents: delta,
            currency: order.currency,
            details: { toleranceCents: tolerance },
          })
        );
      }
    }
  }

  // Rule 8: PARTIAL_REFUND_GAP — independent of the branch above, since it
  // is keyed on order.status === "refunded" rather than settled-charge
  // count.
  if (order.status === "refunded") {
    const chargedTotal = sumCents(settledCharges);
    const refundedTotal = sumCents(settledRefunds);
    const remainder = chargedTotal - refundedTotal;
    const tolerance = config.amountToleranceCents(order.netCents);
    if (remainder > tolerance) {
      discrepancies.push(
        makeDiscrepancy("PARTIAL_REFUND_GAP", group, {
          transactionRefs: [...settledCharges, ...settledRefunds].map(
            (p) => p.transactionRef
          ),
          expectedCents: 0,
          actualCents: remainder,
          impactCents: remainder,
          currency: order.currency,
          details: { chargedTotal, refundedTotal },
        })
      );
    }
  }

  // Rule 9: REFUND_STATUS_MISMATCH — a refund landed but the order still
  // reads "completed" instead of "refunded".
  if (order.status === "completed" && settledRefunds.length > 0) {
    discrepancies.push(
      makeDiscrepancy("REFUND_STATUS_MISMATCH", group, {
        transactionRefs: settledRefunds.map((r) => r.transactionRef),
        expectedCents: null,
        actualCents: sumCents(settledRefunds),
        impactCents: sumCents(settledRefunds),
        currency: order.currency,
        details: {},
      })
    );
  }

  // Rule 10: LATE_SETTLEMENT — charges only; refunds settling days after an
  // order is normal and is deliberately excluded.
  const lagMs = config.settlementLagHours * 60 * 60 * 1000;
  const lateCharges = settledCharges.filter(
    (c) => c.processedAt && c.processedAt.getTime() - order.orderDate.getTime() > lagMs
  );
  if (lateCharges.length > 0) {
    discrepancies.push(
      makeDiscrepancy("LATE_SETTLEMENT", group, {
        transactionRefs: lateCharges.map((c) => c.transactionRef),
        expectedCents: null,
        actualCents: null,
        impactCents: 0,
        currency: null,
        details: {
          lagHours: lateCharges.map((c) =>
            Math.round(
              (c.processedAt!.getTime() - order.orderDate.getTime()) / 3_600_000
            )
          ),
        },
      })
    );
  }

  // Rule 11: DATA_QUALITY — null email/discount on the order, or null
  // processed_at on any of its payments.
  const missingOrderFields: string[] = [];
  if (order.customerEmail === null) missingOrderFields.push("customer_email");
  if (order.discountCents === null) missingOrderFields.push("discount");
  const dq = dataQualityForPayments(group, [...charges, ...refunds]);
  if (missingOrderFields.length > 0 || dq.length > 0) {
    const missingPaymentFields = dq.length > 0 ? ["processed_at"] : [];
    discrepancies.push(
      makeDiscrepancy("DATA_QUALITY", group, {
        transactionRefs: [...charges, ...refunds]
          .filter((p) => p.processedAt === null)
          .map((p) => p.transactionRef),
        expectedCents: null,
        actualCents: null,
        impactCents: 0,
        currency: null,
        details: {
          missingFields: [...missingOrderFields, ...missingPaymentFields],
        },
      })
    );
  }

  return discrepancies;
}

function dataQualityForPayments(
  group: OrderGroup,
  payments: NormalizedPayment[]
): Discrepancy[] {
  const missing = payments.filter((p) => p.processedAt === null);
  if (missing.length === 0) return [];
  return [
    makeDiscrepancy("DATA_QUALITY", group, {
      transactionRefs: missing.map((p) => p.transactionRef),
      expectedCents: null,
      actualCents: null,
      impactCents: 0,
      currency: null,
      details: { missingFields: ["processed_at"] },
    }),
  ];
}

function sumCents(payments: NormalizedPayment[]): number {
  return payments.reduce((sum, p) => sum + p.amountCents, 0);
}
