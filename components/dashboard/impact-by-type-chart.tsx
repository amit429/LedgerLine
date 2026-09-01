"use client";

import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts";
import { RULE_DESCRIPTIONS } from "@/lib/reconciliation/rule-descriptions";
import { SEVERITY_COLORS } from "@/lib/severity-colors";
import { MONEY_AFFECTING_TYPES, type ReconSummary } from "@/lib/reconciliation/types";

export function ImpactByTypeChart({ summary }: { summary: ReconSummary }) {
  const rows = MONEY_AFFECTING_TYPES.map((type) => ({
    type,
    label: RULE_DESCRIPTIONS[type].label,
    severity: RULE_DESCRIPTIONS[type].severity,
    count: summary.byType[type].count,
    impactCents: summary.byType[type].impactCents,
  }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.impactCents - a.impactCents);

  return (
    <div className="flex-[0_0_460px] rounded-lg border border-border bg-card p-5">
      <h2 className="mb-1 text-[15px] font-semibold">Value at risk by type</h2>
      <p className="mb-4 text-[12.5px] text-muted-foreground">
        Ranked by money, not by count.
      </p>
      <BarChart
        width={420}
        height={Math.max(rows.length * 34, 34)}
        data={rows}
        layout="vertical"
        margin={{ top: 0, right: 40, bottom: 0, left: 8 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          width={150}
          tick={{ fontSize: 12.5, fill: "#0F1419" }}
          axisLine={false}
          tickLine={false}
        />
        <Bar dataKey="impactCents" radius={3} barSize={18}>
          {rows.map((row) => (
            <Cell key={row.type} fill={SEVERITY_COLORS[row.severity]} />
          ))}
        </Bar>
      </BarChart>
      <div className="mt-1 flex flex-col gap-1">
        {rows.map((row) => (
          <div key={row.type} className="flex items-center justify-between text-[12.5px]">
            <span className="text-muted-foreground">
              {row.count} issue{row.count === 1 ? "" : "s"}
            </span>
            <span className="font-mono font-medium">
              {(row.impactCents / 100).toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
