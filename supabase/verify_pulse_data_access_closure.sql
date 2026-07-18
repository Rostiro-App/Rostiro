-- Pulse data-access operational closure — verification (2026-07-18).
-- ENTIRELY READ-ONLY. No insert/update/delete/alter/create/drop/truncate,
-- no mutating function calls, no grant/revoke. Every statement below is a
-- SELECT against information_schema/pg_catalog. Safe to run repeatedly, at
-- any time, by anyone with read access — it changes nothing.
--
-- Run this BEFORE applying supabase/migration_pulse_data_access_closure.sql
-- to see the real "before" state (expect several FAILs — that's the whole
-- point of the migration), then again AFTER applying it to confirm every
-- check flips to PASS.

with checks as (
  select
    'pulse_items.metrics_json exists as jsonb' as check_name,
    (select data_type = 'jsonb' from information_schema.columns
     where table_schema = 'public' and table_name = 'pulse_items' and column_name = 'metrics_json') as pass,
    coalesce((select data_type from information_schema.columns
     where table_schema = 'public' and table_name = 'pulse_items' and column_name = 'metrics_json'), 'column not found') as detail

  -- ─── authenticated: required privileges ──────────────────────────────
  union all
  select
    'authenticated has select on news_items',
    exists (select 1 from information_schema.role_table_grants
     where table_schema='public' and table_name='news_items' and grantee='authenticated' and privilege_type='SELECT'),
    'checked'
  union all
  select
    'authenticated has select on player_scratches',
    exists (select 1 from information_schema.role_table_grants
     where table_schema='public' and table_name='player_scratches' and grantee='authenticated' and privilege_type='SELECT'),
    'checked'
  union all
  select
    'authenticated has select+insert+update+delete on notes',
    (select count(distinct privilege_type) from information_schema.role_table_grants
     where table_schema='public' and table_name='notes' and grantee='authenticated'
       and privilege_type in ('SELECT','INSERT','UPDATE','DELETE')) = 4,
    coalesce((select string_agg(distinct privilege_type, ', ' order by privilege_type) from information_schema.role_table_grants
     where table_schema='public' and table_name='notes' and grantee='authenticated'
       and privilege_type in ('SELECT','INSERT','UPDATE','DELETE')), 'none found')
  union all
  select
    'authenticated has select+insert on player_context_cache',
    (select count(distinct privilege_type) from information_schema.role_table_grants
     where table_schema='public' and table_name='player_context_cache' and grantee='authenticated'
       and privilege_type in ('SELECT','INSERT')) = 2,
    coalesce((select string_agg(distinct privilege_type, ', ' order by privilege_type) from information_schema.role_table_grants
     where table_schema='public' and table_name='player_context_cache' and grantee='authenticated'
       and privilege_type in ('SELECT','INSERT')), 'none found')

  -- ─── service_role: required privileges ───────────────────────────────
  union all
  select
    'service_role has select+insert+update on news_items',
    (select count(distinct privilege_type) from information_schema.role_table_grants
     where table_schema='public' and table_name='news_items' and grantee='service_role'
       and privilege_type in ('SELECT','INSERT','UPDATE')) = 3,
    coalesce((select string_agg(distinct privilege_type, ', ' order by privilege_type) from information_schema.role_table_grants
     where table_schema='public' and table_name='news_items' and grantee='service_role'
       and privilege_type in ('SELECT','INSERT','UPDATE')), 'none found')
  union all
  select
    'service_role has select+insert+update on player_scratches',
    (select count(distinct privilege_type) from information_schema.role_table_grants
     where table_schema='public' and table_name='player_scratches' and grantee='service_role'
       and privilege_type in ('SELECT','INSERT','UPDATE')) = 3,
    coalesce((select string_agg(distinct privilege_type, ', ' order by privilege_type) from information_schema.role_table_grants
     where table_schema='public' and table_name='player_scratches' and grantee='service_role'
       and privilege_type in ('SELECT','INSERT','UPDATE')), 'none found')
  union all
  select
    'service_role has select on notes',
    exists (select 1 from information_schema.role_table_grants
     where table_schema='public' and table_name='notes' and grantee='service_role' and privilege_type='SELECT'),
    'checked'
  union all
  select
    'service_role has select+insert on player_context_cache',
    (select count(distinct privilege_type) from information_schema.role_table_grants
     where table_schema='public' and table_name='player_context_cache' and grantee='service_role'
       and privilege_type in ('SELECT','INSERT')) = 2,
    coalesce((select string_agg(distinct privilege_type, ', ' order by privilege_type) from information_schema.role_table_grants
     where table_schema='public' and table_name='player_context_cache' and grantee='service_role'
       and privilege_type in ('SELECT','INSERT')), 'none found')

  -- ─── anon: must have none of these ────────────────────────────────────
  union all
  select
    'anon has no select/insert/update/delete on any of the 4 tables',
    not exists (
      select 1 from information_schema.role_table_grants
      where table_schema='public' and grantee='anon'
        and table_name in ('news_items','player_scratches','notes','player_context_cache')
        and privilege_type in ('SELECT','INSERT','UPDATE','DELETE')
    ),
    coalesce((select string_agg(table_name || ':' || privilege_type, ', ') from information_schema.role_table_grants
     where table_schema='public' and grantee='anon'
       and table_name in ('news_items','player_scratches','notes','player_context_cache')
       and privilege_type in ('SELECT','INSERT','UPDATE','DELETE')), 'none — clean')

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
