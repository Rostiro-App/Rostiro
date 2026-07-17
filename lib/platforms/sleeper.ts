// Packet 02: proves the canonical platform contract (lib/platforms/types.ts)
// is genuinely cross-platform, not a dormant abstraction built only for
// Yahoo — adapts lib/normalize.ts's existing normalizeSleeperLeague()
// output onto NormalizedLeague. Deliberately not a rewrite of Sleeper's
// normalization logic itself (out of scope for this packet); this only
// adds the fields NormalizedLeague requires that League doesn't carry.
//
// Packet 03: also the first real PlatformIntelligenceAdapter implementation
// — server-only from this point on (createAdminClient, lib/sleeper.ts).
// Built from lib/sleeper.ts's real, already-shipped response shapes
// (SleeperRoster/SleeperMatchup/SleeperDraft, all live-verified by prior
// features), not invented against documentation.

import type { League } from '@/types'
import { SleeperAPIError } from '@/types'
import { createAdminClient } from '@/lib/supabase'
import { fetchActivePlayerMappings, resolvePlayerIdentityPure } from '@/lib/playerIdentity'
import {
  getSleeperRosters,
  getSleeperMatchups,
  getSleeperDrafts,
  type SleeperRoster,
  type SleeperDraft,
} from '@/lib/sleeper'
import type {
  NormalizedLeague,
  PlatformCapabilities,
  ConnectedLeagueContext,
  IntelligenceReadResult,
  NormalizedRosterSnapshot,
  NormalizedRosterPlayer,
  NormalizedMatchup,
  NormalizedAvailablePlayer,
  NormalizedDraftInfo,
  NormalizedDraftStatus,
  DataQualityWarning,
  PlatformIntelligenceAdapter,
} from './types'
import { ROSTER_SNAPSHOT_SCHEMA_VERSION } from './types'

// lib/sleeper.ts has no lineup/waiver/trade write functions implemented
// today — Draft Kit and league sync are read-only in this codebase — so
// these mirror actual shipped code, not Sleeper's API's theoretical
// capability. Update this if/when a real Sleeper write path ships.
export const SLEEPER_CAPABILITIES: PlatformCapabilities = {
  leagueRead: true,
  rosterRead: true,
  matchupRead: true,
  draftRead: true,
  freeAgentRead: true,
  lineupWrite: false,
  waiverWrite: false,
  tradeWrite: false,
}

// Sleeper's raw settings/scoring_settings response doesn't carry draft
// scheduling or waiver-type metadata through the existing normalizer, so
// those are honestly reported unknown/empty here rather than guessed —
// same "don't invent a value you can't verify" discipline as the rest of
// lib/normalize.ts.
export function toNormalizedSleeperLeague(league: League): NormalizedLeague {
  return {
    ...league,
    leagueStatus: 'unknown',
    draft: { status: 'unknown', scheduledAt: null },
    waiver: { type: 'unknown', faabBudget: null, waiverDay: null, waiverHour: null },
    capabilities: SLEEPER_CAPABILITIES,
    warnings: [],
  }
}

// ─── Packet 03: intelligence adapter ─────────────────────────────────────────

interface CachedPlayerRow {
  player_id: string
  name: string
  position: string | null
  nfl_team: string | null
  adp_sleeper: number | null
}

async function fetchPlayerCacheRows(playerIds: string[]): Promise<Map<string, CachedPlayerRow>> {
  if (playerIds.length === 0) return new Map()
  const admin = createAdminClient()
  const { data } = await admin
    .from('players_cache')
    .select('player_id, name, position, nfl_team, adp_sleeper')
    .eq('platform', 'sleeper')
    .in('player_id', playerIds)
  return new Map(((data ?? []) as CachedPlayerRow[]).map((p) => [p.player_id, p]))
}

export async function sleeperReadOwnedRoster(
  context: ConnectedLeagueContext
): Promise<IntelligenceReadResult<NormalizedRosterSnapshot>> {
  try {
    const rosters = await getSleeperRosters(context.externalLeagueId)
    const myRoster = rosters.find((r: SleeperRoster) => String(r.roster_id) === context.externalTeamId)
    if (!myRoster) {
      return { status: 'failed', data: null, warnings: [], errorReason: "Owned roster not found in this league's roster list" }
    }

    const playerIds = Array.isArray(myRoster.players) ? myRoster.players : []
    const starterIds = new Set(Array.isArray(myRoster.starters) ? myRoster.starters : [])

    const admin = createAdminClient()
    const [cacheMap, mappingCandidates] = await Promise.all([
      fetchPlayerCacheRows(playerIds),
      fetchActivePlayerMappings(admin),
    ])

    const warnings: DataQualityWarning[] = []
    const players: NormalizedRosterPlayer[] = playerIds.map((playerId) => {
      const cached = cacheMap.get(playerId)
      const resolution = resolvePlayerIdentityPure(mappingCandidates, {
        platform: 'sleeper',
        sourcePlayerId: playerId,
        name: cached?.name ?? '',
        nflTeam: cached?.nfl_team ?? '',
        position: cached?.position ?? null,
      })
      if (resolution.confidence === 'unresolved') {
        warnings.push({ field: `players.${playerId}`, message: resolution.reason })
      }
      return {
        canonicalPlayerId: resolution.canonicalPlayerId,
        sourcePlatform: 'sleeper',
        sourcePlayerId: playerId,
        displayName: cached?.name ?? playerId,
        nflTeam: cached?.nfl_team ?? null,
        position: cached?.position ?? null,
        lineupStatus: starterIds.has(playerId) ? 'starting' : 'bench',
        slot: null,
        identityConfidence: resolution.confidence,
        identityReason: resolution.reason,
      }
    })

    const snapshot: NormalizedRosterSnapshot = {
      schemaVersion: ROSTER_SNAPSHOT_SCHEMA_VERSION,
      connectedLeagueId: context.connectedLeagueId,
      platform: 'sleeper',
      externalLeagueId: context.externalLeagueId,
      externalTeamId: context.externalTeamId,
      capturedAt: new Date().toISOString(),
      // Sleeper's /league/{id}/rosters response carries no last-modified
      // timestamp of its own — capturedAt is the only real freshness signal
      // available for this platform.
      providerUpdatedAt: null,
      players,
      warnings,
    }

    return { status: 'ok', data: snapshot, warnings }
  } catch (err) {
    return {
      status: 'failed',
      data: null,
      warnings: [],
      errorReason: err instanceof SleeperAPIError ? err.message : 'Could not read Sleeper roster',
    }
  }
}

export async function sleeperReadMatchup(
  context: ConnectedLeagueContext,
  week: number
): Promise<IntelligenceReadResult<NormalizedMatchup>> {
  try {
    const matchups = await getSleeperMatchups(context.externalLeagueId, week)
    const myRosterId = Number(context.externalTeamId)
    const mine = matchups.find((m) => m.roster_id === myRosterId)
    if (!mine) {
      return { status: 'failed', data: null, warnings: [], errorReason: 'No matchup found for this roster and week' }
    }
    const opponent = mine.matchup_id != null
      ? matchups.find((m) => m.matchup_id === mine.matchup_id && m.roster_id !== myRosterId)
      : undefined

    const matchup: NormalizedMatchup = {
      connectedLeagueId: context.connectedLeagueId,
      platform: 'sleeper',
      week,
      myTeamId: context.externalTeamId,
      opponentTeamId: opponent ? String(opponent.roster_id) : null,
      myScore: mine.points ?? null,
      opponentScore: opponent?.points ?? null,
      // Sleeper's matchups endpoint carries no projection field.
      myProjectedScore: null,
      opponentProjectedScore: null,
      // Sleeper exposes no pregame/live/final flag on this endpoint —
      // callers needing that should cross-reference nfl_schedule/
      // live_scores rather than have this adapter guess.
      status: 'unknown',
      capturedAt: new Date().toISOString(),
      warnings: [],
    }
    return { status: 'ok', data: matchup, warnings: [] }
  } catch (err) {
    return {
      status: 'failed',
      data: null,
      warnings: [],
      errorReason: err instanceof SleeperAPIError ? err.message : 'Could not read Sleeper matchup',
    }
  }
}

// Bounded, not the entire free-agent universe (Sleeper's player pool is
// 10k+ entries) — the top FREE_AGENT_POOL_SIZE by ADP among players not
// currently rostered by anyone in the league, same shape as the existing
// waiver-alert candidate logic in lib/pulse.ts (rosteredIds exclusion set
// built from every roster in the league, not just the caller's own).
const FREE_AGENT_POOL_SIZE = 25

export async function sleeperReadAvailablePlayers(
  context: ConnectedLeagueContext
): Promise<IntelligenceReadResult<NormalizedAvailablePlayer[]>> {
  try {
    const rosters = await getSleeperRosters(context.externalLeagueId)
    const rosteredIds = new Set(rosters.flatMap((r: SleeperRoster) => (Array.isArray(r.players) ? r.players : [])))

    const admin = createAdminClient()
    const [{ data: topPool }, mappingCandidates] = await Promise.all([
      admin
        .from('players_cache')
        .select('player_id, name, position, nfl_team, adp_sleeper')
        .eq('platform', 'sleeper')
        .not('adp_sleeper', 'is', null)
        .order('adp_sleeper', { ascending: true })
        .limit(FREE_AGENT_POOL_SIZE * 4), // over-fetch: many top-ADP players will already be rostered
      fetchActivePlayerMappings(admin),
    ])

    const available: NormalizedAvailablePlayer[] = []
    for (const p of (topPool ?? []) as CachedPlayerRow[]) {
      if (rosteredIds.has(p.player_id)) continue
      const resolution = resolvePlayerIdentityPure(mappingCandidates, {
        platform: 'sleeper',
        sourcePlayerId: p.player_id,
        name: p.name,
        nflTeam: p.nfl_team ?? '',
        position: p.position,
      })
      available.push({
        canonicalPlayerId: resolution.canonicalPlayerId,
        sourcePlatform: 'sleeper',
        sourcePlayerId: p.player_id,
        displayName: p.name,
        nflTeam: p.nfl_team,
        position: p.position,
        availability: 'free_agent',
        identityConfidence: resolution.confidence,
      })
      if (available.length >= FREE_AGENT_POOL_SIZE) break
    }

    return { status: 'ok', data: available, warnings: [] }
  } catch (err) {
    return {
      status: 'failed',
      data: null,
      warnings: [],
      errorReason: err instanceof SleeperAPIError ? err.message : 'Could not read Sleeper available players',
    }
  }
}

export async function sleeperReadDraftMetadata(
  context: ConnectedLeagueContext
): Promise<IntelligenceReadResult<NormalizedDraftInfo>> {
  try {
    const drafts = await getSleeperDrafts(context.externalLeagueId)
    // Sleeper returns most-recent-first; a league has exactly one draft per
    // season in the normal case.
    const draft: SleeperDraft | undefined = drafts[0]
    if (!draft) {
      return {
        status: 'ok',
        data: { status: 'unknown', scheduledAt: null },
        warnings: [{ field: 'draft', message: 'No draft found for this league' }],
      }
    }

    const status: NormalizedDraftStatus =
      draft.status === 'pre_draft' ? 'not_started'
      : draft.status === 'drafting' || draft.status === 'paused' ? 'in_progress'
      : draft.status === 'complete' ? 'complete'
      : 'unknown'
    const scheduledAt = draft.start_time ? new Date(draft.start_time).toISOString() : null

    return { status: 'ok', data: { status, scheduledAt }, warnings: [] }
  } catch (err) {
    return {
      status: 'failed',
      data: null,
      warnings: [],
      errorReason: err instanceof SleeperAPIError ? err.message : 'Could not read Sleeper draft metadata',
    }
  }
}

export const sleeperIntelligenceAdapter: PlatformIntelligenceAdapter = {
  platform: 'sleeper',
  capabilities: SLEEPER_CAPABILITIES,
  readOwnedRoster: sleeperReadOwnedRoster,
  readMatchup: sleeperReadMatchup,
  readAvailablePlayers: sleeperReadAvailablePlayers,
  readDraftMetadata: sleeperReadDraftMetadata,
}
