import { dedupeOrders, groupByKey } from "./group";
import { normalizeOrder, normalizePayment } from "./normalize";
import { evaluateGroup } from "./rules";
import type {
  Discrepancy,
  DiscrepancyType,
  NormalizedOrder,
  NormalizedPayment,
  OrderGroup,
  RawOrderRow,
  RawPaymentRow,
  ReconConfig,
  ReconResult,
  ReconSummary,
} from "./types";
import { INFORMATIONAL_TYPES, MONEY_AFFECTING_TYPES } from "./types";

// Derived, not hand-maintained — types.ts's two lists are the single
// source of truth for which discrepancy types exist at all.
const ALL_TYPES: DiscrepancyType[] = [...MONEY_AFFECTING_TYPES, ...INFORMATIONAL_TYPES];
const MONEY_AFFECTING_SET = new Set<DiscrepancyType>(MONEY_AFFECTING_TYPES);

/**
 * The whole engine is a pure function: no I/O, no clock reads, no
 * randomness, no LLM. Same input always produces the same output, which is
 * what makes a reconciliation run reproducible when its config is persisted
 * alongside it.
 */
export function reconcile(
  orderRows: RawOrderRow[],
  paymentRows: RawPaymentRow[],
  config: ReconConfig
): ReconResult {
  const normalizedOrders = orderRows.map(normalizeOrder);
  const normalizedPayments = paymentRows.map(normalizePayment);

  const { orders, duplicateOrderKeys } = dedupeOrders(normalizedOrders);
  const groups = groupByKey(orders, normalizedPayments);

  const discrepancies: Discrepancy[] = [];
  for (const group of groups.values()) {
    discrepancies.push(...evaluateGroup(group, config));
  }
  discrepancies.push(
    ...duplicateOrderRowDiscrepancies(duplicateOrderKeys, groups)
  );

  const summary = computeSummary(orders, normalizedPayments, discrepancies);

  return { discrepancies, orders, payments: normalizedPayments, summary };
}

/**
 * Exported separately (not just used internally) because a duplicate row
 * can only ever be detected once, at ingest time — the DB's unique
 * constraint means the removed copy is never persisted, so reconcile() re-
 * running against stored rows can't rediscover it on its own. The API
 * route that persists ingest-time findings reuses this same builder to
 * inject the discrepancy reconcile() itself can no longer produce.
 */
export function buildDuplicateOrderRowDiscrepancy(
  orderKey: string,
  orderId: string | null
): Discrepancy {
  return {
    type: "DUPLICATE_ORDER_ROW",
    severity: "low",
    orderKey,
    orderId,
    transactionRefs: [],
    expectedCents: null,
    actualCents: null,
    impactCents: 0,
    currency: null,
    details: {},
  };
}

function duplicateOrderRowDiscrepancies(
  duplicateOrderKeys: Set<string>,
  groups: Map<string, OrderGroup>
): Discrepancy[] {
  const result: Discrepancy[] = [];
  for (const key of duplicateOrderKeys) {
    const group = groups.get(key);
    result.push(buildDuplicateOrderRowDiscrepancy(key, group?.order?.orderId ?? null));
  }
  return result;
}

/**
 * Headline money definitions (RECON_PLAN §3):
 *
 *   Total order value      = Σ net_amount over unique, non-cancelled orders
 *   Total payments settled = Σ amount where type=charge AND status=settled
 *   Value reconciled       = Σ net_amount of orders with exactly one clean matched charge
 *   Value in dispute       = Σ net_amount of orders carrying ≥1 discrepancy
 *   Money at risk           = Σ |impact| over critical + high severity only
 *
 * Two scoping calls made explicit here, both defensible and both restated
 * in the README:
 *
 * 1. "Carrying a discrepancy" for value-in-dispute is scoped to the 9
 *    money-affecting rule types, not the 3 informational ones (late
 *    settlement / data quality / duplicate row). Those flag something worth
 *    a human's attention but represent no money actually at stake, and the
 *    dataset's own framing ("~19 true discrepancies" vs. "3 informational
 *    flags") treats them as a separate bucket.
 * 2. "Exactly one clean matched charge" for value-reconciled requires zero
 *    discrepancies of *any* kind (including informational) — an order with
 *    a late-settlement flag isn't "clean" even though it's not a financial
 *    dispute.
 */
/**
 * Exported so callers that inject discrepancies reconcile() couldn't have
 * produced itself (e.g. the API route re-attaching a DUPLICATE_ORDER_ROW
 * flag from ingest-time findings) can recompute a summary that accounts
 * for them — an order gaining even an informational discrepancy after the
 * fact should no longer count as "clean" in valueReconciledCents.
 */
export function computeSummary(
  orders: NormalizedOrder[],
  payments: NormalizedPayment[],
  discrepancies: Discrepancy[]
): ReconSummary {
  const discrepanciesByOrderKey = new Map<string, Discrepancy[]>();
  for (const d of discrepancies) {
    const list = discrepanciesByOrderKey.get(d.orderKey) ?? [];
    list.push(d);
    discrepanciesByOrderKey.set(d.orderKey, list);
  }

  const totalOrderValueCents = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + o.netCents, 0);

  const totalPaymentsSettledCents = payments
    .filter((p) => p.type === "charge" && p.status === "settled")
    .reduce((sum, p) => sum + p.amountCents, 0);

  let valueReconciledCents = 0;
  let valueInDisputeCents = 0;
  let reconciledOrderCount = 0;
  let disputedOrderCount = 0;

  for (const order of orders) {
    const orderDiscrepancies = discrepanciesByOrderKey.get(order.orderKey) ?? [];
    const hasMoneyAffecting = orderDiscrepancies.some((d) =>
      MONEY_AFFECTING_SET.has(d.type)
    );
    if (hasMoneyAffecting) {
      valueInDisputeCents += order.netCents;
      disputedOrderCount += 1;
      continue;
    }

    if (
      orderDiscrepancies.length === 0 &&
      order.status === "completed"
    ) {
      valueReconciledCents += order.netCents;
      reconciledOrderCount += 1;
    }
  }

  const moneyAtRiskCents = discrepancies
    .filter((d) => d.severity === "critical" || d.severity === "high")
    .reduce((sum, d) => sum + Math.abs(d.impactCents), 0);

  const bySeverity: ReconSummary["bySeverity"] = {
    critical: { count: 0, impactCents: 0 },
    high: { count: 0, impactCents: 0 },
    medium: { count: 0, impactCents: 0 },
    low: { count: 0, impactCents: 0 },
  };
  const byType = Object.fromEntries(
    ALL_TYPES.map((t) => [t, { count: 0, impactCents: 0 }])
  ) as ReconSummary["byType"];

  for (const d of discrepancies) {
    bySeverity[d.severity].count += 1;
    bySeverity[d.severity].impactCents += Math.abs(d.impactCents);
    byType[d.type].count += 1;
    byType[d.type].impactCents += Math.abs(d.impactCents);
  }

  return {
    totalOrders: orders.length,
    totalPayments: payments.length,
    totalOrderValueCents,
    totalPaymentsSettledCents,
    valueReconciledCents,
    valueInDisputeCents,
    moneyAtRiskCents,
    reconciledOrderCount,
    disputedOrderCount,
    bySeverity,
    byType,
  };
}
