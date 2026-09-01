import Link from "next/link";

// Placeholder landing target for the authenticated app shell. Replaced by
// the real dashboard (headline tiles, charts, drill-down) in Phase 6.
export default function DashboardPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-sm text-muted-foreground">
      <p>Dashboard coming up next.</p>
      <Link
        href="/imports/new"
        className="rounded-md bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground"
      >
        Start an import
      </Link>
    </div>
  );
}
