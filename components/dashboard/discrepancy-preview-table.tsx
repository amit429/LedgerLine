import Link from "next/link";
import { RULE_DESCRIPTIONS } from "@/lib/reconciliation/rule-descriptions";
import type { Discrepancy } from "@/lib/reconciliation/types";

const SEVERITY_PILL: Record<Discrepancy["severity"], string> = {
  critical: "bg-[var(--severity-tint-critical)] text-[var(--severity-critical)]",
  high: "bg-[var(--severity-tint-high)] text-[var(--severity-high)]",
  medium: "bg-[var(--severity-tint-medium)] text-[var(--severity-medium)]",
  low: "bg-[var(--severity-tint-low)] text-[var(--severity-low)]",
};

function formatCents(cents: number | null): string {
  if (cents === null) return "—";
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

interface PreviewRow {
  type: Discrepancy["type"];
  severity: Discrepancy["severity"];
  orderKey: string;
  orderId: string | null;
  expectedCents: number | null;
  actualCents: number | null;
  impactCents: number;
}

export function DiscrepancyPreviewTable({
  rows,
  totalCount,
}: {
  rows: PreviewRow[];
  totalCount: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-5 pt-4.5 pb-4">
        <h2 className="mb-1 text-[15px] font-semibold">Where to start</h2>
        <p className="text-[12.5px] text-muted-foreground">
          The largest single discrepancies in this run, ordered by money at
          stake.
        </p>
      </div>
      <div className="overflow-x-auto">
      <table className="w-full min-w-[800px] text-[13px]">
        <thead>
          <tr className="text-left text-[12px] text-muted-foreground">
            <th className="px-5 py-2.5 font-medium">Severity</th>
            <th className="py-2.5 font-medium">Type</th>
            <th className="py-2.5 font-medium">Order</th>
            <th className="py-2.5 font-medium">What the engine found</th>
            <th className="py-2.5 text-right font-medium">Order value</th>
            <th className="py-2.5 text-right font-medium">Settled</th>
            <th className="px-5 py-2.5 text-right font-medium">Impact</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-border/60">
              <td className="px-5 py-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${SEVERITY_PILL[row.severity]}`}
                >
                  {row.severity[0].toUpperCase() + row.severity.slice(1)}
                </span>
              </td>
              <td className="py-3">{RULE_DESCRIPTIONS[row.type].label}</td>
              <td className="py-3 font-mono">{row.orderId ?? row.orderKey}</td>
              <td className="py-3 text-muted-foreground">
                {RULE_DESCRIPTIONS[row.type].blurb}
              </td>
              <td className="py-3 text-right font-mono">
                {formatCents(row.expectedCents)}
              </td>
              <td className="py-3 text-right font-mono">
                {formatCents(row.actualCents)}
              </td>
              <td className="px-5 py-3 text-right font-mono font-semibold">
                {formatCents(row.impactCents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <div className="flex items-center justify-between border-t border-border px-5 py-3.5">
        <p className="text-[12.5px] text-muted-foreground">
          Showing {rows.length} of {totalCount} discrepancies
        </p>
        <Link
          href="/discrepancies"
          className="text-[12.5px] font-medium text-[var(--severity-reconciled)]"
        >
          View all discrepancies
        </Link>
      </div>
    </div>
  );
}
