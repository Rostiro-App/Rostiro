// Packet 03, P3-8: canonical cross-platform Pulse items. Covers the two
// item types whose logic already generalizes cleanly across platforms —
// roster_grade (reuses lib/crossPlatformPortfolio.ts's
// computeCrossPlatformLeagueHealth verbatim) and waiver_alert (reuses the
// SAME "never infer availability from roster absence" discipline
// lib/playerIntelligence.ts's computePlayerStateForLeague already
// established: a candidate is only ever surfaced after a real,
// successful adapter.readAvailablePlayers call confirms it).
//
// Sleeper's existing item types (injury_alert, lineup_decision,
// opportunity_surge, player_news, touchdown_swing, etc.) are NOT
// reimplemented here — those stay on lib/pulse.ts's existing, live,
// Sleeper-only path, untouched. This file only ADDS real ESPN coverage
// for the two types above; it is called alongside (not instead of) the
// existing Sleeper generation — see lib/pulse.ts's buildPulseItemsForUser.
//
// Yahoo never produces an item here — getIntelligenceAdapter(platform)
// returns null for 'yahoo' (no adapter shipped; still approval-pending),
// so a Yahoo league is silently skipped, never represented as live
// intelligence.

import { createAdminClient } from '@/lib/supabase'
import { getIntelligenceAdapter, type ConnectedLeagueContext, type SnapshotFreshness, type NormalizedRosterSnapshot } from '@/lib/platforms'
import { computeSnapshotFreshness } from '@/lib/rosterSnapshotSync'
import { computeCrossPlatformLeagueHealth, type PlayerAdpRow, type AdpSource } from '@/lib/crossPlatformPortfolio'
import { espnWaiverUrl } from '@/lib/espn'
import type { AffectedLeague, Platform } from '@/types'

// P3-8B: a real, honest deep link — "Advice only" would be a lie for a
// platform whose waiver page genuinely exists and is one click away, even
// though Rostiro itself has no write capability there. Only ESPN has a
// real link today; other platforms fall back to null (no misleading
// button), matching lib/platforms/*.ts's own honest-capabilities discipline.
function waiverActionUrl(platform: Platform, leagueId: string): string | null {
  if (platform === 'espn') return espnWaiverUrl(leagueId)
  return null
}

type AdminClient = ReturnType<typeof createAdminClient>

export interface CrossPlatformPulseItem {
  fingerprint: string
  type: 'roster_grade' | 'waiver_alert'
  priority: 'critical' | 'important' | 'info'
  headline: string
  reasoning: string
  affectedLeagues: AffectedLeague[]
  deadline: string | null
  actionUrl: string | null
}

// P3-8B: so the UI can show "1 ESPN league is stale" or "unavailable —
// hasn't synced yet" instead of a stale/unavailable league silently
// looking identical to "nothing needs attention" (zero items either way).
export type PulseLeagueCoverageStatus = 'included_fresh' | 'included_stale' | 'unavailable' | 'unsupported' | 'approval_pending' | 'failed'

export interface PulseLeagueCoverageEntry {
  connectedLeagueId: string
  leagueName: string
  platform: Platform
  status: PulseLeagueCoverageStatus
  reason: string | null
}

interface ConnectedLeagueRow {
  id: string
  platform: Platform
  league_id: string
  league_name: string
  team_id: string | null
}

async function fetchLatestSnapshot(admin: AdminClient, connectedLeagueId: string, teamId: string) {
  const { data } = await admin
    .from('roster_snapshots')
    .select('snapshot_json, snapped_at')
    .eq('league_id', connectedLeagueId)
    .eq('team_id', teamId)
    .order('snapped_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  return { snapshot: data.snapshot_json as NormalizedRosterSnapshot, snappedAt: data.snapped_at as string }
}

interface IdentifiedPlayer {
  canonicalPlayerId: string | null
  sourcePlatform: Platform
  sourcePlayerId: string
}

// Builds ADP lookup entries for the roster snapshot's own players PLUS any
// extra players (e.g. real free-agent/waiver candidates from a successful
// readAvailablePlayers call) — both need ADP data before a fair "which
// candidate beats my median starter" comparison can happen, and both are
// the SAME platform's players_cache rows, so one query covers both.
async function buildAdpLookup(
  admin: AdminClient,
  platform: Platform,
  players: IdentifiedPlayer[]
): Promise<Map<string, PlayerAdpRow>> {
  const lookup = new Map<string, PlayerAdpRow>()
  const sourcePlayerIds = players.map((p) => p.sourcePlayerId)
  if (sourcePlayerIds.length === 0) return lookup

  const { data } = await admin
    .from('players_cache')
    .select('player_id, adp_consensus, adp_sleeper, adp_espn, injury_status')
    .eq('platform', platform)
    .in('player_id', sourcePlayerIds)
  const byPlayerId = new Map((data ?? []).map((r) => [r.player_id as string, r]))

  for (const player of players) {
    const row = byPlayerId.get(player.sourcePlayerId)
    const key = player.canonicalPlayerId ?? `${player.sourcePlatform}:${player.sourcePlayerId}`
    lookup.set(key, {
      key,
      adpConsensus: row?.adp_consensus ?? null,
      adpPlatformSpecific: platform === 'espn' ? (row?.adp_espn ?? null) : (row?.adp_sleeper ?? null),
      injuryStatus: row?.injury_status ?? null,
    })
  }
  return lookup
}

function baseAffectedLeague(
  league: ConnectedLeagueRow,
  freshness: SnapshotFreshness,
  actionCapability: 'none' | 'lineup' | 'waiver'
): AffectedLeague {
  return {
    leagueId: league.id,
    leagueName: league.league_name,
    platform: league.platform,
    freshness,
    actionCapability,
    canonicalPlayerId: null,
    providerPlayerId: null,
    status: null,
  }
}

function actionCapabilityFor(caps: { lineupWrite: boolean; waiverWrite: boolean }): 'none' | 'lineup' | 'waiver' {
  if (caps.lineupWrite) return 'lineup'
  if (caps.waiverWrite) return 'waiver'
  return 'none'
}

export interface LeagueItemsResult {
  items: CrossPlatformPulseItem[]
  coverage: PulseLeagueCoverageEntry
}

function coverageEntry(league: ConnectedLeagueRow, status: PulseLeagueCoverageStatus, reason: string | null): PulseLeagueCoverageEntry {
  return { connectedLeagueId: league.id, leagueName: league.league_name, platform: league.platform, status, reason }
}

/**
 * One league's cross-platform Pulse items PLUS its coverage entry. Never
 * throws past its own boundary in practice (the caller wraps it too, but
 * every internal step here already degrades to "no items for this
 * league" rather than an exception) — a stale or unavailable league
 * contributes zero items but STILL gets a real coverage entry, so the UI
 * can distinguish "nothing needs attention" from "this league hasn't
 * synced yet."
 */
export async function buildCrossPlatformPulseItemsForLeague(
  admin: AdminClient,
  league: ConnectedLeagueRow
): Promise<LeagueItemsResult> {
  if (!league.team_id) return { items: [], coverage: coverageEntry(league, 'unavailable', 'No team assigned yet') }
  const adapter = getIntelligenceAdapter(league.platform)
  if (!adapter) {
    // No adapter (Yahoo) — never fabricate intelligence for it.
    const status: PulseLeagueCoverageStatus = league.platform === 'yahoo' ? 'approval_pending' : 'unsupported'
    return { items: [], coverage: coverageEntry(league, status, `No intelligence adapter for platform '${league.platform}'`) }
  }

  const latest = await fetchLatestSnapshot(admin, league.id, league.team_id)
  const freshness = computeSnapshotFreshness({
    lastSnapshotAt: latest?.snappedAt ?? null,
    now: new Date(),
    capabilitiesSupportRosterRead: adapter.capabilities.rosterRead,
    approvalPending: false,
  })
  if (!latest || (freshness !== 'fresh' && freshness !== 'stale')) {
    return { items: [], coverage: coverageEntry(league, 'unavailable', 'No successful roster snapshot has been captured yet') }
  }

  const actionCapability = actionCapabilityFor(adapter.capabilities)
  const items: CrossPlatformPulseItem[] = []

  // Fetch available players FIRST (if supported) so the ADP lookup below
  // can cover both the owned roster AND any real waiver/free-agent
  // candidates in one query — a candidate not on the roster snapshot
  // would otherwise never get an ADP row to compare against.
  const context: ConnectedLeagueContext = {
    connectedLeagueId: league.id,
    userId: '',
    platform: league.platform,
    externalLeagueId: league.league_id,
    externalTeamId: league.team_id,
  }
  let availableResult: Awaited<ReturnType<NonNullable<typeof adapter.readAvailablePlayers>>> | null = null
  if (adapter.readAvailablePlayers) {
    try {
      availableResult = await adapter.readAvailablePlayers(context)
    } catch {
      availableResult = null
    }
  }
  const availableCandidates = availableResult?.status === 'ok' ? (availableResult.data ?? []) : []

  const adpLookup = await buildAdpLookup(admin, league.platform, [...latest.snapshot.players, ...availableCandidates])

  // ─── Roster grade (same computeLeagueHealth, cross-platform input) ─────
  const healthResult = computeCrossPlatformLeagueHealth(latest.snapshot, adpLookup, null, null)
  if (healthResult.health.score !== null) {
    items.push({
      fingerprint: `roster_grade:${league.id}`,
      type: 'roster_grade',
      priority: 'info',
      headline: `${league.league_name} — your roster grades ${Math.round(healthResult.health.score)}`,
      reasoning: `Rostiro grades ${league.league_name}'s roster construction a ${Math.round(healthResult.health.score)}/100 (based on ${healthResult.factorCoverage.available} of ${healthResult.factorCoverage.total} factors, ADP source: ${healthResult.adpSource}).${healthResult.health.topFlag ? ` ${healthResult.health.topFlag}.` : ''}`,
      affectedLeagues: [baseAffectedLeague(league, freshness, actionCapability)],
      deadline: null,
      actionUrl: '/leagues',
    })
  }

  // ─── Waiver opportunity — ONLY from a real, successful readAvailablePlayers ──
  if (availableCandidates.length > 0) {
    {
      let best: { candidate: typeof availableCandidates[number]; adp: number } | null = null
      for (const candidate of availableCandidates) {
        const key = candidate.canonicalPlayerId ?? `${candidate.sourcePlatform}:${candidate.sourcePlayerId}`
        const row = adpLookup.get(key)
        const adp = row?.adpConsensus ?? row?.adpPlatformSpecific ?? null
        if (adp === null) continue
        if (!best || adp < best.adp) best = { candidate, adp }
      }
      if (best) {
        const leagueDetail: AffectedLeague = {
          ...baseAffectedLeague(league, freshness, actionCapability),
          canonicalPlayerId: best.candidate.canonicalPlayerId,
          providerPlayerId: best.candidate.sourcePlayerId,
          status: best.candidate.availability === 'waivers' ? 'waivers' : 'free_agent',
        }
        items.push({
          fingerprint: `waiver:${league.id}:${leagueDetail.providerPlayerId}`,
          type: 'waiver_alert',
          priority: 'info',
          headline: `${best.candidate.displayName} is available in ${league.league_name}`,
          reasoning: `${best.candidate.displayName} is unrostered in ${league.league_name} (ADP ${Math.round(best.adp)}), confirmed via ${league.platform}'s real waiver/free-agent data — not inferred from your own roster.`,
          affectedLeagues: [leagueDetail],
          deadline: null,
          actionUrl: waiverActionUrl(league.platform, league.league_id),
        })
      }
    }
  }
  // A non-'ok' status (failed/unsupported/unverified/a thrown error) means
  // no waiver_alert for this league — never guessed from absence.

  return { items, coverage: coverageEntry(league, freshness === 'fresh' ? 'included_fresh' : 'included_stale', null) }
}

export interface CrossPlatformPulseUserResult {
  items: CrossPlatformPulseItem[]
  leagueCount: number
  coverage: PulseLeagueCoverageEntry[]
}

export async function buildCrossPlatformPulseItemsForUser(userId: string): Promise<CrossPlatformPulseUserResult> {
  const admin = createAdminClient()
  const { data: leagues } = await admin
    .from('connected_leagues')
    .select('id, platform, league_id, league_name, team_id')
    .eq('user_id', userId)
    .neq('platform', 'sleeper') // Sleeper stays on lib/pulse.ts's existing path
  const rows = (leagues ?? []) as ConnectedLeagueRow[]

  const results = await Promise.allSettled(rows.map((league) => buildCrossPlatformPulseItemsForLeague(admin, league)))
  const items = results.flatMap((r) => (r.status === 'fulfilled' ? r.value.items : []))
  const coverage = results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value.coverage
      : coverageEntry(rows[i], 'failed', r.reason instanceof Error ? r.reason.message : 'Unknown error computing this league')
  )

  return { items, leagueCount: rows.length, coverage }
}

export type { AdpSource }
