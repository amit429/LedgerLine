import type { ReconConfig } from "./types";

/**
 * Serializable inputs behind the tolerance formulas — persisted verbatim on
 * every reconciliation_runs row so a run is reproducible as
 * (batch, engine_version, config) -> result, and so Settings (added last,
 * after everything else works) can edit these exact numbers without
 * touching engine code.
 */
export interface ReconConfigInput {
  /**
   * Amount tolerance = max(amountToleranceFloorCents, netCents * amountToleranceRelative).
   *
   * Why $0.05 / 0.05%: the observed noise floor in this dataset is $0.02
   * (rounding artifacts on ORD-1901/1902/1903). The smallest genuine
   * mismatch is $18.50 (ORD-1402). Anything between $0.02 and $18 separates
   * the two cleanly, so rather than fit a threshold to that gap, this sets
   * a floor with an independent reason: $0.05 is a half-cent-rounding
   * allowance that survives currency conversion and processor rounding, and
   * the 0.05% relative term keeps it proportionate if order values scale
   * up. On this dataset the absolute floor always dominates. The point of a
   * floor instead of a fitted number: the tolerance shouldn't change just
   * because the data does.
   */
  amountToleranceFloorCents: number;
  amountToleranceRelative: number;
  /**
   * Median charge lag in this dataset is 42 minutes, p75 is 68 minutes; the
   * only real outlier is 29 days (ORD-2101). 72h is roughly 1000x the
   * median and leaves room for weekend batch settlement. Applies to
   * charges only — a refund landing days after its order (e.g. ORD-1702)
   * is normal and is excluded.
   */
  settlementLagHours: number;
}

export const DEFAULT_CONFIG_INPUT: ReconConfigInput = {
  amountToleranceFloorCents: 5,
  amountToleranceRelative: 0.0005,
  settlementLagHours: 72,
};

/** The engine's own version, persisted per run alongside its config. */
export const ENGINE_VERSION = "1.0.0";

export function buildConfig(input: ReconConfigInput): ReconConfig {
  return {
    amountToleranceCents: (netCents: number) =>
      Math.max(
        input.amountToleranceFloorCents,
        Math.round(netCents * input.amountToleranceRelative)
      ),
    settlementLagHours: input.settlementLagHours,
  };
}

export const DEFAULT_CONFIG: ReconConfig = buildConfig(DEFAULT_CONFIG_INPUT);
