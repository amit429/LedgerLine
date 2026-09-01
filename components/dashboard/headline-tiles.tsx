import Link from "next/link";
import type { ReconSummary } from "@/lib/reconciliation/types";

function formatDollars(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

interface TileProps {
  label: string;
  value: string;
  hint: string;
  href: string;
  emphasize?: boolean;
}

function Tile({ label, value, hint, href, emphasize }: TileProps) {
  return (
    <Link
      href={href}
      className="flex-1 rounded-lg border border-border bg-card px-5 py-4.5 transition-colors hover:border-ring"
    >
      <p className="mb-2 text-[12.5px] text-muted-foreground">{label}</p>
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
    <div className="flex gap-4">
      <Tile
        label="Orders"
        value={summary.totalOrders.toLocaleString()}
        hint={reconciledOrderCount === null ? "—" : `${reconciledOrderCount} matched cleanly`}
        href="/orders"
      />
      <Tile
        label="Payments"
        value={summary.totalPayments.toLocaleString()}
        hint={formatDollars(summary.totalPaymentsSettledCents) + " settled"}
        href="/payments"
      />
      <Tile
        label="Reconciled"
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
        value={formatDollars(summary.valueInDisputeCents)}
        hint={`${disputePercent.toFixed(1)}% of total order value`}
        href="/discrepancies"
        emphasize
      />
      <Tile
        label="At risk"
        value={formatDollars(summary.moneyAtRiskCents)}
        hint={`${moneyAffectingCount} money-affecting issues`}
        href="/discrepancies?severity=critical,high"
        emphasize
      />
    </div>
  );
}
