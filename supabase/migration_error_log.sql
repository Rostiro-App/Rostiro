-- App error/uptime monitoring (T-138, PRD gap-analysis pass) — run once in
-- the Supabase SQL editor. Idempotent; safe to re-run.
--
-- Backs lib/errorLog.ts. Same posture as migration_observability.sql /
-- migration_rate_limit.sql: no Sentry/APM provisioned yet, so this is a
-- Postgres-backed record of real app-level errors (uncaught React render
-- crashes via app/global-error.tsx, and any route that opts into
-- logAppError()) — distinct from api_call_log, which only covers external
-- platform (Sleeper/ESPN/Yahoo/Claude) call failures, not our own code.

create table if not exists public.app_error_log (
  id         uuid primary key default gen_random_uuid(),
  source     text not null,
  message    text not null,
  stack      text,
  context    jsonb,
  created_at timestamptz not null default now()
);

alter table public.app_error_log enable row level security;

drop policy if exists "Service role can manage app error log" on public.app_error_log;
create policy "Service role can manage app error log" on public.app_error_log
  for all using (auth.role() = 'service_role');

grant select, insert on public.app_error_log to service_role;

create index if not exists idx_app_error_log_created_at on public.app_error_log (created_at desc);

-- Grows without bound otherwise — same acceptable-for-now tradeoff
-- api_call_log makes; cheap enough to trim manually until real volume
-- makes a retention job worth building.
