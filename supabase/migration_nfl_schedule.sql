-- NFL schedule / kickoff data (PRD v5.2, T-79 prerequisite) — run once in the
-- Supabase SQL editor. Idempotent; safe to re-run.
--
-- Source: nflverse/nfldata games.csv (open, free, community-maintained,
-- https://github.com/nflverse/nfldata). Confirmed live July 3, 2026 with real
-- 2026 season data already published (272 games), including Week 1's
-- Wednesday-night Australia game — exactly the kind of schedule irregularity
-- Rostiro States (6.10) needs to key off actual kickoff times rather than a
-- fixed day-of-week assumption.
--
-- game_date/game_time_et are stored as nflverse provides them (gametime is
-- documented as always Eastern time, 24h, regardless of where the game is
-- actually played). kickoff_at is a generated column so Postgres's own tz
-- database — not hand-rolled JS date math — handles the EST/EDT transition
-- correctly across the season.

create table if not exists public.nfl_schedule (
  game_id      text primary key,
  season       integer not null,
  game_type    text not null,
  week         integer not null,
  game_date    date not null,
  game_time_et time not null,
  kickoff_at   timestamptz generated always as (
    (game_date::timestamp + game_time_et) at time zone 'America/New_York'
  ) stored,
  home_team    text not null,
  away_team    text not null,
  last_synced_at timestamptz not null default now()
);

create index if not exists nfl_schedule_kickoff_idx on public.nfl_schedule (kickoff_at);
create index if not exists nfl_schedule_season_week_idx on public.nfl_schedule (season, week);

alter table public.nfl_schedule enable row level security;

drop policy if exists "Authenticated users can read nfl schedule" on public.nfl_schedule;
create policy "Authenticated users can read nfl schedule" on public.nfl_schedule
  for select using (auth.role() = 'authenticated');

drop policy if exists "Service role can manage nfl schedule" on public.nfl_schedule;
create policy "Service role can manage nfl schedule" on public.nfl_schedule
  for all using (auth.role() = 'service_role');

grant select on public.nfl_schedule to authenticated;
grant select, insert, update, delete on public.nfl_schedule to service_role;
