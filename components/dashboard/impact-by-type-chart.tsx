"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipContentProps } from "recharts";
import { TooltipCard } from "./chart-tooltip";
import { RULE_DESCRIPTIONS } from "@/lib/reconciliation/rule-descriptions";
import { SEVERITY_COLORS } from "@/lib/severity-colors";
import { MONEY_AFFECTING_TYPES, type DiscrepancyType, type ReconSummary } from "@/lib/reconciliation/types";

interface Row {
  type: DiscrepancyType;
  label: string;
  severity: "critical" | "high" | "medium" | "low";
  count: number;
  impactCents: number;
}

function formatDollars(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function ImpactTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as Row | undefined;
  if (!row) return null;
  return (
    <TooltipCard>
      <div className="flex items-center gap-1.5">
        <span
          className="h-2 w-2 flex-none rounded-full"
          style={{ backgroundColor: SEVERITY_COLORS[row.severity] }}
        />
        <span className="font-semibold">{row.label}</span>
      </div>
      <div className="mt-1 text-muted-foreground">
        {row.count} issue{row.count === 1 ? "" : "s"} · {formatDollars(row.impactCents)}
      </div>
      <div className="mt-1.5 text-[11px] font-medium text-[var(--severity-reconciled)]">
        Click to view these discrepancies →
      </div>
    </TooltipCard>
  );
}

export function ImpactByTypeChart({ summary }: { summary: ReconSummary }) {
  const router = useRouter();
  const [hoveredType, setHoveredType] = useState<DiscrepancyType | null>(null);

  const rows: Row[] = MONEY_AFFECTING_TYPES.map((type) => ({
    type,
    label: RULE_DESCRIPTIONS[type].label,
    severity: RULE_DESCRIPTIONS[type].severity,
    count: summary.byType[type].count,
    impactCents: summary.byType[type].impactCents,
  }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.impactCents - a.impactCents);

  function goToType(type: DiscrepancyType) {
    router.push(`/discrepancies?type=${type}`);
  }

  return (
    <div className="w-full min-w-0 rounded-lg border border-border bg-card p-5 lg:w-auto lg:flex-[0_0_460px]">
      <h2 className="mb-1 text-[15px] font-semibold">Value at risk by type</h2>
      <p className="mb-4 text-[12.5px] text-muted-foreground">
        Ranked by money, not by count. Click a bar to see those discrepancies.
      </p>
      <ResponsiveContainer width="100%" height={Math.max(rows.length * 34, 34)}>
        <BarChart
          data={rows}
          layout="vertical"
          margin={{ top: 0, right: 40, bottom: 0, left: 8 }}
          onMouseLeave={() => setHoveredType(null)}
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
          <Tooltip content={ImpactTooltip} cursor={{ fill: "rgba(15,20,25,0.04)" }} />
          <Bar dataKey="impactCents" radius={3} barSize={18}>
            {rows.map((row) => (
              <Cell
                key={row.type}
                fill={SEVERITY_COLORS[row.severity]}
                fillOpacity={hoveredType === null || hoveredType === row.type ? 1 : 0.4}
                style={{ cursor: "pointer" }}
                onClick={() => goToType(row.type)}
                onMouseEnter={() => setHoveredType(row.type)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-1 flex flex-col gap-0.5">
        {rows.map((row) => (
          <Link
            key={row.type}
            href={`/discrepancies?type=${row.type}`}
            onMouseEnter={() => setHoveredType(row.type)}
            onMouseLeave={() => setHoveredType(null)}
            className={`flex items-center justify-between rounded px-1.5 py-0.5 text-[12.5px] transition-colors hover:bg-secondary ${
              hoveredType !== null && hoveredType !== row.type ? "opacity-40" : ""
            }`}
          >
            <span className="text-muted-foreground">
              {row.count} issue{row.count === 1 ? "" : "s"}
            </span>
            <span className="font-mono font-medium">{formatDollars(row.impactCents)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
