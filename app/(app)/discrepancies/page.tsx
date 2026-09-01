"use client";

import { Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { DetailDrawer } from "@/components/discrepancies/detail-drawer";
import { DiscrepancyTable } from "@/components/discrepancies/discrepancy-table";
import { MultiSelectDropdown } from "@/components/discrepancies/multi-select-dropdown";
import { Pagination } from "@/components/shared/pagination";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import type { DiscrepanciesResponse, DiscrepancyRow } from "@/lib/discrepancies/types";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { RULE_DESCRIPTIONS } from "@/lib/reconciliation/rule-descriptions";
import type { DiscrepancyType } from "@/lib/reconciliation/types";

const SEVERITY_OPTIONS = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const TYPE_OPTIONS = (Object.keys(RULE_DESCRIPTIONS) as DiscrepancyType[]).map((type) => ({
  value: type,
  label: RULE_DESCRIPTIONS[type].label,
}));

const SORT_OPTIONS = [
  { value: "impact_desc", label: "Impact, high to low" },
  { value: "impact_asc", label: "Impact, low to high" },
  { value: "detected_desc", label: "Detected, newest first" },
  { value: "detected_asc", label: "Detected, oldest first" },
];

function buildQuery(params: {
  severity: string[];
  type: string[];
  q: string;
  sort: string;
  page: number;
  pageSize: number;
  exportAll?: boolean;
}): string {
  const search = new URLSearchParams();
  if (params.severity.length > 0) search.set("severity", params.severity.join(","));
  if (params.type.length > 0) search.set("type", params.type.join(","));
  if (params.q) search.set("q", params.q);
  search.set("sort", params.sort);
  if (params.exportAll) {
    search.set("export", "true");
  } else {
    search.set("page", String(params.page));
    search.set("pageSize", String(params.pageSize));
  }
  return search.toString();
}

function toCsv(rows: DiscrepancyRow[]): string {
  const header = [
    "severity",
    "type",
    "order_id",
    "order_key",
    "transaction_refs",
    "expected_cents",
    "actual_cents",
    "impact_cents",
    "detected_at",
  ];
  const lines = rows.map((r) =>
    [
      r.severity,
      r.type,
      r.order_id ?? "",
      r.order_key,
      r.transaction_refs.join("|"),
      r.expected_cents ?? "",
      r.actual_cents ?? "",
      r.impact_cents,
      r.created_at,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  return [header.join(","), ...lines].join("\n");
}

export default function DiscrepanciesPage() {
  // Seeded once from the URL on first render — this is what makes the
  // dashboard's chart clicks and headline-tile links (e.g.
  // /discrepancies?severity=critical,high) actually land on a filtered
  // view instead of silently opening the unfiltered table. Filters aren't
  // synced back to the URL as the user changes them (that's a separate,
  // bigger feature — bookmarkable/shareable filter state); this only
  // covers arriving with filters already applied.
  const searchParams = useSearchParams();
  const [severity, setSeverity] = useState<string[]>(
    () => searchParams.get("severity")?.split(",").filter(Boolean) ?? []
  );
  const [type, setType] = useState<string[]>(
    () => searchParams.get("type")?.split(",").filter(Boolean) ?? []
  );
  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const debouncedQ = useDebouncedValue(q, 300);
  const [sort, setSort] = useState(() => searchParams.get("sort") ?? "impact_desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [data, setData] = useState<DiscrepanciesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [bulkExplainProgress, setBulkExplainProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  // Fetches on every filter/sort/page change. The reset-then-fetch shape
  // is React's own documented data-fetching-in-effect pattern (react.dev/
  // learn/synchronizing-with-effects#fetching-data); the `cancelled` guard
  // prevents a stale response from a superseded request overwriting a
  // newer one.
  // Resets the page whenever the *debounced* search settles, not on every
  // keystroke — otherwise typing would race a page-1 fetch against the
  // still-in-flight debounce and cause a redundant request.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [debouncedQ]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    setError(null);
    fetch(`/api/discrepancies?${buildQuery({ severity, type, q: debouncedQ, sort, page, pageSize })}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load discrepancies.");
        return res.json();
      })
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [severity, type, debouncedQ, sort, page, pageSize]);

  function updateFilter<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  const updateSeverity = updateFilter(setSeverity);
  const updateType = updateFilter(setType);
  const updateSort = updateFilter(setSort);

  function updatePageSize(size: number) {
    setPageSize(size);
    setPage(1);
  }

  async function handleExport() {
    const res = await fetch(
      `/api/discrepancies?${buildQuery({ severity, type, q: debouncedQ, sort, page, pageSize, exportAll: true })}`
    );
    const body: DiscrepanciesResponse = await res.json();
    const csv = toCsv(body.rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "discrepancies.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleBulkExplain() {
    const ids = Array.from(selected);
    setBulkExplainProgress({ done: 0, total: ids.length });
    // Sequential, not parallel — this respects the per-user rate limit
    // (lib/llm/rate-limit.ts) instead of bursting past it, and keeps
    // progress readable as it goes.
    for (let i = 0; i < ids.length; i++) {
      await fetch(`/api/discrepancies/${ids[i]}/explain`, { method: "POST" }).catch(() => {});
      setBulkExplainProgress({ done: i + 1, total: ids.length });
    }
    setBulkExplainProgress(null);
    setSelected(new Set());
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!data) return;
    setSelected((prev) => {
      const allSelected = data.rows.every((r) => prev.has(r.id));
      if (allSelected) return new Set();
      return new Set(data.rows.map((r) => r.id));
    });
  }

  const hasFilters = severity.length > 0 || type.length > 0 || q.length > 0;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <div className="flex items-center justify-between border-b border-border bg-card px-7 py-3.5">
        <div>
          <h1 className="text-lg font-semibold">Discrepancies</h1>
          <p className="text-[12.5px] text-muted-foreground">
            {isLoading ? "Loading…" : `${data?.total ?? 0} matching current filters`}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExport}
            className="rounded-md border border-ring bg-white px-3.5 py-2 text-sm font-medium"
          >
            Export CSV
          </button>
          <button
            onClick={handleBulkExplain}
            disabled={selected.size === 0 || bulkExplainProgress !== null}
            className="rounded-md bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground"
          >
            {bulkExplainProgress
              ? `Explaining ${bulkExplainProgress.done}/${bulkExplainProgress.total}…`
              : `Explain ${selected.size > 0 ? selected.size : ""} selected`}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3.5 p-7">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex min-w-[220px] flex-1 max-w-[360px] items-center gap-2 rounded-md border border-border bg-white px-3 py-2">
            <Search size={13} className="text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search order ID or transaction ref"
              className="w-full text-[13px] outline-none"
            />
          </div>
          <MultiSelectDropdown
            label="Severity"
            allLabel="All"
            options={SEVERITY_OPTIONS}
            selected={severity}
            onChange={updateSeverity}
          />
          <MultiSelectDropdown
            label="Type"
            allLabel="All"
            options={TYPE_OPTIONS}
            selected={type}
            onChange={updateType}
          />
          <div className="flex-1" />
          <select
            value={sort}
            onChange={(e) => updateSort(e.target.value)}
            className="rounded-md border border-border bg-white px-3 py-2 text-[13px]"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Sort: {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-lg border border-border bg-card">
          {error && <p className="p-6 text-sm text-destructive">{error}</p>}
          {!error && isLoading && <TableSkeleton rows={pageSize > 20 ? 12 : pageSize} cols={9} />}
          {!error && !isLoading && data && data.rows.length === 0 && (
            <div className="flex flex-col items-center gap-2 p-12 text-center">
              <p className="text-sm font-semibold">
                {hasFilters
                  ? "No discrepancies match those filters"
                  : "No discrepancies in this run"}
              </p>
              <p className="text-[12.5px] text-muted-foreground">
                {hasFilters
                  ? "Try widening your severity or type filters, or clear your search."
                  : "Every order and payment matched cleanly."}
              </p>
              {hasFilters && (
                <button
                  onClick={() => {
                    setSeverity([]);
                    setType([]);
                    setQ("");
                  }}
                  className="mt-1 rounded-md border border-ring bg-white px-3.5 py-2 text-[13px] font-medium"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
          {!error && !isLoading && data && data.rows.length > 0 && (
            <>
              <DiscrepancyTable
                rows={data.rows}
                selected={selected}
                onToggleSelect={toggleSelect}
                onToggleSelectAll={toggleSelectAll}
                onOpenRow={(row) => setOpenId(row.id)}
              />
              <Pagination
                page={data.page}
                totalPages={totalPages}
                total={data.total}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={updatePageSize}
                itemLabel="discrepancies"
              />
            </>
          )}
        </div>
      </div>

      {openId && <DetailDrawer discrepancyId={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}
