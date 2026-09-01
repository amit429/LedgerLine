"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { DetailDrawer } from "@/components/discrepancies/detail-drawer";
import { DiscrepancyTable } from "@/components/discrepancies/discrepancy-table";
import { MultiSelectDropdown } from "@/components/discrepancies/multi-select-dropdown";
import type { DiscrepanciesResponse, DiscrepancyRow } from "@/lib/discrepancies/types";
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
  const [severity, setSeverity] = useState<string[]>([]);
  const [type, setType] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("impact_desc");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<DiscrepanciesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);

  // Fetches on every filter/sort/page change. The reset-then-fetch shape
  // is React's own documented data-fetching-in-effect pattern (react.dev/
  // learn/synchronizing-with-effects#fetching-data); the `cancelled` guard
  // prevents a stale response from a superseded request overwriting a
  // newer one.
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    setError(null);
    fetch(`/api/discrepancies?${buildQuery({ severity, type, q, sort, page })}`)
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
  }, [severity, type, q, sort, page]);

  function updateFilter<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  const updateSeverity = updateFilter(setSeverity);
  const updateType = updateFilter(setType);
  const updateQ = updateFilter(setQ);
  const updateSort = updateFilter(setSort);

  async function handleExport() {
    const res = await fetch(
      `/api/discrepancies?${buildQuery({ severity, type, q, sort, page, exportAll: true })}`
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
            disabled
            title="LLM explanations arrive in a later phase"
            className="cursor-not-allowed rounded-md bg-secondary px-3.5 py-2 text-sm font-semibold text-muted-foreground"
          >
            Explain {selected.size > 0 ? selected.size : ""} selected
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3.5 p-7">
        <div className="flex items-center gap-2.5">
          <div className="flex flex-1 max-w-[360px] items-center gap-2 rounded-md border border-border bg-white px-3 py-2">
            <Search size={13} className="text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => updateQ(e.target.value)}
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
          {!error && data && data.rows.length === 0 && (
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
          {!error && data && data.rows.length > 0 && (
            <>
              <DiscrepancyTable
                rows={data.rows}
                selected={selected}
                onToggleSelect={toggleSelect}
                onToggleSelectAll={toggleSelectAll}
                onOpenRow={(row) => setOpenId(row.id)}
              />
              <div className="flex items-center justify-between border-t border-border px-5 py-3.5">
                <p className="text-[12.5px] text-muted-foreground">
                  Page {data.page} of {totalPages} · {selected.size} selected
                </p>
                <div className="flex gap-1.5">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded border border-border px-2.5 py-1 text-[12px] disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="rounded border border-border px-2.5 py-1 text-[12px] disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {openId && <DetailDrawer discrepancyId={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}
