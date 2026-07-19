-- Read-only verifier for migration_push_subscription_global_identity.sql
-- (P3.5-4C correction pass). Safe to run anytime — SELECTs only, no writes.
--
-- Use BEFORE applying the migration to confirm the precondition (Section 1),
-- and AFTER applying to confirm enforcement (Sections 2 & 3). Each section
-- returns an explicit PASS/FAIL.

-- 1. PRECONDITION / duplicate check: zero onesignal_player_id owned by >1 row.
--    (Must PASS before the migration can create the global unique index.)
select
  'no_duplicate_subscription_ids' as check_name,
  count(*) as duplicate_id_count,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as result
from (
  select onesignal_player_id
  from public.push_subscriptions
  where onesignal_player_id is not null
  group by onesignal_player_id
  having count(*) > 1
) dups;

-- 2. INDEX EXISTS: the global unique index is present, is UNIQUE, and covers
--    exactly (onesignal_player_id). Reads the actual index definition from the
--    catalog rather than assuming it.
select
  'global_unique_index_exists' as check_name,
  count(*) as matching_index_count,
  case when count(*) = 1 then 'PASS' else 'FAIL' end as result
from pg_indexes
where schemaname = 'public'
  and tablename = 'push_subscriptions'
  and indexname = 'push_subscriptions_onesignal_player_id_global_key'
  and indexdef ilike '%CREATE UNIQUE INDEX%'
  and indexdef ilike '%(onesignal_player_id)%';

-- 3. NO EMPTY IDS: no row has a null/empty subscription id.
select
  'no_empty_subscription_ids' as check_name,
  count(*) as empty_id_count,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as result
from public.push_subscriptions
where onesignal_player_id is null
  or length(trim(onesignal_player_id)) = 0;

-- 4. COLUMN AUTHORITY: users.push_enabled is the server-only push kill switch.
--    Reads the ACTUAL privilege from the catalog via has_column_privilege
--    (not an assumption): authenticated must NOT hold UPDATE on push_enabled,
--    while service_role (which the push/subscribe route uses to derive it) must.
--    Run BEFORE the migration and this FAILs — authenticated_can_update is true
--    under the old migration_launch_security grant. After the migration's
--    `revoke update (push_enabled) ... from authenticated`, it PASSes.
select
  'push_enabled_server_authority_only' as check_name,
  has_column_privilege('authenticated', 'public.users', 'push_enabled', 'UPDATE') as authenticated_can_update,
  has_column_privilege('service_role', 'public.users', 'push_enabled', 'UPDATE') as service_role_can_update,
  case
    when has_column_privilege('authenticated', 'public.users', 'push_enabled', 'UPDATE') = false
     and has_column_privilege('service_role', 'public.users', 'push_enabled', 'UPDATE') = true
    then 'PASS' else 'FAIL'
  end as result;

-- 5. PRESERVED CLIENT COLUMNS: authenticated must retain UPDATE on the four
--    legitimate preference columns (mode, seen_hints, notify_scratches,
--    updated_at) — the revoke above must not have over-reached.
select
  'authenticated_retains_preference_columns' as check_name,
  case
    when has_column_privilege('authenticated', 'public.users', 'mode', 'UPDATE')
     and has_column_privilege('authenticated', 'public.users', 'seen_hints', 'UPDATE')
     and has_column_privilege('authenticated', 'public.users', 'notify_scratches', 'UPDATE')
     and has_column_privilege('authenticated', 'public.users', 'updated_at', 'UPDATE')
    then 'PASS' else 'FAIL'
  end as result;
