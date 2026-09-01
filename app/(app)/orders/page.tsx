"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { OutcomePill } from "@/components/shared/outcome-pill";
import type { Outcome } from "@/lib/reconciliation/outcome";

interface OrderRow {
  id: string;
  order_id: string;
  order_date: string;
  customer_email: string | null;
  currency: string;
  gross_cents: number;
  discount_cents: number | null;
  net_cents: number;
  status: string;
  outcome: Outcome;
}

function formatCents(cents: number | null): string {
  if (cents === null) return "—";
  return (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function OrdersPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [outcome, setOutcome] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (status) search.set("status", status);
    if (outcome) search.set("outcome", outcome);
    search.set("page", String(page));
    fetch(`/api/orders?${search.toString()}`)
      .then((res) => res.json())
      .then((body) => {
        if (cancelled) return;
        setRows(body.rows ?? []);
        setTotal(body.total ?? 0);
        setPageSize(body.pageSize ?? 25);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q, status, outcome, page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <div className="flex items-center justify-between border-b border-border bg-card px-7 py-3.5">
        <div>
          <h1 className="text-lg font-semibold">Orders</h1>
          <p className="text-[12.5px] text-muted-foreground">
            {isLoading ? "Loading…" : `${total} orders`}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3.5 p-7">
        <div className="flex items-center gap-2.5">
          <div className="flex max-w-[360px] flex-1 items-center gap-2 rounded-md border border-border bg-white px-3 py-2">
            <Search size={13} className="text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search order ID or customer email"
              className="w-full text-[13px] outline-none"
            />
          </div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-border bg-white px-3 py-2 text-[13px]"
          >
            <option value="">Status: All</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
          </select>
          <select
            value={outcome}
            onChange={(e) => {
              setOutcome(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-border bg-white px-3 py-2 text-[13px]"
          >
            <option value="">Match: All outcomes</option>
            <option value="matched">Matched only</option>
            <option value="flagged">Flagged only</option>
          </select>
        </div>

        <div className="rounded-lg border border-border bg-card">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[12px] text-muted-foreground">
                <th className="px-5 py-2.5 font-medium">Order</th>
                <th className="px-3 py-2.5 font-medium">Order date</th>
                <th className="px-3 py-2.5 font-medium">Customer</th>
                <th className="px-3 py-2.5 font-medium">Cur</th>
                <th className="px-3 py-2.5 text-right font-medium">Gross</th>
                <th className="px-3 py-2.5 text-right font-medium">Discount</th>
                <th className="px-3 py-2.5 text-right font-medium">Net</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-5 py-2.5 font-medium">Reconciliation</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border/60">
                  <td className="px-5 py-3 font-mono">{row.order_id}</td>
                  <td className="px-3 py-3 text-muted-foreground">{formatDate(row.order_date)}</td>
                  <td className="px-3 py-3 font-mono text-muted-foreground">
                    {row.customer_email ?? "—"}
                  </td>
                  <td className="px-3 py-3">{row.currency}</td>
                  <td className="px-3 py-3 text-right font-mono">{formatCents(row.gross_cents)}</td>
                  <td className="px-3 py-3 text-right font-mono">{formatCents(row.discount_cents)}</td>
                  <td className="px-3 py-3 text-right font-mono">{formatCents(row.net_cents)}</td>
                  <td className="px-3 py-3 text-muted-foreground">{row.status}</td>
                  <td className="px-5 py-3">
                    <OutcomePill label={row.outcome.label} tone={row.outcome.tone} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!isLoading && rows.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No orders match your filters.
            </p>
          )}
          <div className="flex items-center justify-between border-t border-border px-5 py-3.5">
            <p className="text-[12.5px] text-muted-foreground">
              Page {page} of {totalPages}
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
        </div>
      </div>
    </>
  );
}
