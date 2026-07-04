-- IP-based rate limiting for unauthenticated routes (T-76, PRD Section 10)
-- — run once in the Supabase SQL editor. Idempotent; safe to re-run.
--
-- Backs lib/rateLimit.ts's checkRateLimit(). No Redis/Upstash provisioned
-- yet, and none of these routes see enough traffic to need one — a
-- Postgres upsert is the same pattern usage_counters already uses
-- (lib/usageLimits.ts), reusing infra instead of adding a new service.
-- Keyed by an arbitrary string (route name + IP), not a user id, since the
-- routes this protects are deliberately unauthenticated (Draft Kit).

create table if not exists public.rate_limit_events (
  rate_key     text not null,
  window_start timestamptz not null,
  count        integer not null default 0,
  primary key (rate_key, window_start)
);

alter table public.rate_limit_events enable row level security;

drop policy if exists "Service role can manage rate limits" on public.rate_limit_events;
create policy "Service role can manage rate limits" on public.rate_limit_events
  for all using (auth.role() = 'service_role');

grant select, insert, update, delete on public.rate_limit_events to service_role;

-- Old windows are write-only noise after they expire — trim anything over
-- a day old. Safe to run repeatedly; not wired to a cron, just cheap
-- enough to run inline before each check (see lib/rateLimit.ts).
