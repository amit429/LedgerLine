"use client";

import { Cell, Pie, PieChart } from "recharts";
import { RECONCILED_COLOR, SEVERITY_COLORS } from "@/lib/severity-colors";
import type { ReconSummary, Severity } from "@/lib/reconciliation/types";

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];
const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function SeverityDonut({ summary }: { summary: ReconSummary }) {
  const data = [
    {
      // Guards against older persisted runs that predate this field —
      // see the matching guard in headline-tiles.tsx.
      name: "Reconciled",
      value: summary.reconciledOrderCount ?? 0,
      color: RECONCILED_COLOR,
    },
    ...SEVERITY_ORDER.filter((s) => summary.bySeverity[s].count > 0).map((s) => ({
      name: SEVERITY_LABEL[s],
      value: summary.bySeverity[s].count,
      color: SEVERITY_COLORS[s],
    })),
  ];

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-1 text-[15px] font-semibold">Severity breakdown</h2>
      <p className="mb-4 text-[12.5px] text-muted-foreground">
        Reconciled orders alongside every open discrepancy.
      </p>
      <div className="flex items-center gap-6">
        <PieChart width={140} height={140}>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={44}
            outerRadius={68}
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
        <div className="flex flex-col gap-2">
          {data.map((entry) => (
            <div key={entry.name} className="flex items-center gap-2 text-[12.5px]">
              <span
                className="h-2 w-2 flex-none rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{entry.name}</span>
              <span className="font-mono font-medium">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
