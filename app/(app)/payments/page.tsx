"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { OutcomePill } from "@/components/shared/outcome-pill";
import type { Outcome } from "@/lib/reconciliation/outcome";

interface PaymentRow {
  id: string;
  transaction_ref: string;
  processed_at: string | null;
  order_reference: string;
  type: string;
  amount_cents: number;
  fee_cents: number;
  net_settled_cents: number;
  status: string;
  outcome: Outcome;
}

function formatCents(cents: number | null): string {
  if (cents === null) return "—";
  return (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function PaymentsPage() {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (type) search.set("type", type);
    if (status) search.set("status", status);
    search.set("page", String(page));
    fetch(`/api/payments?${search.toString()}`)
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
  }, [q, type, status, page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <div className="flex items-center justify-between border-b border-border bg-card px-7 py-3.5">
        <div>
          <h1 className="text-lg font-semibold">Payments</h1>
          <p className="text-[12.5px] text-muted-foreground">
            {isLoading ? "Loading…" : `${total} transactions`}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3.5 p-7">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex max-w-[360px] flex-1 items-center gap-2 rounded-md border border-border bg-white px-3 py-2">
            <Search size={13} className="text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search transaction ref or order reference"
              className="w-full text-[13px] outline-none"
            />
          </div>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-border bg-white px-3 py-2 text-[13px]"
          >
            <option value="">Type: All</option>
            <option value="charge">Charge</option>
            <option value="refund">Refund</option>
          </select>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-border bg-white px-3 py-2 text-[13px]"
          >
            <option value="">Status: All</option>
            <option value="settled">Settled</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        <div className="rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-[13px]">
            <thead>
              <tr className="text-left text-[12px] text-muted-foreground">
                <th className="px-5 py-2.5 font-medium">Transaction</th>
                <th className="px-3 py-2.5 font-medium">Processed at</th>
                <th className="px-3 py-2.5 font-medium">Order ref</th>
                <th className="px-3 py-2.5 font-medium">Type</th>
                <th className="px-3 py-2.5 text-right font-medium">Amount</th>
                <th className="px-3 py-2.5 text-right font-medium">Fee</th>
                <th className="px-3 py-2.5 text-right font-medium">Net settled</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-5 py-2.5 font-medium">Reconciliation</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border/60">
                  <td className="px-5 py-3 font-mono">{row.transaction_ref}</td>
                  <td className="px-3 py-3 font-mono text-muted-foreground">
                    {formatDateTime(row.processed_at)}
                  </td>
                  <td
                    className={`px-3 py-3 font-mono ${
                      row.outcome.label === "Reference normalised"
                        ? "text-[var(--severity-high)]"
                        : ""
                    }`}
                  >
                    {row.order_reference}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{row.type}</td>
                  <td className="px-3 py-3 text-right font-mono">{formatCents(row.amount_cents)}</td>
                  <td className="px-3 py-3 text-right font-mono">{formatCents(row.fee_cents)}</td>
                  <td className="px-3 py-3 text-right font-mono">
                    {formatCents(row.net_settled_cents)}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{row.status}</td>
                  <td className="px-5 py-3">
                    <OutcomePill label={row.outcome.label} tone={row.outcome.tone} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {!isLoading && rows.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No payments match your filters.
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
