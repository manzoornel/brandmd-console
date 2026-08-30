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
