"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { TooltipContentProps } from "recharts";
import { TooltipCard } from "./chart-tooltip";
import { SEVERITY_COLORS } from "@/lib/severity-colors";
import type { RunHistoryRow } from "@/lib/batches/run-history";

function formatDollars(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface Point {
  runId: string;
  date: string;
  atRiskCents: number;
  discrepancyCount: number;
}

function TrendTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload as Point | undefined;
  if (!point) return null;
  return (
    <TooltipCard>
      <div className="font-semibold">{formatShortDate(point.date)}</div>
      <div className="mt-1 text-muted-foreground">
        {formatDollars(point.atRiskCents)} at risk · {point.discrepancyCount} discrepanc
        {point.discrepancyCount === 1 ? "y" : "ies"}
      </div>
      <div className="mt-1.5 text-[11px] font-medium text-[var(--severity-reconciled)]">
        Click to view this import →
      </div>
    </TooltipCard>
  );
}

/**
 * "Value at risk by type" and the severity donut both describe the
 * *current* run. Neither answers the question a recurring reviewer
 * actually has: is this getting better or worse? One point per import
 * (not per Settings re-run of the same import — see the `status` filter
 * where this is built) plotted over time is the only place on the
 * dashboard that answers that.
 */
export function MoneyAtRiskTrendChart({ runs }: { runs: RunHistoryRow[] }) {
  const router = useRouter();

  // A single persistent dot, not recharts' separate dot/activeDot pair —
  // recharts mounts activeDot as an extra element on top of dot when
  // hovered, which swaps the DOM node out from under a click between
  // mousedown and mouseup (the click lands on `dot`, activeDot appears,
  // mouseup hits a different element, no click event fires at all).
  // Passing the same renderer as `activeDot` doesn't help — recharts still
  // renders two separate circles, not one. One dot, always present, is
  // what actually keeps clicking reliable.
  function TrendDot({ cx, cy, payload }: { cx?: number; cy?: number; payload?: Point }) {
    if (cx === undefined || cy === undefined || !payload) return null;
    return (
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill={SEVERITY_COLORS.critical}
        stroke="#fff"
        strokeWidth={1.5}
        style={{ cursor: "pointer" }}
        onClick={() => router.push(`/imports#${payload.runId}`)}
      />
    );
  }

  if (runs.length < 2) {
    return (
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-1 text-[15px] font-semibold">Money at risk over time</h2>
        <p className="mb-3 text-[12.5px] text-muted-foreground">
          Appears once you have more than one import to compare — this is
          your first.
        </p>
        <Link
          href="/imports/new"
          className="text-[12.5px] font-medium text-[var(--severity-reconciled)]"
        >
          Start another import →
        </Link>
      </div>
    );
  }

  const points: Point[] = runs.map((r) => ({
    runId: r.runId,
    date: r.reconciledAt,
    atRiskCents: r.atRiskCents,
    discrepancyCount: r.discrepancyCount,
  }));

  const latest = points[points.length - 1];
  const previous = points[points.length - 2];
  const deltaCents = latest.atRiskCents - previous.atRiskCents;
  const improving = deltaCents < 0;
  const flat = deltaCents === 0;
  const deltaColor = flat
    ? "text-muted-foreground"
    : improving
      ? "text-[var(--severity-reconciled)]"
      : "text-[var(--severity-critical)]";

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="text-[15px] font-semibold">Money at risk over time</h2>
        <span className={`font-mono text-[12.5px] font-semibold ${deltaColor}`}>
          {flat ? "No change" : `${improving ? "↓" : "↑"} ${formatDollars(Math.abs(deltaCents))}`}
          {" vs last import"}
        </span>
      </div>
      <p className="mb-4 text-[12.5px] text-muted-foreground">
        One point per import — re-runs of the same import with different
        tolerances aren&apos;t counted twice. Click a point to see that import.
      </p>
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id="atRiskFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SEVERITY_COLORS.critical} stopOpacity={0.22} />
              <stop offset="100%" stopColor={SEVERITY_COLORS.critical} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tickFormatter={formatShortDate}
            tick={{ fontSize: 11, fill: "#5A6472" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={TrendTooltip} />
          <Area
            type="monotone"
            dataKey="atRiskCents"
            stroke={SEVERITY_COLORS.critical}
            strokeWidth={2}
            fill="url(#atRiskFill)"
            dot={TrendDot}
            activeDot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
