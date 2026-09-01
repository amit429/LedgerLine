import { z } from "zod";

const emptyToNull = (val: unknown) =>
  typeof val === "string" && val.trim() === "" ? null : val;

export const ORDER_CSV_COLUMNS = [
  "order_id",
  "order_date",
  "customer_email",
  "currency",
  "gross_amount",
  "discount",
  "net_amount",
  "status",
] as const;

export const PAYMENT_CSV_COLUMNS = [
  "transaction_ref",
  "processed_at",
  "order_reference",
  "currency",
  "amount",
  "fee",
  "net_settled",
  "type",
  "status",
] as const;

export const OrderCsvRowSchema = z.object({
  order_id: z.string().min(1),
  order_date: z.string().min(1),
  customer_email: z.preprocess(emptyToNull, z.string().nullable()),
  currency: z.string().min(1),
  gross_amount: z.string().min(1),
  discount: z.preprocess(emptyToNull, z.string().nullable()),
  net_amount: z.string().min(1),
  status: z.enum(["completed", "cancelled", "refunded"]),
});

export const PaymentCsvRowSchema = z.object({
  transaction_ref: z.string().min(1),
  processed_at: z.preprocess(emptyToNull, z.string().nullable()),
  order_reference: z.string().min(1),
  currency: z.string().min(1),
  amount: z.string().min(1),
  fee: z.string().min(1),
  net_settled: z.string().min(1),
  type: z.enum(["charge", "refund"]),
  status: z.enum(["settled", "failed", "pending"]),
});
