-- Player mapping provenance columns + backfill (Packet 03, P3-11 correction
-- pass, revised 2026-07-18).
--
-- Status: PROPOSED — NOT APPLIED TO PRODUCTION. Do not run this against
-- production without separate, explicit approval. This supersedes the
-- prior version of this file, which only added the columns without a
-- backfill plan — that version left every existing row's mapping_basis
-- null forever, which the follow-up correction pass judged insufficient:
-- 1970 real rows already exist in production and their provenance IS
-- knowable from what's already stored (which provider IDs are populated),
-- so leaving them null was avoidable data loss, not honesty.
--
-- ─── What this adds ─────────────────────────────────────────────────────
-- 1. mapping_basis: text, constrained to
--    'provider_id_reuse' | 'name_team_unambiguous' | 'single_platform'
--    (lib/playerMappingSeed.ts's MatchBasis). Backfilled for every
--    existing row (see below), then made NOT NULL — this migration only
--    reaches that final ALTER after confirming the backfill left zero
--    nulls.
-- 2. teamless_activity_unverified: boolean, not null, default false.
--
-- ─── Backfill logic for existing rows ───────────────────────────────────
-- Every row in production today was written by the P3-4/P3-4B seed run,
-- which never had this column to fill in — but the seed's own insert
-- logic (lib/playerMappingSeed.ts's buildPlayerMappingSeedPlan) already
-- determined basis from provider-ID count at insert time:
--   `sleeperRow && espnRow ? 'name_team_unambiguous' : 'single_platform'`
-- A row with 2+ populated provider ID columns today can ONLY have gotten
-- there one of two ways: (a) inserted with both IDs at once (that seed
-- path already used 'name_team_unambiguous'), or (b) had a second ID
-- LINKED on after insert via `link_platform_id`, which also always uses
-- 'name_team_unambiguous' (lib/playerMappingSeed.ts lines ~319-324). There
-- is no existing write path that ever produces a genuinely
-- provider_id_reuse-confirmed row today, so backfilling multi-provider
-- rows to 'name_team_unambiguous' (never 'provider_id_reuse') is not a
-- guess — it's the only basis those two real write paths ever use.
--   - 2+ of (espn_id, yahoo_id, sleeper_id) populated -> 'name_team_unambiguous'
--   - exactly 1 populated -> 'single_platform'
--   - 0 populated -> cannot be backfilled safely at all (see precondition
--     check below — this migration REFUSES to proceed if any exist,
--     rather than guessing a basis for a row with no provider identity).
--
-- teamless_activity_unverified backfill: existing rows use `nfl_team IS
-- NULL` as the backfill proxy for this flag. This is coarser than the
-- live seed's own condition (nfl_team null AND a real ownership%/ADP
-- signal from players_cache at seed time — see
-- lib/playerMappingSeed.ts's hasTeamlessActivitySignal) because
-- players_cache's ownership/ADP values are live-updated and no longer
-- reflect what was true the moment each row was inserted; there is no
-- reliable historical snapshot to re-derive the original condition from.
-- Using nfl_team IS NULL alone is deliberately conservative in the safe
-- direction: every row this flag is ABOUT TO warn downstream consumers on
-- (real activity signal, no team) is included, plus some rows that may
-- have had no activity signal either (retired/irrelevant) — the flag's
-- own contract ("must not be treated as confirmation of active free
-- agency") already tolerates that; it was never a precise signal, only a
-- caution flag, and over-flagging a caution is the safe error direction.
--
-- ─── Precondition / postcondition counts ────────────────────────────────
-- Both are RAISE NOTICE'd so a human running this in the Supabase SQL
-- editor sees real counts, not just "success." The zero-provider-ID
-- precondition check ABORTS THE WHOLE TRANSACTION (RAISE EXCEPTION) if it
-- finds any such row — this migration does not proceed with a partial or
-- guessed backfill.
--
-- Idempotent: safe to re-run. If mapping_basis is already NOT NULL (a
-- prior run of this exact migration already succeeded), the backfill
-- UPDATEs affect 0 rows (their WHERE clauses only target
-- mapping_basis IS NULL) and the final ALTER ... SET NOT NULL is a no-op.

begin;

do $$
declare
  v_total_rows int;
  v_multi_provider_rows int;
  v_single_provider_rows int;
  v_zero_provider_rows int;
  v_teamless_rows int;
  v_already_backfilled int;
begin
  select count(*) into v_total_rows from public.player_mappings;
  select count(*) into v_multi_provider_rows from public.player_mappings
    where (espn_id is not null)::int + (yahoo_id is not null)::int + (sleeper_id is not null)::int >= 2;
  select count(*) into v_single_provider_rows from public.player_mappings
    where (espn_id is not null)::int + (yahoo_id is not null)::int + (sleeper_id is not null)::int = 1;
  select count(*) into v_zero_provider_rows from public.player_mappings
    where espn_id is null and yahoo_id is null and sleeper_id is null;
  select count(*) into v_teamless_rows from public.player_mappings where nfl_team is null;

  raise notice 'PRECONDITION: % total rows, % multi-provider, % single-provider, % zero-provider (must be 0), % teamless',
    v_total_rows, v_multi_provider_rows, v_single_provider_rows, v_zero_provider_rows, v_teamless_rows;

  if v_zero_provider_rows > 0 then
    raise exception 'Refusing to backfill: % row(s) have no provider ID at all (espn_id, yahoo_id, sleeper_id all null) — cannot assign a mapping_basis without guessing. Investigate these rows manually before re-running this migration.', v_zero_provider_rows;
  end if;
end $$;

-- ─── 1. Add columns (additive, nullable at first) ──────────────────────
alter table public.player_mappings
  add column if not exists mapping_basis text
    check (mapping_basis in ('provider_id_reuse', 'name_team_unambiguous', 'single_platform')),
  add column if not exists teamless_activity_unverified boolean not null default false;

-- ─── 2. Backfill mapping_basis for existing rows ───────────────────────
-- Only ever touches rows where mapping_basis IS NULL — safe to re-run.
update public.player_mappings
set mapping_basis = 'name_team_unambiguous'
where mapping_basis is null
  and (espn_id is not null)::int + (yahoo_id is not null)::int + (sleeper_id is not null)::int >= 2;

update public.player_mappings
set mapping_basis = 'single_platform'
where mapping_basis is null
  and (espn_id is not null)::int + (yahoo_id is not null)::int + (sleeper_id is not null)::int = 1;

-- ─── 3. Backfill teamless_activity_unverified for existing rows ────────
update public.player_mappings
set teamless_activity_unverified = true
where nfl_team is null
  and teamless_activity_unverified = false;

-- ─── 4. Postcondition check + NOT NULL ──────────────────────────────────
do $$
declare
  v_null_basis_remaining int;
  v_provider_id_reuse int;
  v_name_team_unambiguous int;
  v_single_platform int;
  v_teamless_flagged int;
begin
  select count(*) into v_null_basis_remaining from public.player_mappings where mapping_basis is null;

  if v_null_basis_remaining > 0 then
    raise exception 'Backfill left % row(s) with mapping_basis still null — refusing to add the NOT NULL constraint. This should be impossible given the precondition check above; investigate before re-running.', v_null_basis_remaining;
  end if;

  select count(*) filter (where mapping_basis = 'provider_id_reuse'),
         count(*) filter (where mapping_basis = 'name_team_unambiguous'),
         count(*) filter (where mapping_basis = 'single_platform'),
         count(*) filter (where teamless_activity_unverified = true)
    into v_provider_id_reuse, v_name_team_unambiguous, v_single_platform, v_teamless_flagged
  from public.player_mappings;

  raise notice 'POSTCONDITION: mapping_basis distribution — provider_id_reuse=%, name_team_unambiguous=%, single_platform=%, teamless_activity_unverified=true count=%',
    v_provider_id_reuse, v_name_team_unambiguous, v_single_platform, v_teamless_flagged;
end $$;

alter table public.player_mappings
  alter column mapping_basis set not null;

commit;
