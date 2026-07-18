// Packet 03, P3-8 (corrected P3-11 audit, 2026-07-18): canonical
// cross-platform Pulse items. Covers the two item types whose logic
// already generalizes cleanly across platforms — roster_grade (reuses
// lib/crossPlatformPortfolio.ts's computeCrossPlatformLeagueHealth
// verbatim) and waiver_alert (reuses the SAME "never infer availability
// from roster absence" discipline lib/playerIntelligence.ts's
// computePlayerStateForLeague already established: a candidate is only
// ever surfaced after a real, successful adapter.readAvailablePlayers
// call confirms it).
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
//
// CORRECTION (independent P3-11 audit, 2026-07-18):
//  - Stale leagues now get a coverage entry but produce ZERO Pulse
//    recommendation items — an actionable "grab this free agent"
//    suggestion built on data that might already be out of date is a
//    real risk in a way a passive "here's your exposure" Portfolio number
//    isn't. Only 'fresh' snapshots generate roster_grade/waiver_alert.
//  - The real, authenticated user ID is now threaded through to every
//    adapter context (was previously a hardcoded empty string).
//  - Every Supabase query here now checks its own error — a real DB
//    failure surfaces as a 'failed' coverage entry, never silently
//    treated the same as "no data yet."

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
// looking identical to "nothing needs attention." P3-11 correction:
// 'included_stale' now means "coverage only, zero recommendation items"
// — see buildCrossPlatformPulseItemsForLeague.
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

interface SnapshotFetchResult {
  snapshot: NormalizedRosterSnapshot | null
  snappedAt: string | null
  error: string | null
}

async function fetchLatestSnapshot(admin: AdminClient, connectedLeagueId: string, teamId: string): Promise<SnapshotFetchResult> {
  const { data, error } = await admin
    .from('roster_snapshots')
    .select('snapshot_json, snapped_at')
    .eq('league_id', connectedLeagueId)
    .eq('team_id', teamId)
    .order('snapped_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return { snapshot: null, snappedAt: null, error: error.message }
  if (!data) return { snapshot: null, snappedAt: null, error: null }
  return { snapshot: data.snapshot_json as NormalizedRosterSnapshot, snappedAt: data.snapped_at as string, error: null }
}

interface IdentifiedPlayer {
  canonicalPlayerId: string | null
  sourcePlatform: Platform
  sourcePlayerId: string
}

interface AdpLookupResult {
  lookup: Map<string, PlayerAdpRow>
  error: string | null
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
): Promise<AdpLookupResult> {
  const lookup = new Map<string, PlayerAdpRow>()
  const sourcePlayerIds = players.map((p) => p.sourcePlayerId)
  if (sourcePlayerIds.length === 0) return { lookup, error: null }

  const { data, error } = await admin
    .from('players_cache')
    .select('player_id, adp_consensus, adp_sleeper, adp_espn, injury_status')
    .eq('platform', platform)
    .in('player_id', sourcePlayerIds)
  if (error) return { lookup, error: error.message }

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
  return { lookup, error: null }
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
 *
 * Requires the real, authenticated user ID — passed through to every
 * adapter context, never a placeholder.
 */
export async function buildCrossPlatformPulseItemsForLeague(
  admin: AdminClient,
  league: ConnectedLeagueRow,
  userId: string
): Promise<LeagueItemsResult> {
  if (!league.team_id) return { items: [], coverage: coverageEntry(league, 'unavailable', 'No team assigned yet') }
  const adapter = getIntelligenceAdapter(league.platform)
  if (!adapter) {
    // No adapter (Yahoo) — never fabricate intelligence for it.
    const status: PulseLeagueCoverageStatus = league.platform === 'yahoo' ? 'approval_pending' : 'unsupported'
    return { items: [], coverage: coverageEntry(league, status, `No intelligence adapter for platform '${league.platform}'`) }
  }

  const snapshotResult = await fetchLatestSnapshot(admin, league.id, league.team_id)
  if (snapshotResult.error) {
    // A real DB failure reading roster_snapshots — distinct from "no
    // snapshot yet," which is a normal, expected state for a brand-new
    // league. Never collapsed into the same 'unavailable' bucket.
    return { items: [], coverage: coverageEntry(league, 'failed', snapshotResult.error) }
  }

  const freshness = computeSnapshotFreshness({
    lastSnapshotAt: snapshotResult.snappedAt,
    now: new Date(),
    capabilitiesSupportRosterRead: adapter.capabilities.rosterRead,
    approvalPending: false,
  })
  if (!snapshotResult.snapshot || (freshness !== 'fresh' && freshness !== 'stale')) {
    return { items: [], coverage: coverageEntry(league, 'unavailable', 'No successful roster snapshot has been captured yet') }
  }

  // P3-11 correction: stale data gets a coverage entry but never an
  // actionable recommendation — a waiver/roster-grade suggestion built on
  // data that might already be out of date is a real risk a passive
  // exposure number isn't. Only 'fresh' generates real Pulse items.
  if (freshness === 'stale') {
    return { items: [], coverage: coverageEntry(league, 'included_stale', null) }
  }

  const actionCapability = actionCapabilityFor(adapter.capabilities)
  const items: CrossPlatformPulseItem[] = []
  const snapshot = snapshotResult.snapshot

  // Fetch available players FIRST (if supported) so the ADP lookup below
  // can cover both the owned roster AND any real waiver/free-agent
  // candidates in one query — a candidate not on the roster snapshot
  // would otherwise never get an ADP row to compare against.
  const context: ConnectedLeagueContext = {
    connectedLeagueId: league.id,
    userId,
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

  const { lookup: adpLookup, error: adpError } = await buildAdpLookup(admin, league.platform, [...snapshot.players, ...availableCandidates])
  if (adpError) {
    // ADP lookup failed — health/waiver math would be built on incomplete
    // data. Report this league as failed rather than silently computing
    // with an empty lookup (which would read as "no ADP data anywhere,"
    // not "the query broke").
    return { items: [], coverage: coverageEntry(league, 'failed', adpError) }
  }

  // ─── Roster grade (same computeLeagueHealth, cross-platform input) ─────
  const healthResult = computeCrossPlatformLeagueHealth(snapshot, adpLookup, null, null)
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
  // A non-'ok' status (failed/unsupported/unverified/a thrown error) means
  // no waiver_alert for this league — never guessed from absence.

  return { items, coverage: coverageEntry(league, 'included_fresh', null) }
}

export interface CrossPlatformPulseUserResult {
  items: CrossPlatformPulseItem[]
  leagueCount: number
  coverage: PulseLeagueCoverageEntry[]
}

export async function buildCrossPlatformPulseItemsForUser(userId: string): Promise<CrossPlatformPulseUserResult> {
  const admin = createAdminClient()
  const { data: leagues, error } = await admin
    .from('connected_leagues')
    .select('id, platform, league_id, league_name, team_id')
    .eq('user_id', userId)
    .neq('platform', 'sleeper') // Sleeper stays on lib/pulse.ts's existing path

  if (error) {
    // A real DB failure fetching the league list itself — must not be
    // silently reported as "this user has zero cross-platform leagues."
    throw new Error(`Failed to load connected leagues: ${error.message}`)
  }

  const rows = (leagues ?? []) as ConnectedLeagueRow[]

  const results = await Promise.allSettled(rows.map((league) => buildCrossPlatformPulseItemsForLeague(admin, league, userId)))
  const items = results.flatMap((r) => (r.status === 'fulfilled' ? r.value.items : []))
  const coverage = results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value.coverage
      : coverageEntry(rows[i], 'failed', r.reason instanceof Error ? r.reason.message : 'Unknown error computing this league')
  )

  return { items, leagueCount: rows.length, coverage }
}

export type { AdpSource }
