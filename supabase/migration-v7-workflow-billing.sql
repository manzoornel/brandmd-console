-- BrandMD v7: clean shoot handoff, assignment audit, and monthly invoices.
-- Additive only: existing records are preserved.

alter table videos add column if not exists expected_topic_count int;
alter table videos add column if not exists source_shoot_id uuid references videos(id) on delete set null;
alter table videos add column if not exists reassignment_reason text default '';
alter table videos add column if not exists reassigned_at timestamptz;
alter table videos add column if not exists reassigned_by uuid references profiles(id) on delete set null;

create table if not exists assignment_transfers (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references videos(id) on delete cascade,
  from_user_id uuid references profiles(id) on delete set null,
  to_user_id uuid references profiles(id) on delete set null,
  reason text not null,
  transferred_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null default 'draft' check (status in ('draft','sent','part_paid','paid','void')),
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  generated_at timestamptz not null default now(),
  generated_by uuid references profiles(id) on delete set null,
  unique(client_id, period_start, period_end)
);

create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  video_id uuid references videos(id) on delete set null,
  description text not null,
  quantity numeric(8,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0
);

alter table assignment_transfers enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
create policy "admin assignment transfer access" on assignment_transfers for all using (is_admin()) with check (is_admin());
create policy "staff read assignment transfers" on assignment_transfers for select using (is_staff());
create policy "admin invoice access" on invoices for all using (is_admin()) with check (is_admin());
create policy "client invoice read" on invoices for select using (client_id = (select client_id from profiles where id = auth.uid()));
create policy "admin invoice item access" on invoice_items for all using (is_admin()) with check (is_admin());
create policy "client invoice item read" on invoice_items for select using (invoice_id in (select id from invoices where client_id = (select client_id from profiles where id = auth.uid())));

create index if not exists idx_videos_source_shoot on videos(source_shoot_id);
create index if not exists idx_assignment_transfers_video on assignment_transfers(video_id, created_at);
create index if not exists idx_invoices_client_period on invoices(client_id, period_start);
create index if not exists idx_invoice_items_invoice on invoice_items(invoice_id);
