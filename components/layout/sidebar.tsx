"use client";

import {
  AlertTriangle,
  LayoutDashboard,
  Package,
  Receipt,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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

interface SidebarProps {
  activeImportLabel: string;
  userEmail: string;
  openDiscrepancyCount?: number;
}

export function Sidebar({
  activeImportLabel,
  userEmail,
  openDiscrepancyCount,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar. Below `lg` there isn't room for a fixed 248px
          rail without forcing horizontal scroll on the whole page, so it's
          replaced by the compact top nav below rather than shrunk in place. */}
      <aside className="hidden w-[248px] flex-none flex-col bg-sidebar px-3.5 pt-5 pb-4.5 text-sidebar-foreground lg:flex">
        <div className="mb-5 flex items-center gap-2.5 pl-2">
          <span className="block h-6 w-6 rounded-[6.5px] bg-[var(--severity-reconciled)]" />
          <span className="text-[15.5px] font-semibold tracking-tight">
            Ledgerline
          </span>
        </div>

        <div className="mb-4.5 rounded-md border border-sidebar-border bg-sidebar-accent px-3 py-2.5">
          <p className="mb-0.5 text-[10.5px] text-white/60">Active import</p>
          <p className="text-[12.5px] font-medium text-white">
            {activeImportLabel}
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
          <span className="block h-7 w-7 flex-none rounded-full bg-sidebar-border" />
          <div>
            <p className="text-[12.5px] font-medium text-white">Revenue ops</p>
            <p className="text-[10.5px] text-white/60">{userEmail}</p>
          </div>
        </div>
      </aside>

      {/* Mobile top nav: same links, horizontally scrollable instead of a
          fixed rail, so narrow viewports never force page-level horizontal
          scroll. */}
      <header className="flex w-full flex-col bg-sidebar px-3 pt-3 pb-2 text-sidebar-foreground lg:hidden">
        <div className="mb-2 flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="block h-5 w-5 rounded-[5px] bg-[var(--severity-reconciled)]" />
            <span className="text-[14px] font-semibold tracking-tight">Ledgerline</span>
          </div>
          <span className="text-[11px] text-white/60">{activeImportLabel}</span>
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
