import Link from "next/link";
import { DiscrepancyPreviewTable } from "@/components/dashboard/discrepancy-preview-table";
import { HeadlineTiles } from "@/components/dashboard/headline-tiles";
import { ImpactByTypeChart } from "@/components/dashboard/impact-by-type-chart";
import { SeverityDonut } from "@/components/dashboard/severity-donut";
import type { Discrepancy, ReconSummary } from "@/lib/reconciliation/types";
import { createClient } from "@/lib/supabase/server";

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-xl font-semibold">Nothing to reconcile yet</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Upload your order export and payment export to get your first
        reconciliation run.
      </p>
      <Link
        href="/imports/new"
        className="mt-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        Start an import
      </Link>
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default async function DashboardPage() {
  const supabase = await createClient();

  // The latest *run*, not the latest batch — an uploaded-but-never-
  // reconciled batch (abandoned mid-wizard, or just not run yet) must not
  // shadow an older batch that was actually reconciled.
  const { data: run } = await supabase
    .from("reconciliation_runs")
    .select("id, batch_id, summary, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!run) {
    return <EmptyState />;
  }

  const summary = run.summary as ReconSummary;

  const { data: allDiscrepancies } = await supabase
    .from("discrepancies")
    .select("type, severity, order_key, order_id, expected_cents, actual_cents, impact_cents")
    .eq("run_id", run.id);

  const topDiscrepancies = [...(allDiscrepancies ?? [])]
    .sort((a, b) => Math.abs(b.impact_cents) - Math.abs(a.impact_cents))
    .slice(0, 6)
    .map((d) => ({
      type: d.type as Discrepancy["type"],
      severity: d.severity as Discrepancy["severity"],
      orderKey: d.order_key,
      orderId: d.order_id,
      expectedCents: d.expected_cents,
      actualCents: d.actual_cents,
      impactCents: d.impact_cents,
    }));

  return (
    <>
      <div className="flex items-center justify-between border-b border-border bg-card px-7 py-3.5">
        <div>
          <h1 className="text-lg font-semibold">Reconciliation overview</h1>
          <p className="text-[12.5px] text-muted-foreground">
            {summary.totalOrders} orders · {summary.totalPayments} payments ·
            reconciled {formatRelativeTime(run.created_at)}
          </p>
        </div>
        <Link
          href="/imports/new"
          className="rounded-md bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground"
        >
          New import
        </Link>
      </div>

      <div className="flex flex-col gap-5 p-7">
        <HeadlineTiles summary={summary} />
        <div className="flex gap-4">
          <ImpactByTypeChart summary={summary} />
          <div className="flex-1">
            <SeverityDonut summary={summary} />
          </div>
        </div>
        <DiscrepancyPreviewTable
          rows={topDiscrepancies}
          totalCount={allDiscrepancies?.length ?? 0}
        />
      </div>
    </>
  );
}
