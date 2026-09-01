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

  const { data: batch } = await supabase
    .from("import_batches")
    .select("id, label")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let openDiscrepancyCount: number | undefined;
  if (batch) {
    const { data: run } = await supabase
      .from("reconciliation_runs")
      .select("summary")
      .eq("batch_id", batch.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (run) {
      const summary = run.summary as ReconSummary;
      openDiscrepancyCount = MONEY_AFFECTING_TYPES.reduce(
        (sum, type) => sum + (summary.byType[type]?.count ?? 0),
        0
      );
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        activeImportLabel={batch?.label ?? "No import yet"}
        userEmail={user.email ?? ""}
        openDiscrepancyCount={openDiscrepancyCount}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
