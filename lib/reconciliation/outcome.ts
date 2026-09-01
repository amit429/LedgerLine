import { RULE_DESCRIPTIONS } from "./rule-descriptions";
import type { DiscrepancyType } from "./types";

export type OutcomeTone = "ok" | "bad" | "warn" | "info" | "mute";

export interface Outcome {
  label: string;
  tone: OutcomeTone;
}

const TONE_BY_TYPE: Record<DiscrepancyType, OutcomeTone> = {
  MISSING_PAYMENT: "bad",
  ORPHAN_PAYMENT: "bad",
  DUPLICATE_CHARGE: "bad",
  CANCELLED_BUT_CHARGED: "bad",
  CURRENCY_MISMATCH: "bad",
  AMOUNT_MISMATCH: "warn",
  UNSETTLED_PAYMENT: "warn",
  PARTIAL_REFUND_GAP: "warn",
  REFUND_STATUS_MISMATCH: "info",
  LATE_SETTLEMENT: "info",
  DATA_QUALITY: "info",
  DUPLICATE_ORDER_ROW: "mute",
};

const LABEL_OVERRIDE: Partial<Record<DiscrepancyType, string>> = {
  CANCELLED_BUT_CHARGED: "Charged anyway",
  DUPLICATE_ORDER_ROW: "Duplicate row merged",
  LATE_SETTLEMENT: "Settled late",
  UNSETTLED_PAYMENT: "Unsettled",
};

export function outcomeForType(type: DiscrepancyType): Outcome {
  return {
    label: LABEL_OVERRIDE[type] ?? RULE_DESCRIPTIONS[type].label,
    tone: TONE_BY_TYPE[type],
  };
}

export const MATCHED_OUTCOME: Outcome = { label: "Matched", tone: "ok" };
export const REFERENCE_NORMALISED_OUTCOME: Outcome = {
  label: "Reference normalised",
  tone: "mute",
};
