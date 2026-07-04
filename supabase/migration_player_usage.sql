-- Weekly snap-count/usage ingestion (T-87, PRD 5.7) — run once in the
-- Supabase SQL editor. Idempotent; safe to re-run.
--
-- Backs lib/nflverseUsage.ts. One row per (season, week, player) — player_id
-- is always the resolved Sleeper id (see lib/nflverseUsage.ts's comment on
-- the pfr_id -> gsis_id -> sleeper_id join), never nflverse's own ids, so
-- every consumer looks this up the same way they already look up
-- players_cache. Powers T-95's Film Room usage deltas and T-88's ESPN
-- projections parity check.

create table if not exists public.player_usage_snapshots (
  season         integer not null,
  week           integer not null,
  player_id      text not null,
  position       text,
  team           text,
  opponent       text,
  offense_snaps  integer not null default 0,
  offense_pct    numeric,
  defense_snaps  integer not null default 0,
  defense_pct    numeric,
  st_snaps       integer not null default 0,
  st_pct         numeric,
  updated_at     timestamptz not null default now(),
  primary key (season, week, player_id)
);

alter table public.player_usage_snapshots enable row level security;

drop policy if exists "Authenticated users can read player usage" on public.player_usage_snapshots;
create policy "Authenticated users can read player usage" on public.player_usage_snapshots
  for select using (auth.role() = 'authenticated');

drop policy if exists "Service role can manage player usage" on public.player_usage_snapshots;
create policy "Service role can manage player usage" on public.player_usage_snapshots
  for all using (auth.role() = 'service_role');

grant select on public.player_usage_snapshots to authenticated;
grant select, insert, update, delete on public.player_usage_snapshots to service_role;

create index if not exists idx_player_usage_player on public.player_usage_snapshots (player_id, season, week desc);
