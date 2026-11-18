-- v10: Auto-publishing by the Hermes publisher (runs on the office PC).
-- Apply AFTER migration-v9. Existing rows are untouched (verified at the end).
--
-- Flow for clients with auto_publish = true:
--   review --(doctor approves)--> content
--   Hermes writes caption/hashtags/pinned comment/YouTube title, picks the
--   next free daily slot (default 19:00 IST) --> scheduled (publication_source='auto_pending')
--   Until the slot, staff can edit the text or "Return to Content & Posting" to hold it.
--   At the slot Hermes uploads to Facebook / Instagram / YouTube, saves the links
--   --> published (publication_source='auto_api').
--   The pg_cron job from v9 no longer touches auto-publish items, so an item is
--   only shown as Published after the platforms actually accepted it.
begin;
select set_config('brandmd.before_autopub',
  md5(coalesce(string_agg((to_jsonb(v))::text, '' order by id),'')), true) from public.videos v;

alter table public.clients add column if not exists auto_publish boolean not null default false;
alter table public.clients add column if not exists auto_publish_time time not null default '19:00';
alter table public.clients add column if not exists auto_publish_platforms text[] not null default '{facebook,instagram,youtube}';
alter table public.clients add column if not exists caption_style text not null default '';

alter table public.videos add column if not exists yt_title text not null default '';
alter table public.videos add column if not exists yt_description text not null default '';
alter table public.videos add column if not exists ai_prepared_at timestamptz;
alter table public.videos add column if not exists publish_locked_until timestamptz;
alter table public.videos add column if not exists publish_attempts int not null default 0;
alter table public.videos add column if not exists publish_error text not null default '';
alter table public.videos add column if not exists yt_video_id text not null default '';
alter table public.videos add column if not exists ig_media_id text not null default '';
alter table public.videos add column if not exists fb_video_id text not null default '';

-- Same job as v9, but auto-publish items are left for Hermes to publish and verify.
create or replace function public.release_scheduled_content()
returns void language sql security definer set search_path = '' as $$
  with released as (
    update public.videos v set stage = 'published', posted_at = v.scheduled_publish_at,
      current_stage_entered_at = v.scheduled_publish_at, last_saved_at = now(),
      publication_source = 'scheduled_time_unverified'
    where v.stage = 'scheduled' and v.scheduled_publish_at <= now()
      and coalesce(v.publication_source,'') <> 'auto_pending'
    returning v.id, v.writer_id, v.scheduled_publish_at
  )
  insert into public.activity_events(user_id, video_id, event_type, metadata)
  select writer_id, id, 'stage_transition', jsonb_build_object(
    'from_stage','scheduled','to_stage','published','automatic',true,
    'scheduled_for',scheduled_publish_at,'platform_verified',false)
  from released;
$$;
revoke all on function public.release_scheduled_content() from public, anon, authenticated;

create index if not exists idx_videos_auto_due on public.videos(scheduled_publish_at)
  where stage = 'scheduled' and publication_source = 'auto_pending';

do $$
declare after_digest text;
begin
  select md5(coalesce(string_agg((to_jsonb(v) - 'yt_title' - 'yt_description' - 'ai_prepared_at'
    - 'publish_locked_until' - 'publish_attempts' - 'publish_error' - 'yt_video_id'
    - 'ig_media_id' - 'fb_video_id')::text, '' order by id),'')) into after_digest from public.videos v;
  if current_setting('brandmd.before_autopub') <> after_digest then
    raise exception 'Existing video data changed; migration rolled back';
  end if;
end $$;
commit;

-- Turn it on for Doctor Uncle only (prototype). Check the name first:
--   select id, name, auto_publish from clients order by name;
-- update clients set auto_publish = true where name ilike '%doctor uncle%' and not is_firm;
