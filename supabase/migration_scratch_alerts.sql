-- T-163: Starter Scratch Alerts. Fresh per-player injury signal derived from
-- ESPN news headlines (15-min cron), feeding both the Pulse injury_alert card
-- (existing injury: fingerprint) and a Pro-gated push (engagement_log).

create table if not exists public.player_scratches (
  player_id    text not null,
  platform     text not null default 'sleeper',
  status       text not null check (status in ('out','doubtful','questionable')),
  confidence   text not null check (confidence in ('high','medium')),
  source       text not null default 'espn_news',
  news_id      text,
  headline     text,
  detected_at  timestamptz not null default now(),
  primary key (player_id, platform)
);
create index if not exists player_scratches_detected_idx on public.player_scratches (detected_at);

alter table public.player_scratches enable row level security;
-- Admin-written by cron; no client read path needed today. No policy = deny-all
-- to anon/authenticated, which is correct (T-154 lesson: RLS on with no policy
-- is deny-all — intended here, unlike the founder_feedback bug).

-- Per-type push preference (T-163 principle 4). Default on.
alter table public.users add column if not exists notify_scratches boolean not null default true;

-- REQUIRED: the trigger_type CHECK is hardcoded; without this, claimTrigger's
-- insert for the new type fails 23514 (which claimTrigger throws on, not 23505).
alter table public.engagement_log drop constraint if exists engagement_log_trigger_type_check;
alter table public.engagement_log add constraint engagement_log_trigger_type_check
  check (trigger_type in ('touchdown_swing','lineup_lock','mission_complete','starter_scratch'));
