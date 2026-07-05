-- Dev-only Simulation Suite (State x Mode x Plan x Trigger testing) — run
-- once in the Supabase SQL editor. Idempotent; safe to re-run.
--
-- DB-backed, not an env var or localStorage key — same reasoning
-- lib/featureFlags.ts already established: an env var needs a Vercel
-- redeploy to change, which fails the actual requirement (toggle instantly,
-- from the panel, no deploy). Single-row table (id is always 1) rather than
-- a per-user override — this is a solo-founder QA tool, not a per-user
-- feature.

create table if not exists public.sim_state (
  id             integer primary key default 1,
  is_active      boolean not null default false,
  sim_timestamp  timestamptz,
  forced_state   text check (forced_state in ('draft', 'standard', 'waiver_day', 'game_day', 'film_room')),
  -- Snapshot of any real row this session's scenarios temporarily mutated
  -- (e.g. a real starter's injury_status flipped to 'questionable' to
  -- exercise the real lock-countdown code path) — "clear simulation" reads
  -- this to restore exact original values rather than guessing a default.
  restore_json   jsonb not null default '[]',
  active_scenario text,
  updated_at     timestamptz not null default now(),
  constraint sim_state_singleton check (id = 1)
);

insert into public.sim_state (id) values (1) on conflict (id) do nothing;

alter table public.sim_state enable row level security;

drop policy if exists "Service role can manage sim state" on public.sim_state;
create policy "Service role can manage sim state" on public.sim_state
  for all using (auth.role() = 'service_role');

grant select, insert, update, delete on public.sim_state to service_role;

-- Fake nfl_schedule rows scenarios seed (e.g. an imminent kickoff to drive
-- the real lock-countdown code path) use this prefix so they can never
-- collide with a real nflverse game_id and are trivially identifiable/
-- cleanable.
comment on table public.sim_state is 'Dev-only simulation override singleton. Fake nfl_schedule rows this system seeds use game_id prefix SIM-.';
