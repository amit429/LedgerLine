import Link from "next/link";
import { InfoTooltip } from "@/components/shared/info-tooltip";
import type { ReconSummary } from "@/lib/reconciliation/types";

function formatDollars(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

interface TileProps {
  label: string;
  tooltip: string;
  /** Right-align the tooltip for tiles near the right edge of the row so
   * it doesn't run off the viewport — see InfoTooltip. */
  tooltipAlign?: "left" | "right";
  value: string;
  hint: string;
  href: string;
  emphasize?: boolean;
}

function Tile({ label, tooltip, tooltipAlign, value, hint, href, emphasize }: TileProps) {
  return (
    <Link
      href={href}
      className="min-w-[160px] flex-1 rounded-lg border border-border bg-card px-5 py-4.5 transition-colors hover:border-ring"
    >
      <p className="mb-2 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
        {label}
        <InfoTooltip text={tooltip} align={tooltipAlign} />
      </p>
      <p
        className={`mb-1.5 font-mono text-[26px] font-semibold tracking-tight ${
          emphasize ? "text-[var(--severity-critical)]" : ""
        }`}
      >
        {value}
      </p>
      <p className="text-[11.5px] text-muted-foreground">{hint}</p>
    </Link>
  );
}

export function HeadlineTiles({ summary }: { summary: ReconSummary }) {
  const disputePercent =
    summary.totalOrderValueCents > 0
      ? (summary.valueInDisputeCents / summary.totalOrderValueCents) * 100
      : 0;
  const moneyAffectingCount =
    summary.byType.MISSING_PAYMENT.count +
    summary.byType.ORPHAN_PAYMENT.count +
    summary.byType.DUPLICATE_CHARGE.count +
    summary.byType.CANCELLED_BUT_CHARGED.count +
    summary.byType.CURRENCY_MISMATCH.count +
    summary.byType.AMOUNT_MISMATCH.count +
    summary.byType.UNSETTLED_PAYMENT.count +
    summary.byType.PARTIAL_REFUND_GAP.count +
    summary.byType.REFUND_STATUS_MISMATCH.count;

  // Older persisted runs predate a field added to the summary shape —
  // RECON_PLAN's own design keeps historical runs immutable (Phase 9), so
  // rather than backfill them, the UI degrades to "—" instead of printing
  // a literal "undefined".
  const reconciledOrderCount = summary.reconciledOrderCount ?? null;

  return (
    <div className="flex flex-wrap gap-4">
      <Tile
        label="Orders"
        tooltip="Every order in this import, whether it matched cleanly or not."
        value={summary.totalOrders.toLocaleString()}
        hint={reconciledOrderCount === null ? "—" : `${reconciledOrderCount} matched cleanly`}
        href="/orders"
      />
      <Tile
        label="Payments"
        tooltip="Every payment transaction — charges and refunds — in this import."
        value={summary.totalPayments.toLocaleString()}
        hint={formatDollars(summary.totalPaymentsSettledCents) + " settled"}
        href="/payments"
      />
      <Tile
        label="Reconciled"
        tooltip="Total value of orders with zero discrepancies of any kind — these matched cleanly between the order export and the payment settlement."
        value={formatDollars(summary.valueReconciledCents)}
        hint={
          reconciledOrderCount === null
            ? "—"
            : `${reconciledOrderCount} of ${summary.totalOrders} orders`
        }
        href="/orders?outcome=matched"
      />
      <Tile
        label="In dispute"
        tooltip="Full value of every order with at least one money-affecting discrepancy, counted once per order at its total value. Compare to 'At risk' — that only counts the actual dollar impact, not the whole order."
        tooltipAlign="right"
        value={formatDollars(summary.valueInDisputeCents)}
        hint={`${disputePercent.toFixed(1)}% of total order value`}
        href="/discrepancies"
        emphasize
      />
      <Tile
        label="At risk"
        tooltip="Sum of the actual dollar impact from critical- and high-severity discrepancies only — the delta itself, not the order's full value. E.g. a $25 overcharge on a $92 order puts $25 at risk, even though that order's full $92 counts toward 'In dispute'."
        tooltipAlign="right"
        value={formatDollars(summary.moneyAtRiskCents)}
        hint={`${moneyAffectingCount} money-affecting issues`}
        href="/discrepancies?severity=critical,high"
        emphasize
      />
    </div>
  );
}
