-- Row Level Security is the "users only see their own data" requirement,
-- enforced at the database rather than trusted to application code alone.
-- Every route handler also checks the session server-side first (401 if
-- absent) — RLS is the second, independent layer, not the only one.

alter table import_batches enable row level security;
alter table orders enable row level security;
alter table payments enable row level security;
alter table reconciliation_runs enable row level security;
alter table discrepancies enable row level security;

create policy "own rows" on import_batches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows" on orders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows" on payments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows" on reconciliation_runs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows" on discrepancies
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
