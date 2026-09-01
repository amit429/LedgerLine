import type { ReconConfig } from "./types";

/**
 * max($0.05, 0.05% of order value).
 *
 * Why: the observed noise floor in this dataset is $0.02 (rounding artifacts
 * on ORD-1901/1902/1903). The smallest genuine mismatch is $18.50
 * (ORD-1402). Anything between $0.02 and $18 separates the two cleanly, so
 * rather than fit a threshold to that gap, this sets a floor with an
 * independent reason: $0.05 is a half-cent-rounding allowance that survives
 * currency conversion and processor rounding, and the 0.05% relative term
 * keeps it proportionate if order values scale up. On this dataset the
 * absolute floor always dominates. The point of a floor instead of a fitted
 * number: the tolerance shouldn't change just because the data does.
 */
export const AMOUNT_TOLERANCE_CENTS = (netCents: number): number =>
  Math.max(5, Math.round(netCents * 0.0005));

/**
 * Median charge lag in this dataset is 42 minutes, p75 is 68 minutes; the
 * only real outlier is 29 days (ORD-2101). 72h is roughly 1000x the median
 * and leaves room for weekend batch settlement. Applies to charges only —
 * a refund landing days after its order (e.g. ORD-1702) is normal and is
 * excluded.
 */
export const SETTLEMENT_LAG_HOURS = 72;

export const DEFAULT_CONFIG: ReconConfig = {
  amountToleranceCents: AMOUNT_TOLERANCE_CENTS,
  settlementLagHours: SETTLEMENT_LAG_HOURS,
};
