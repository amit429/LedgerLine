import type { NormalizedOrder, NormalizedPayment } from "../types";

let orderCounter = 0;
let paymentCounter = 0;

export function buildOrder(overrides: Partial<NormalizedOrder> = {}): NormalizedOrder {
  orderCounter += 1;
  const orderId = overrides.orderId ?? `ORD-${1000 + orderCounter}`;
  const orderKey = overrides.orderKey ?? orderId.trim().toUpperCase();
  return {
    orderId,
    orderKey,
    orderDate: overrides.orderDate ?? new Date("2025-04-01T00:00:00.000Z"),
    customerEmail:
      "customerEmail" in overrides ? overrides.customerEmail! : "test@example.com",
    currency: overrides.currency ?? "USD",
    grossCents: overrides.grossCents ?? 10000,
    discountCents: "discountCents" in overrides ? overrides.discountCents! : 0,
    netCents: overrides.netCents ?? 10000,
    status: overrides.status ?? "completed",
    raw: overrides.raw ?? {
      order_id: orderId,
      order_date: "2025-04-01 00:00:00",
      customer_email: "test@example.com",
      currency: "USD",
      gross_amount: "100.00",
      discount: "0",
      net_amount: "100.00",
      status: "completed",
    },
  };
}

export function buildPayment(
  overrides: Partial<NormalizedPayment> = {}
): NormalizedPayment {
  paymentCounter += 1;
  const transactionRef = overrides.transactionRef ?? `TXN${700000 + paymentCounter}`;
  const orderReference = overrides.orderReference ?? "ORD-1000";
  const orderKey = overrides.orderKey ?? orderReference.trim().toUpperCase();
  return {
    transactionRef,
    processedAt:
      "processedAt" in overrides
        ? overrides.processedAt!
        : new Date("2025-04-01T00:30:00.000Z"),
    orderReference,
    orderKey,
    currency: overrides.currency ?? "USD",
    amountCents: overrides.amountCents ?? 10000,
    feeCents: overrides.feeCents ?? 300,
    netSettledCents: overrides.netSettledCents ?? 9700,
    type: overrides.type ?? "charge",
    status: overrides.status ?? "settled",
    raw: overrides.raw ?? {
      transaction_ref: transactionRef,
      processed_at: "01/04/2025 00:30",
      order_reference: orderReference,
      currency: "USD",
      amount: "100.00",
      fee: "3.00",
      net_settled: "97.00",
      type: "charge",
      status: "settled",
    },
  };
}
