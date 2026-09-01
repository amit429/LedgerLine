import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { MONEY_AFFECTING_TYPES, type ReconSummary } from "@/lib/reconciliation/types";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // Both reads are RLS-scoped to the caller's session cookie independently
  // of each other, so they don't need to run in sequence — this halves the
  // round-trip latency this layout adds to every navigation within the
  // (app) route group (it can't be statically prefetched, since it reads
  // cookies() via createClient()).
  const [
    {
      data: { user },
    },
    { data: run },
  ] = await Promise.all([
    supabase.auth.getUser(),
    // The latest *run*, not the latest batch — see getActiveBatchId's doc
    // comment. Joins import_batches for the label shown in the sidebar.
    supabase
      .from("reconciliation_runs")
      .select("summary, import_batches(label)")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Middleware already redirects unauthenticated requests away from this
  // route group — this is the second, independent check at the page layer.
  if (!user) {
    redirect("/login");
  }

  let openDiscrepancyCount: number | undefined;
  let activeImportLabel = "No import yet";
  if (run) {
    const summary = run.summary as ReconSummary;
    openDiscrepancyCount = MONEY_AFFECTING_TYPES.reduce(
      (sum, type) => sum + (summary.byType[type]?.count ?? 0),
      0
    );
    const batchRelation = run.import_batches as
      | { label: string }
      | { label: string }[]
      | null;
    const batch = Array.isArray(batchRelation) ? batchRelation[0] : batchRelation;
    activeImportLabel = batch?.label ?? activeImportLabel;
  }

  const userName =
    typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()
      ? user.user_metadata.full_name.trim()
      : null;

  return (
    <div className="flex h-dvh flex-col bg-background lg:flex-row lg:overflow-hidden">
      <Sidebar
        activeImportLabel={activeImportLabel}
        userEmail={user.email ?? ""}
        userName={userName}
        openDiscrepancyCount={openDiscrepancyCount}
      />
      {/* Independent scroll region: the sidebar stays fixed to the
          viewport on desktop (lg:sticky below) instead of scrolling away
          with long tables. */}
      <div className="flex min-w-0 flex-1 flex-col lg:h-dvh lg:overflow-y-auto">{children}</div>
    </div>
  );
}
