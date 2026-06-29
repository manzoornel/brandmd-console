-- ============================================================
-- Brand MD Solutions — Content Operations Console
-- Database schema for Supabase (PostgreSQL)
-- Run this once in: Supabase Dashboard -> SQL Editor -> New query
-- ============================================================

-- ---------- TABLES ----------

-- Doctors / clients whose content we produce
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'external' check (type in ('internal','external')),
  package text default '',
  youtube_channel text default '',
  ig_account text default '',
  fb_page text default '',
  quota_videos int not null default 0,
  quota_posters int not null default 0,
  self_approver boolean not null default false,
  price numeric not null default 0,
  package_id uuid,
  discount numeric not null default 0,
  follow_up_date date,
  follow_up_note text default '',
  created_at timestamptz not null default now()
);

-- Staff + admins + client-logins. Mirrors auth.users (1:1 by id).
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'editor'
    check (role in ('super_admin','admin','editor','writer','client')),
  roles text[] not null default '{}',
  client_id uuid references clients(id) on delete set null, -- only for role='client'
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- The videos moving through the pipeline
create table if not exists videos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  item_type text not null default 'video' check (item_type in ('video','poster')),
  brief text default '',
  due_date date,
  client_id uuid references clients(id) on delete set null,
  editor_id uuid references profiles(id) on delete set null,
  writer_id uuid references profiles(id) on delete set null,
  stage text not null default 'to_edit'
    check (stage in ('to_edit','review','content','published')),
  drive_link text default '',
  caption text default '',
  hashtags text default '',
  pinned_comment text default '',
  youtube_url text default '',
  instagram_url text default '',
  facebook_url text default '',
  yt_views int not null default 0,
  ig_views int not null default 0,
  fb_views int not null default 0,
  views_auto boolean not null default false,
  rejection_note text default '',
  approver_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  approved_at timestamptz,
  posted_at timestamptz
);

-- Per-task work timer (starts when a person opens a task to work)
create table if not exists task_time_logs (
  id uuid primary key default gen_random_uuid(),
  video_id uuid references videos(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  stage text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  seconds int
);

-- Attendance: clock-in on login, clock-out on button or idle auto-out
create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  work_date date not null default current_date,
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  auto_out boolean not null default false
);

-- ---------- HELPER FUNCTIONS (used by RLS) ----------

create or replace function auth_role()
returns text language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function auth_client_id()
returns uuid language sql stable security definer set search_path = public as $$
  select client_id from profiles where id = auth.uid()
$$;

create or replace function is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(auth_role() in ('super_admin','admin','editor','writer'), false)
$$;

create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(auth_role() in ('super_admin','admin'), false)
$$;

-- ---------- ROW LEVEL SECURITY ----------

alter table clients         enable row level security;
alter table profiles        enable row level security;
alter table videos          enable row level security;
alter table task_time_logs  enable row level security;
alter table attendance      enable row level security;

-- profiles
create policy "read own profile"      on profiles for select using (id = auth.uid());
create policy "admin read profiles"   on profiles for select using (is_admin());
create policy "admin write profiles"  on profiles for all    using (is_admin()) with check (is_admin());

-- clients
create policy "staff read clients"    on clients for select using (is_staff());
create policy "client reads own"      on clients for select using (id = auth_client_id());
create policy "admin write clients"   on clients for all    using (is_admin()) with check (is_admin());

-- videos
create policy "staff read videos"     on videos for select using (is_staff());
create policy "client reads own vids" on videos for select using (client_id = auth_client_id());
create policy "staff insert videos"   on videos for insert with check (auth_role() in ('super_admin','admin','editor'));
create policy "staff update videos"   on videos for update using (is_staff()) with check (is_staff());
create policy "admin delete videos"   on videos for delete using (is_admin());

-- task_time_logs
create policy "own time read"         on task_time_logs for select using (user_id = auth.uid());
create policy "admin time read"       on task_time_logs for select using (is_admin());
create policy "own time write"        on task_time_logs for all    using (user_id = auth.uid()) with check (user_id = auth.uid());

-- attendance
create policy "own attendance read"   on attendance for select using (user_id = auth.uid());
create policy "admin attendance read" on attendance for select using (is_admin());
create policy "own attendance write"  on attendance for all    using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- INDEXES ----------
create index if not exists idx_videos_stage   on videos(stage);
create index if not exists idx_videos_client  on videos(client_id);
create index if not exists idx_att_user_date  on attendance(user_id, work_date);
create index if not exists idx_ttl_video      on task_time_logs(video_id);

-- ---------- v2: roles[] helpers + client self-approval ----------
create or replace function my_roles()
returns text[] language sql stable security definer set search_path = public as $$
  select roles from profiles where id = auth.uid()
$$;
create or replace function has_role(r text)
returns boolean language sql stable security definer set search_path = public as $$
  select r = any(coalesce(my_roles(), '{}'))
$$;
-- redefine is_admin / is_staff to use roles[]
create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select has_role('super_admin') or has_role('admin')
$$;
create or replace function is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select has_role('super_admin') or has_role('admin')
      or has_role('editor') or has_role('writer') or has_role('designer')
$$;
drop policy if exists "client approve own vids" on videos;
create policy "client approve own vids" on videos for update
  using (client_id = auth_client_id()) with check (client_id = auth_client_id());

-- ---------- v3 r2: payments / accounts ----------
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  amount numeric not null default 0,
  note text default '',
  method text default '',
  paid_at timestamptz not null default now(),
  created_by uuid references profiles(id) on delete set null
);
alter table payments enable row level security;
drop policy if exists "admin all payments" on payments;
create policy "admin all payments" on payments for all using (is_admin()) with check (is_admin());
create index if not exists idx_payments_client on payments(client_id);


-- ---------- v3 r3b: packages catalog ----------
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
