"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Cell, Pie, PieChart, Tooltip } from "recharts";
import type { TooltipContentProps } from "recharts";
import { TooltipCard } from "./chart-tooltip";
import { RECONCILED_COLOR, SEVERITY_COLORS } from "@/lib/severity-colors";
import type { ReconSummary, Severity } from "@/lib/reconciliation/types";

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];
const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

interface Slice {
  name: string;
  value: number;
  color: string;
  /** Where clicking/hovering this slice should navigate — reconciled
   * orders live on the orders page, everything else is a discrepancy
   * severity filter. */
  href: string;
}

function SeverityTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  const slice = payload[0]?.payload as Slice | undefined;
  if (!slice) return null;
  return (
    <TooltipCard>
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 flex-none rounded-full" style={{ backgroundColor: slice.color }} />
        <span className="font-semibold">{slice.name}</span>
      </div>
      <div className="mt-1 text-muted-foreground">
        {slice.value} order{slice.value === 1 ? "" : "s"}
      </div>
      <div className="mt-1.5 text-[11px] font-medium text-[var(--severity-reconciled)]">
        Click to view →
      </div>
    </TooltipCard>
  );
}

export function SeverityDonut({ summary }: { summary: ReconSummary }) {
  const router = useRouter();
  const [hoveredName, setHoveredName] = useState<string | null>(null);

  const data: Slice[] = [
    {
      // Guards against older persisted runs that predate this field —
      // see the matching guard in headline-tiles.tsx.
      name: "Reconciled",
      value: summary.reconciledOrderCount ?? 0,
      color: RECONCILED_COLOR,
      href: "/orders?outcome=matched",
    },
    ...SEVERITY_ORDER.filter((s) => summary.bySeverity[s].count > 0).map((s) => ({
      name: SEVERITY_LABEL[s],
      value: summary.bySeverity[s].count,
      color: SEVERITY_COLORS[s],
      href: `/discrepancies?severity=${s}`,
    })),
  ];

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-1 text-[15px] font-semibold">Severity breakdown</h2>
      <p className="mb-4 text-[12.5px] text-muted-foreground">
        Reconciled orders alongside every open discrepancy. Click a slice to drill in.
      </p>
      <div className="flex items-center gap-6">
        <PieChart width={140} height={140}>
          <Tooltip content={SeverityTooltip} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={44}
            outerRadius={68}
            paddingAngle={2}
            strokeWidth={0}
            onMouseLeave={() => setHoveredName(null)}
          >
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={entry.color}
                fillOpacity={hoveredName === null || hoveredName === entry.name ? 1 : 0.4}
                style={{ cursor: "pointer" }}
                onClick={() => router.push(entry.href)}
                onMouseEnter={() => setHoveredName(entry.name)}
              />
            ))}
          </Pie>
        </PieChart>
        <div className="flex flex-col gap-1">
          {data.map((entry) => (
            <Link
              key={entry.name}
              href={entry.href}
              onMouseEnter={() => setHoveredName(entry.name)}
              onMouseLeave={() => setHoveredName(null)}
              className={`flex items-center gap-2 rounded px-1.5 py-0.5 text-[12.5px] transition-colors hover:bg-secondary ${
                hoveredName !== null && hoveredName !== entry.name ? "opacity-40" : ""
              }`}
            >
              <span
                className="h-2 w-2 flex-none rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{entry.name}</span>
              <span className="font-mono font-medium">{entry.value}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
