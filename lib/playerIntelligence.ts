// Packet 03, P3-7: canonical-first Player Intelligence. Replaces
// app/api/players/[playerId]/intelligence/route.ts's Sleeper-only,
// raw-ID, direct-roster-scan logic with a cross-platform pipeline that
// consumes roster_snapshots (never a raw per-platform roster refetch for
// the "is this mine" check) and each adapter's own provider-confirmed
// readAvailablePlayers for free-agent/waiver status.
//
// Canonical player ID is the primary identity. A legacy raw Sleeper ID
// (every existing caller of the route today) is resolved to canonical at
// the ROUTE boundary via resolvePlayerIdentityForRoute — this file's
// per-league computation always works in terms of an already-resolved
// PlayerIdentityInput, never a bare string of unknown origin.

import { createAdminClient } from '@/lib/supabase'
import { getIntelligenceAdapter, type ConnectedLeagueContext, type SnapshotFreshness } from '@/lib/platforms'
import { computeSnapshotFreshness } from '@/lib/rosterSnapshotSync'
import type { Platform } from '@/types'

type AdminClient = ReturnType<typeof createAdminClient>

export interface PlayerIdentityInput {
  canonicalPlayerId: string | null
  // Present when canonicalPlayerId is null (an unresolved player) OR when
  // the caller only ever had a single platform's raw ID (legacy route
  // callers) — used to match this specific player within a single
  // platform's snapshot when no canonical link exists yet.
  sourcePlatform: Platform | null
  sourcePlayerId: string | null
}

interface ConnectedLeagueRow {
  id: string
  platform: Platform
  league_id: string
  league_name: string
  team_id: string | null
}

/**
 * Compatibility lookup — resolves whatever the route received (a real
 * canonical player_mappings.id, OR a legacy raw Sleeper/ESPN player ID
 * from every pre-P3-7 caller) into an identity this file's per-league
 * computation can use. Never silently assumes a bare string IS canonical
 * — it's only treated as canonical after a real player_mappings.id match.
 */
export async function resolvePlayerIdentityForRoute(
  admin: AdminClient,
  rawParam: string,
  legacyPlatformHint: Platform = 'sleeper'
): Promise<PlayerIdentityInput> {
  const { data: byId } = await admin.from('player_mappings').select('id').eq('id', rawParam).maybeSingle()
  if (byId) return { canonicalPlayerId: byId.id, sourcePlatform: null, sourcePlayerId: null }

  // Legacy compatibility: every caller before P3-7 passes a raw
  // platform-specific ID (Sleeper today, the only platform the UI
  // currently wires player cards from) — look it up across all three
  // provider-ID columns rather than assuming the hint is right.
  const { data: bySleeper } = await admin.from('player_mappings').select('id').eq('sleeper_id', rawParam).maybeSingle()
  if (bySleeper) return { canonicalPlayerId: bySleeper.id, sourcePlatform: null, sourcePlayerId: null }
  const { data: byEspn } = await admin.from('player_mappings').select('id').eq('espn_id', rawParam).maybeSingle()
  if (byEspn) return { canonicalPlayerId: byEspn.id, sourcePlatform: null, sourcePlayerId: null }
  const { data: byYahoo } = await admin.from('player_mappings').select('id').eq('yahoo_id', rawParam).maybeSingle()
  if (byYahoo) return { canonicalPlayerId: byYahoo.id, sourcePlatform: null, sourcePlayerId: null }

  // Genuinely no mapping exists yet — stay platform-specific rather than
  // guessing a canonical link. legacyPlatformHint defaults to 'sleeper'
  // to match every existing route caller's real behavior unchanged.
  return { canonicalPlayerId: null, sourcePlatform: legacyPlatformHint, sourcePlayerId: rawParam }
}

export type PlayerLeagueStatus = 'mine' | 'rostered_elsewhere' | 'free_agent' | 'waivers' | 'unknown'
export type ActionCapability = 'none' | 'lineup' | 'waiver'

export interface PlayerLeagueState {
  connectedLeagueId: string
  leagueName: string
  platform: Platform
  status: PlayerLeagueStatus
  isStarter: boolean
  freshness: SnapshotFreshness
  actionCapability: ActionCapability
  // Set only when this specific league's match came from a source-ID
  // comparison rather than a canonical link — i.e. this player is
  // unresolved in THIS league specifically, even if resolved elsewhere.
  unresolvedSourcePlayerId: string | null
}

function actionCapabilityFor(caps: { lineupWrite: boolean; waiverWrite: boolean }): ActionCapability {
  if (caps.lineupWrite) return 'lineup'
  if (caps.waiverWrite) return 'waiver'
  return 'none'
}

function matchesIdentity(
  player: { canonicalPlayerId: string | null; sourcePlatform: Platform; sourcePlayerId: string },
  identity: PlayerIdentityInput
): boolean {
  if (identity.canonicalPlayerId && player.canonicalPlayerId === identity.canonicalPlayerId) return true
  if (!identity.canonicalPlayerId && identity.sourcePlatform && identity.sourcePlayerId) {
    return player.sourcePlatform === identity.sourcePlatform && player.sourcePlayerId === identity.sourcePlayerId
  }
  return false
}

/**
 * One connected league's independent player state. Never infers
 * free-agent status from "absent from my roster" — a player not on my
 * own snapshot is only ever reported 'free_agent'/'waivers' after a real
 * provider-confirmed readAvailablePlayers call finds them there;
 * otherwise it's honestly 'rostered_elsewhere' (some other real team must
 * hold them, since the provider confirmed they are NOT a free agent) or
 * 'unknown' when even that can't be determined.
 */
export async function computePlayerStateForLeague(
  admin: AdminClient,
  league: ConnectedLeagueRow,
  identity: PlayerIdentityInput
): Promise<PlayerLeagueState> {
  const adapter = getIntelligenceAdapter(league.platform)
  if (!adapter || !league.team_id) {
    return {
      connectedLeagueId: league.id,
      leagueName: league.league_name,
      platform: league.platform,
      status: 'unknown',
      isStarter: false,
      freshness: adapter ? 'unavailable' : (league.platform === 'yahoo' ? 'approval_pending' : 'unsupported'),
      actionCapability: 'none',
      unresolvedSourcePlayerId: null,
    }
  }

  const { data: latest } = await admin
    .from('roster_snapshots')
    .select('snapshot_json, snapped_at')
    .eq('league_id', league.id)
    .eq('team_id', league.team_id)
    .order('snapped_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const freshness = computeSnapshotFreshness({
    lastSnapshotAt: latest?.snapped_at ?? null,
    now: new Date(),
    capabilitiesSupportRosterRead: adapter.capabilities.rosterRead,
    approvalPending: false,
  })
  const actionCapability = actionCapabilityFor(adapter.capabilities)

  if (latest && (freshness === 'fresh' || freshness === 'stale')) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const snapshot = latest.snapshot_json as any
    const mine = (snapshot.players ?? []).find((p: { canonicalPlayerId: string | null; sourcePlatform: Platform; sourcePlayerId: string }) =>
      matchesIdentity(p, identity)
    )
    if (mine) {
      return {
        connectedLeagueId: league.id,
        leagueName: league.league_name,
        platform: league.platform,
        status: 'mine',
        isStarter: mine.lineupStatus === 'starting',
        freshness,
        actionCapability,
        unresolvedSourcePlayerId: mine.canonicalPlayerId ? null : mine.sourcePlayerId,
      }
    }
  }

  // Not on my own roster — check the provider-confirmed free-agent/waiver
  // pool before ever concluding anything. This is the "availability must
  // come from league-wide roster or waiver data" boundary.
  const context: ConnectedLeagueContext = {
    connectedLeagueId: league.id,
    userId: '', // not needed for a read-only availability check
    platform: league.platform,
    externalLeagueId: league.league_id,
    externalTeamId: league.team_id,
  }
  if (adapter.readAvailablePlayers) {
    try {
      const result = await adapter.readAvailablePlayers(context)
      if (result.status === 'ok' && result.data) {
        const found = result.data.find((p) => matchesIdentity(p, identity))
        if (found) {
          return {
            connectedLeagueId: league.id,
            leagueName: league.league_name,
            platform: league.platform,
            status: found.availability === 'waivers' ? 'waivers' : 'free_agent',
            isStarter: false,
            freshness,
            actionCapability,
            unresolvedSourcePlayerId: found.canonicalPlayerId ? null : found.sourcePlayerId,
          }
        }
        // Provider confirmed the free-agent/waiver pool and this player
        // wasn't in it — a real, non-guessed basis for "someone else in
        // this league owns them."
        return {
          connectedLeagueId: league.id,
          leagueName: league.league_name,
          platform: league.platform,
          status: 'rostered_elsewhere',
          isStarter: false,
          freshness,
          actionCapability,
          unresolvedSourcePlayerId: null,
        }
      }
    } catch {
      // fall through to 'unknown' below
    }
  }

  return {
    connectedLeagueId: league.id,
    leagueName: league.league_name,
    platform: league.platform,
    status: 'unknown',
    isStarter: false,
    freshness,
    actionCapability,
    unresolvedSourcePlayerId: null,
  }
}

export interface PlayerIntelligenceResult {
  identity: PlayerIdentityInput
  leagues: PlayerLeagueState[]
}

/**
 * Every connected league (any platform, not just Sleeper) reports its own
 * independent state — one league's failure never removes another's
 * result, same failure-isolation discipline as P3-6's Portfolio pipeline.
 */
export async function computePlayerIntelligence(
  admin: AdminClient,
  userId: string,
  identity: PlayerIdentityInput
): Promise<PlayerIntelligenceResult> {
  const { data: leagues } = await admin
    .from('connected_leagues')
    .select('id, platform, league_id, league_name, team_id')
    .eq('user_id', userId)
  const rows = (leagues ?? []) as ConnectedLeagueRow[]

  const leagueStates = await Promise.all(
    rows.map(async (league) => {
      try {
        return await computePlayerStateForLeague(admin, league, identity)
      } catch {
        // Isolated per-league failure — never removes another league's result.
        return {
          connectedLeagueId: league.id,
          leagueName: league.league_name,
          platform: league.platform,
          status: 'unknown' as const,
          isStarter: false,
          freshness: 'unavailable' as const,
          actionCapability: 'none' as const,
          unresolvedSourcePlayerId: null,
        }
      }
    })
  )

  return { identity, leagues: leagueStates }
}
