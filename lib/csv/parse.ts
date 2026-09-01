import Papa from "papaparse";
import type { ZodType } from "zod";
import type { RawOrderRow, RawPaymentRow } from "../reconciliation/types";
import {
  ORDER_CSV_COLUMNS,
  OrderCsvRowSchema,
  PAYMENT_CSV_COLUMNS,
  PaymentCsvRowSchema,
} from "./schema";

export interface CsvParseResult<T> {
  rows: T[];
  errors: string[];
}

/**
 * Both source files use CRLF line endings; PapaParse handles that (and
 * quoted fields) correctly where a naive String.split("\n") would leave
 * trailing \r characters on every value.
 */
function parseRows<T>(
  csvText: string,
  columns: readonly string[],
  rowSchema: ZodType<T>
): CsvParseResult<T> {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const errors: string[] = result.errors.map(
    (e) => `${e.type} at row ${e.row}: ${e.message}`
  );

  const headerFields = result.meta.fields ?? [];
  const missingColumns = columns.filter((c) => !headerFields.includes(c));
  if (missingColumns.length > 0) {
    errors.push(`Missing required columns: ${missingColumns.join(", ")}`);
    return { rows: [], errors };
  }

  const rows: T[] = [];
  result.data.forEach((raw, index) => {
    const parsed = rowSchema.safeParse(raw);
    if (parsed.success && parsed.data) {
      rows.push(parsed.data);
    } else {
      const message = parsed.error?.issues.map((i) => i.message).join("; ");
      errors.push(`Row ${index + 2}: ${message}`);
    }
  });

  return { rows, errors };
}

export function parseOrdersCsv(csvText: string): CsvParseResult<RawOrderRow> {
  return parseRows<RawOrderRow>(csvText, ORDER_CSV_COLUMNS, OrderCsvRowSchema);
}

export function parsePaymentsCsv(
  csvText: string
): CsvParseResult<RawPaymentRow> {
  return parseRows<RawPaymentRow>(
    csvText,
    PAYMENT_CSV_COLUMNS,
    PaymentCsvRowSchema
  );
}
