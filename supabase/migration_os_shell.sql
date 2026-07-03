-- OS Shell migration (PRD v4.4, T-69) — run once in the Supabase SQL editor.
-- Also includes the still-outstanding queue_json column from T-64.1 (Draft
-- Copilot queue persistence) so one run catches everything up.

-- ─── T-64.1 (outstanding): Draft Copilot queue persistence ────────────────────
alter table public.draft_sessions
  add column if not exists queue_json jsonb not null default '[]';

-- ─── T-71: Mode persists to the users table (closes T-51) ─────────────────────
-- localStorage remains the pre-signup cache; once signed in, this column is
-- the source of truth so mode follows the user across devices.
alter table public.users
  add column if not exists mode text not null default 'balanced'
  check (mode in ('focused', 'balanced', 'savant'));

-- ─── T-69: Pulse persistence — fingerprint + lifecycle state ──────────────────
-- fingerprint: stable identity for a piece of intelligence (e.g.
-- "injury:<league>:<player>:<status>") so regeneration can tell "same item,
-- don't resurrect it if dismissed" from "new item, insert it".
alter table public.pulse_items
  add column if not exists fingerprint text,
  add column if not exists status text not null default 'open',
  add column if not exists snoozed_until timestamptz,
  add column if not exists completed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pulse_items_status_check'
  ) then
    alter table public.pulse_items
      add constraint pulse_items_status_check
      check (status in ('open', 'done', 'dismissed', 'snoozed'));
  end if;
end $$;

create unique index if not exists idx_pulse_items_user_fingerprint
  on public.pulse_items (user_id, fingerprint)
  where fingerprint is not null;

-- ─── T-69: Daily ADP snapshots ─────────────────────────────────────────────────
-- One row per player per day, written by the players cron. Powers the
-- "ADP movers" preseason Pulse card once a week of history exists —
-- cheap to collect now, impossible to backfill later.
create table if not exists public.adp_snapshots (
  snapshot_date date not null,
  player_id     text not null,
  platform      text not null check (platform in ('espn', 'yahoo', 'sleeper')),
  adp           numeric not null,
  primary key (snapshot_date, player_id, platform)
);

alter table public.adp_snapshots enable row level security;

drop policy if exists "Authenticated users can read adp snapshots" on public.adp_snapshots;
create policy "Authenticated users can read adp snapshots" on public.adp_snapshots
  for select using (auth.role() = 'authenticated');

drop policy if exists "Service role can manage adp snapshots" on public.adp_snapshots;
create policy "Service role can manage adp snapshots" on public.adp_snapshots
  for all using (auth.role() = 'service_role');

-- Table-level grants — RLS policies alone aren't enough; the API roles also
-- need Postgres privileges on the table (confirmed live: without these the
-- service role gets "permission denied for table adp_snapshots").
grant select on public.adp_snapshots to authenticated;
grant select, insert, update, delete on public.adp_snapshots to service_role;
