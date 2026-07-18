-- Player mapping constraints (Packet 03, P3-4 + P3-4B, 2026-07-17).
-- Status: APPLIED to production 2026-07-17 (P3-10). Verified: nfl_team
-- is nullable; all 3 partial unique indexes exist; 0 pre-existing rows
-- meant no precondition violations were possible. Do not re-edit this
-- file — it's a historical record now; any further change belongs in a
-- new forward migration.

-- ─── 1. nfl_team becomes nullable (P3-4B) ──────────────────────────────────
-- A player with no current NFL team on record but a real activity signal
-- (ownership % or ADP) is a legitimate mapping with a genuinely preserved
-- provider identity — lib/playerMappingSeed.ts's buildPlayerMappingSeedPlan never
-- represents that with a placeholder team string ('', 'FA', etc.), only
-- with a real null. The original schema's `nfl_team text not null`
-- constraint would reject that honest representation outright, forcing a
-- placeholder — this migration removes the constraint so "no team" can
-- mean "no team," not "we don't know" or "we made something up."
--
-- unique(name, nfl_team, season) is untouched and still works correctly
-- with nulls: Postgres treats NULL <> NULL in a unique constraint, so
-- multiple teamless players sharing a name can coexist with nfl_team = null
-- without violating uniqueness — collision prevention for that case is
-- handled in memory by buildPlayerMappingSeedPlan before any write
-- happens, not by this constraint.
alter table public.player_mappings alter column nfl_team drop not null;

-- ─── 2. Partial uniqueness per non-null provider ID (P3-4) ─────────────────
-- Defense-in-depth only: lib/playerMappingSeed.ts's buildPlayerMappingSeedPlan
-- already detects and refuses to write duplicate/colliding provider IDs in
-- memory before any write happens, and public.player_mappings currently
-- has 0 rows in production (verified via a live query, 2026-07-17) — so
-- this is not fixing an existing data problem, it's a safety net against a
-- future seed-script bug or a concurrent write ever inserting two rows
-- that claim the same platform's player ID, which would silently corrupt
-- every future identity resolution for that player
-- (lib/playerIdentity.ts's exact-match step assumes at most one mapping
-- row per provider ID).
--
-- Partial (WHERE ... IS NOT NULL) because most rows will only have ONE of
-- espn_id/yahoo_id/sleeper_id populated at first (players_cache has zero
-- Yahoo rows, and ESPN rows only exist once P3-4B's ingestion runner is
-- explicitly run with --write), and a plain unique index would otherwise
-- reject multiple NULLs from ever coexisting, which is not the intent.
--
-- Idempotent; safe to re-run.
create unique index if not exists idx_player_mappings_espn_id_unique
  on public.player_mappings (espn_id)
  where espn_id is not null;

create unique index if not exists idx_player_mappings_yahoo_id_unique
  on public.player_mappings (yahoo_id)
  where yahoo_id is not null;

create unique index if not exists idx_player_mappings_sleeper_id_unique
  on public.player_mappings (sleeper_id)
  where sleeper_id is not null;
