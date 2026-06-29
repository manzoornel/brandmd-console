-- Brand MD Console — v3 (Round 3B): reusable Packages catalog. Safe on existing DB.
create table if not exists packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric not null default 0,
  quota_videos int not null default 0,
  quota_posters int not null default 0,
  created_at timestamptz not null default now()
);
alter table packages enable row level security;
drop policy if exists "admin all packages" on packages;
create policy "admin all packages" on packages for all using (is_admin()) with check (is_admin());

alter table clients add column if not exists package_id uuid references packages(id) on delete set null;
alter table clients add column if not exists discount numeric not null default 0;
