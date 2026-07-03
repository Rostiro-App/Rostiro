-- Feature-flag framework (PRD v5.2, 10.1 Engineering Philosophy) — run once
-- in the Supabase SQL editor. Idempotent; safe to re-run.
--
-- Every expensive or new-and-risky feature must be toggleable without a
-- deploy. A DB-backed flag (not an env var) is what actually satisfies that —
-- env vars require a Vercel redeploy to change. lib/featureFlags.ts reads
-- this table with a short in-memory cache so it isn't a query per request.

create table if not exists public.feature_flags (
  key         text primary key,
  enabled     boolean not null default false,
  description text,
  updated_at  timestamptz not null default now()
);

alter table public.feature_flags enable row level security;

drop policy if exists "Authenticated users can read feature flags" on public.feature_flags;
create policy "Authenticated users can read feature flags" on public.feature_flags
  for select using (auth.role() = 'authenticated');

drop policy if exists "Service role can manage feature flags" on public.feature_flags;
create policy "Service role can manage feature flags" on public.feature_flags
  for all using (auth.role() = 'service_role');

grant select on public.feature_flags to authenticated;
grant select, insert, update, delete on public.feature_flags to service_role;

-- Seed the flags named in PRD 10.1. All default on except rostiro_states,
-- which ships behind an explicit flag per 6.10's own requirement (new logic
-- activating automatically for 100% of users on the highest-traffic day) —
-- flip it on once T-79/T-81 are ready to go live, not before.
insert into public.feature_flags (key, enabled, description) values
  ('ticker', true, 'Bottom ticker strip (ADP movers / waivers / injuries / live scores by season phase)'),
  ('draft_copilot', true, 'Live draft tracking + pre-fetched recommendations'),
  ('ai_pulse', true, 'Claude-generated Pulse item explanations'),
  ('live_scores', true, 'Live score polling and display (Game Day State, ticker)'),
  ('push_notifications', true, 'OneSignal push send pipeline'),
  ('rostiro_states', false, 'Automatic day/week-driven cockpit reconfiguration (PRD 6.10) — instant kill switch back to Standard State')
on conflict (key) do nothing;
