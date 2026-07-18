-- Portfolio exposure schema versioning (Packet 03, P3-6, 2026-07-17).
-- Proposed forward migration — NOT applied to production.
--
-- public.portfolio_exposure_snapshots currently has 15 real rows (verified
-- via a live query, 2026-07-17) whose `player_id` is a RAW SLEEPER PLAYER
-- ID — lib/portfolio.ts's old, Sleeper-only computeUserPortfolioSnapshot
-- never ran any of this through lib/playerIdentity.ts's canonical
-- resolution. P3-6's new cross-platform exposure pipeline
-- (lib/crossPlatformPortfolio.ts) writes CANONICAL player_mappings.id
-- values instead. Those are two genuinely different ID spaces (a raw
-- Sleeper ID is a short numeric string; a canonical ID is a
-- player_mappings uuid) — silently treating old rows as if they held
-- canonical IDs would misattribute exposure to the wrong player (or to no
-- player at all) the first time a UUID happened to collide with a lookup,
-- and would corrupt any historical trend that spans both eras.
--
-- schema_version distinguishes the two eras explicitly rather than
-- leaving a future reader to guess from the string shape. Existing rows
-- backfill to 1 (sleeper_raw) via the column default; nothing already
-- written is touched or reinterpreted. New rows written by the P3-6
-- pipeline must set schema_version = 2 explicitly.
--
-- Idempotent; safe to re-run.

alter table public.portfolio_exposure_snapshots
  add column if not exists schema_version integer not null default 1,
  add column if not exists player_id_space text not null default 'sleeper_raw'
    check (player_id_space in ('sleeper_raw', 'canonical'));

-- Symmetry with the exposure table — health rows don't carry a
-- player-identity ambiguity (keyed by league_id, not player_id), but the
-- computation METHODOLOGY itself has changed (factor coverage + ADP
-- source disclosure are new in P3-6) — versioning this too means a future
-- reader can tell "this score has no factorCoverage/adpSource because it
-- predates that" apart from "this score is somehow malformed."
alter table public.portfolio_health_snapshots
  add column if not exists schema_version integer not null default 1;
