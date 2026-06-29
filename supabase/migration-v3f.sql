-- Brand MD Console — v3 (Round 3D): Expenses, Assets, Partners (profit share). Safe on existing DB.
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'Other',
  amount numeric not null default 0,
  note text default '',
  spent_at date not null default current_date,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  value numeric not null default 0,
  acquired_at date not null default current_date,
  note text default '',
  created_at timestamptz not null default now()
);
create table if not exists partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  share_pct numeric not null default 0,
  created_at timestamptz not null default now()
);
alter table expenses enable row level security;
alter table assets   enable row level security;
alter table partners enable row level security;
drop policy if exists "admin all expenses" on expenses;
drop policy if exists "admin all assets" on assets;
drop policy if exists "admin all partners" on partners;
create policy "admin all expenses" on expenses for all using (is_admin()) with check (is_admin());
create policy "admin all assets"   on assets   for all using (is_admin()) with check (is_admin());
create policy "admin all partners" on partners for all using (is_admin()) with check (is_admin());
