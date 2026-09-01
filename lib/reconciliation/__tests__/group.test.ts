import { describe, expect, it } from "vitest";
import { dedupeOrders, groupByKey } from "../group";
import { buildOrder, buildPayment } from "./test-helpers";

describe("dedupeOrders", () => {
  it("drops a byte-identical duplicate row and records its key", () => {
    const order = buildOrder({ orderId: "ORD-1004", netCents: 2734 });
    const duplicate = buildOrder({
      orderId: "ORD-1004",
      orderDate: order.orderDate,
      netCents: 2734,
    });

    const { orders, duplicateOrderKeys } = dedupeOrders([order, duplicate]);

    expect(orders).toHaveLength(1);
    expect(duplicateOrderKeys.has("ORD-1004")).toBe(true);
  });

  it("does not treat two different orders with the same id-shape as duplicates", () => {
    const a = buildOrder({ orderId: "ORD-2000", netCents: 1000 });
    const b = buildOrder({ orderId: "ORD-2001", netCents: 1000 });

    const { orders, duplicateOrderKeys } = dedupeOrders([a, b]);

    expect(orders).toHaveLength(2);
    expect(duplicateOrderKeys.size).toBe(0);
  });
});

describe("groupByKey", () => {
  it("normalizes a lowercase, trailing-space payment reference onto the right order", () => {
    const order = buildOrder({ orderId: "ORD-1801" });
    const payment = buildPayment({ orderReference: "ord-1801 " });

    const groups = groupByKey([order], [payment]);

    expect(groups.size).toBe(1);
    const group = groups.get("ORD-1801");
    expect(group?.order).toBe(order);
    expect(group?.charges).toHaveLength(1);
  });

  it("creates an order-less group for a payment with no matching order", () => {
    const payment = buildPayment({ orderReference: "ORD-1301" });

    const groups = groupByKey([], [payment]);

    const group = groups.get("ORD-1301");
    expect(group?.order).toBeNull();
    expect(group?.charges).toHaveLength(1);
  });

  it("splits charges and refunds so refunds never land in the charges list", () => {
    const order = buildOrder({ orderId: "ORD-1702", netCents: 24000 });
    const charge = buildPayment({ orderReference: "ORD-1702", type: "charge" });
    const refund = buildPayment({ orderReference: "ORD-1702", type: "refund" });

    const groups = groupByKey([order], [charge, refund]);

    const group = groups.get("ORD-1702")!;
    expect(group.charges).toEqual([charge]);
    expect(group.refunds).toEqual([refund]);
  });

  it("creates a group with zero payments for an order with none", () => {
    const order = buildOrder({ orderId: "ORD-1201" });

    const groups = groupByKey([order], []);

    const group = groups.get("ORD-1201")!;
    expect(group.charges).toHaveLength(0);
    expect(group.refunds).toHaveLength(0);
  });
});
