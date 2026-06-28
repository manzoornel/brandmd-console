-- ============================================================
-- Brand MD Console — v2 update
-- Run once in Supabase -> SQL Editor -> New query -> Run
-- Safe to run on your existing database (won't delete anything).
-- ============================================================

-- 1) Multiple roles per user
alter table profiles add column if not exists roles text[] not null default '{}';
update profiles set roles = array[role]
  where (roles = '{}' or roles is null) and role is not null;

-- 2) Content type (video / poster) + an editing brief
alter table videos add column if not exists item_type text not null default 'video'
  check (item_type in ('video','poster'));
alter table videos add column if not exists brief text default '';

-- 3) Doctor packages + self-approval
alter table clients add column if not exists quota_videos  int not null default 0;
alter table clients add column if not exists quota_posters int not null default 0;
alter table clients add column if not exists self_approver boolean not null default false;

-- 4) Permission helpers now read the roles[] array
create or replace function my_roles()
returns text[] language sql stable security definer set search_path = public as $$
  select roles from profiles where id = auth.uid()
$$;

create or replace function has_role(r text)
returns boolean language sql stable security definer set search_path = public as $$
  select r = any(coalesce(my_roles(), '{}'))
$$;

create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select has_role('super_admin') or has_role('admin')
$$;

create or replace function is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select has_role('super_admin') or has_role('admin')
      or has_role('editor') or has_role('writer') or has_role('designer')
$$;

-- 5) Let a doctor (client login) approve their own content
drop policy if exists "client approve own vids" on videos;
create policy "client approve own vids" on videos for update
  using (client_id = auth_client_id()) with check (client_id = auth_client_id());

-- 6) Designers can also create items
drop policy if exists "staff insert videos" on videos;
create policy "staff insert videos" on videos for insert with check (
  has_role('super_admin') or has_role('admin') or has_role('editor') or has_role('designer')
);
