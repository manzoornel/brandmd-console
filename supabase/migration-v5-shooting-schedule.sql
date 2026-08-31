-- BrandMD v5: shooting-day topic capture and doctor-approved publishing schedules.
alter table videos add column if not exists shoot_date date;
alter table videos add column if not exists scheduled_post_date date;
alter table videos add column if not exists schedule_status text not null default 'approved'
  check (schedule_status in ('draft','approved','rejected'));
alter table videos add column if not exists shooting_batch_id uuid;
alter table videos add column if not exists topic_order int;
alter table videos add column if not exists edit_lead_days int not null default 2;
alter table videos add column if not exists schedule_approved_at timestamptz;
alter table videos add column if not exists schedule_approved_by uuid references profiles(id) on delete set null;

create index if not exists idx_videos_shooting_batch on videos(shooting_batch_id, topic_order);
create index if not exists idx_videos_scheduled_post on videos(scheduled_post_date);

-- v6 content aims: clinic/banner owns the calendar; presenter can be a child doctor.
alter table clients add column if not exists posting_plan_mode text not null default 'monthly'
  check (posting_plan_mode in ('daily','weekly','monthly'));
alter table clients add column if not exists monthly_video_target int not null default 0;
alter table clients add column if not exists weekly_video_target int not null default 0;
alter table clients add column if not exists preferred_weekday int not null default 2
  check (preferred_weekday between 1 and 6);
alter table videos add column if not exists presenter_client_id uuid references clients(id) on delete set null;
create index if not exists idx_videos_presenter on videos(presenter_client_id);
-- BrandMD v5: shooting-day topic capture and doctor-approved publishing schedules.
alter table videos add column if not exists shoot_date date;
alter table videos add column if not exists scheduled_post_date date;
alter table videos add column if not exists schedule_status text not null default 'approved'
  check (schedule_status in ('draft','approved','rejected'));
alter table videos add column if not exists shooting_batch_id uuid;
alter table videos add column if not exists topic_order int;
alter table videos add column if not exists edit_lead_days int not null default 2;
alter table videos add column if not exists schedule_approved_at timestamptz;
alter table videos add column if not exists schedule_approved_by uuid references profiles(id) on delete set null;

create index if not exists idx_videos_shooting_batch on videos(shooting_batch_id, topic_order);
create index if not exists idx_videos_scheduled_post on videos(scheduled_post_date);
