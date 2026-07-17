-- Yahoo token custody verification (Packet 02, Section 7). Runs directly
-- in the Supabase SQL Editor — no psql syntax, wrapped in BEGIN/ROLLBACK so
-- nothing persists regardless of outcome. Same pattern as
-- verify_launch_security.sql (Packet 01 correction pass).
--
-- HOW TO RUN: replace the placeholder UUID below with a real disposable
-- test user's public.users.id (must already have a yahoo_tokens row —
-- insert one below if not, it's rolled back either way), paste this whole
-- file into the SQL Editor, run it, read the final result-set table.

begin;

create temporary table _verify_config (user_a uuid not null);
insert into _verify_config (user_a) values ('93739384-5f02-4ebe-b746-df79c1542cf5'); -- ◄── EDIT to a real test user's id

create temporary table _verify_results (
  seq int generated always as identity primary key,
  check_name text not null,
  passed boolean not null,
  detail text
);

-- Temp tables are only accessible to their owning role by default — once
-- this script does `set role authenticated`/`set role service_role` below,
-- those roles need an explicit grant on these throwaway tables too, or
-- every subsequent statement inside a DO block fails with
-- "permission denied for table _verify_results" before it ever gets to
-- the actual yahoo_tokens check. Harmless: both tables are rolled back
-- with everything else at the end regardless.
grant select, insert on _verify_config, _verify_results to authenticated, service_role;

-- Ensure a row exists to test against, regardless of whether this test
-- user previously connected Yahoo — inserted as service_role, rolled back
-- at the end either way.
insert into public.yahoo_tokens (user_id, access_token, refresh_token, expires_at, scope)
values (
  (select user_a from _verify_config),
  'verify-fixture-access-token-ciphertext',
  'verify-fixture-refresh-token-ciphertext',
  now() + interval '1 hour',
  'fspt-r'
)
on conflict (user_id) do update set access_token = excluded.access_token;

-- ─── 1. authenticated cannot select yahoo_tokens at all ─────────────────────
select set_config('request.jwt.claims', json_build_object('sub', (select user_a from _verify_config))::text, true);
set role authenticated;

do $$
declare
  passed boolean;
  detail text;
begin
  begin
    perform * from public.yahoo_tokens where user_id = (select user_a from _verify_config);
    passed := false;
    detail := 'select succeeded — grant/RLS regression, authenticated can read token ciphertext';
  exception
    when insufficient_privilege then
      passed := true;
      detail := 'insufficient_privilege raised as expected';
  end;
  insert into _verify_results (check_name, passed, detail) values ('1. authenticated cannot select yahoo_tokens', passed, detail);
end $$;

reset role;

-- ─── 2. authenticated cannot insert/update/delete yahoo_tokens ──────────────
select set_config('request.jwt.claims', json_build_object('sub', (select user_a from _verify_config))::text, true);
set role authenticated;

do $$
declare
  passed boolean;
  detail text;
begin
  begin
    update public.yahoo_tokens set access_token = 'attacker-controlled' where user_id = (select user_a from _verify_config);
    passed := false;
    detail := 'update succeeded — grant/RLS regression';
  exception
    when insufficient_privilege then
      passed := true;
      detail := 'insufficient_privilege raised as expected';
  end;
  insert into _verify_results (check_name, passed, detail) values ('2a. authenticated cannot update yahoo_tokens', passed, detail);
end $$;

do $$
declare
  passed boolean;
  detail text;
begin
  begin
    delete from public.yahoo_tokens where user_id = (select user_a from _verify_config);
    passed := false;
    detail := 'delete succeeded — grant/RLS regression';
  exception
    when insufficient_privilege then
      passed := true;
      detail := 'insufficient_privilege raised as expected';
  end;
  insert into _verify_results (check_name, passed, detail) values ('2b. authenticated cannot delete yahoo_tokens', passed, detail);
end $$;

do $$
declare
  passed boolean;
  detail text;
begin
  begin
    insert into public.yahoo_tokens (user_id, access_token, refresh_token, expires_at, scope)
    values (gen_random_uuid(), 'x', 'x', now(), 'fspt-r');
    passed := false;
    detail := 'insert succeeded — grant/RLS regression';
  exception
    when insufficient_privilege then
      passed := true;
      detail := 'insufficient_privilege raised as expected';
  end;
  insert into _verify_results (check_name, passed, detail) values ('2c. authenticated cannot insert into yahoo_tokens', passed, detail);
end $$;

reset role;

-- ─── 3. service_role retains full custody ───────────────────────────────────
set role service_role;

do $$
declare
  affected int;
begin
  update public.yahoo_tokens set access_token = 'refreshed-ciphertext' where user_id = (select user_a from _verify_config);
  get diagnostics affected = row_count;
  insert into _verify_results (check_name, passed, detail) values
    ('3. service_role can update yahoo_tokens (refresh path)', affected = 1, format('%s row(s) affected', affected));
end $$;

reset role;

-- ─── Summary ─────────────────────────────────────────────────────────────
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

rollback;
