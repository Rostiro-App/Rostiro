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
-- Global player injury signals — no per-user data — so authenticated users get a
-- role-level read (the Pulse card is built on-demand with the authenticated SSR
-- client via buildPulseItemsForUser; RLS-on with no policy would deny that read and
-- leave the in-app card silently empty). Mirrors the news_items read policy.
drop policy if exists "Authenticated users can read player scratches" on public.player_scratches;
create policy "Authenticated users can read player scratches" on public.player_scratches
  for select using (auth.role() = 'authenticated');

-- Per-type push preference (T-163 principle 4). Default on.
alter table public.users add column if not exists notify_scratches boolean not null default true;

-- REQUIRED: the trigger_type CHECK is hardcoded; without this, claimTrigger's
-- insert for the new type fails 23514 (which claimTrigger throws on, not 23505).
alter table public.engagement_log drop constraint if exists engagement_log_trigger_type_check;
alter table public.engagement_log add constraint engagement_log_trigger_type_check
  check (trigger_type in ('touchdown_swing','lineup_lock','mission_complete','starter_scratch'));
