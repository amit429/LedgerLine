import type {
  Discrepancy,
  NormalizedOrder,
  NormalizedPayment,
} from "../reconciliation/types";

/**
 * DB row shapes for insert. `raw` carries the untouched parsed CSV row as
 * jsonb — that's what lets Phase 5's reconcile endpoint feed the exact same
 * pure `reconcile()` function used in lib/reconciliation without a second
 * normalization code path: it just reads `raw` back out and re-normalizes.
 */
export interface OrderInsertRow {
  batch_id: string;
  user_id: string;
  order_id: string;
  order_key: string;
  order_date: string;
  customer_email: string | null;
  currency: string;
  gross_cents: number;
  discount_cents: number | null;
  net_cents: number;
  status: string;
  raw: NormalizedOrder["raw"];
}

export interface PaymentInsertRow {
  batch_id: string;
  user_id: string;
  transaction_ref: string;
  processed_at: string | null;
  order_reference: string;
  order_key: string;
  currency: string;
  amount_cents: number;
  fee_cents: number;
  net_settled_cents: number;
  type: string;
  status: string;
  raw: NormalizedPayment["raw"];
}

export function orderToInsertRow(
  order: NormalizedOrder,
  batchId: string,
  userId: string
): OrderInsertRow {
  return {
    batch_id: batchId,
    user_id: userId,
    order_id: order.orderId,
    order_key: order.orderKey,
    order_date: order.orderDate.toISOString(),
    customer_email: order.customerEmail,
    currency: order.currency,
    gross_cents: order.grossCents,
    discount_cents: order.discountCents,
    net_cents: order.netCents,
    status: order.status,
    raw: order.raw,
  };
}

export function paymentToInsertRow(
  payment: NormalizedPayment,
  batchId: string,
  userId: string
): PaymentInsertRow {
  return {
    batch_id: batchId,
    user_id: userId,
    transaction_ref: payment.transactionRef,
    processed_at: payment.processedAt?.toISOString() ?? null,
    order_reference: payment.orderReference,
    order_key: payment.orderKey,
    currency: payment.currency,
    amount_cents: payment.amountCents,
    fee_cents: payment.feeCents,
    net_settled_cents: payment.netSettledCents,
    type: payment.type,
    status: payment.status,
    raw: payment.raw,
  };
}

export interface DiscrepancyInsertRow {
  run_id: string;
  user_id: string;
  type: Discrepancy["type"];
  severity: Discrepancy["severity"];
  order_key: string;
  order_id: string | null;
  transaction_refs: string[];
  expected_cents: number | null;
  actual_cents: number | null;
  impact_cents: number;
  currency: string | null;
  details: Discrepancy["details"];
}

export function discrepancyToInsertRow(
  discrepancy: Discrepancy,
  runId: string,
  userId: string
): DiscrepancyInsertRow {
  return {
    run_id: runId,
    user_id: userId,
    type: discrepancy.type,
    severity: discrepancy.severity,
    order_key: discrepancy.orderKey,
    order_id: discrepancy.orderId,
    transaction_refs: discrepancy.transactionRefs,
    expected_cents: discrepancy.expectedCents,
    actual_cents: discrepancy.actualCents,
    impact_cents: discrepancy.impactCents,
    currency: discrepancy.currency,
    details: discrepancy.details,
  };
}
