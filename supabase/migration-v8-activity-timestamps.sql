-- Additive workflow timing fields. Existing production rows and timestamps are preserved.
alter table videos add column if not exists current_stage_entered_at timestamptz;
alter table videos add column if not exists last_saved_at timestamptz;

update videos
set current_stage_entered_at = case
  when stage = 'published' then coalesce(posted_at, approved_at, submitted_at, created_at)
  when stage = 'content' then coalesce(approved_at, submitted_at, created_at)
  when stage = 'review' then coalesce(submitted_at, created_at)
  else created_at
end
where current_stage_entered_at is null;

create index if not exists idx_videos_stage_entered on videos(stage, current_stage_entered_at);

