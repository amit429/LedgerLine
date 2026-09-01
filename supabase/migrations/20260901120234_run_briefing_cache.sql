-- Caches the portfolio-level LLM briefing per run, mirroring the
-- discrepancies.llm_explanation / llm_generated_at pattern.
alter table reconciliation_runs
  add column llm_briefing jsonb,
  add column llm_briefing_generated_at timestamptz;
