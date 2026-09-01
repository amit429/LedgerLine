function Pulse({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-secondary ${className ?? ""}`} />;
}

/** Skeleton rows matching a data table's shape, shown both on initial route
 * load (via loading.tsx) and during client-side refetches (filter/search/
 * page changes) so the table never silently shows stale rows while new
 * data is in flight. */
export function TableSkeleton({ rows = 8, cols = 7 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-[13px]">
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r} className="border-t border-border/60 first:border-t-0">
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c} className="px-5 py-3.5 first:pl-5 last:pr-5">
                  <Pulse className="h-3.5 w-full max-w-[130px]" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { Pulse };
