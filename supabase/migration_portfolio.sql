-- Portfolio data plumbing, no UI (T-86, PRD 13/10.3) — run once in the
-- Supabase SQL editor. Idempotent; safe to re-run.
--
-- Backs lib/portfolio.ts. "Roster grade" reuses the existing Health Score
-- rather than a separate formula (confirmed with the founder, July 4
-- 2026) — one row per (week_start, user_id, league_id). Exposure is
-- cross-league by design — one row per (week_start, user_id, player_id),
-- counting how many of that user's leagues roster that player, the same
-- concentration-risk idea already used by Health Score's own bye-week
-- factor, just tracked over time instead of computed fresh each time.
--
-- week_start is the Monday of the ISO week, computed the same way in
-- lib/usageLimits.ts's currentWeekStart() and here — not enforced by the
-- DB, just a convention every weekly feature in this codebase now shares.

create table if not exists public.portfolio_health_snapshots (
  week_start    date not null,
  user_id       uuid not null references public.users(id) on delete cascade,
  league_id     uuid not null references public.connected_leagues(id) on delete cascade,
  health_score  numeric,
  health_status text not null,
  created_at    timestamptz not null default now(),
  primary key (week_start, user_id, league_id)
);

alter table public.portfolio_health_snapshots enable row level security;

drop policy if exists "Users can read own health snapshots" on public.portfolio_health_snapshots;
create policy "Users can read own health snapshots" on public.portfolio_health_snapshots
  for select using (auth.uid() = user_id);

drop policy if exists "Service role can manage health snapshots" on public.portfolio_health_snapshots;
create policy "Service role can manage health snapshots" on public.portfolio_health_snapshots
  for all using (auth.role() = 'service_role');

grant select on public.portfolio_health_snapshots to authenticated;
grant select, insert, update, delete on public.portfolio_health_snapshots to service_role;

create table if not exists public.portfolio_exposure_snapshots (
  week_start   date not null,
  user_id      uuid not null references public.users(id) on delete cascade,
  player_id    text not null,
  league_count integer not null,
  created_at   timestamptz not null default now(),
  primary key (week_start, user_id, player_id)
);

alter table public.portfolio_exposure_snapshots enable row level security;

drop policy if exists "Users can read own exposure snapshots" on public.portfolio_exposure_snapshots;
create policy "Users can read own exposure snapshots" on public.portfolio_exposure_snapshots
  for select using (auth.uid() = user_id);

drop policy if exists "Service role can manage exposure snapshots" on public.portfolio_exposure_snapshots;
create policy "Service role can manage exposure snapshots" on public.portfolio_exposure_snapshots
  for all using (auth.role() = 'service_role');

grant select on public.portfolio_exposure_snapshots to authenticated;
grant select, insert, update, delete on public.portfolio_exposure_snapshots to service_role;
