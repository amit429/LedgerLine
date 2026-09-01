import type { DiscrepancyType, Severity } from "./types";

export interface RuleDescription {
  label: string;
  severity: Severity;
  /** The rule's condition, as implemented in rules.ts. */
  condition: string;
  /** One line of what the flag means in plain language, for a table row. */
  blurb: string;
}

/**
 * The canonical source for each rule's severity — rules.ts imports
 * SEVERITY_BY_TYPE from here instead of keeping its own copy, so the
 * engine and the UI can never disagree on what severity a rule carries.
 */
export const RULE_DESCRIPTIONS: Record<DiscrepancyType, RuleDescription> = {
  MISSING_PAYMENT: {
    label: "Missing payment",
    severity: "critical",
    condition: "order exists, 0 charges",
    blurb: "Completed order with no charge in the processor export",
  },
  ORPHAN_PAYMENT: {
    label: "Orphan payment",
    severity: "critical",
    condition: "payment key not in orders",
    blurb: "Charge references an order that does not exist",
  },
  DUPLICATE_CHARGE: {
    label: "Duplicate charge",
    severity: "critical",
    condition: "≥2 settled charges, same key",
    blurb: "The same order was charged more than once",
  },
  CANCELLED_BUT_CHARGED: {
    label: "Cancelled but charged",
    severity: "critical",
    condition: "status cancelled + settled charge",
    blurb: "Order was cancelled, charge settled anyway",
  },
  CURRENCY_MISMATCH: {
    label: "Currency mismatch",
    severity: "critical",
    condition: "order.currency !== payment.currency",
    blurb: "Ordered and settled in different currencies at the same figure",
  },
  AMOUNT_MISMATCH: {
    label: "Amount mismatch",
    severity: "high",
    condition: "|charge.amount - order.net_amount| > tolerance",
    blurb: "Charge amount differs from the order total beyond tolerance",
  },
  UNSETTLED_PAYMENT: {
    label: "Unsettled payment",
    severity: "high",
    condition: "order completed, charge failed/pending",
    blurb: "Charge returned failed or pending, order still marked completed",
  },
  PARTIAL_REFUND_GAP: {
    label: "Partial refund gap",
    severity: "high",
    condition: "status refunded, charges - refunds > tolerance",
    blurb: "Refund does not fully cover the original charge",
  },
  REFUND_STATUS_MISMATCH: {
    label: "Refund status mismatch",
    severity: "medium",
    condition: "refund exists, order still completed",
    blurb: "A refund landed but the order still reads completed",
  },
  LATE_SETTLEMENT: {
    label: "Late settlement",
    severity: "low",
    condition: "charge lag > settlement window",
    blurb: "Charge settled well after the order was placed",
  },
  DATA_QUALITY: {
    label: "Data quality",
    severity: "low",
    condition: "null email / discount / processed_at",
    blurb: "A field expected to be present was blank",
  },
  DUPLICATE_ORDER_ROW: {
    label: "Duplicate order row",
    severity: "low",
    condition: "identical order row appears twice",
    blurb: "The same order row was uploaded more than once",
  },
};

export const SEVERITY_BY_TYPE: Record<DiscrepancyType, Severity> = Object.fromEntries(
  Object.entries(RULE_DESCRIPTIONS).map(([type, desc]) => [type, desc.severity])
) as Record<DiscrepancyType, Severity>;
