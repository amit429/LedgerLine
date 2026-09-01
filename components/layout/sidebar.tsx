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
    <aside className="flex w-[248px] flex-none flex-col bg-sidebar px-3.5 pt-5 pb-4.5 text-sidebar-foreground">
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
  );
}
