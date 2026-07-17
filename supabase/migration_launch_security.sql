-- Launch security hardening (Codex Implementation Packet 01, 2026-07-16).
-- Closes three confirmed pre-launch vulnerabilities:
--   1. authenticated had table-wide insert/update/delete on public.users,
--      letting any logged-in user set their own plan/Stripe fields directly
--      via PostgREST, bypassing the app's own settings API entirely.
--   2. The users update RLS policy had no WITH CHECK, only USING.
--   3. lib/rateLimit.ts's select-then-upsert pattern is not concurrency-safe
--      (a classic TOCTOU race) — this migration adds an atomic replacement.
-- Idempotent; safe to re-run. Forward-only — does not touch data already
-- written under the old grants, only the privileges going forward.

-- ─── 1. Revoke table-wide write access on public.users from authenticated ──
-- Explicit REVOKE (not just omitting the grant in grants.sql) because any
-- environment that already ran the old grants.sql has these privileges live
-- today and needs them actively removed, not just left out of a fresh setup.
revoke insert, update, delete on public.users from authenticated;

-- authenticated keeps table-wide select (RLS's "own row" policy still
-- restricts which rows are visible) — re-asserted here for a fresh
-- environment that runs this migration before ever running grants.sql.
grant select on public.users to authenticated;

-- ─── 2. Column-level update grant — only what app/api/settings/route.ts's
-- authenticated PATCH handler legitimately writes today, verified directly
-- against that file: mode, push_enabled, seen_hints, notify_scratches,
-- updated_at. Every billing/plan/trial/founder/Stripe/email column is
-- deliberately excluded — those are service-role-only (Stripe webhook,
-- admin simulate route), never client-writable.
grant update (mode, push_enabled, seen_hints, notify_scratches, updated_at)
  on public.users to authenticated;

-- ─── 3. WITH CHECK on the update policy ─────────────────────────────────────
-- The original policy (schema.sql) only had USING, which Postgres reuses as
-- the WITH CHECK expression by default for UPDATE — but making it explicit
-- removes any ambiguity and matches the pattern of every other per-user
-- table's policy in this schema.
drop policy if exists "Users can update own row" on public.users;
create policy "Users can update own row" on public.users
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ─── 4. Atomic rate-limit increment ─────────────────────────────────────────
-- Replaces lib/rateLimit.ts's select-then-upsert (a real race under
-- concurrent requests: two requests can both read count=N before either
-- writes N+1, letting both through when only one should pass) with a single
-- atomic statement. SECURITY DEFINER with an explicit search_path (never
-- trust the caller's search_path inside a SECURITY DEFINER function —
-- that's the classic privilege-escalation vector for this pattern),
-- schema-qualified references throughout, execute revoked from every role
-- except service_role (this function is only ever called from
-- lib/rateLimit.ts using the admin client).
create or replace function public.increment_rate_limit(
  p_rate_key text,
  p_window_start timestamptz,
  p_limit integer
)
returns table (allowed boolean, remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
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
