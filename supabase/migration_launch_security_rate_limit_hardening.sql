-- Launch security hardening, Codex Packet 01 correction pass (2026-07-17).
-- Forward migration on top of migration_launch_security.sql — that file is
-- already applied to production, so it stays exactly as originally run and
-- this hardens increment_rate_limit in place instead of editing history.
--
-- Two issues in the original increment_rate_limit:
--   1. `set search_path = public` is still an attacker-influenceable search
--      path (a role with CREATE on public — or a future extension creating
--      an unexpectedly-named object in public — could shadow a bare
--      reference inside this SECURITY DEFINER function). Pinned to an empty
--      search_path instead; every reference below is already schema-
--      qualified (public.rate_limit_events), and pg_catalog is always
--      implicitly searched first regardless, so built-ins like greatest()
--      still resolve correctly.
--   2. No input validation — an empty/oversized rate_key or a sub-1 limit
--      were previously accepted, which would have inserted garbage rows or
--      made the "allowed" check meaningless (limit 0 always denies, but a
--      negative limit's semantics were undefined).
--
-- Idempotent; safe to re-run. service_role-only execution is unchanged from
-- the original migration — re-asserted here for a fresh environment that
-- runs this file before ever running migration_launch_security.sql.
create or replace function public.increment_rate_limit(
  p_rate_key text,
  p_window_start timestamptz,
  p_limit integer
)
returns table (allowed boolean, remaining integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_rate_key is null or length(p_rate_key) = 0 or length(p_rate_key) > 200 then
    raise exception 'increment_rate_limit: p_rate_key must be 1-200 characters';
  end if;
  if p_limit is null or p_limit < 1 then
    raise exception 'increment_rate_limit: p_limit must be >= 1';
  end if;

  insert into public.rate_limit_events (rate_key, window_start, count)
  values (p_rate_key, p_window_start, 1)
  on conflict (rate_key, window_start)
  do update set count = public.rate_limit_events.count + 1
  returning public.rate_limit_events.count into v_count;

  if v_count > p_limit then
    return query select false, 0;
  else
    return query select true, greatest(p_limit - v_count, 0);
  end if;
end;
$$;

revoke all on function public.increment_rate_limit(text, timestamptz, integer) from public;
revoke all on function public.increment_rate_limit(text, timestamptz, integer) from anon;
revoke all on function public.increment_rate_limit(text, timestamptz, integer) from authenticated;
grant execute on function public.increment_rate_limit(text, timestamptz, integer) to service_role;
