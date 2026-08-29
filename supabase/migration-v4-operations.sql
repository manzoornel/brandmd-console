-- BrandMD v4: video units, staff compensation, geofenced attendance and audit history.
-- Additive migration. Review and back up the production project before running.

alter table videos add column if not exists duration_seconds int
  check (duration_seconds is null or duration_seconds >= 0);
alter table videos add column if not exists calculated_units numeric(8,2)
  generated always as (
    case
      when item_type = 'video' and coalesce(duration_seconds, 0) > 0
        then ceil(duration_seconds::numeric / 180)
      when item_type in ('poster', 'shoot') then 1
      else 0
    end
  ) stored;
alter table videos add column if not exists approved_units numeric(8,2)
  check (approved_units is null or approved_units >= 0);
alter table videos add column if not exists unit_adjustment_note text default '';
alter table videos add column if not exists calculated_staff_units numeric(8,2)
  generated always as (
    case
      when item_type = 'video' and coalesce(duration_seconds, 0) > 0
        then 0.5 + (ceil(duration_seconds::numeric / 180) * 0.5)
      when item_type in ('poster', 'shoot') then 1
      else 0
    end
  ) stored;
alter table videos add column if not exists approved_staff_units numeric(8,2)
  check (approved_staff_units is null or approved_staff_units >= 0);
alter table videos add column if not exists staff_unit_adjustment_note text default '';

alter table clients add column if not exists video_unit_price numeric(12,2) not null default 1500;
alter table clients add column if not exists video_discount_percent numeric(5,2) not null default 0
  check (video_discount_percent between 0 and 100);

create table if not exists office_settings (
  id boolean primary key default true check (id),
  office_name text not null default 'BrandMD Office',
  latitude double precision not null default 10.875409126281738,
  longitude double precision not null default 75.89746856689453,
  radius_m int not null default 20 check (radius_m between 5 and 1000),
  minimum_gps_accuracy_m int not null default 50,
  shift_start time not null default '09:30',
  shift_end time not null default '17:00',
  grace_minutes int not null default 0,
  lunch_minutes int not null default 60,
  timezone text not null default 'Asia/Kolkata',
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id) on delete set null
);
insert into office_settings (id) values (true) on conflict (id) do nothing;

create table if not exists staff_compensation_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles(id) on delete cascade,
  base_salary numeric(12,2) not null default 0,
  monthly_video_unit_target numeric(8,2) not null default 0,
  video_unit_bonus_threshold numeric(8,2) not null default 0,
  extra_video_unit_rate numeric(12,2) not null default 0,
  monthly_post_target int not null default 0,
  post_bonus_threshold int not null default 0,
  missing_post_deduction numeric(12,2) not null default 0,
  extra_post_rate numeric(12,2) not null default 0,
  monthly_creative_target int not null default 0,
  missing_creative_deduction numeric(12,2) not null default 0,
  extra_creative_rate numeric(12,2) not null default 0,
  video_edit_rate numeric(12,2) not null default 0,
  general_duties_component numeric(12,2) not null default 0,
  active boolean not null default true,
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists attendance_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  event_type text not null check (event_type in ('clock_in','clock_out','lunch_out','lunch_in')),
  occurred_at timestamptz not null default now(),
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  distance_m double precision,
  location_verified boolean not null default false,
  source text not null default 'web',
  note text default '',
  created_at timestamptz not null default now()
);

create table if not exists sunday_duty_credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  duty_date date not null,
  status text not null default 'pending'
    check (status in ('pending','approved','used_as_leave','carried_forward','paid','rejected')),
  compensated_leave_date date,
  paid_amount numeric(12,2),
  approved_by uuid references profiles(id) on delete set null,
  approved_at timestamptz,
  note text default '',
  created_at timestamptz not null default now(),
  unique (user_id, duty_date)
);

create table if not exists activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  video_id uuid references videos(id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table office_settings enable row level security;
alter table staff_compensation_rules enable row level security;
alter table attendance_events enable row level security;
alter table sunday_duty_credits enable row level security;
alter table activity_events enable row level security;

drop policy if exists "staff read office settings" on office_settings;
drop policy if exists "admin manage office settings" on office_settings;
drop policy if exists "own compensation read" on staff_compensation_rules;
drop policy if exists "admin manage compensation" on staff_compensation_rules;
drop policy if exists "own attendance events read" on attendance_events;
drop policy if exists "own attendance events insert" on attendance_events;
drop policy if exists "admin manage attendance events" on attendance_events;
drop policy if exists "own sunday credits read" on sunday_duty_credits;
drop policy if exists "admin manage sunday credits" on sunday_duty_credits;
drop policy if exists "staff read activity events" on activity_events;
drop policy if exists "staff insert activity events" on activity_events;
drop policy if exists "admin manage activity events" on activity_events;

create policy "staff read office settings" on office_settings for select using (is_staff());
create policy "admin manage office settings" on office_settings for all using (is_admin()) with check (is_admin());
create policy "own compensation read" on staff_compensation_rules for select using (user_id = auth.uid() or is_admin());
create policy "admin manage compensation" on staff_compensation_rules for all using (is_admin()) with check (is_admin());
create policy "own attendance events read" on attendance_events for select using (user_id = auth.uid() or is_admin());
create policy "own attendance events insert" on attendance_events for insert with check (user_id = auth.uid());
create policy "admin manage attendance events" on attendance_events for all using (is_admin()) with check (is_admin());
create policy "own sunday credits read" on sunday_duty_credits for select using (user_id = auth.uid() or is_admin());
create policy "admin manage sunday credits" on sunday_duty_credits for all using (is_admin()) with check (is_admin());
create policy "staff read activity events" on activity_events for select using (is_staff());
create policy "staff insert activity events" on activity_events for insert with check (user_id = auth.uid());
create policy "admin manage activity events" on activity_events for all using (is_admin()) with check (is_admin());

create index if not exists idx_attendance_events_user_time on attendance_events(user_id, occurred_at);
create index if not exists idx_sunday_credits_user_date on sunday_duty_credits(user_id, duty_date);
create index if not exists idx_activity_events_video_time on activity_events(video_id, created_at);
create index if not exists idx_activity_events_user_time on activity_events(user_id, created_at);
