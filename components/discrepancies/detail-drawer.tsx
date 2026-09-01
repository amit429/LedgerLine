"use client";

import { useEffect, useState } from "react";
import { RULE_DESCRIPTIONS } from "@/lib/reconciliation/rule-descriptions";
import type {
  DiscrepancyType,
  RawOrderRow,
  RawPaymentRow,
  Severity,
} from "@/lib/reconciliation/types";

interface DrawerData {
  discrepancy: {
    id: string;
    type: DiscrepancyType;
    severity: Severity;
    order_key: string;
    order_id: string | null;
    expected_cents: number | null;
    actual_cents: number | null;
    impact_cents: number;
  };
  order: RawOrderRow | null;
  payments: RawPaymentRow[];
}

const SEVERITY_PILL: Record<Severity, string> = {
  critical: "bg-[var(--severity-tint-critical)] text-[var(--severity-critical)]",
  high: "bg-[var(--severity-tint-high)] text-[var(--severity-high)]",
  medium: "bg-[var(--severity-tint-medium)] text-[var(--severity-medium)]",
  low: "bg-[var(--severity-tint-low)] text-[var(--severity-low)]",
};

function formatCents(cents: number | null): string {
  if (cents === null) return "—";
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

const ORDER_FIELDS: Array<{ key: keyof RawOrderRow; label: string }> = [
  { key: "order_id", label: "order_id" },
  { key: "order_date", label: "order_date" },
  { key: "customer_email", label: "customer_email" },
  { key: "currency", label: "currency" },
  { key: "net_amount", label: "net_amount" },
  { key: "status", label: "status" },
];

const PAYMENT_FIELDS: Array<{ key: keyof RawPaymentRow; label: string }> = [
  { key: "order_reference", label: "order_reference" },
  { key: "processed_at", label: "processed_at" },
  { key: "currency", label: "currency" },
  { key: "amount", label: "amount" },
  { key: "type", label: "type" },
  { key: "status", label: "status" },
];

export function DetailDrawer({
  discrepancyId,
  onClose,
}: {
  discrepancyId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<DrawerData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset-then-fetch on discrepancyId change — React's documented
  // data-fetching-in-effect pattern; `cancelled` guards against a stale
  // response overwriting a newer one if the user clicks another row fast.
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(null);
    setError(null);
    fetch(`/api/discrepancies/${discrepancyId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load this discrepancy.");
        return res.json();
      })
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [discrepancyId]);

  const rule = data ? RULE_DESCRIPTIONS[data.discrepancy.type] : null;
  // A field on the payment card is highlighted when the corresponding
  // order field disagrees with it — currency is the common case, but this
  // works for any pairable field.
  const currencyDiffers =
    data?.order && data.payments[0] && data.order.currency !== data.payments[0].currency;

  return (
    <>
      <div className="fixed inset-0 z-20 bg-[rgba(16,20,28,.32)]" onClick={onClose} />
      <div className="fixed top-0 right-0 z-30 flex h-full w-[524px] flex-col overflow-y-auto bg-white shadow-2xl">
        {error && (
          <div className="p-6 text-sm text-destructive">{error}</div>
        )}
        {!data && !error && (
          <div className="flex flex-1 flex-col gap-3 p-6">
            <div className="h-5 w-32 animate-pulse rounded bg-secondary" />
            <div className="h-8 w-48 animate-pulse rounded bg-secondary" />
            <div className="h-24 w-full animate-pulse rounded bg-secondary" />
            <div className="h-40 w-full animate-pulse rounded bg-secondary" />
          </div>
        )}
        {data && rule && (
          <>
            <div className="border-b border-border px-6 py-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${SEVERITY_PILL[data.discrepancy.severity]}`}
                  >
                    {data.discrepancy.severity[0].toUpperCase() +
                      data.discrepancy.severity.slice(1)}
                  </span>
                  {rule.label}
                </div>
                <button onClick={onClose} className="text-[12px] text-muted-foreground">
                  Close
                </button>
              </div>
              <h2 className="mb-1.5 text-2xl font-semibold tracking-tight">
                {data.discrepancy.order_id ?? data.discrepancy.order_key}
              </h2>
              {data.order?.customer_email && (
                <p className="text-[12.5px] text-muted-foreground">
                  {data.order.customer_email}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between bg-[var(--severity-tint-critical)] px-6 py-4">
              <div>
                <p className="text-[12.5px] text-[var(--severity-critical)]">Money at risk</p>
                <p className="font-mono text-xl font-semibold text-[var(--severity-critical)]">
                  {formatCents(Math.abs(data.discrepancy.impact_cents))}
                </p>
              </div>
              <p className="max-w-[220px] text-right text-[12px] text-[var(--severity-critical)]">
                {rule.blurb}
              </p>
            </div>

            <div className="border-b border-border px-6 py-5">
              <h3 className="mb-3 text-[13px] font-semibold">The records, as imported</h3>
              <div className="flex gap-3">
                <div className="flex-1 rounded-md border border-border">
                  <div className="border-b border-border bg-secondary px-3 py-2 font-mono text-[11px] font-semibold">
                    orders.csv
                  </div>
                  {data.order ? (
                    ORDER_FIELDS.map(({ key, label }) => {
                      const order = data.order!;
                      return (
                        <div
                          key={key}
                          className={`flex items-center justify-between border-t border-border/60 px-3 py-2 text-[12px] first:border-t-0 ${
                            key === "currency" && currencyDiffers
                              ? "bg-[var(--severity-tint-critical)]"
                              : ""
                          }`}
                        >
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-mono font-medium">
                            {String(order[key] ?? "—")}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <p className="p-3 text-[12px] text-muted-foreground">
                      No matching order found.
                    </p>
                  )}
                </div>
                <div className="flex-1 rounded-md border border-border">
                  <div className="border-b border-border bg-secondary px-3 py-2 font-mono text-[11px] font-semibold">
                    payments.csv
                  </div>
                  {data.payments.length > 0 ? (
                    data.payments.map((payment, i) => (
                      <div key={i} className={i > 0 ? "border-t border-border" : ""}>
                        {PAYMENT_FIELDS.map(({ key, label }) => (
                          <div
                            key={key}
                            className={`flex items-center justify-between border-t border-border/60 px-3 py-2 text-[12px] first:border-t-0 ${
                              key === "currency" && currencyDiffers
                                ? "bg-[var(--severity-tint-critical)]"
                                : ""
                            }`}
                          >
                            <span className="text-muted-foreground">{label}</span>
                            <span className="font-mono font-medium">
                              {String(payment[key] ?? "—")}
                            </span>
                          </div>
                        ))}
                      </div>
                    ))
                  ) : (
                    <p className="p-3 text-[12px] text-muted-foreground">No payment found.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="border-b border-border px-6 py-5">
              <h3 className="mb-3 text-[13px] font-semibold">Rule that flagged it</h3>
              <div className="mb-3 rounded-md bg-primary px-3.5 py-3 font-mono text-[12px] text-primary-foreground">
                <p className="mb-1 font-semibold">{data.discrepancy.type}</p>
                <p className="text-white/70">{rule.condition}</p>
              </div>
              <p className="text-[12.5px] leading-[19px] text-muted-foreground">
                {rule.blurb}.
              </p>
            </div>

            <div className="flex-1 border-b border-border px-6 py-5">
              <h3 className="mb-2 text-[13px] font-semibold">Explanation</h3>
              <p className="text-[12.5px] leading-[19px] text-muted-foreground">
                Plain-language explanations arrive in a later phase — this
                deterministic record is already final and won&apos;t change
                once that&apos;s wired up.
              </p>
            </div>

            <div className="sticky bottom-0 flex items-center gap-2.5 border-t border-border bg-white px-6 py-4">
              <button
                disabled
                title="Not persisted in this version — see README for what a resolution workflow would need"
                className="cursor-not-allowed rounded-md bg-secondary px-3.5 py-2 text-[13px] font-semibold text-muted-foreground"
              >
                Mark as resolved
              </button>
              <button
                disabled
                className="cursor-not-allowed rounded-md border border-border bg-white px-3.5 py-2 text-[13px] font-medium text-muted-foreground"
              >
                Add note
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
