export type OrderStatus = "completed" | "cancelled" | "refunded";
export type PaymentType = "charge" | "refund";
export type PaymentStatus = "settled" | "failed" | "pending";

export interface RawOrderRow {
  order_id: string;
  order_date: string;
  customer_email: string | null;
  currency: string;
  gross_amount: string;
  discount: string | null;
  net_amount: string;
  status: OrderStatus;
}

export interface RawPaymentRow {
  transaction_ref: string;
  processed_at: string | null;
  order_reference: string;
  currency: string;
  amount: string;
  fee: string;
  net_settled: string;
  type: PaymentType;
  status: PaymentStatus;
}

export interface NormalizedOrder {
  orderId: string;
  orderKey: string;
  orderDate: Date;
  customerEmail: string | null;
  currency: string;
  grossCents: number;
  discountCents: number | null;
  netCents: number;
  status: OrderStatus;
  raw: RawOrderRow;
}

export interface NormalizedPayment {
  transactionRef: string;
  processedAt: Date | null;
  orderReference: string;
  orderKey: string;
  currency: string;
  amountCents: number;
  feeCents: number;
  netSettledCents: number;
  type: PaymentType;
  status: PaymentStatus;
  raw: RawPaymentRow;
}

/** The 9 rules whose impact represents real money at stake. */
export const MONEY_AFFECTING_TYPES = [
  "MISSING_PAYMENT",
  "ORPHAN_PAYMENT",
  "DUPLICATE_CHARGE",
  "CANCELLED_BUT_CHARGED",
  "CURRENCY_MISMATCH",
  "AMOUNT_MISMATCH",
  "UNSETTLED_PAYMENT",
  "PARTIAL_REFUND_GAP",
  "REFUND_STATUS_MISMATCH",
] as const;

/** The 3 rules that flag something worth a human's attention but move no money. */
export const INFORMATIONAL_TYPES = [
  "LATE_SETTLEMENT",
  "DATA_QUALITY",
  "DUPLICATE_ORDER_ROW",
] as const;

export type DiscrepancyType =
  | (typeof MONEY_AFFECTING_TYPES)[number]
  | (typeof INFORMATIONAL_TYPES)[number];

export type Severity = "critical" | "high" | "medium" | "low";

export interface Discrepancy {
  type: DiscrepancyType;
  severity: Severity;
  orderKey: string;
  orderId: string | null;
  transactionRefs: string[];
  expectedCents: number | null;
  actualCents: number | null;
  /** Signed for AMOUNT_MISMATCH, 0 for informational rules, positive otherwise. */
  impactCents: number;
  currency: string | null;
  details: Record<string, unknown>;
}

export interface ReconConfig {
  amountToleranceCents: (netCents: number) => number;
  settlementLagHours: number;
}

export interface OrderGroup {
  key: string;
  order: NormalizedOrder | null;
  charges: NormalizedPayment[];
  refunds: NormalizedPayment[];
}

export interface ReconSummary {
  totalOrders: number;
  totalPayments: number;
  totalOrderValueCents: number;
  totalPaymentsSettledCents: number;
  valueReconciledCents: number;
  valueInDisputeCents: number;
  moneyAtRiskCents: number;
  /** Orders with zero discrepancies of any kind — the $ counterpart is valueReconciledCents. */
  reconciledOrderCount: number;
  /** Unique orders carrying >=1 money-affecting discrepancy — counterpart to valueInDisputeCents. */
  disputedOrderCount: number;
  bySeverity: Record<Severity, { count: number; impactCents: number }>;
  byType: Record<DiscrepancyType, { count: number; impactCents: number }>;
}

export interface ReconResult {
  discrepancies: Discrepancy[];
  orders: NormalizedOrder[];
  payments: NormalizedPayment[];
  summary: ReconSummary;
}
