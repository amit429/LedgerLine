import { RULE_DESCRIPTIONS } from "@/lib/reconciliation/rule-descriptions";
import type { Severity } from "@/lib/reconciliation/types";
import type { DiscrepancyRow } from "@/lib/discrepancies/types";

const SEVERITY_PILL: Record<Severity, string> = {
  critical: "bg-[var(--severity-tint-critical)] text-[var(--severity-critical)]",
  high: "bg-[var(--severity-tint-high)] text-[var(--severity-high)]",
  medium: "bg-[var(--severity-tint-medium)] text-[var(--severity-medium)]",
  low: "bg-[var(--severity-tint-low)] text-[var(--severity-low)]",
};

function formatCents(cents: number | null): string {
  if (cents === null) return "—";
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

interface DiscrepancyTableProps {
  rows: DiscrepancyRow[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onOpenRow: (row: DiscrepancyRow) => void;
}

export function DiscrepancyTable({
  rows,
  selected,
  onToggleSelect,
  onToggleSelectAll,
  onOpenRow,
}: DiscrepancyTableProps) {
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  return (
    <div className="overflow-x-auto">
    <table className="w-full min-w-[900px] text-[13px]">
      <thead>
        <tr className="text-left text-[12px] text-muted-foreground">
          <th className="w-9 px-5 py-2.5">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={onToggleSelectAll}
              aria-label="Select all discrepancies on this page"
              className="h-3.5 w-3.5 rounded border-border"
            />
          </th>
          <th className="w-24 py-2.5 font-medium">Severity</th>
          <th className="w-44 py-2.5 font-medium">Type</th>
          <th className="w-28 py-2.5 font-medium">Order</th>
          <th className="w-40 py-2.5 font-medium">Transactions</th>
          <th className="w-28 py-2.5 font-medium">Detected</th>
          <th className="py-2.5 text-right font-medium">Order value</th>
          <th className="py-2.5 text-right font-medium">Settled</th>
          <th className="px-5 py-2.5 text-right font-medium">Impact</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.id}
            className="cursor-pointer border-t border-border/60 hover:bg-secondary/40"
            onClick={() => onOpenRow(row)}
          >
            <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={selected.has(row.id)}
                onChange={() => onToggleSelect(row.id)}
                aria-label={`Select discrepancy for order ${row.order_id ?? row.order_key}`}
                className="h-3.5 w-3.5 rounded border-border"
              />
            </td>
            <td className="py-3">
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${SEVERITY_PILL[row.severity]}`}
              >
                {row.severity[0].toUpperCase() + row.severity.slice(1)}
              </span>
            </td>
            <td className="py-3">{RULE_DESCRIPTIONS[row.type].label}</td>
            <td className="py-3 font-mono">{row.order_id ?? row.order_key}</td>
            <td className="py-3 font-mono text-muted-foreground">
              {row.transaction_refs.length === 0
                ? "—"
                : row.transaction_refs.length === 1
                  ? row.transaction_refs[0]
                  : `${row.transaction_refs[0]} +${row.transaction_refs.length - 1}`}
            </td>
            <td className="py-3 text-muted-foreground">{formatDate(row.created_at)}</td>
            <td className="py-3 text-right font-mono">{formatCents(row.expected_cents)}</td>
            <td className="py-3 text-right font-mono">{formatCents(row.actual_cents)}</td>
            <td className="px-5 py-3 text-right font-mono font-semibold">
              {formatCents(row.impact_cents)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}
