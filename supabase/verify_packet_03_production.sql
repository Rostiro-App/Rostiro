-- Packet 03 production verification (2026-07-18).
-- ENTIRELY READ-ONLY. No insert/update/delete/alter/create/drop/truncate,
-- no mutating function calls. Every statement below is a SELECT against
-- information_schema, pg_catalog, or application tables. Safe to run
-- repeatedly, at any time, by anyone with read access — it changes
-- nothing.
--
-- Run each section independently (e.g. paste one at a time into the
-- Supabase SQL editor) or the whole file at once; every section returns
-- its own labeled result set.

-- ─── 1. Migration presence: player_mappings constraints ────────────────────
-- Expect: nfl_team is_nullable = YES; 3 unique indexes present.
select
  'player_mappings.nfl_team nullable' as check_name,
  is_nullable = 'YES' as pass,
  is_nullable as actual_value
from information_schema.columns
where table_schema = 'public' and table_name = 'player_mappings' and column_name = 'nfl_team';

select indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'player_mappings' and indexname like '%_unique'
order by indexname;

-- ─── 2. Migration presence: Portfolio schema versioning ────────────────────
-- Expect: 3 rows (schema_version on both tables, player_id_space on exposure only).
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('portfolio_exposure_snapshots', 'portfolio_health_snapshots')
  and column_name in ('schema_version', 'player_id_space')
order by table_name, column_name;

-- ─── 3. player_mappings row counts + confidence breakdown ──────────────────
select
  count(*) as total_rows,
  count(*) filter (where nfl_team is null) as teamless_rows,
  count(*) filter (where nfl_team is not null) as team_known_rows,
  count(*) filter (where espn_id is not null and sleeper_id is not null) as cross_platform_rows,
  count(*) filter (where espn_id is not null and sleeper_id is null and yahoo_id is null) as espn_only_rows,
  count(*) filter (where sleeper_id is not null and espn_id is null and yahoo_id is null) as sleeper_only_rows,
  count(*) filter (where yahoo_id is not null) as yahoo_rows
from public.player_mappings;

-- ─── 4. Duplicate detection — provider IDs (should all return 0 rows) ──────
select 'espn_id' as col, espn_id as val, count(*) as dup_count
from public.player_mappings where espn_id is not null group by espn_id having count(*) > 1
union all
select 'yahoo_id', yahoo_id, count(*)
from public.player_mappings where yahoo_id is not null group by yahoo_id having count(*) > 1
union all
select 'sleeper_id', sleeper_id, count(*)
from public.player_mappings where sleeper_id is not null group by sleeper_id having count(*) > 1;

-- ─── 5. Duplicate detection — (name, nfl_team, season) (should return 0 rows) ──
select name, nfl_team, season, count(*) as dup_count
from public.player_mappings
group by name, nfl_team, season
having count(*) > 1;

-- ─── 6. Placeholder team strings (should return 0 rows — only real null or ──
-- real 2-4 char codes are allowed; '', 'FA', etc. would indicate a bug) ─────
select distinct nfl_team, length(nfl_team) as len
from public.player_mappings
where nfl_team is not null and length(nfl_team) not between 2 and 4;

-- ─── 7. Known collision case — Josh Johnson (expect exactly 1 row, a real ──
-- player with a real team; the ambiguous teamless trio must NOT appear) ────
select id, name, nfl_team, position, espn_id, sleeper_id
from public.player_mappings
where name = 'Josh Johnson';

-- ─── 8. Portfolio snapshot row counts + schema/ID-space distribution ───────
select
  count(*) as total_rows,
  count(*) filter (where schema_version = 1) as schema_v1_rows,
  count(*) filter (where schema_version = 2) as schema_v2_rows,
  count(*) filter (where player_id_space = 'sleeper_raw') as sleeper_raw_rows,
  count(*) filter (where player_id_space = 'canonical') as canonical_rows
from public.portfolio_exposure_snapshots;

select
  count(*) as total_rows,
  count(*) filter (where schema_version = 1) as schema_v1_rows,
  count(*) filter (where schema_version = 2) as schema_v2_rows
from public.portfolio_health_snapshots;

-- ─── 9. Roster snapshot counts + platform attribution ──────────────────────
select
  league_id,
  team_id,
  snapshot_json->>'platform' as platform,
  snapshot_json->>'schemaVersion' as schema_version,
  jsonb_array_length(snapshot_json->'players') as player_count,
  snapped_at
from public.roster_snapshots
order by snapped_at desc;

-- ─── 10. ESPN connected league team_id (expect a real, non-null value) ─────
select id, platform, league_id, league_name, team_id
from public.connected_leagues
where platform = 'espn';

-- ─── 11. Absence of temporary/throwaway test rows (should return 0 rows — ──
-- P3-10/P3-11 test inserts used week_start = '1999-01-01' and were deleted
-- immediately after verification; this confirms none remain) ───────────────
select 'portfolio_health_snapshots' as table_name, count(*) as leftover_test_rows
from public.portfolio_health_snapshots where week_start = '1999-01-01'
union all
select 'portfolio_exposure_snapshots', count(*)
from public.portfolio_exposure_snapshots where week_start = '1999-01-01';

-- ─── 12. connected_leagues summary (platform coverage sanity check) ────────
select platform, count(*) as league_count, count(*) filter (where team_id is not null) as with_team_id
from public.connected_leagues
group by platform
order by platform;
