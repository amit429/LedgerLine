const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  itemLabel?: string;
}

/** Windowed page numbers: always shows first/last, the current page and its
 * neighbors, with "…" filling gaps — never enumerates every page. */
function getPageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const keep = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...keep].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const result: (number | "…")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push("…");
    result.push(sorted[i]);
  }
  return result;
}

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemLabel = "results",
}: PaginationProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3.5">
      <div className="flex items-center gap-3 text-[12.5px] text-muted-foreground">
        <span>{total.toLocaleString("en-US")} {itemLabel}</span>
        <label className="flex items-center gap-1.5">
          Rows per page
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded border border-border bg-white px-1.5 py-1 text-[12px]"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded border border-border px-2.5 py-1 text-[12px] disabled:opacity-40"
        >
          Previous
        </button>
        {getPageWindow(page, totalPages).map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="px-1 text-[12px] text-muted-foreground">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              aria-current={p === page ? "page" : undefined}
              className={`min-w-[26px] rounded border px-2 py-1 text-[12px] ${
                p === page
                  ? "border-primary bg-primary font-semibold text-primary-foreground"
                  : "border-border hover:bg-secondary"
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded border border-border px-2.5 py-1 text-[12px] disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
