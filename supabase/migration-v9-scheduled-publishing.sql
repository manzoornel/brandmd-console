-- Apply BEFORE deploying the Scheduled UI. Existing rows/files are untouched.
begin;
select set_config('brandmd.before_schedule',
  md5(coalesce(string_agg((to_jsonb(v) - 'scheduled_publish_at' - 'posting_prepared_at' - 'publication_source')::text, '' order by id),'')), true) from public.videos v;
create extension if not exists pg_cron with schema pg_catalog;
alter table public.videos add column if not exists scheduled_publish_at timestamptz;
alter table public.videos add column if not exists posting_prepared_at timestamptz;
alter table public.videos add column if not exists publication_source text;
alter table public.videos drop constraint if exists videos_stage_check;
alter table public.videos add constraint videos_stage_check
  check (stage in ('to_edit','review','content','scheduled','published'));
alter table public.videos drop constraint if exists videos_scheduled_time_check;
alter table public.videos add constraint videos_scheduled_time_check
  check (stage <> 'scheduled' or (scheduled_publish_at is not null and posted_at is null and item_type <> 'shoot'));
create index if not exists idx_videos_due_publication on public.videos(scheduled_publish_at) where stage = 'scheduled';

-- Runs without an open browser. Atomic update + event ensures retries cannot
-- duplicate publication; a delayed run retains the intended publication time.
create or replace function public.release_scheduled_content()
returns void language sql security definer set search_path = '' as $$
  with released as (
    update public.videos set stage = 'published', posted_at = scheduled_publish_at,
      current_stage_entered_at = scheduled_publish_at, last_saved_at = now(),
      publication_source = 'scheduled_time_unverified'
    where stage = 'scheduled' and scheduled_publish_at <= now()
    returning id, writer_id, scheduled_publish_at
  )
  insert into public.activity_events(user_id, video_id, event_type, metadata)
  select writer_id, id, 'stage_transition', jsonb_build_object(
    'from_stage','scheduled','to_stage','published','automatic',true,
    'scheduled_for',scheduled_publish_at,'platform_verified',false)
  from released;
$$;
revoke all on function public.release_scheduled_content() from public, anon, authenticated;
select cron.schedule('brandmd-release-scheduled-content', '* * * * *',
  'select public.release_scheduled_content();');
do $$
declare after_rows bigint; after_digest text;
begin
  select count(*), md5(coalesce(string_agg((to_jsonb(v) - 'scheduled_publish_at' - 'posting_prepared_at' - 'publication_source')::text, '' order by id),'')) into after_rows, after_digest from public.videos v;
  if current_setting('brandmd.before_schedule') <> after_digest then
    raise exception 'Existing video data changed; migration rolled back';
  end if;
end $$;
commit;

-- Verify after deployment (read-only):
-- select jobid, jobname, schedule, active from cron.job where jobname='brandmd-release-scheduled-content';
-- select status, return_message, start_time from cron.job_run_details
-- where jobid=(select jobid from cron.job where jobname='brandmd-release-scheduled-content') order by start_time desc limit 5;
