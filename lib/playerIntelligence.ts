// Packet 03, P3-7 (corrected P3-11 audit, 2026-07-18): canonical-first
// Player Intelligence. Replaces app/api/players/[playerId]/intelligence/
// route.ts's Sleeper-only, raw-ID, direct-roster-scan logic with a
// cross-platform pipeline that consumes roster_snapshots (never a raw
// per-platform roster refetch for the "is this mine" check) and each
// adapter's own provider-confirmed readAvailablePlayers for free-agent/
// waiver status.
//
// Canonical player ID is the primary identity. A legacy raw Sleeper ID
// (every existing caller of the route today) is resolved to canonical at
// the ROUTE boundary via resolvePlayerIdentityForRoute — this file's
// per-league computation always works in terms of an already-resolved
// PlayerIdentityInput, never a bare string of unknown origin.
//
// CORRECTION (independent P3-11 audit, 2026-07-18): this file previously
// inferred 'rostered_elsewhere' whenever a player was absent from
// readAvailablePlayers's result — but every real adapter's available-
// players read is a BOUNDED top-N pool (e.g. top 25 by ADP), not a
// complete league-wide ownership read. A player genuinely available but
// outside that bound would have been wrongly reported as owned by
// someone else. Absence from a bounded list now correctly falls through
// to 'unknown' — 'rostered_elsewhere' is no longer inferred anywhere in
// this file, since no adapter here provides a complete-enough read to
// support it. It's kept in the PlayerLeagueStatus union for a future
// adapter that DOES expose a genuine full-league ownership read.

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

// P3-11 P0 hotfix (2026-07-18): player_mappings.id is a uuid column —
// querying it with a non-UUID-shaped value (e.g. a raw Sleeper ID like
// "4984") makes Postgres reject the comparison outright with 22P02
// (invalid_text_representation) before the query can even run, not a "no
// rows found" result. That is not a real database failure — it is fully
// predictable and 100% of the time for every legacy raw-provider-ID
// caller (Draft Kit, Lineups, trades, ⌘K search — see this file's header
// comment). Checking isUuidShaped first means the invalid query is never
// sent at all, rather than sent-and-caught: PostgreSQL error 22P02 is
// never special-cased or suppressed here, because it's never produced.
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuidShaped(value: string): boolean {
  return UUID_SHAPE.test(value)
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
  // P3-11 correction: every lookup below now checks its own Supabase
  // error and throws rather than silently falling through to the next
  // lookup (or ultimately to "no mapping found") — a real DB failure on
  // any one of these four queries must never be indistinguishable from a
  // genuinely unresolved player.
  //
  // P3-11 P0 hotfix: the player_mappings.id (uuid) lookup only ever runs
  // when rawParam is actually UUID-shaped — a raw provider ID never is,
  // so it skips straight to the provider-ID lookups below instead of
  // sending a query Postgres would reject.
  if (isUuidShaped(rawParam)) {
    const { data: byId, error: byIdError } = await admin.from('player_mappings').select('id').eq('id', rawParam).maybeSingle()
    if (byIdError) throw new Error(`player_mappings lookup by id failed: ${byIdError.message}`)
    if (byId) return { canonicalPlayerId: byId.id, sourcePlatform: null, sourcePlayerId: null }
  }

  // Legacy compatibility: every caller before P3-7 passes a raw
  // platform-specific ID (Sleeper today, the only platform the UI
  // currently wires player cards from) — look it up across all three
  // provider-ID columns rather than assuming the hint is right.
  const { data: bySleeper, error: bySleeperError } = await admin.from('player_mappings').select('id').eq('sleeper_id', rawParam).maybeSingle()
  if (bySleeperError) throw new Error(`player_mappings lookup by sleeper_id failed: ${bySleeperError.message}`)
  if (bySleeper) return { canonicalPlayerId: bySleeper.id, sourcePlatform: null, sourcePlayerId: null }
  const { data: byEspn, error: byEspnError } = await admin.from('player_mappings').select('id').eq('espn_id', rawParam).maybeSingle()
  if (byEspnError) throw new Error(`player_mappings lookup by espn_id failed: ${byEspnError.message}`)
  if (byEspn) return { canonicalPlayerId: byEspn.id, sourcePlatform: null, sourcePlayerId: null }
  const { data: byYahoo, error: byYahooError } = await admin.from('player_mappings').select('id').eq('yahoo_id', rawParam).maybeSingle()
  if (byYahooError) throw new Error(`player_mappings lookup by yahoo_id failed: ${byYahooError.message}`)
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
  // P3.5-1: the real, external provider league ID (e.g. a Sleeper league
  // ID, an ESPN leagueId) — already loaded by every caller of this
  // function (connected_leagues.league_id), simply passed through here so
  // the UI can build a real deep link via lib/leagueLinks.ts's existing,
  // client-safe URL builders. Never used to construct anything beyond a
  // plain "go view your real league" URL — no write action is implied.
  externalLeagueId: string
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
 * provider-confirmed readAvailablePlayers call finds them there.
 *
 * Absence from that same (bounded) read is NOT proof of anything —
 * readAvailablePlayers is a top-N pool, not a complete league-wide
 * ownership read, so a real free agent outside that bound would
 * otherwise be misreported as owned by someone else. The honest result
 * when the bounded list doesn't contain the player is 'unknown'.
 */
export async function computePlayerStateForLeague(
  admin: AdminClient,
  league: ConnectedLeagueRow,
  identity: PlayerIdentityInput,
  userId: string
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
      externalLeagueId: league.league_id,
    }
  }

  const { data: latest, error: snapshotError } = await admin
    .from('roster_snapshots')
    .select('snapshot_json, snapped_at')
    .eq('league_id', league.id)
    .eq('team_id', league.team_id)
    .order('snapped_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (snapshotError) {
    // A real DB failure is NOT the same as "no snapshot yet" — reporting
    // it as 'unavailable' would hide a real infrastructure problem behind
    // the same label a genuinely-never-synced league gets.
    return {
      connectedLeagueId: league.id,
      leagueName: league.league_name,
      platform: league.platform,
      status: 'unknown',
      isStarter: false,
      freshness: 'unavailable',
      actionCapability: actionCapabilityFor(adapter.capabilities),
      unresolvedSourcePlayerId: null,
      externalLeagueId: league.league_id,
    }
  }

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
        externalLeagueId: league.league_id,
      }
    }
  }

  // Not on my own roster — check the provider-confirmed free-agent/waiver
  // pool before ever concluding anything. This is the "availability must
  // come from league-wide roster or waiver data" boundary. The real,
  // authenticated user ID is threaded through here — every adapter call
  // must receive it, never an empty string.
  const context: ConnectedLeagueContext = {
    connectedLeagueId: league.id,
    userId,
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
            externalLeagueId: league.league_id,
          }
        }
        // The player wasn't in this BOUNDED pool — that proves nothing
        // about who (if anyone) owns them. Never inferred as
        // 'rostered_elsewhere' from a partial read; only a genuinely
        // complete league-wide ownership read could support that
        // conclusion, and no adapter here provides one.
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
    externalLeagueId: league.league_id,
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
  const { data: leagues, error } = await admin
    .from('connected_leagues')
    .select('id, platform, league_id, league_name, team_id')
    .eq('user_id', userId)

  if (error) {
    // A real DB failure fetching the league list itself — cannot report
    // per-league states at all, so this must surface as a thrown error,
    // never a silently empty leagues array (which would look identical
    // to "this user has no connected leagues").
    throw new Error(`Failed to load connected leagues: ${error.message}`)
  }

  const rows = (leagues ?? []) as ConnectedLeagueRow[]

  const leagueStates = await Promise.all(
    rows.map(async (league) => {
      try {
        return await computePlayerStateForLeague(admin, league, identity, userId)
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
          externalLeagueId: league.league_id,
        }
      }
    })
  )

  return { identity, leagues: leagueStates }
}
