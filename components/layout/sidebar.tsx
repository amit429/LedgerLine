"use client";

import {
  AlertTriangle,
  LayoutDashboard,
  LogOut,
  Package,
  Receipt,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LocalDateTime } from "@/components/shared/local-datetime";
import { createClient } from "@/lib/supabase/client";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number }>;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Discrepancies", href: "/discrepancies", icon: AlertTriangle },
  { label: "Orders", href: "/orders", icon: Package },
  { label: "Payments", href: "/payments", icon: Receipt },
  { label: "Imports", href: "/imports", icon: UploadCloud },
];

// Module-level, not an inline object literal — see LocalDateTime's own
// comment on why `options` needs a stable reference across renders.
const ACTIVE_IMPORT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

interface SidebarProps {
  /** null when the user has no import yet. The date is rendered
   * separately from the label (see ActiveImport below) because it must
   * be formatted in the *viewer's* timezone, client-side — the label
   * itself deliberately carries no pre-baked date (see
   * app/api/batches/route.ts) since that was computed on Vercel's UTC
   * server clock and would silently show the wrong calendar day to
   * anyone in a timezone ahead of UTC for part of every day. */
  activeImport: { label: string; createdAt: string } | null;
  userEmail: string;
  userName: string | null;
  openDiscrepancyCount?: number;
}

function ActiveImport({ activeImport }: { activeImport: SidebarProps["activeImport"] }) {
  if (!activeImport) return <>No import yet</>;
  return (
    <>
      {activeImport.label} ·{" "}
      <LocalDateTime iso={activeImport.createdAt} options={ACTIVE_IMPORT_DATE_OPTIONS} />
    </>
  );
}

export function Sidebar({
  activeImport,
  userEmail,
  userName,
  openDiscrepancyCount,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const displayName = userName ?? userEmail.split("@")[0] ?? "Account";

  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      {/* Desktop sidebar. Below `lg` there isn't room for a fixed 248px
          rail without forcing horizontal scroll on the whole page, so it's
          replaced by the compact top nav below rather than shrunk in place.
          `sticky top-0 h-dvh` keeps it pinned to the viewport instead of
          scrolling away with long tables — only the content pane (see
          AppLayout) scrolls. */}
      <aside className="hidden w-[248px] flex-none flex-col bg-sidebar px-3.5 pt-5 pb-4.5 text-sidebar-foreground lg:sticky lg:top-0 lg:flex lg:h-dvh lg:overflow-y-auto">
        <div className="mb-5 flex items-center gap-2.5 pl-2">
          <span className="block h-6 w-6 rounded-[6.5px] bg-[var(--severity-reconciled)]" />
          <span className="text-[15.5px] font-semibold tracking-tight">
            Ledgerline
          </span>
        </div>

        <div className="mb-4.5 rounded-md border border-sidebar-border bg-sidebar-accent px-3 py-2.5">
          <p className="mb-0.5 text-[10.5px] text-white/60">Active import</p>
          <p className="text-[12.5px] font-medium text-white">
            <ActiveImport activeImport={activeImport} />
          </p>
        </div>

        <nav className="flex flex-col gap-0.5">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const isActive = pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px] ${
                  isActive
                    ? "bg-sidebar-accent font-semibold text-white"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <Icon size={16} />
                {label}
                {label === "Discrepancies" &&
                  !!openDiscrepancyCount &&
                  openDiscrepancyCount > 0 && (
                    <em className="ml-auto rounded-full bg-[var(--severity-critical)] px-1.75 py-0.5 text-[11px] font-semibold text-white not-italic">
                      {openDiscrepancyCount}
                    </em>
                  )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex items-center gap-2.5 border-t border-sidebar-border pt-3.5 pl-2">
          <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-sidebar-border text-[11px] font-semibold text-white">
            {displayName[0]?.toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-medium text-white">{displayName}</p>
            <p className="truncate text-[10.5px] text-white/60">{userEmail}</p>
          </div>
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            title="Sign out"
            aria-label="Sign out"
            className="flex h-7 w-7 flex-none items-center justify-center rounded-md text-white/60 hover:bg-sidebar-accent hover:text-white disabled:opacity-50"
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      {/* Mobile top nav: same links, horizontally scrollable instead of a
          fixed rail, so narrow viewports never force page-level horizontal
          scroll. Sticky so it stays put while the page below scrolls. */}
      <header className="sticky top-0 z-10 flex w-full flex-col bg-sidebar px-3 pt-3 pb-2 text-sidebar-foreground lg:hidden">
        <div className="mb-2 flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="block h-5 w-5 rounded-[5px] bg-[var(--severity-reconciled)]" />
            <span className="text-[14px] font-semibold tracking-tight">Ledgerline</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] text-white/60">
              <ActiveImport activeImport={activeImport} />
            </span>
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              title="Sign out"
              aria-label="Sign out"
              className="flex h-6 w-6 flex-none items-center justify-center rounded-md text-white/60 hover:bg-sidebar-accent hover:text-white disabled:opacity-50"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const isActive = pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-none items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] ${
                  isActive
                    ? "bg-sidebar-accent font-semibold text-white"
                    : "text-white/60"
                }`}
              >
                <Icon size={14} />
                {label}
                {label === "Discrepancies" &&
                  !!openDiscrepancyCount &&
                  openDiscrepancyCount > 0 && (
                    <em className="rounded-full bg-[var(--severity-critical)] px-1.5 py-0.5 text-[10px] font-semibold text-white not-italic">
                      {openDiscrepancyCount}
                    </em>
                  )}
              </Link>
            );
          })}
        </nav>
      </header>
    </>
  );
}
