-- Live score cache (PRD v5.2, T-81 / 10.2 Game Day Architecture) — run once
-- in the Supabase SQL editor. Idempotent; safe to re-run.
--
-- One shared table, written by one cron job (lib/liveScores.ts), read by
-- every client. This is the whole point of 10.2: no client ever polls a
-- score provider directly — everyone reads this cache. game_id matches
-- nfl_schedule.game_id (nflverse's id format), not ESPN's own event id —
-- see lib/liveScores.ts for why (nflverse's own espn cross-reference column
-- is empty for future/2026 games, so matching is done by date+teams instead,
-- normalizing the two known team-code mismatches: LA/LAR, WAS/WSH).

create table if not exists public.live_scores (
  game_id      text primary key references public.nfl_schedule(game_id),
  home_score   integer not null default 0,
  away_score   integer not null default 0,
  period       integer not null default 0,
  display_clock text not null default '',
  status_state text not null check (status_state in ('pre', 'in', 'post')),
  last_synced_at timestamptz not null default now()
);

alter table public.live_scores enable row level security;

drop policy if exists "Authenticated users can read live scores" on public.live_scores;
create policy "Authenticated users can read live scores" on public.live_scores
  for select using (auth.role() = 'authenticated');

drop policy if exists "Service role can manage live scores" on public.live_scores;
create policy "Service role can manage live scores" on public.live_scores
  for all using (auth.role() = 'service_role');

grant select on public.live_scores to authenticated;
grant select, insert, update, delete on public.live_scores to service_role;
