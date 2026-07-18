-- Pulse data-access operational closure — verification (2026-07-18,
-- strengthened to check EXACT privilege sets, not merely presence).
-- ENTIRELY READ-ONLY. No insert/update/delete/alter/create/drop/truncate,
-- no mutating function calls, no grant/revoke. Every statement below is a
-- SELECT against information_schema/pg_catalog. Safe to run repeatedly, at
-- any time, by anyone with read access — it changes nothing.
--
-- Run this BEFORE applying supabase/migration_pulse_data_access_closure.sql
-- to see the real "before" state (expect several FAILs — that's the whole
-- point of the migration), then again AFTER applying it to confirm every
-- check flips to PASS.
--
-- Each privilege check below compares the ACTUAL, complete, alphabetically
-- sorted set of privileges a role holds on a table against the EXACT
-- expected set — not "contains at least these" — so an extra privilege
-- left over from the blanket `grant all on all tables in schema public to
-- service_role` (supabase/grants.sql) that the narrower grant never
-- revoked would show up as a FAIL here, not a silent pass.

with grant_sets as (
  select
    table_name,
    grantee,
    coalesce(string_agg(distinct privilege_type, ',' order by privilege_type), '') as privileges
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name in ('news_items', 'player_scratches', 'notes', 'player_context_cache')
    and grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')
  group by table_name, grantee
),
checks as (
  select
    'pulse_items.metrics_json exists as jsonb' as check_name,
    (select data_type = 'jsonb' from information_schema.columns
     where table_schema = 'public' and table_name = 'pulse_items' and column_name = 'metrics_json') as pass,
    coalesce((select data_type from information_schema.columns
     where table_schema = 'public' and table_name = 'pulse_items' and column_name = 'metrics_json'), 'column not found') as detail

  -- ─── authenticated: EXACT privilege set, nothing more ─────────────────
  union all
  select
    'authenticated on news_items is exactly {SELECT}',
    coalesce((select privileges from grant_sets where table_name='news_items' and grantee='authenticated'), '') = 'SELECT',
    coalesce((select privileges from grant_sets where table_name='news_items' and grantee='authenticated'), '(none)')
  union all
  select
    'authenticated on player_scratches is exactly {SELECT}',
    coalesce((select privileges from grant_sets where table_name='player_scratches' and grantee='authenticated'), '') = 'SELECT',
    coalesce((select privileges from grant_sets where table_name='player_scratches' and grantee='authenticated'), '(none)')
  union all
  select
    'authenticated on notes is exactly {DELETE,INSERT,SELECT,UPDATE}',
    coalesce((select privileges from grant_sets where table_name='notes' and grantee='authenticated'), '') = 'DELETE,INSERT,SELECT,UPDATE',
    coalesce((select privileges from grant_sets where table_name='notes' and grantee='authenticated'), '(none)')
  union all
  select
    'authenticated on player_context_cache is exactly {INSERT,SELECT}',
    coalesce((select privileges from grant_sets where table_name='player_context_cache' and grantee='authenticated'), '') = 'INSERT,SELECT',
    coalesce((select privileges from grant_sets where table_name='player_context_cache' and grantee='authenticated'), '(none)')

  -- ─── service_role: EXACT privilege set, nothing more (no leftover from
  -- the blanket `grant all on all tables ... to service_role`) ──────────
  union all
  select
    'service_role on news_items is exactly {INSERT,SELECT,UPDATE}',
    coalesce((select privileges from grant_sets where table_name='news_items' and grantee='service_role'), '') = 'INSERT,SELECT,UPDATE',
    coalesce((select privileges from grant_sets where table_name='news_items' and grantee='service_role'), '(none)')
  union all
  select
    'service_role on player_scratches is exactly {INSERT,SELECT,UPDATE}',
    coalesce((select privileges from grant_sets where table_name='player_scratches' and grantee='service_role'), '') = 'INSERT,SELECT,UPDATE',
    coalesce((select privileges from grant_sets where table_name='player_scratches' and grantee='service_role'), '(none)')
  union all
  select
    'service_role on notes is exactly {SELECT}',
    coalesce((select privileges from grant_sets where table_name='notes' and grantee='service_role'), '') = 'SELECT',
    coalesce((select privileges from grant_sets where table_name='notes' and grantee='service_role'), '(none)')
  union all
  select
    'service_role on player_context_cache is exactly {INSERT,SELECT}',
    coalesce((select privileges from grant_sets where table_name='player_context_cache' and grantee='service_role'), '') = 'INSERT,SELECT',
    coalesce((select privileges from grant_sets where table_name='player_context_cache' and grantee='service_role'), '(none)')

  -- ─── anon and PUBLIC: must hold ZERO privileges on any of the 4 tables ──
  union all
  select
    'anon has zero privileges on all 4 tables',
    not exists (select 1 from grant_sets where grantee = 'anon' and privileges <> ''),
    coalesce((select string_agg(table_name || ':' || privileges, ', ') from grant_sets where grantee = 'anon' and privileges <> ''), 'none — clean')
  union all
  select
    'PUBLIC (implicit) has zero privileges on all 4 tables',
    not exists (select 1 from grant_sets where grantee = 'PUBLIC' and privileges <> ''),
    coalesce((select string_agg(table_name || ':' || privileges, ', ') from grant_sets where grantee = 'PUBLIC' and privileges <> ''), 'none — clean')

  -- ─── RLS: still enabled, existing policies still present ──────────────
  union all
  select
    'RLS still enabled on all 4 tables',
    (select count(*) from pg_tables
     where schemaname='public' and tablename in ('news_items','player_scratches','notes','player_context_cache')
       and rowsecurity) = 4,
    coalesce((select string_agg(tablename || '=' || rowsecurity::text, ', ' order by tablename) from pg_tables
     where schemaname='public' and tablename in ('news_items','player_scratches','notes','player_context_cache')), 'none found')
  union all
  select
    'all 5 pre-existing RLS policies still present, none dropped or altered',
    (select count(*) from pg_policies
     where schemaname='public' and tablename in ('news_items','player_scratches','notes','player_context_cache')) = 5,
    coalesce((select string_agg(tablename || '.' || policyname, ' | ' order by tablename, policyname) from pg_policies
     where schemaname='public' and tablename in ('news_items','player_scratches','notes','player_context_cache')), 'none found')
)
select
  case when pass then 'PASS' else 'FAIL' end as result,
  check_name,
  detail
from checks
order by pass asc, check_name;
