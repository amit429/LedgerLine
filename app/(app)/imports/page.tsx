import Link from "next/link";
import { LocalDateTime } from "@/components/shared/local-datetime";
import { OutcomePill } from "@/components/shared/outcome-pill";
import { computeRunHistoryRows, type RunHistoryRow } from "@/lib/batches/run-history";
import { createClient } from "@/lib/supabase/server";

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// Module-level constants, not object literals inline at the call site —
// LocalDateTime's effect intentionally skips `options` in its dependency
// array, which only stays harmless if the same reference is passed every
// render rather than a fresh object each time.
const IMPORT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};
const RECONCILED_AT_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

function formatConfig(config: RunHistoryRow["config"], engineVersion: string): string {
  const floor = (config.amountToleranceFloorCents / 100).toFixed(2);
  return `${engineVersion} · $${floor} / ${config.settlementLagHours}h`;
}

const STATUS_LABEL: Record<RunHistoryRow["status"], { label: string; tone: "ok" | "mute" }> = {
  current: { label: "Current", tone: "ok" },
  superseded: { label: "Superseded", tone: "mute" },
  archived: { label: "Archived", tone: "mute" },
};

export default async function ImportsPage() {
  const supabase = await createClient();
  const [{ data: batches }, { data: runs }] = await Promise.all([
    supabase
      .from("import_batches")
      .select("id, label, created_at, orders_row_count, payments_row_count")
      .order("created_at", { ascending: false }),
    supabase
      .from("reconciliation_runs")
      .select("id, batch_id, summary, engine_version, config, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const rows = computeRunHistoryRows(batches ?? [], runs ?? []);

  return (
    <>
      <div className="flex items-center justify-between border-b border-border bg-card px-7 py-3.5">
        <div>
          <h1 className="text-lg font-semibold">Imports</h1>
          <p className="text-[12.5px] text-muted-foreground">
            Every run keeps the tolerances it ran with, so old results stay
            reproducible
          </p>
        </div>
        <Link
          href="/imports/new"
          className="rounded-md bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground"
        >
          New import
        </Link>
      </div>

      <div className="flex flex-col gap-4 p-7">
        <div className="rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-[13px]">
            <thead>
              <tr className="text-left text-[12px] text-muted-foreground">
                <th className="px-5 py-2.5 font-medium">Import</th>
                <th className="px-3 py-2.5 font-medium">Reconciled at</th>
                <th className="px-3 py-2.5 text-right font-medium">Orders</th>
                <th className="px-3 py-2.5 text-right font-medium">Payments</th>
                <th className="px-3 py-2.5 text-right font-medium">Discrepancies</th>
                <th className="px-3 py-2.5 text-right font-medium">At risk</th>
                <th className="px-3 py-2.5 font-medium">Engine + config</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.runId}
                  id={row.runId}
                  className="border-t border-border/60 target:bg-[var(--severity-tint-reconciled)]"
                >
                  <td className="px-5 py-3">
                    {row.label} ·{" "}
                    <LocalDateTime iso={row.batchCreatedAt} options={IMPORT_DATE_OPTIONS} />
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    <LocalDateTime iso={row.reconciledAt} options={RECONCILED_AT_OPTIONS} />
                  </td>
                  <td className="px-3 py-3 text-right font-mono">{row.ordersCount}</td>
                  <td className="px-3 py-3 text-right font-mono">{row.paymentsCount}</td>
                  <td className="px-3 py-3 text-right font-mono">{row.discrepancyCount}</td>
                  <td className="px-3 py-3 text-right font-mono">
                    {formatCents(row.atRiskCents)}
                  </td>
                  <td className="px-3 py-3 font-mono text-muted-foreground">
                    {formatConfig(row.config, row.engineVersion)}
                  </td>
                  <td className="px-5 py-3">
                    <OutcomePill
                      label={STATUS_LABEL[row.status].label}
                      tone={STATUS_LABEL[row.status].tone}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {rows.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No imports yet.{" "}
              <Link href="/imports/new" className="font-medium text-[var(--severity-reconciled)]">
                Start one
              </Link>
              .
            </p>
          )}
        </div>
      </div>
    </>
  );
}
