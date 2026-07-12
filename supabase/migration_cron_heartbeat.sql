-- Cron liveness heartbeat (monitoring). Catches the one failure app_error_log
-- can't: a Vercel cron that stops running entirely, so no error row is ever
-- written. Each cron stamps last_run_at on every authorized run
-- (lib/cronHeartbeat.ts, called right after the auth guard). A pg_cron job runs
-- check_cron_heartbeats() every 2 min, which pushes to n8n -> Discord only on a
-- state change: a cron going stale (once) and later recovering (once).
--
-- Applied to the live project via MCP as two migrations:
--   add_cron_heartbeat_table, add_cron_heartbeat_checker.
-- The pg_cron schedule at the bottom is armed AFTER the deploy that ships the
-- recordCronRun() stamps, so seeded rows can't false-alarm in the gap.

create table if not exists public.cron_heartbeat (
  cron_name   text primary key,
  last_run_at timestamptz not null default now(),
  last_status text not null default 'ok',
  stale_after interval not null default '1 hour',
  alerted_at  timestamptz  -- set when we've paged for a current stall; cleared on recovery
);

-- Ops table: only the service role (bypasses RLS) writes from the app; the
-- pg_cron checker runs as table owner. No policies = locked to anon/authenticated.
alter table public.cron_heartbeat enable row level security;

-- One row per Vercel cron with its staleness threshold (see vercel.json).
insert into public.cron_heartbeat (cron_name, stale_after) values
  ('live-scores',        interval '5 minutes'),   -- schedule: * * * * *
  ('news',               interval '20 minutes'),  -- schedule: */15 * * * *
  ('nfl-schedule',       interval '26 hours'),    -- schedule: 0 8 * * *
  ('players',            interval '26 hours'),    -- schedule: 0 9 * * *
  ('pulse',              interval '26 hours'),    -- schedule: 0 10 * * *
  ('season-points',      interval '26 hours'),    -- schedule: 0 11 * * *
  ('season-pass-expiry', interval '26 hours')     -- schedule: 0 7 * * *
on conflict (cron_name) do nothing;

create or replace function public.check_cron_heartbeats()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_url text := 'https://rostiro.app.n8n.cloud/webhook/cron-heartbeat';
  v_headers jsonb := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer <SUPABASE_N8N_WEBHOOK_SECRET>'
  );
begin
  -- Newly stale -> alert once, mark alerted.
  for r in
    select cron_name, last_run_at, stale_after
    from public.cron_heartbeat
    where now() - last_run_at > stale_after and alerted_at is null
  loop
    perform net.http_post(
      url := v_url,
      body := jsonb_build_object('event','stale','cron_name',r.cron_name,
                                 'last_run_at',r.last_run_at,'stale_after',r.stale_after::text),
      headers := v_headers
    );
    update public.cron_heartbeat set alerted_at = now() where cron_name = r.cron_name;
  end loop;

  -- Recovered -> notify once, clear alert.
  for r in
    select cron_name, last_run_at
    from public.cron_heartbeat
    where now() - last_run_at <= stale_after and alerted_at is not null
  loop
    perform net.http_post(
      url := v_url,
      body := jsonb_build_object('event','recovered','cron_name',r.cron_name,'last_run_at',r.last_run_at),
      headers := v_headers
    );
    update public.cron_heartbeat set alerted_at = null where cron_name = r.cron_name;
  end loop;
end $$;

-- ARM (run only AFTER the deploy that ships lib/cronHeartbeat.ts is live and
-- last_run_at values are advancing, so seeded rows don't false-alarm):
--   create extension if not exists pg_cron;
--   select cron.schedule('cron-heartbeat-check', '*/2 * * * *',
--                        $$select public.check_cron_heartbeats()$$);
