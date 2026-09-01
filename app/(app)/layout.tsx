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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already redirects unauthenticated requests away from this
  // route group — this is the second, independent check at the page layer.
  if (!user) {
    redirect("/login");
  }

  // The latest *run*, not the latest batch — see getActiveBatchId's doc
  // comment. Joins import_batches for the label shown in the sidebar.
  const { data: run } = await supabase
    .from("reconciliation_runs")
    .select("summary, import_batches(label)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

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

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        activeImportLabel={activeImportLabel}
        userEmail={user.email ?? ""}
        openDiscrepancyCount={openDiscrepancyCount}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
