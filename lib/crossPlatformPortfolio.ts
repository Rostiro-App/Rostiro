// Packet 03, P3-6: cross-platform Portfolio exposure + League Health.
// Consumes lib/rosterSnapshotSync.ts's NormalizedRosterSnapshot rows —
// never refetches or reinterprets raw Sleeper/ESPN roster data itself.
// Deduplicates exposure strictly by canonicalPlayerId (lib/playerIdentity.ts's
// resolution, already baked into every snapshot's players[] by the
// adapters — see lib/platforms/sleeper.ts / lib/platforms/espn.ts).
//
// League Health reuses lib/healthScore.ts's computeLeagueHealth
// UNCHANGED — this file only builds an equivalent, platform-neutral
// HealthInput from a canonical snapshot plus an ADP lookup, and wraps the
// result with factor-coverage + ADP-source disclosure. The existing
// Sleeper-only production path (app/api/system/status/route.ts,
// lib/pulse.ts, lib/portfolio.ts) is untouched by this file.

import type { NormalizedRosterSnapshot, SnapshotFreshness } from '@/lib/platforms'
import { computeLeagueHealth, type HealthInput, type HealthPlayer } from '@/lib/healthScore'
import type { LeagueHealth, Platform } from '@/types'

// ─── Exposure ─────────────────────────────────────────────────────────────

export interface LeagueSnapshotEntry {
  connectedLeagueId: string
  leagueName: string
  platform: Platform
  freshness: SnapshotFreshness
  // null when freshness is 'unavailable' | 'unsupported' | 'approval_pending'
  // — those leagues are excluded from exposure but still reportable via
  // coverage (see computeUserCrossPlatformPortfolio).
  snapshot: NormalizedRosterSnapshot | null
}

export interface ExposureLeagueDetail {
  connectedLeagueId: string
  leagueName: string
  platform: Platform
  lineupStatus: string
  freshness: SnapshotFreshness
  capturedAt: string
}

export interface ResolvedExposureEntry {
  canonicalPlayerId: string
  displayName: string
  exposureCount: number
  starterCount: number
  benchCount: number
  leagues: ExposureLeagueDetail[]
}

// Keyed by platform + raw source player ID — NEVER by display name, so two
// different real players who happen to share a name are never conflated,
// and the same unresolved player seen in two different leagues on the
// SAME platform is still tracked as one identity (same platform:sourceId).
export interface UnresolvedExposureEntry {
  key: string // `${platform}:${sourcePlayerId}`
  platform: Platform
  sourcePlayerId: string
  displayName: string
  leagues: ExposureLeagueDetail[]
}

export interface ExposureResult {
  resolved: ResolvedExposureEntry[]
  unresolved: UnresolvedExposureEntry[]
}

// Only a fresh or stale snapshot contributes real roster data. A stale
// snapshot IS included (never silently dropped) but always carries its
// real capturedAt so a consumer can show "as of 2 days ago" rather than
// implying live accuracy — this is what makes 'stale' safe to use at all.
const USABLE_FRESHNESS: ReadonlySet<SnapshotFreshness> = new Set(['fresh', 'stale'])

export function computeCrossPlatformExposure(entries: LeagueSnapshotEntry[]): ExposureResult {
  const resolvedMap = new Map<string, ResolvedExposureEntry>()
  const unresolvedMap = new Map<string, UnresolvedExposureEntry>()

  for (const entry of entries) {
    if (!USABLE_FRESHNESS.has(entry.freshness) || !entry.snapshot) continue

    for (const player of entry.snapshot.players) {
      const detail: ExposureLeagueDetail = {
        connectedLeagueId: entry.connectedLeagueId,
        leagueName: entry.leagueName,
        platform: entry.platform,
        lineupStatus: player.lineupStatus,
        freshness: entry.freshness,
        capturedAt: entry.snapshot.capturedAt,
      }

      if (player.canonicalPlayerId) {
        const key = player.canonicalPlayerId
        const existing = resolvedMap.get(key)
        if (existing) {
          existing.exposureCount++
          if (player.lineupStatus === 'starting') existing.starterCount++
          else existing.benchCount++
          existing.leagues.push(detail)
        } else {
          resolvedMap.set(key, {
            canonicalPlayerId: key,
            displayName: player.displayName,
            exposureCount: 1,
            starterCount: player.lineupStatus === 'starting' ? 1 : 0,
            benchCount: player.lineupStatus === 'starting' ? 0 : 1,
            leagues: [detail],
          })
        }
      } else {
        // Never keyed by display name — two unresolved players who share
        // a name (a real, non-rare case) must never merge into one entry.
        const key = `${player.sourcePlatform}:${player.sourcePlayerId}`
        const existing = unresolvedMap.get(key)
        if (existing) {
          existing.leagues.push(detail)
        } else {
          unresolvedMap.set(key, {
            key,
            platform: player.sourcePlatform,
            sourcePlayerId: player.sourcePlayerId,
            displayName: player.displayName,
            leagues: [detail],
          })
        }
      }
    }
  }

  return {
    resolved: Array.from(resolvedMap.values()),
    unresolved: Array.from(unresolvedMap.values()),
  }
}

// ─── League Health (cross-platform, same computeLeagueHealth) ────────────

export type AdpSource = 'consensus' | 'sleeper' | 'espn' | 'mixed' | 'unknown'

export interface PlayerAdpRow {
  // Keyed by the SAME identity computeCrossPlatformExposure uses —
  // canonicalPlayerId when resolved, `${platform}:${sourcePlayerId}` when not.
  key: string
  adpConsensus: number | null
  adpPlatformSpecific: number | null // adp_sleeper or adp_espn, matching the snapshot's platform
  injuryStatus: string | null
}

export interface HealthBuildResult {
  input: HealthInput
  adpSource: AdpSource
  // How many of myPlayers actually had ANY ADP value at all — distinct
  // from factor coverage (which is about computeLeagueHealth's 5 factors),
  // this is about how much of the ADP lookup itself succeeded.
  playersWithAdp: number
  playersTotal: number
}

function playerKey(player: { canonicalPlayerId: string | null; sourcePlatform: Platform; sourcePlayerId: string }): string {
  return player.canonicalPlayerId ?? `${player.sourcePlatform}:${player.sourcePlayerId}`
}

/**
 * Builds a HealthInput from a canonical roster snapshot — the SAME shape
 * every existing Sleeper-only call site already produces, just sourced
 * from cross-platform data instead of a direct players_cache query.
 * `computeLeagueHealth` itself is never modified or duplicated.
 *
 * ADP source discipline: adp_consensus is preferred when present (it's
 * platform-neutral by construction); otherwise the snapshot's OWN
 * platform's ADP field is used per player and the fallback is disclosed
 * via `adpSource`. Different players' ADP values are never silently
 * treated as comparable when they come from different source fields
 * without disclosing that mix — `adpSource: 'mixed'` exists exactly for
 * that case, not to hide it.
 */
export function buildHealthInputFromSnapshot(
  snapshot: NormalizedRosterSnapshot,
  adpLookup: Map<string, PlayerAdpRow>,
  bestFreeAgentAdp: number | null,
  bestFreeAgentName: string | null
): HealthBuildResult {
  const sourcesUsed = new Set<'consensus' | 'platform_specific'>()
  let playersWithAdp = 0

  const myPlayers: HealthPlayer[] = snapshot.players.map((player) => {
    const row = adpLookup.get(playerKey(player))
    let adp: number | null = null
    if (row?.adpConsensus !== null && row?.adpConsensus !== undefined) {
      adp = row.adpConsensus
      sourcesUsed.add('consensus')
    } else if (row?.adpPlatformSpecific !== null && row?.adpPlatformSpecific !== undefined) {
      adp = row.adpPlatformSpecific
      sourcesUsed.add('platform_specific')
    }
    if (adp !== null) playersWithAdp++
    return { playerId: playerKey(player), adp, injuryStatus: row?.injuryStatus ?? null }
  })

  const starterIds = snapshot.players.filter((p) => p.lineupStatus === 'starting').map((p) => playerKey(p))

  let adpSource: AdpSource
  if (sourcesUsed.size === 0) adpSource = 'unknown'
  else if (sourcesUsed.has('consensus') && sourcesUsed.has('platform_specific')) adpSource = 'mixed'
  else if (sourcesUsed.has('consensus')) adpSource = 'consensus'
  else adpSource = snapshot.platform === 'espn' ? 'espn' : snapshot.platform === 'sleeper' ? 'sleeper' : 'unknown'

  return {
    input: { myPlayers, starterIds, bestFreeAgentAdp, bestFreeAgentName },
    adpSource,
    playersWithAdp,
    playersTotal: snapshot.players.length,
  }
}

export interface FactorCoverage {
  available: number
  total: number
}

export interface CrossPlatformHealthResult {
  health: LeagueHealth
  factorCoverage: FactorCoverage
  adpSource: AdpSource
  playersWithAdp: number
  playersTotal: number
}

/**
 * Runs the SAME, unmodified computeLeagueHealth against a cross-platform
 * snapshot's built HealthInput, then attaches factor coverage (how many
 * of the 5 PRD factors actually had data — bye/matchup are permanently
 * null today for every platform, never fabricated) and ADP source
 * disclosure. This is the one function P3-6's acceptance test proves
 * produces IDENTICAL scores for equivalent Sleeper and ESPN inputs.
 */
export function computeCrossPlatformLeagueHealth(
  snapshot: NormalizedRosterSnapshot,
  adpLookup: Map<string, PlayerAdpRow>,
  bestFreeAgentAdp: number | null,
  bestFreeAgentName: string | null
): CrossPlatformHealthResult {
  const built = buildHealthInputFromSnapshot(snapshot, adpLookup, bestFreeAgentAdp, bestFreeAgentName)
  const health = computeLeagueHealth(built.input)
  const factorCoverage: FactorCoverage = {
    available: health.factors.filter((f) => f.score !== null).length,
    total: health.factors.length,
  }
  return { health, factorCoverage, adpSource: built.adpSource, playersWithAdp: built.playersWithAdp, playersTotal: built.playersTotal }
}
