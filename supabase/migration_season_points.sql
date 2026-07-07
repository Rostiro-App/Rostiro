-- Real in-season fantasy points ingestion (T-148 sub-scope 1, PRD gap:
-- "ADP doesn't matter after week 2-3 when the real pecking order is shown
-- to the world") — run once in the Supabase SQL editor. Idempotent; safe
-- to re-run.
--
-- Backs lib/seasonPoints.ts. One row per (season, player) — season-to-date
-- totals recomputed from scratch on every cron run (see lib/seasonPoints.ts
-- for why: re-summing every completed week's real box score, rather than
-- incrementing a running total, is what lets a corrected/updated Sleeper
-- stat line for an earlier week ever actually take effect).
--
-- Scored with a standard, disclosed 1-PPR baseline (lib/seasonPoints.ts's
-- STANDARD_SCORING) — not any specific league's real ScoringSettings, same
-- generic-proxy posture ADP itself already has. Wiring a specific league's
-- real scoring into the Trade Analyzer's value model is T-148's separate,
-- not-yet-built sub-scope 2.

create table if not exists public.player_season_points (
  player_id       text not null,
  platform        text not null default 'sleeper',
  season          integer not null,
  weeks_included  integer not null default 0,
  games_played    integer not null default 0,
  total_points    numeric not null default 0,
  points_per_game numeric,
  updated_at      timestamptz not null default now(),
  primary key (player_id, platform, season)
);

alter table public.player_season_points enable row level security;

drop policy if exists "Authenticated users can read season points" on public.player_season_points;
create policy "Authenticated users can read season points" on public.player_season_points
  for select using (auth.role() = 'authenticated');

drop policy if exists "Service role can manage season points" on public.player_season_points;
create policy "Service role can manage season points" on public.player_season_points
  for all using (auth.role() = 'service_role');

grant select on public.player_season_points to authenticated;
grant select, insert, update, delete on public.player_season_points to service_role;
