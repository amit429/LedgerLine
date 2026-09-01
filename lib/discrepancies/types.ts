import type { DiscrepancyType, Severity } from "@/lib/reconciliation/types";

/** Shape of a row as returned by GET /api/discrepancies (DB column names). */
export interface DiscrepancyRow {
  id: string;
  run_id: string;
  type: DiscrepancyType;
  severity: Severity;
  order_key: string;
  order_id: string | null;
  transaction_refs: string[];
  expected_cents: number | null;
  actual_cents: number | null;
  impact_cents: number;
  currency: string | null;
  details: Record<string, unknown>;
  llm_explanation: Record<string, unknown> | null;
  llm_generated_at: string | null;
  created_at: string;
}

export interface DiscrepanciesResponse {
  rows: DiscrepancyRow[];
  total: number;
  page: number;
  pageSize: number;
  runId: string | null;
}
