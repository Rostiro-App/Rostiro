-- Launch security hardening (Codex Packet 01) — database privilege
-- verification script. Run this against a real Supabase project (staging,
-- or a disposable local one) AFTER applying migration_launch_security.sql.
--
-- Why this exists instead of an automated test: this repo has no local
-- Supabase CLI/test harness (no supabase/config.toml, no docker-based test
-- DB), and this environment doesn't have the Supabase CLI installed to
-- stand one up. The packet's own instructions anticipate this ("If none
-- exists, add a reproducible SQL verification script"). This script
-- exercises real Postgres/RLS privileges directly — not a mocked Next.js
-- handler — which is the actual attack surface the vulnerability lived in.
--
-- HOW TO RUN: open this in the Supabase SQL Editor (or `psql` against the
-- project) as a role that can `set role`. Replace the two placeholder UUIDs
-- below with two REAL, disposable test users' auth.users.id (sign up two
-- throwaway accounts first). Run top to bottom; each numbered block prints
-- its own PASS/FAIL via RAISE NOTICE / an intentional exception.

\set user_a '00000000-0000-0000-0000-000000000001'  -- replace with a real test user's id
\set user_b '00000000-0000-0000-0000-000000000002'  -- replace with a second real test user's id

-- ─── 1. User A cannot update protected columns on their own row ────────────
select set_config('request.jwt.claims', json_build_object('sub', :'user_a')::text, true);
set role authenticated;

do $$
begin
  begin
    update public.users set plan = 'pro' where id = :'user_a'::uuid;
    raise exception 'FAIL: authenticated user updated plan directly — grant/RLS regression';
  exception
    when insufficient_privilege then
      raise notice 'PASS: authenticated user cannot update plan (insufficient_privilege)';
  end;
end $$;

do $$
begin
  begin
    update public.users set stripe_customer_id = 'cus_fake' where id = :'user_a'::uuid;
    raise exception 'FAIL: authenticated user updated stripe_customer_id directly';
  exception
    when insufficient_privilege then
      raise notice 'PASS: authenticated user cannot update stripe_customer_id';
  end;
end $$;

reset role;

-- ─── 2. User A CAN update the approved preference columns on their own row ──
select set_config('request.jwt.claims', json_build_object('sub', :'user_a')::text, true);
set role authenticated;

do $$
begin
  update public.users set mode = 'savant', updated_at = now() where id = :'user_a'::uuid;
  if found then
    raise notice 'PASS: authenticated user can update mode/updated_at on their own row';
  else
    raise exception 'FAIL: update affected 0 rows — check user_a actually exists in public.users';
  end if;
end $$;

reset role;

-- ─── 3. User A cannot update ANY column on User B's row ────────────────────
select set_config('request.jwt.claims', json_build_object('sub', :'user_a')::text, true);
set role authenticated;

do $$
declare
  affected int;
begin
  update public.users set mode = 'savant' where id = :'user_b'::uuid;
  get diagnostics affected = row_count;
  if affected = 0 then
    raise notice 'PASS: authenticated user cannot update another user''s row (RLS blocked it, 0 rows affected)';
  else
    raise exception 'FAIL: authenticated user updated % row(s) belonging to a different user — RLS regression', affected;
  end if;
end $$;

reset role;

-- ─── 4. Service role can still update protected fields (webhook/billing path) ──
set role service_role;

do $$
begin
  update public.users set plan = 'pro', stripe_customer_id = 'cus_test' where id = :'user_a'::uuid;
  if found then
    raise notice 'PASS: service_role can still write plan/stripe_customer_id (webhook path intact)';
  else
    raise exception 'FAIL: service_role update affected 0 rows';
  end if;
  -- Restore test user A to a clean state.
  update public.users set plan = 'free', stripe_customer_id = null where id = :'user_a'::uuid;
end $$;

reset role;

-- ─── 5. Atomic rate limiter: only service_role can execute it ──────────────
select set_config('request.jwt.claims', json_build_object('sub', :'user_a')::text, true);
set role authenticated;

do $$
begin
  begin
    perform public.increment_rate_limit('test-key', now(), 5);
    raise exception 'FAIL: authenticated role could execute increment_rate_limit directly';
  exception
    when insufficient_privilege then
      raise notice 'PASS: authenticated cannot execute increment_rate_limit';
  end;
end $$;

reset role;

set role service_role;
do $$
declare
  r record;
begin
  select * into r from public.increment_rate_limit('verify-script-key', date_trunc('minute', now()), 3);
  if r.allowed then
    raise notice 'PASS: service_role can execute increment_rate_limit (allowed=%, remaining=%)', r.allowed, r.remaining;
  else
    raise exception 'FAIL: first call to increment_rate_limit was not allowed';
  end if;
  -- clean up the test row
  delete from public.rate_limit_events where rate_key = 'verify-script-key';
end $$;
reset role;

-- If every block above printed PASS with no FAIL exceptions, the launch
-- security migration is verified. Any FAIL exception will abort that block
-- (and the transaction, if run inside one) — re-run failed sections after
-- fixing the underlying grant/policy.
