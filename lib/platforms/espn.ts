// Packet 03: ESPN intelligence adapter — mirrors lib/platforms/sleeper.ts's
// structure. Built from real, live-captured ESPN Fantasy API responses
// (this session, league 799979, a real user league) — see the Packet 03
// completion report for exactly which shapes were captured live vs which
// rely on ESPN's widely-documented (but unofficial) numeric ID scheme.
//
// Server-only from this point on (createAdminClient, lib/espn.ts, decrypt).

import { createAdminClient } from '@/lib/supabase'
import { decrypt } from '@/lib/encrypt'
import { EspnAPIError } from '@/types'
import type { NFLPosition } from '@/types'
import { fetchActivePlayerMappings, resolvePlayerIdentityPure } from '@/lib/playerIdentity'
import {
  getEspnRosters,
  getEspnMatchup,
  getEspnWaivers,
  getEspnDraftDetail,
  getEspnLivePoints,
  type EspnLiveMatchup,
} from '@/lib/espn'
import type {
  ConnectedLeagueContext,
  IntelligenceReadResult,
  NormalizedRosterSnapshot,
  NormalizedRosterPlayer,
  NormalizedMatchup,
  NormalizedAvailablePlayer,
  NormalizedDraftInfo,
  DataQualityWarning,
  PlatformCapabilities,
  PlatformIntelligenceAdapter,
  LineupStatus,
} from './types'
import { ROSTER_SNAPSHOT_SCHEMA_VERSION } from './types'

// lib/espn.ts's own header: "Unofficial v3 endpoints... Read only — no
// write API exists." Matches actual shipped code, same discipline as
// SLEEPER_CAPABILITIES.
export const ESPN_CAPABILITIES: PlatformCapabilities = {
  leagueRead: true,
  rosterRead: true,
  matchupRead: true,
  draftRead: true,
  freeAgentRead: true,
  lineupWrite: false,
  waiverWrite: false,
  tradeWrite: false,
}

// ESPN's defaultPositionId/proTeamId numeric enum is unofficial — ESPN
// publishes no schema for it — but it's been stable across every public
// ESPN fantasy API integration for years. Directly confirmed LIVE this
// session against real players: defaultPositionId 2 (Israel Abanikanda,
// Ameer Abdullah, Jonathan Taylor — all real RBs) and 3 (Puka Nacua, a
// real WR); proTeamId 6 (NYJ/Abanikanda), 30 (LV/Abdullah), 15
// (MIA/Achane), 14 (LAR/Nacua), 11 (IND/Taylor). The rest of this table
// follows the same widely-used community enum but was NOT independently
// re-verified live — a wrong entry here degrades a player's displayed
// position/team, it does not break identity resolution (which falls back
// to name-only matching when position/team don't line up — see
// lib/playerIdentity.ts), except for DEF/D-ST players, where a wrong
// proTeamId would misresolve entirely. Treat any DEF resolution from this
// adapter as lower-confidence until independently verified.
const ESPN_POSITION_MAP: Record<number, NFLPosition> = {
  1: 'QB',
  2: 'RB',
  3: 'WR',
  4: 'TE',
  5: 'K',
  16: 'DEF',
}

const ESPN_PRO_TEAM_MAP: Record<number, string> = {
  1: 'ATL', 2: 'BUF', 3: 'CHI', 4: 'CIN', 5: 'CLE', 6: 'NYJ', 7: 'DEN', 8: 'DAL',
  9: 'DET', 10: 'GB', 11: 'IND', 12: 'HOU', 13: 'LV', 14: 'LAR', 15: 'MIA',
  16: 'MIN', 17: 'NE', 18: 'NO', 19: 'NYG', 20: 'PHI', 21: 'ARI', 22: 'PIT',
  23: 'LAC', 24: 'SF', 25: 'SEA', 26: 'TB', 27: 'WSH', 28: 'CAR', 29: 'JAX',
  30: 'LV', 33: 'BAL', 34: 'HOU',
}

// Same convention lib/normalize.ts's normalizeEspnRoster already documents:
// ESPN slot IDs 0=QB,2=RB,4=WR,6=TE,16=K,17=D/ST,20=BN,21=IR,23=FLEX.
const BENCH_SLOT_IDS = new Set([20])
const IR_SLOT_IDS = new Set([21])

interface EspnCredentials {
  espnS2: string
  swid: string
}

async function getEspnCredentialsForUser(userId: string): Promise<EspnCredentials | null> {
  const admin = createAdminClient()
  const { data } = await admin.from('espn_credentials').select('espn_s2, swid').eq('user_id', userId).maybeSingle()
  if (!data) return null
  return { espnS2: decrypt(data.espn_s2), swid: decrypt(data.swid) }
}

interface EspnRawPlayer {
  id: number
  fullName: string
  defaultPositionId: number
  proTeamId: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function espnPlayerFields(player: any): { name: string; nflTeam: string; position: NFLPosition | null } {
  return {
    name: player?.fullName ?? '',
    nflTeam: ESPN_PRO_TEAM_MAP[player?.proTeamId] ?? '',
    position: ESPN_POSITION_MAP[player?.defaultPositionId] ?? null,
  }
}

function lineupStatusForSlot(slotId: number): LineupStatus {
  if (IR_SLOT_IDS.has(slotId)) return 'ir'
  if (BENCH_SLOT_IDS.has(slotId)) return 'bench'
  return 'starting'
}

export async function espnReadOwnedRoster(
  context: ConnectedLeagueContext
): Promise<IntelligenceReadResult<NormalizedRosterSnapshot>> {
  try {
    const credentials = await getEspnCredentialsForUser(context.userId)
    if (!credentials) {
      return { status: 'failed', data: null, warnings: [], errorReason: 'No ESPN credentials on file for this user' }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = (await getEspnRosters(context.externalLeagueId, credentials)) as any
    const teams = raw?.teams ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const myTeam = teams.find((t: any) => String(t.id) === context.externalTeamId)
    if (!myTeam) {
      return { status: 'failed', data: null, warnings: [], errorReason: "Owned team not found in this league's team list" }
    }

    const entries = myTeam?.roster?.entries ?? []
    const admin = createAdminClient()
    const mappingCandidates = await fetchActivePlayerMappings(admin)

    const warnings: DataQualityWarning[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const players: NormalizedRosterPlayer[] = entries.map((entry: any) => {
      const player: EspnRawPlayer = entry?.playerPoolEntry?.player ?? {}
      const sourcePlayerId = String(player.id ?? '')
      const { name, nflTeam, position } = espnPlayerFields(player)

      const resolution = resolvePlayerIdentityPure(mappingCandidates, {
        platform: 'espn',
        sourcePlayerId,
        name,
        nflTeam,
        position,
      })
      if (resolution.confidence === 'unresolved') {
        warnings.push({ field: `players.${sourcePlayerId}`, message: resolution.reason })
      }

      return {
        canonicalPlayerId: resolution.canonicalPlayerId,
        sourcePlatform: 'espn',
        sourcePlayerId,
        displayName: name || sourcePlayerId,
        nflTeam: nflTeam || null,
        position,
        lineupStatus: lineupStatusForSlot(entry?.lineupSlotId ?? -1),
        slot: entry?.lineupSlotId != null ? String(entry.lineupSlotId) : null,
        identityConfidence: resolution.confidence,
        identityReason: resolution.reason,
      }
    })

    const snapshot: NormalizedRosterSnapshot = {
      schemaVersion: ROSTER_SNAPSHOT_SCHEMA_VERSION,
      connectedLeagueId: context.connectedLeagueId,
      platform: 'espn',
      externalLeagueId: context.externalLeagueId,
      externalTeamId: context.externalTeamId,
      capturedAt: new Date().toISOString(),
      // mRoster carries no last-modified timestamp of its own, same gap as
      // Sleeper's roster endpoint.
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
      errorReason: err instanceof EspnAPIError ? err.message : 'Could not read ESPN roster',
    }
  }
}

// mMatchup carries no team-total-score or winner field this session's live
// captures could confirm (only cumulativeScore — a season W/L tally for
// this matchup slot, not a per-week point total). Score is instead
// DERIVED from getEspnLivePoints's already-shipped, live-verified
// per-player point extraction (lib/espn.ts, "VERIFIED LIVE July 3, 2026")
// — summing real per-player appliedTotal values, not fabricating a field
// this session couldn't independently confirm.
export async function espnReadMatchup(
  context: ConnectedLeagueContext,
  week: number
): Promise<IntelligenceReadResult<NormalizedMatchup>> {
  try {
    const credentials = await getEspnCredentialsForUser(context.userId)
    if (!credentials) {
      return { status: 'failed', data: null, warnings: [], errorReason: 'No ESPN credentials on file for this user' }
    }

    const raw = (await getEspnMatchup(context.externalLeagueId, credentials, week)) as {
      schedule?: Array<{ matchupPeriodId?: number; home?: { teamId?: number }; away?: { teamId?: number } }>
    }
    const myTeamId = Number(context.externalTeamId)
    const entry = (raw.schedule ?? []).find(
      (m) => m.matchupPeriodId === week && (m.home?.teamId === myTeamId || m.away?.teamId === myTeamId)
    )
    if (!entry) {
      return { status: 'failed', data: null, warnings: [], errorReason: 'No matchup found for this team and week' }
    }
    const opponentSide = entry.home?.teamId === myTeamId ? entry.away : entry.home
    const opponentTeamId = opponentSide?.teamId != null ? String(opponentSide.teamId) : null

    const livePoints = await getEspnLivePoints(context.externalLeagueId, credentials, week).catch(() => [] as EspnLiveMatchup[])
    const sumPoints = (teamId: number | null) => {
      if (teamId === null) return null
      const match = livePoints.find((m) => m.teamId === teamId)
      if (!match) return null
      return match.playerPoints.reduce((total, p) => total + p.points, 0)
    }

    const warnings: DataQualityWarning[] = []
    const myScore = sumPoints(myTeamId)
    if (myScore === null) {
      warnings.push({ field: 'myScore', message: 'No live per-player point data returned for this team/week — score unavailable rather than fabricated' })
    }

    const matchup: NormalizedMatchup = {
      connectedLeagueId: context.connectedLeagueId,
      platform: 'espn',
      week,
      myTeamId: context.externalTeamId,
      opponentTeamId,
      myScore,
      opponentScore: sumPoints(opponentTeamId ? Number(opponentTeamId) : null),
      // ESPN's mMatchup exposes no projection field this session verified.
      myProjectedScore: null,
      opponentProjectedScore: null,
      // No pregame/live/final flag confirmed on this endpoint.
      status: 'unknown',
      capturedAt: new Date().toISOString(),
      warnings,
    }
    return { status: 'ok', data: matchup, warnings }
  } catch (err) {
    return {
      status: 'failed',
      data: null,
      warnings: [],
      errorReason: err instanceof EspnAPIError ? err.message : 'Could not read ESPN matchup',
    }
  }
}

const FREE_AGENT_POOL_SIZE = 25

export async function espnReadAvailablePlayers(
  context: ConnectedLeagueContext
): Promise<IntelligenceReadResult<NormalizedAvailablePlayer[]>> {
  try {
    const credentials = await getEspnCredentialsForUser(context.userId)
    if (!credentials) {
      return { status: 'failed', data: null, warnings: [], errorReason: 'No ESPN credentials on file for this user' }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = (await getEspnWaivers(context.externalLeagueId, credentials)) as any
    const pool = raw?.players ?? []

    const admin = createAdminClient()
    const mappingCandidates = await fetchActivePlayerMappings(admin)

    const available: NormalizedAvailablePlayer[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const entry of pool as any[]) {
      const player: EspnRawPlayer = entry?.player ?? {}
      const sourcePlayerId = String(player.id ?? '')
      if (!sourcePlayerId) continue
      const { name, nflTeam, position } = espnPlayerFields(player)

      const resolution = resolvePlayerIdentityPure(mappingCandidates, {
        platform: 'espn',
        sourcePlayerId,
        name,
        nflTeam,
        position,
      })

      available.push({
        canonicalPlayerId: resolution.canonicalPlayerId,
        sourcePlatform: 'espn',
        sourcePlayerId,
        displayName: name || sourcePlayerId,
        nflTeam: nflTeam || null,
        position,
        // getEspnWaivers filters to FREEAGENT/WAIVERS status but doesn't
        // distinguish which — entry.status carries that (real field,
        // confirmed in kona_player_info capture), so surface it honestly
        // rather than collapsing both to 'free_agent'.
        availability: entry?.status === 'WAIVERS' ? 'waivers' : 'free_agent',
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
      errorReason: err instanceof EspnAPIError ? err.message : 'Could not read ESPN available players',
    }
  }
}

export async function espnReadDraftMetadata(
  context: ConnectedLeagueContext
): Promise<IntelligenceReadResult<NormalizedDraftInfo>> {
  try {
    const credentials = await getEspnCredentialsForUser(context.userId)
    if (!credentials) {
      return { status: 'failed', data: null, warnings: [], errorReason: 'No ESPN credentials on file for this user' }
    }

    const raw = await getEspnDraftDetail(context.externalLeagueId, credentials)
    if (!raw?.draftDetail) {
      return {
        status: 'ok',
        data: { status: 'unknown', scheduledAt: null },
        warnings: [{ field: 'draft', message: 'ESPN mDraftDetail returned no draftDetail for this league' }],
      }
    }

    const { drafted, inProgress } = raw.draftDetail
    const status = drafted ? 'complete' : inProgress ? 'in_progress' : 'not_started'

    return {
      status: 'ok',
      data: {
        status,
        // mDraftDetail's real response (captured live this session, an
        // undrafted league) carries no scheduled-start-time field —
        // reported unknown rather than guessed, same as Sleeper's gap.
        scheduledAt: null,
      },
      warnings: [{ field: 'draft.scheduledAt', message: 'ESPN mDraftDetail does not expose a scheduled draft start time' }],
    }
  } catch (err) {
    return {
      status: 'failed',
      data: null,
      warnings: [],
      errorReason: err instanceof EspnAPIError ? err.message : 'Could not read ESPN draft metadata',
    }
  }
}

export const espnIntelligenceAdapter: PlatformIntelligenceAdapter = {
  platform: 'espn',
  capabilities: ESPN_CAPABILITIES,
  readOwnedRoster: espnReadOwnedRoster,
  readMatchup: espnReadMatchup,
  readAvailablePlayers: espnReadAvailablePlayers,
  readDraftMetadata: espnReadDraftMetadata,
}
