import type {
  NormalizedOrder,
  NormalizedPayment,
  RawOrderRow,
  RawPaymentRow,
} from "./types";

/** Join keys must survive case and whitespace noise (e.g. "ord-1801 "). */
export function normalizeKey(raw: string): string {
  return raw.trim().toUpperCase();
}

export function normalizeCurrency(raw: string): string {
  return raw.trim().toUpperCase();
}

/**
 * Converts a decimal string like "119.84" to integer cents (11984) by
 * splitting on the decimal point rather than multiplying a float by 100 —
 * `119.84 * 100` is 11984.000000000002 in JS. String math avoids the class
 * of bug entirely and keeps every downstream comparison exact.
 */
export function toCents(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  const negative = trimmed.startsWith("-");
  const abs = negative ? trimmed.slice(1) : trimmed;
  const [wholeRaw, fracRaw = ""] = abs.split(".");
  const whole = wholeRaw === "" ? "0" : wholeRaw;
  const frac = (fracRaw + "00").slice(0, 2);

  if (!/^\d+$/.test(whole) || !/^\d{2}$/.test(frac)) {
    throw new Error(`toCents: cannot parse amount "${raw}"`);
  }

  const cents = Number(whole) * 100 + Number(frac);
  return negative ? -cents : cents;
}

/** orders.csv dates are ISO "YYYY-MM-DD HH:MM:SS". Treated as UTC so parsing
 * is deterministic regardless of the runtime's local timezone. */
export function parseOrderDate(raw: string): Date {
  const iso = raw.trim().replace(" ", "T") + "Z";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`parseOrderDate: cannot parse "${raw}"`);
  }
  return date;
}

/**
 * payments.csv dates are day-first "DD/MM/YYYY HH:mm" (confirmed by rows
 * like 21/04/2025 and 30/04/2025). Never hand this string to `new Date()` —
 * it assumes US month-first ordering and would silently corrupt roughly
 * half the rows.
 */
export function parsePaymentDate(raw: string | null): Date | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  const match = trimmed.match(
    /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/
  );
  if (!match) {
    throw new Error(`parsePaymentDate: cannot parse "${raw}"`);
  }
  const [, day, month, year, hour, minute] = match;
  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute)
    )
  );
}

export function normalizeOrder(row: RawOrderRow): NormalizedOrder {
  return {
    orderId: row.order_id,
    orderKey: normalizeKey(row.order_id),
    orderDate: parseOrderDate(row.order_date),
    customerEmail: row.customer_email,
    currency: normalizeCurrency(row.currency),
    grossCents: toCents(row.gross_amount) ?? 0,
    discountCents: toCents(row.discount),
    netCents: toCents(row.net_amount) ?? 0,
    status: row.status,
    raw: row,
  };
}

export function normalizePayment(row: RawPaymentRow): NormalizedPayment {
  return {
    transactionRef: row.transaction_ref,
    processedAt: parsePaymentDate(row.processed_at),
    orderReference: row.order_reference,
    orderKey: normalizeKey(row.order_reference),
    currency: normalizeCurrency(row.currency),
    amountCents: toCents(row.amount) ?? 0,
    feeCents: toCents(row.fee) ?? 0,
    netSettledCents: toCents(row.net_settled) ?? 0,
    type: row.type,
    status: row.status,
    raw: row,
  };
}
