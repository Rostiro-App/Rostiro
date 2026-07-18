// Packet 02, Workstream F: canonical player identity resolution with an
// explicit confidence label — replaces silent name-only matching (the
// pattern player_mappings.yahoo_id being "currently unseeded" forced
// app/api/draft/session/[id]/picks/route.ts and lib/yahoo.ts's
// getYahooPlayersByKeys to fall back to) with a resolver that reports HOW
// confident a match is, and refuses to merge two players on a name match
// alone when more than one candidate could plausibly be the same player.
//
// Packet 03 will use this across Pulse and cross-league exposure
// calculations, once real Yahoo player data exists to test it against —
// see the Packet 02 completion report for what's still unverified.

import type { Platform } from '@/types'
import type { SupabaseClient } from '@supabase/supabase-js'

// Packet 03: named and exported (was an inline literal union) so
// lib/platforms/types.ts's NormalizedRosterPlayer/NormalizedAvailablePlayer
// can reuse the exact same confidence vocabulary this resolver produces,
// rather than redefining an equivalent-but-separate union that could
// silently drift out of sync.
export type PlayerIdentityConfidence = 'exact' | 'verified_alias' | 'name_team' | 'unresolved'

export interface PlayerIdentityResolution {
  canonicalPlayerId: string | null
  sourcePlatform: Platform
  sourcePlayerId: string
  confidence: PlayerIdentityConfidence
  reason: string
}

export interface PlayerMappingRow {
  id: string
  name: string
  nflTeam: string
  position: string | null
  espnId: string | null
  yahooId: string | null
  sleeperId: string | null
  // P3-11 correction: optional because the column doesn't exist in
  // production until supabase/migration_player_mapping_provenance.sql
  // (PROPOSED, not applied) is separately approved and applied.
  // fetchActivePlayerMappings below DOES select this column — this field
  // will be undefined only until that migration lands; once it does, this
  // becomes real data with no further code change needed here.
  mappingBasis?: 'provider_id_reuse' | 'name_team_unambiguous' | 'single_platform' | null
}

export interface PlayerIdentityInput {
  platform: Platform
  sourcePlayerId: string
  name: string
  nflTeam: string
  position?: string | null
}

// Strips punctuation/suffixes a raw platform response commonly varies on
// (periods, apostrophes, hyphens, Jr./Sr./II/III/IV) so "A.J. Brown",
// "AJ Brown", and "A.J. Brown Jr." all normalize the same — collision
// detection below is what keeps this safe (two DIFFERENT players never
// silently merge just because they normalize to the same string).
export function normalizePlayerName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[.']/g, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.replace(/\s+(jr|sr|ii|iii|iv|v)$/, '')
}

function platformColumn(platform: Platform): keyof Pick<PlayerMappingRow, 'espnId' | 'yahooId' | 'sleeperId'> {
  if (platform === 'yahoo') return 'yahooId'
  if (platform === 'sleeper') return 'sleeperId'
  return 'espnId'
}

// Pure — no DB access — so every resolution-order case (exact, name+team,
// team-change, duplicate-name collision, defense, free agent, unresolved)
// can be tested deterministically against an in-memory candidate list
// (lib/playerIdentity.test.ts), independent of a real Supabase connection.
export function resolvePlayerIdentityPure(
  candidates: PlayerMappingRow[],
  input: PlayerIdentityInput
): PlayerIdentityResolution {
  const { platform, sourcePlayerId } = input
  const col = platformColumn(platform)

  // 1. Exact stored platform mapping.
  const exact = candidates.find((c) => c[col] === sourcePlayerId)
  if (exact) {
    const colName = col === 'yahooId' ? 'yahoo_id' : col === 'sleeperId' ? 'sleeper_id' : 'espn_id'
    // P3-11 correction: a row's cross-platform link can come from a real
    // provider ID re-match (matchBasis 'provider_id_reuse') OR from a
    // name+team heuristic applied once at seed time (matchBasis
    // 'name_team_unambiguous' — see lib/playerMappingSeed.ts's MatchBasis).
    // Only the former earns 'exact' confidence; a heuristically-linked row
    // must never silently present as fully verified just because its
    // provider ID is now stored on file. Reported as 'name_team' rather
    // than 'verified_alias' — 'verified_alias' would itself be a
    // mislabeling, since (per step 2 below) no independently verified
    // second source exists in this codebase yet; 'name_team' is the
    // existing, honest label for exactly this kind of heuristic match.
    // Conservative at row granularity (mappingBasis describes the whole
    // row, not which specific column was heuristically linked) — this can
    // under-claim confidence for a column that was genuinely the row's
    // original single-platform ID, but never over-claims, which is the
    // failure mode this guard exists to prevent.
    if (exact.mappingBasis === 'name_team_unambiguous') {
      return {
        canonicalPlayerId: exact.id,
        sourcePlatform: platform,
        sourcePlayerId,
        confidence: 'name_team',
        reason: `Matched via stored player_mappings.${colName}, but this row's cross-platform link was established by a name+team heuristic at seed time, not independent provider confirmation`,
      }
    }
    return {
      canonicalPlayerId: exact.id,
      sourcePlatform: platform,
      sourcePlayerId,
      confidence: 'exact',
      reason: `Matched via stored player_mappings.${colName}`,
    }
  }

  // 2. Verified external crosswalk. No independent, verified second source
  // exists in this codebase yet (e.g. an nflverse gsis_id-keyed join
  // confirmed against a live authorized Yahoo/Sleeper/ESPN response would
  // qualify). Deliberately falls through to step 3 rather than promoting
  // to 'verified_alias' without one — never claim a confidence level this
  // resolver can't actually back up yet.

  const isDefense = input.position === 'DEF'
  if (isDefense) {
    const defMatches = candidates.filter((c) => c.position === 'DEF' && c.nflTeam === input.nflTeam)
    if (defMatches.length === 1) {
      return {
        canonicalPlayerId: defMatches[0].id,
        sourcePlatform: platform,
        sourcePlayerId,
        confidence: 'name_team',
        reason: `Matched team defense by NFL team (${input.nflTeam})`,
      }
    }
    return {
      canonicalPlayerId: null,
      sourcePlatform: platform,
      sourcePlayerId,
      confidence: 'unresolved',
      reason: defMatches.length > 1
        ? `${defMatches.length} defense rows matched team ${input.nflTeam} — collision, cannot resolve safely`
        : `No defense mapping found for team ${input.nflTeam}`,
    }
  }

  const normalizedInputName = normalizePlayerName(input.name)

  // 3a. Normalized name + current NFL team.
  const sameTeamMatches = candidates.filter(
    (c) => normalizePlayerName(c.name) === normalizedInputName && c.nflTeam === input.nflTeam
  )
  if (sameTeamMatches.length === 1) {
    return {
      canonicalPlayerId: sameTeamMatches[0].id,
      sourcePlatform: platform,
      sourcePlayerId,
      confidence: 'name_team',
      reason: 'Matched by normalized name + NFL team',
    }
  }
  if (sameTeamMatches.length > 1) {
    return {
      canonicalPlayerId: null,
      sourcePlatform: platform,
      sourcePlayerId,
      confidence: 'unresolved',
      reason: `${sameTeamMatches.length} players matched name + team ${input.nflTeam} — collision, cannot resolve safely`,
    }
  }

  // 3b. Name-only fallback — handles a real team change (a trade since
  // player_mappings was last refreshed) or a free agent (nflTeam not
  // meaningfully matchable). Only resolves when EXACTLY one candidate
  // anywhere shares this normalized name; two+ is exactly the ambiguous
  // "duplicate name, different team" case this step exists to catch
  // rather than silently guess through.
  const nameOnlyMatches = candidates.filter((c) => normalizePlayerName(c.name) === normalizedInputName)
  if (nameOnlyMatches.length === 1) {
    const matchedTeam = nameOnlyMatches[0].nflTeam
    return {
      canonicalPlayerId: nameOnlyMatches[0].id,
      sourcePlatform: platform,
      sourcePlayerId,
      confidence: 'name_team',
      reason: matchedTeam === input.nflTeam
        ? 'Matched by normalized name + NFL team'
        : `Matched by name only — stored team (${matchedTeam}) differs from source team (${input.nflTeam}), likely a team change`,
    }
  }
  if (nameOnlyMatches.length > 1) {
    return {
      canonicalPlayerId: null,
      sourcePlatform: platform,
      sourcePlayerId,
      confidence: 'unresolved',
      reason: `${nameOnlyMatches.length} players share this name across different teams — collision, cannot resolve safely without a team match`,
    }
  }

  // 4. Unresolved.
  return {
    canonicalPlayerId: null,
    sourcePlatform: platform,
    sourcePlayerId,
    confidence: 'unresolved',
    reason: 'No stored mapping or name/team match found',
  }
}

// Fetches the active player_mappings universe once. Packet 03 adapters
// resolving a whole roster (15-20+ players) at once should call this ONCE
// and reuse the result across every resolvePlayerIdentityPure call, rather
// than letting resolvePlayerIdentity below refetch the entire table per
// player — a full-roster sync doing that is 15-20 redundant table scans.
export async function fetchActivePlayerMappings(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, any, any>
): Promise<PlayerMappingRow[]> {
  const { data, error } = await admin
    .from('player_mappings')
    .select('id, name, nfl_team, position, espn_id, yahoo_id, sleeper_id, mapping_basis')
    .eq('is_active', true)

  // P3-11 correction: a real DB failure here must NEVER be treated the
  // same as "zero active mappings" — every caller (roster-sync adapters,
  // resolvePlayerIdentity below) would otherwise silently resolve every
  // player as 'unresolved', which looks identical to a genuinely empty
  // table. Thrown so callers' existing try/catch (lib/platforms/*.ts
  // already wraps every read in one) surfaces this as a real 'failed'
  // result instead.
  if (error) throw new Error(`Failed to load player_mappings: ${error.message}`)

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    nflTeam: row.nfl_team,
    position: row.position,
    espnId: row.espn_id,
    yahooId: row.yahoo_id,
    sleeperId: row.sleeper_id,
    mappingBasis: row.mapping_basis,
  }))
}

// DB-backed entry point for resolving a SINGLE player — fetches the active
// player_mappings universe fresh and delegates to the pure resolver above.
// Callers resolving many players at once (Packet 03's roster-sync
// adapters) should call fetchActivePlayerMappings once themselves and use
// resolvePlayerIdentityPure directly per player instead of calling this in
// a loop.
export async function resolvePlayerIdentity(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, any, any>,
  input: PlayerIdentityInput
): Promise<PlayerIdentityResolution> {
  const candidates = await fetchActivePlayerMappings(admin)
  return resolvePlayerIdentityPure(candidates, input)
}
