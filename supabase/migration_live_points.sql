-- LIVE tab (T-111) — per-player live fantasy points cache. Run once in the
-- Supabase SQL editor. Idempotent; safe to re-run.
--
-- One row per (league, platform, week, roster) holding the roster's whole
-- players_points blob as of the last poll — cheaper than one row per
-- player, and diffing happens in application code the same way
-- live_scores/touchdown_swing already diff team-level scores poll to poll.

create table if not exists public.live_matchup_points (
  league_id     text not null,
  platform      text not null check (platform in ('sleeper', 'espn', 'yahoo')),
  week          integer not null,
  roster_id     text not null,
  players_points jsonb not null default '{}',
  updated_at    timestamptz not null default now(),
  primary key (league_id, platform, week, roster_id)
);

alter table public.live_matchup_points enable row level security;

drop policy if exists "Service role can manage live matchup points" on public.live_matchup_points;
create policy "Service role can manage live matchup points" on public.live_matchup_points
  for all using (auth.role() = 'service_role');

grant select, insert, update, delete on public.live_matchup_points to service_role;

-- Classified events (touchdown/reception/yardage/negative) the LIVE tab
-- polls for "did something just happen for one of my players" — a short-
-- lived feed, not a permanent log. league_row_id references
-- connected_leagues.id (not the raw platform league_id) so it's directly
-- joinable against a user's own rosters.
create table if not exists public.live_events (
  id            uuid primary key default gen_random_uuid(),
  league_row_id uuid not null references public.connected_leagues(id) on delete cascade,
  platform      text not null check (platform in ('sleeper', 'espn', 'yahoo')),
  player_id     text not null,
  event_type    text not null check (event_type in ('touchdown', 'reception', 'yardage', 'negative')),
  delta         numeric not null,
  created_at    timestamptz not null default now()
);

create index if not exists live_events_recent_idx on public.live_events (league_row_id, created_at desc);

alter table public.live_events enable row level security;

drop policy if exists "Users can read own league live events" on public.live_events;
create policy "Users can read own league live events" on public.live_events
  for select using (
    exists (
      select 1 from public.connected_leagues cl
      where cl.id = live_events.league_row_id and cl.user_id = auth.uid()
    )
  );

drop policy if exists "Service role can manage live events" on public.live_events;
create policy "Service role can manage live events" on public.live_events
  for all using (auth.role() = 'service_role');

grant select on public.live_events to authenticated;
grant select, insert, update, delete on public.live_events to service_role;

-- Adds window_recap to the existing pulse_items type list (migration_player_intel.sql
-- already added player_news/opportunity_surge).
alter table public.pulse_items drop constraint if exists pulse_items_type_check;
alter table public.pulse_items add constraint pulse_items_type_check check (type in (
  'lineup_decision', 'injury_alert', 'weather_alert', 'waiver_alert', 'trade_opportunity',
  'opponent_intel', 'deadline_reminder', 'exposure_flag',
  'touchdown_swing', 'lineup_lock', 'mission_complete',
  'roster_grade', 'player_news', 'opportunity_surge', 'window_recap'
));

-- Dedupe ledger for window recaps — one per (user, window) — same pattern
-- as engagement_log, kept separate since window_recap isn't a Game Day
-- Engagement System trigger (T-93) and engagement_log's own check
-- constraint is scoped to those three specifically.
create table if not exists public.window_recap_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  window_key text not null,
  sent_at    timestamptz not null default now(),
  unique (user_id, window_key)
);

alter table public.window_recap_log enable row level security;

drop policy if exists "Users can read own window recap log" on public.window_recap_log;
create policy "Users can read own window recap log" on public.window_recap_log
  for select using (auth.uid() = user_id);

drop policy if exists "Service role can manage window recap log" on public.window_recap_log;
create policy "Service role can manage window recap log" on public.window_recap_log
  for all using (auth.role() = 'service_role');

grant select on public.window_recap_log to authenticated;
grant select, insert, update, delete on public.window_recap_log to service_role;
