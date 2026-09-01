import type { ReconConfigInput } from "../reconciliation/config";
import type { ReconSummary } from "../reconciliation/types";

export interface RunHistoryRow {
  runId: string;
  batchId: string;
  label: string;
  reconciledAt: string;
  ordersCount: number;
  paymentsCount: number;
  discrepancyCount: number;
  atRiskCents: number;
  engineVersion: string;
  config: ReconConfigInput;
  status: "current" | "superseded" | "archived";
}

interface BatchRow {
  id: string;
  label: string;
  orders_row_count: number;
  payments_row_count: number;
}

interface RunRow {
  id: string;
  batch_id: string;
  summary: unknown;
  engine_version: string;
  config: unknown;
  created_at: string;
}

/**
 * Derives run-history status without mutating any past run: "current" is
 * the single most recent run across all batches, "archived" is the latest
 * run of any other (older) batch, and "superseded" is an older run of a
 * batch that has since been re-run — e.g. after a Settings tolerance
 * change. `runs` must already be sorted newest-first.
 */
export function computeRunHistoryRows(
  batches: BatchRow[],
  runs: RunRow[]
): RunHistoryRow[] {
  const batchById = new Map(batches.map((b) => [b.id, b]));
  const activeRunId = runs[0]?.id ?? null;
  const latestRunIdByBatch = new Map<string, string>();
  for (const run of runs) {
    if (!latestRunIdByBatch.has(run.batch_id)) {
      latestRunIdByBatch.set(run.batch_id, run.id);
    }
  }

  return runs.flatMap((run) => {
    const batch = batchById.get(run.batch_id);
    if (!batch) return [];

    const summary = run.summary as ReconSummary;
    const status: RunHistoryRow["status"] =
      run.id === activeRunId
        ? "current"
        : latestRunIdByBatch.get(run.batch_id) === run.id
          ? "archived"
          : "superseded";

    return [
      {
        runId: run.id,
        batchId: run.batch_id,
        label: batch.label,
        reconciledAt: run.created_at,
        ordersCount: batch.orders_row_count,
        paymentsCount: batch.payments_row_count,
        discrepancyCount:
          summary.bySeverity.critical.count +
          summary.bySeverity.high.count +
          summary.bySeverity.medium.count +
          summary.bySeverity.low.count,
        atRiskCents: summary.moneyAtRiskCents,
        engineVersion: run.engine_version,
        config: run.config as ReconConfigInput,
        status,
      },
    ];
  });
}
