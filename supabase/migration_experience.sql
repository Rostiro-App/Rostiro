-- Experience Layer migration (PRD v4.5, T-72/T-73) — run once in the
-- Supabase SQL editor. Idempotent; safe to re-run.

-- ─── T-72: coach-mark / boot persistence ───────────────────────────────────────
-- Which hints (and the boot sequence) this user has dismissed, as a jsonb
-- array of hint ids. localStorage remains the per-device fast path.
alter table public.users
  add column if not exists seen_hints jsonb not null default '[]';

-- ─── T-73: daily injury-status snapshots ───────────────────────────────────────
-- One row per tagged player per day, written by the players cron. Powers
-- "designation changed" ticker/Pulse news in-season (Questionable → Out is
-- the story, not the standing status). Cheap to collect now, impossible to
-- backfill later — same reasoning as adp_snapshots. Only players with a
-- non-null status get rows; a player disappearing from the table = cleared.
create table if not exists public.injury_snapshots (
  snapshot_date  date not null,
  player_id      text not null,
  platform       text not null check (platform in ('espn', 'yahoo', 'sleeper')),
  injury_status  text not null,
  primary key (snapshot_date, player_id, platform)
);

alter table public.injury_snapshots enable row level security;

drop policy if exists "Authenticated users can read injury snapshots" on public.injury_snapshots;
create policy "Authenticated users can read injury snapshots" on public.injury_snapshots
  for select using (auth.role() = 'authenticated');

drop policy if exists "Service role can manage injury snapshots" on public.injury_snapshots;
create policy "Service role can manage injury snapshots" on public.injury_snapshots
  for all using (auth.role() = 'service_role');

-- Table-level grants — learned live on adp_snapshots: RLS policies alone
-- aren't enough, the API roles need Postgres privileges too.
grant select on public.injury_snapshots to authenticated;
grant select, insert, update, delete on public.injury_snapshots to service_role;
