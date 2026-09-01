-- The duplicate-row dedupe happens at ingest time (before insert, since the
-- orders table's UNIQUE constraint can only ever hold one copy of an
-- identical row). That means the removed duplicate is gone by the time
-- reconcile() re-reads persisted rows, so it can never rediscover it to
-- emit a DUPLICATE_ORDER_ROW discrepancy on its own. Persisting the keys
-- detected at ingest is what lets reconcile still surface that flag.
alter table import_batches
  add column duplicate_order_keys text[] not null default '{}';
