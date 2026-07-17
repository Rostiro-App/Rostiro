-- Player mapping provider-ID uniqueness (Packet 03, P3-4, 2026-07-17).
-- Proposed forward migration — NOT applied to production. Defense-in-depth
-- only: lib/playerMappingSeed.ts's buildPlayerMappingSeedPlan already
-- detects and refuses to write duplicate/colliding provider IDs in memory
-- before any write happens, and public.player_mappings currently has 0
-- rows in production (verified via a live query, 2026-07-17) — so this is
-- not fixing an existing data problem, it's a safety net against a future
-- seed-script bug or a concurrent write ever inserting two rows that
-- claim the same platform's player ID, which would silently corrupt every
-- future identity resolution for that player (lib/playerIdentity.ts's
-- exact-match step assumes at most one mapping row per provider ID).
--
-- Partial (WHERE ... IS NOT NULL) because most rows will only have ONE of
-- espn_id/yahoo_id/sleeper_id populated at first (see the Packet 03
-- completion report — players_cache has zero ESPN/Yahoo rows today, only
-- Sleeper), and a plain unique index would otherwise reject multiple NULLs
-- from ever coexisting, which is not the intent here.
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
