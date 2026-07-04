-- Scalability baseline: per-platform API observability + circuit breakers
-- (T-84, PRD 10.1) — run once in the Supabase SQL editor. Idempotent;
-- safe to re-run.
--
-- Backs lib/observability.ts. api_call_log is an append-only latency/
-- success ledger per platform (Sleeper/ESPN/Yahoo/Claude) — "API latency
-- per platform... failed-sync count" from 10.1's observability list.
-- circuit_breaker_state is one row per platform: consecutive_failures
-- resets to 0 on any success, and opened_until is set once failures cross
-- the threshold — "if Yahoo is erroring, stop hammering it and serve
-- cache" from the same section, made concrete.

create table if not exists public.api_call_log (
  id          uuid primary key default gen_random_uuid(),
  platform    text not null check (platform in ('sleeper', 'espn', 'yahoo', 'claude')),
  path        text not null,
  latency_ms  integer not null,
  success     boolean not null,
  status_code integer,
  created_at  timestamptz not null default now()
);

alter table public.api_call_log enable row level security;

drop policy if exists "Service role can manage api call log" on public.api_call_log;
create policy "Service role can manage api call log" on public.api_call_log
  for all using (auth.role() = 'service_role');

grant select, insert on public.api_call_log to service_role;

create index if not exists idx_api_call_log_platform_time on public.api_call_log (platform, created_at desc);

create table if not exists public.circuit_breaker_state (
  platform            text primary key check (platform in ('sleeper', 'espn', 'yahoo', 'claude')),
  consecutive_failures integer not null default 0,
  opened_until        timestamptz,
  updated_at          timestamptz not null default now()
);

alter table public.circuit_breaker_state enable row level security;

drop policy if exists "Service role can manage circuit breaker state" on public.circuit_breaker_state;
create policy "Service role can manage circuit breaker state" on public.circuit_breaker_state
  for all using (auth.role() = 'service_role');

grant select, insert, update on public.circuit_breaker_state to service_role;

-- api_call_log grows without bound otherwise — old rows are just
-- diagnostic history, not something any code path reads far back into.
-- Not wired to a cron; cheap enough to run manually/ad hoc for now at
-- current scale, revisit if this table ever needs a real retention job.
