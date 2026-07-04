-- Game Day Engagement System (PRD v5.3, T-93 / 6.12) — run once in the
-- Supabase SQL editor. Idempotent; safe to re-run.
--
-- engagement_log is the de-dup ledger: the unique constraint is what
-- actually enforces "don't send this twice" — touchdown_swing dedupes on
-- the exact score state (so an ESPN stat-correction reversal-then-recorrect
-- can't double-fire), lineup_lock and mission_complete dedupe once per
-- league/day. Detection itself lives in lib/engagementTriggers.ts, called
-- from the existing live-scores cron (10.2) — no new polling loop.

create table if not exists public.engagement_log (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  trigger_type text not null check (trigger_type in ('touchdown_swing', 'lineup_lock', 'mission_complete')),
  dedupe_key   text not null,
  sent_at      timestamptz not null default now(),
  unique (user_id, trigger_type, dedupe_key)
);

create index if not exists engagement_log_user_idx on public.engagement_log (user_id, trigger_type);

alter table public.engagement_log enable row level security;

drop policy if exists "Users can read own engagement log" on public.engagement_log;
create policy "Users can read own engagement log" on public.engagement_log
  for select using (auth.uid() = user_id);

drop policy if exists "Service role can manage engagement log" on public.engagement_log;
create policy "Service role can manage engagement log" on public.engagement_log
  for all using (auth.role() = 'service_role');

grant select on public.engagement_log to authenticated;
grant select, insert, update, delete on public.engagement_log to service_role;

-- pulse_items.type gets three new values for the triggers detection can
-- actually support today (team-level touchdown swing, lineup-lock
-- countdown, mission complete) — see PRD 6.12 for the full 7-trigger
-- taxonomy and lib/engagementTriggers.ts for which ones aren't buildable
-- yet and why.
alter table public.pulse_items drop constraint if exists pulse_items_type_check;
alter table public.pulse_items add constraint pulse_items_type_check check (type in (
  'lineup_decision', 'injury_alert', 'weather_alert', 'waiver_alert', 'trade_opportunity',
  'opponent_intel', 'deadline_reminder', 'exposure_flag',
  'touchdown_swing', 'lineup_lock', 'mission_complete'
));
