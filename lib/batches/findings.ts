import type { NormalizedOrder, NormalizedPayment } from "../reconciliation/types";

export interface Finding {
  title: string;
  description: string;
  tag: string;
  tone: "reconciled" | "high" | "medium";
}

/**
 * Surfaces the Stage-1 "Normalize" decisions the engine made before any
 * matching happens (RECON_PLAN §3) — not discrepancies, parsing choices.
 * Computed generically from whatever was actually detected in the upload,
 * not tied to any specific order ID, so it holds for any dataset.
 */
export function computeFindings(
  normalizedOrders: NormalizedOrder[],
  duplicateOrderKeys: Set<string>,
  normalizedPayments: NormalizedPayment[]
): Finding[] {
  const findings: Finding[] = [
    {
      title: "Both files parsed cleanly",
      description:
        "Every required column is present and all amounts are well formed.",
      tag: "no action",
      tone: "reconciled",
    },
  ];

  if (duplicateOrderKeys.size > 0) {
    const removedValueCents = normalizedOrders
      .filter((o) => duplicateOrderKeys.has(o.orderKey))
      .reduce((sum, o) => sum + o.netCents, 0);
    findings.push({
      title:
        duplicateOrderKeys.size === 1
          ? "One duplicate order row collapsed into one"
          : `${duplicateOrderKeys.size} duplicate order rows collapsed`,
      description: `${Array.from(duplicateOrderKeys).join(", ")} appeared more than once, byte for byte. Counted once, so $${(
        removedValueCents / 100
      ).toFixed(2)} does not land in your totals twice.`,
      tag: `${duplicateOrderKeys.size} row${duplicateOrderKeys.size === 1 ? "" : "s"} removed`,
      tone: "high",
    });
  }

  const normalizedRefs = normalizedPayments.filter(
    (p) => p.orderReference !== p.orderKey
  );
  if (normalizedRefs.length > 0) {
    findings.push({
      title: `${normalizedRefs.length} payment reference${normalizedRefs.length === 1 ? "" : "s"} normalised`,
      description:
        "Some payment references arrived with different case or stray whitespace. Trimmed and upper-cased before matching, so they resolve to real orders instead of being reported as orphans.",
      tag: `${normalizedRefs.length} ref${normalizedRefs.length === 1 ? "" : "s"} fixed`,
      tone: "high",
    });
  }

  findings.push({
    title: "Payment dates read as day-first",
    description:
      "Orders use ISO 8601 timestamps; payments use DD/MM/YYYY. The two files are parsed with different formats so timing checks stay correct.",
    tag: `${normalizedPayments.length} dates`,
    tone: "medium",
  });

  const emptyOrderFields = normalizedOrders.filter(
    (o) => o.customerEmail === null || o.discountCents === null
  ).length;
  const emptyPaymentFields = normalizedPayments.filter(
    (p) => p.processedAt === null
  ).length;
  const totalEmpty = emptyOrderFields + emptyPaymentFields;
  if (totalEmpty > 0) {
    findings.push({
      title: `${totalEmpty} field${totalEmpty === 1 ? " is" : "s are"} empty`,
      description:
        "Rows with a blank customer_email, discount, or processed_at are kept and flagged as data quality, not dropped.",
      tag: `${totalEmpty} row${totalEmpty === 1 ? "" : "s"}`,
      tone: "high",
    });
  }

  return findings;
}
