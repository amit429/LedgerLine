import type { NormalizedOrder, NormalizedPayment, OrderGroup } from "./types";

export interface DedupeResult {
  orders: NormalizedOrder[];
  /** One entry per order that had at least one duplicate row removed. */
  duplicateOrderKeys: Set<string>;
}

/**
 * Drops byte-identical order rows (e.g. ORD-1004 appearing twice) before any
 * matching happens, so they can't double-count in headline totals or trip a
 * unique constraint on insert. Mirrors the DB's
 * UNIQUE(batch_id, order_id, order_date, net_cents) constraint minus the
 * batch scope. The removed rows are tracked so rules.ts can still surface a
 * DUPLICATE_ORDER_ROW flag — deduping and flagging are separate concerns.
 */
export function dedupeOrders(orders: NormalizedOrder[]): DedupeResult {
  const seen = new Set<string>();
  const duplicateOrderKeys = new Set<string>();
  const deduped: NormalizedOrder[] = [];

  for (const order of orders) {
    const dedupeKey = `${order.orderKey}|${order.orderDate.toISOString()}|${order.netCents}`;
    if (seen.has(dedupeKey)) {
      duplicateOrderKeys.add(order.orderKey);
      continue;
    }
    seen.add(dedupeKey);
    deduped.push(order);
  }

  return { orders: deduped, duplicateOrderKeys };
}

/**
 * Builds one group per join key. Orders always get a group even with zero
 * payments (feeds MISSING_PAYMENT); payments referencing a key with no order
 * still get a group with order=null (feeds ORPHAN_PAYMENT). Payments are
 * split by type up front so refunds are never accidentally compared against
 * net_amount as if they were failed charges.
 */
export function groupByKey(
  orders: NormalizedOrder[],
  payments: NormalizedPayment[]
): Map<string, OrderGroup> {
  const groups = new Map<string, OrderGroup>();

  for (const order of orders) {
    groups.set(order.orderKey, {
      key: order.orderKey,
      order,
      charges: [],
      refunds: [],
    });
  }

  for (const payment of payments) {
    let group = groups.get(payment.orderKey);
    if (!group) {
      group = { key: payment.orderKey, order: null, charges: [], refunds: [] };
      groups.set(payment.orderKey, group);
    }
    if (payment.type === "charge") {
      group.charges.push(payment);
    } else {
      group.refunds.push(payment);
    }
  }

  return groups;
}
