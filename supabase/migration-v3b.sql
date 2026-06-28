-- Brand MD Console — v3 (Round 2): payments / accounts + follow-up.
-- Safe to run on existing DB.
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  amount numeric not null default 0,
  note text default '',
  paid_at timestamptz not null default now(),
  created_by uuid references profiles(id) on delete set null
);
alter table clients add column if not exists follow_up_date date;
alter table clients add column if not exists follow_up_note text default '';

alter table payments enable row level security;
drop policy if exists "admin all payments" on payments;
create policy "admin all payments" on payments for all using (is_admin()) with check (is_admin());

create index if not exists idx_payments_client on payments(client_id);
