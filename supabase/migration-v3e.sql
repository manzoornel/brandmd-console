-- Brand MD Console — v3 (Round 3C): Shooting type + Videographer role + Firm/hospital hierarchy.
-- Safe on existing DB.

-- 1) allow 'shoot' as an item type
alter table videos drop constraint if exists videos_item_type_check;
alter table videos add constraint videos_item_type_check check (item_type in ('video','poster','shoot'));

-- 2) staff helper + insert policy include the new 'shooter' role
create or replace function is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select has_role('super_admin') or has_role('admin') or has_role('editor')
      or has_role('writer') or has_role('designer') or has_role('shooter')
$$;
drop policy if exists "staff insert videos" on videos;
create policy "staff insert videos" on videos for insert with check (
  has_role('super_admin') or has_role('admin') or has_role('editor')
  or has_role('designer') or has_role('shooter')
);

-- 3) firm / hospital hierarchy on clients
alter table clients add column if not exists parent_id uuid references clients(id) on delete set null;
alter table clients add column if not exists is_firm boolean not null default false;

-- 4) firm login can read its sub-doctors' videos
drop policy if exists "client reads firm vids" on videos;
create policy "client reads firm vids" on videos for select using (
  client_id in (select id from clients where parent_id = auth_client_id())
);
