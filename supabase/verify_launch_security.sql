-- Launch security hardening (Codex Packet 01) — database privilege
-- verification script, corrected per Codex's audit of the first draft.
--
-- Runs directly in the Supabase SQL Editor as one script — no \set, no
-- psql variable interpolation, no external tooling. Wrapped in a single
-- BEGIN ... ROLLBACK transaction: every write this script makes (test
-- users' plan/mode/stripe_customer_id, rate_limit_events rows) is undone
-- automatically at the end, regardless of which checks pass or fail. This
-- also means any AFTER UPDATE trigger on public.users that queues an
-- async side effect via pg_net (e.g. the sale_ping Discord webhook —
-- already guarded separately by migration_sale_ping_guard.sql, but this
-- is defense-in-depth) has its queued request rolled back before the
-- background worker can act on it, since pg_net enqueues inside the same
-- transaction. A prior run of the old (unwrapped) version of this script
-- caused a real false-positive Discord "sale" notification — see
-- migration_sale_ping_guard.sql's header for the full story.
--
-- Each check records PASS/FAIL into a temp results table instead of using
-- RAISE EXCEPTION as the failure signal — an uncaught exception aborts
-- the whole transaction and would prevent every later check from running
-- (and, before Postgres 8.4-era savepoint semantics inside DO blocks were
-- reliable, made the output hard to read). The one exception (literally):
-- the "test users must exist" precondition at the top, which really is a
-- hard stop — nothing downstream is meaningful without it.
--
-- HOW TO RUN: replace the two UUIDs in the `insert into _verify_config`
-- statement below with two REAL, disposable test users' id from
-- public.users (sign up two throwaway accounts, e.g. via Gmail
-- plus-addressing, confirm them, and load the app once so their
-- public.users row exists). Paste this entire file into the Supabase SQL
-- Editor and run it as one script. Read the final result set (a PASS/FAIL
-- table) — no need to dig through the NOTICE log.

begin;

create temporary table _verify_config (
  user_a uuid not null,
  user_b uuid not null
);

-- ◄── EDIT THESE TWO VALUES to your own disposable test accounts' public.users.id
insert into _verify_config (user_a, user_b) values
  ('93739384-5f02-4ebe-b746-df79c1542cf5', '0c5f2fdb-00e0-49d6-8362-04d754b8cd68');

create temporary table _verify_results (
  seq int generated always as identity primary key,
  check_name text not null,
  passed boolean not null,
  detail text
);

-- ─── 0. Precondition: both disposable test users must already exist ────────
do $$
declare
  v_user_a uuid;
  v_user_b uuid;
  v_a_exists boolean;
  v_b_exists boolean;
begin
  select user_a, user_b into v_user_a, v_user_b from _verify_config;
  select exists(select 1 from public.users where id = v_user_a) into v_a_exists;
  select exists(select 1 from public.users where id = v_user_b) into v_b_exists;

  insert into _verify_results (check_name, passed, detail) values
    ('0a. user_a exists in public.users', v_a_exists, v_user_a::text),
    ('0b. user_b exists in public.users', v_b_exists, v_user_b::text);

  if not v_a_exists or not v_b_exists then
    raise exception 'Both test users must exist in public.users first (sign up, confirm email, load the app once) — edit the UUIDs in _verify_config and re-run.';
  end if;
end $$;

-- ─── 1. authenticated cannot update protected columns on their own row ─────
select set_config('request.jwt.claims', json_build_object('sub', (select user_a from _verify_config))::text, true);
set role authenticated;

do $$
declare
  passed boolean;
  detail text;
begin
  begin
    update public.users set plan = 'pro' where id = (select user_a from _verify_config);
    passed := false;
    detail := 'update succeeded — no insufficient_privilege raised (grant/RLS regression)';
  exception
    when insufficient_privilege then
      passed := true;
      detail := 'insufficient_privilege raised as expected';
  end;
  insert into _verify_results (check_name, passed, detail) values ('1a. authenticated cannot update plan', passed, detail);
end $$;

do $$
declare
  passed boolean;
  detail text;
begin
  begin
    update public.users set stripe_customer_id = 'cus_fake' where id = (select user_a from _verify_config);
    passed := false;
    detail := 'update succeeded — no insufficient_privilege raised (grant/RLS regression)';
  exception
    when insufficient_privilege then
      passed := true;
      detail := 'insufficient_privilege raised as expected';
  end;
  insert into _verify_results (check_name, passed, detail) values ('1b. authenticated cannot update stripe_customer_id', passed, detail);
end $$;

reset role;

-- ─── 2. authenticated CAN update the approved preference columns ───────────
select set_config('request.jwt.claims', json_build_object('sub', (select user_a from _verify_config))::text, true);
set role authenticated;

do $$
declare
  affected int;
begin
  update public.users set mode = 'savant', updated_at = now() where id = (select user_a from _verify_config);
  get diagnostics affected = row_count;
  insert into _verify_results (check_name, passed, detail) values
    ('2. authenticated can update mode/updated_at on own row', affected = 1, format('%s row(s) affected', affected));
end $$;

reset role;

-- ─── 3. authenticated cannot update ANY column on another user's row ───────
select set_config('request.jwt.claims', json_build_object('sub', (select user_a from _verify_config))::text, true);
set role authenticated;

do $$
declare
  affected int;
begin
  update public.users set mode = 'savant' where id = (select user_b from _verify_config);
  get diagnostics affected = row_count;
  insert into _verify_results (check_name, passed, detail) values
    ('3. authenticated cannot update another user''s row', affected = 0, format('%s row(s) affected (expected 0)', affected));
end $$;

reset role;

-- ─── 4. service_role can still write plan/stripe_customer_id (webhook path) ─
set role service_role;

do $$
declare
  affected int;
begin
  update public.users set plan = 'pro', stripe_customer_id = 'cus_test' where id = (select user_a from _verify_config);
  get diagnostics affected = row_count;
  insert into _verify_results (check_name, passed, detail) values
    ('4. service_role can write plan/stripe_customer_id', affected = 1, format('%s row(s) affected', affected));
end $$;

reset role;

-- ─── 5. RPC execution privileges: increment_rate_limit ─────────────────────
select set_config('request.jwt.claims', json_build_object('sub', (select user_a from _verify_config))::text, true);
set role authenticated;

do $$
declare
  passed boolean;
  detail text;
begin
  begin
    perform public.increment_rate_limit('verify-rpc-priv-authenticated', now(), 5);
    passed := false;
    detail := 'call succeeded — no insufficient_privilege raised (grant regression)';
  exception
    when insufficient_privilege then
      passed := true;
      detail := 'insufficient_privilege raised as expected';
  end;
  insert into _verify_results (check_name, passed, detail) values ('5a. authenticated cannot execute increment_rate_limit', passed, detail);
end $$;

reset role;

set role service_role;
do $$
declare
  r record;
  passed boolean;
begin
  select * into r from public.increment_rate_limit('verify-rpc-priv-service', date_trunc('minute', now()), 5);
  passed := r.allowed is true and r.remaining = 4;
  insert into _verify_results (check_name, passed, detail) values
    ('5b. service_role can execute increment_rate_limit', passed, format('allowed=%s remaining=%s', r.allowed, r.remaining));
end $$;
reset role;

-- ─── 6. Limit boundary: exactly p_limit accepted calls, all allowed ────────
set role service_role;
do $$
declare
  r record;
  win timestamptz := date_trunc('minute', now());
  i int;
  all_allowed boolean := true;
  remainings int[] := array[]::int[];
begin
  for i in 1..3 loop
    select * into r from public.increment_rate_limit('verify-boundary-test', win, 3);
    if not r.allowed then all_allowed := false; end if;
    remainings := array_append(remainings, r.remaining);
  end loop;
  insert into _verify_results (check_name, passed, detail) values
    ('6. limit boundary: 3 calls at limit=3 all allowed', all_allowed and remainings = array[2,1,0], format('remaining sequence=%s', remainings));
end $$;
reset role;

-- ─── 7. Over-limit: the (limit+1)th call is denied, remaining stays 0 ──────
set role service_role;
do $$
declare
  r record;
  win timestamptz := date_trunc('minute', now());
begin
  -- Reuses the same key/window as check 6 — this IS the 4th call against
  -- a limit of 3, deliberately chained to prove denial persists past the
  -- boundary rather than resetting.
  select * into r from public.increment_rate_limit('verify-boundary-test', win, 3);
  insert into _verify_results (check_name, passed, detail) values
    ('7. over-limit: 4th call at limit=3 is denied', r.allowed is false and r.remaining = 0, format('allowed=%s remaining=%s', r.allowed, r.remaining));
end $$;
reset role;

-- ─── 8. Window independence: a new window_start starts a fresh count ───────
set role service_role;
do $$
declare
  r1 record;
  r2 record;
  r3 record;
  win_a timestamptz := date_trunc('minute', now());
  win_b timestamptz := win_a + interval '1 minute';
  passed boolean;
begin
  select * into r1 from public.increment_rate_limit('verify-window-test', win_a, 1);   -- window A, 1st call: allowed
  select * into r2 from public.increment_rate_limit('verify-window-test', win_a, 1);   -- window A, 2nd call: denied (over limit 1)
  select * into r3 from public.increment_rate_limit('verify-window-test', win_b, 1);   -- window B, 1st call: allowed (independent counter)
  passed := r1.allowed is true and r2.allowed is false and r3.allowed is true;
  insert into _verify_results (check_name, passed, detail) values
    ('8. window independence', passed, format('winA#1=%s winA#2=%s winB#1=%s', r1.allowed, r2.allowed, r3.allowed));
end $$;
reset role;

-- ─── 9. Input validation added in this correction pass ─────────────────────
set role service_role;

do $$
declare
  passed boolean;
  detail text;
begin
  begin
    perform public.increment_rate_limit('', now(), 5);
    passed := false;
    detail := 'call succeeded with an empty key — should have raised';
  exception
    when others then
      passed := true;
      detail := sqlerrm;
  end;
  insert into _verify_results (check_name, passed, detail) values ('9a. empty rate_key is rejected', passed, detail);
end $$;

do $$
declare
  passed boolean;
  detail text;
begin
  begin
    perform public.increment_rate_limit(repeat('x', 201), now(), 5);
    passed := false;
    detail := 'call succeeded with a 201-char key — should have raised';
  exception
    when others then
      passed := true;
      detail := sqlerrm;
  end;
  insert into _verify_results (check_name, passed, detail) values ('9b. oversized (201-char) rate_key is rejected', passed, detail);
end $$;

do $$
declare
  passed boolean;
  detail text;
begin
  begin
    perform public.increment_rate_limit('verify-limit-zero', now(), 0);
    passed := false;
    detail := 'call succeeded with limit=0 — should have raised';
  exception
    when others then
      passed := true;
      detail := sqlerrm;
  end;
  insert into _verify_results (check_name, passed, detail) values ('9c. limit = 0 is rejected', passed, detail);
end $$;

do $$
declare
  passed boolean;
  detail text;
begin
  begin
    perform public.increment_rate_limit('verify-limit-negative', now(), -1);
    passed := false;
    detail := 'call succeeded with limit=-1 — should have raised';
  exception
    when others then
      passed := true;
      detail := sqlerrm;
  end;
  insert into _verify_results (check_name, passed, detail) values ('9d. negative limit is rejected', passed, detail);
end $$;

reset role;

-- ─── Summary ─────────────────────────────────────────────────────────────
-- This SELECT is the last statement before ROLLBACK, so it's what shows in
-- the SQL Editor's Results panel — read this, not the NOTICE log.
select
  seq,
  check_name,
  case when passed then 'PASS' else 'FAIL' end as result,
  detail
from _verify_results
order by seq;

select
  count(*) filter (where passed) as passed_count,
  count(*) filter (where not passed) as failed_count,
  count(*) as total_checks
from _verify_results;

-- Every row inserted by this script — test users' plan/mode/
-- stripe_customer_id changes, every rate_limit_events row from checks
-- 5-9 — is discarded here. Nothing above is visible outside this script's
-- own transaction, and nothing persists after this line runs.
rollback;
