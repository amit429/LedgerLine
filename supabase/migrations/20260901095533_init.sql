-- Core schema for reconciliation batches, runs, and discrepancies.
-- Column shapes and constraints follow RECON_PLAN.md §5.

create extension if not exists pgcrypto;

create table import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  orders_filename text not null,
  payments_filename text not null,
  orders_row_count integer not null default 0,
  payments_row_count integer not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'reconciled', 'failed')),
  created_at timestamptz not null default now()
);

create index import_batches_user_id_idx on import_batches (user_id);

-- order_id is the raw value as uploaded; order_key is trim().toUpperCase()
-- of order_id and is what every join/lookup uses. The unique constraint on
-- (batch_id, order_id, order_date, net_cents) is what a duplicate insert of
-- an identical row (e.g. ORD-1004) collides against, so an upsert with
-- ON CONFLICT DO NOTHING dedupes on ingest instead of double-counting.
create table orders (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references import_batches (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  order_id text not null,
  order_key text not null,
  order_date timestamptz not null,
  customer_email text,
  currency text not null,
  gross_cents bigint not null,
  discount_cents bigint,
  net_cents bigint not null,
  status text not null check (status in ('completed', 'cancelled', 'refunded')),
  raw jsonb not null,
  created_at timestamptz not null default now(),
  unique (batch_id, order_id, order_date, net_cents)
);

create index orders_batch_id_idx on orders (batch_id);
create index orders_user_id_idx on orders (user_id);
create index orders_order_key_idx on orders (batch_id, order_key);

-- order_reference is the raw value as uploaded on the payment row;
-- order_key is its normalized form, joined against orders.order_key.
create table payments (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references import_batches (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  transaction_ref text not null,
  processed_at timestamptz,
  order_reference text not null,
  order_key text not null,
  currency text not null,
  amount_cents bigint not null,
  fee_cents bigint not null,
  net_settled_cents bigint not null,
  type text not null check (type in ('charge', 'refund')),
  status text not null check (status in ('settled', 'failed', 'pending')),
  raw jsonb not null,
  created_at timestamptz not null default now(),
  unique (batch_id, transaction_ref)
);

create index payments_batch_id_idx on payments (batch_id);
create index payments_user_id_idx on payments (user_id);
create index payments_order_key_idx on payments (batch_id, order_key);

-- One row per reconciliation run. config + engine_version are persisted so
-- a run is reproducible as (batch, engine_version, config) -> result, even
-- after tolerances change in Settings.
create table reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references import_batches (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  config jsonb not null,
  engine_version text not null,
  summary jsonb not null,
  created_at timestamptz not null default now()
);

create index reconciliation_runs_batch_id_idx on reconciliation_runs (batch_id);
create index reconciliation_runs_user_id_idx on reconciliation_runs (user_id);

create table discrepancies (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references reconciliation_runs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  severity text not null check (severity in ('critical', 'high', 'medium', 'low')),
  order_key text not null,
  order_id text,
  transaction_refs text[] not null default '{}',
  expected_cents bigint,
  actual_cents bigint,
  impact_cents bigint not null default 0,
  currency text,
  details jsonb not null default '{}',
  llm_explanation jsonb,
  llm_generated_at timestamptz,
  created_at timestamptz not null default now()
);

create index discrepancies_run_id_idx on discrepancies (run_id);
create index discrepancies_user_id_idx on discrepancies (user_id);
create index discrepancies_type_idx on discrepancies (run_id, type);
create index discrepancies_severity_idx on discrepancies (run_id, severity);
