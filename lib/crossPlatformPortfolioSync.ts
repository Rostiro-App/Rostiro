// Packet 03, P3-6: DB-touching orchestrator around lib/crossPlatformPortfolio.ts's
// pure exposure/health functions. Reads roster_snapshots (never raw
// Sleeper/ESPN rosters directly) and players_cache for ADP lookups.
//
// Failure isolation: every per-league step is wrapped so one league's
// failure (adapter error, missing snapshot, a DB hiccup) produces a
// 'failed' coverage entry for THAT league only — it never throws out of
// the loop and never blanks another league's already-computed exposure
// or health.

import { createAdminClient } from '@/lib/supabase'
import { getIntelligenceAdapter, type ConnectedLeagueContext } from '@/lib/platforms'
import { computeSnapshotFreshness } from '@/lib/rosterSnapshotSync'
import {
  computeCrossPlatformExposure,
  computeCrossPlatformLeagueHealth,
  type LeagueSnapshotEntry,
  type ExposureResult,
  type CrossPlatformHealthResult,
  type PlayerAdpRow,
} from '@/lib/crossPlatformPortfolio'
import type { NormalizedRosterSnapshot, SnapshotFreshness } from '@/lib/platforms'
import type { Platform } from '@/types'

type AdminClient = ReturnType<typeof createAdminClient>

interface ConnectedLeagueRow {
  id: string
  platform: Platform
  league_id: string
  league_name: string
  team_id: string | null
}

export type LeagueCoverageStatus = 'included_fresh' | 'included_stale' | 'unavailable' | 'unsupported' | 'approval_pending' | 'failed'

export interface LeagueCoverageEntry {
  connectedLeagueId: string
  leagueName: string
  platform: Platform
  status: LeagueCoverageStatus
  reason: string | null
}

export interface LeagueHealthReport {
  connectedLeagueId: string
  leagueName: string
  platform: Platform
  result: CrossPlatformHealthResult
}

export interface UserCrossPlatformPortfolio {
  exposure: ExposureResult
  health: LeagueHealthReport[]
  coverage: LeagueCoverageEntry[]
}

async function fetchLatestSnapshot(
  admin: AdminClient,
  connectedLeagueId: string,
  teamId: string
): Promise<{ snapshot: NormalizedRosterSnapshot; snappedAt: string } | null> {
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

async function buildAdpLookup(admin: AdminClient, snapshot: NormalizedRosterSnapshot): Promise<Map<string, PlayerAdpRow>> {
  const lookup = new Map<string, PlayerAdpRow>()
  const sourcePlayerIds = snapshot.players.map((p) => p.sourcePlayerId)
  if (sourcePlayerIds.length === 0) return lookup

  const { data } = await admin
    .from('players_cache')
    .select('player_id, adp_consensus, adp_sleeper, adp_espn, injury_status')
    .eq('platform', snapshot.platform)
    .in('player_id', sourcePlayerIds)

  const byPlayerId = new Map((data ?? []).map((r) => [r.player_id as string, r]))

  for (const player of snapshot.players) {
    const row = byPlayerId.get(player.sourcePlayerId)
    const key = player.canonicalPlayerId ?? `${player.sourcePlatform}:${player.sourcePlayerId}`
    lookup.set(key, {
      key,
      adpConsensus: row?.adp_consensus ?? null,
      adpPlatformSpecific: snapshot.platform === 'espn' ? (row?.adp_espn ?? null) : (row?.adp_sleeper ?? null),
      injuryStatus: row?.injury_status ?? null,
    })
  }
  return lookup
}

async function bestAvailableAdp(
  admin: AdminClient,
  adapter: NonNullable<ReturnType<typeof getIntelligenceAdapter>>,
  context: ConnectedLeagueContext
): Promise<{ adp: number | null; name: string | null }> {
  if (!adapter.readAvailablePlayers) return { adp: null, name: null }
  const result = await adapter.readAvailablePlayers(context)
  if (result.status !== 'ok' || !result.data || result.data.length === 0) return { adp: null, name: null }

  const ids = result.data.map((p) => p.sourcePlayerId)
  const { data } = await admin
    .from('players_cache')
    .select('player_id, adp_consensus, adp_sleeper, adp_espn')
    .eq('platform', context.platform)
    .in('player_id', ids)
  const byId = new Map((data ?? []).map((r) => [r.player_id as string, r]))

  let best: { adp: number; name: string } | null = null
  for (const p of result.data) {
    const row = byId.get(p.sourcePlayerId)
    const adp = row?.adp_consensus ?? (context.platform === 'espn' ? row?.adp_espn : row?.adp_sleeper) ?? null
    if (adp === null) continue
    if (!best || adp < best.adp) best = { adp, name: p.displayName }
  }
  return best ? { adp: best.adp, name: best.name } : { adp: null, name: null }
}

export async function computeUserCrossPlatformPortfolio(userId: string): Promise<UserCrossPlatformPortfolio> {
  const admin = createAdminClient()
  const coverage: LeagueCoverageEntry[] = []
  const snapshotEntries: LeagueSnapshotEntry[] = []
  const health: LeagueHealthReport[] = []

  const { data: leagues } = await admin
    .from('connected_leagues')
    .select('id, platform, league_id, league_name, team_id')
    .eq('user_id', userId)
  const rows = (leagues ?? []) as ConnectedLeagueRow[]

  for (const league of rows) {
    try {
      if (!league.team_id) {
        coverage.push({ connectedLeagueId: league.id, leagueName: league.league_name, platform: league.platform, status: 'unavailable', reason: 'No team assigned yet' })
        continue
      }

      const adapter = getIntelligenceAdapter(league.platform)
      if (!adapter) {
        const status: LeagueCoverageStatus = league.platform === 'yahoo' ? 'approval_pending' : 'unsupported'
        coverage.push({ connectedLeagueId: league.id, leagueName: league.league_name, platform: league.platform, status, reason: `No intelligence adapter for platform '${league.platform}'` })
        continue
      }

      const latest = await fetchLatestSnapshot(admin, league.id, league.team_id)
      const freshness: SnapshotFreshness = computeSnapshotFreshness({
        lastSnapshotAt: latest?.snappedAt ?? null,
        now: new Date(),
        capabilitiesSupportRosterRead: adapter.capabilities.rosterRead,
        approvalPending: false,
      })

      if (!latest || (freshness !== 'fresh' && freshness !== 'stale')) {
        coverage.push({ connectedLeagueId: league.id, leagueName: league.league_name, platform: league.platform, status: 'unavailable', reason: 'No successful roster snapshot has been captured yet' })
        continue
      }

      snapshotEntries.push({
        connectedLeagueId: league.id,
        leagueName: league.league_name,
        platform: league.platform,
        freshness,
        snapshot: latest.snapshot,
      })
      coverage.push({
        connectedLeagueId: league.id,
        leagueName: league.league_name,
        platform: league.platform,
        status: freshness === 'fresh' ? 'included_fresh' : 'included_stale',
        reason: null,
      })

      const context: ConnectedLeagueContext = {
        connectedLeagueId: league.id,
        userId,
        platform: league.platform,
        externalLeagueId: league.league_id,
        externalTeamId: league.team_id,
      }
      const [adpLookup, freeAgent] = await Promise.all([
        buildAdpLookup(admin, latest.snapshot),
        bestAvailableAdp(admin, adapter, context),
      ])
      const result = computeCrossPlatformLeagueHealth(latest.snapshot, adpLookup, freeAgent.adp, freeAgent.name)
      health.push({ connectedLeagueId: league.id, leagueName: league.league_name, platform: league.platform, result })
    } catch (err) {
      // A single league's failure is isolated here — it becomes one
      // 'failed' coverage entry, never an exception that would blank
      // every OTHER league's already-computed exposure/health.
      coverage.push({
        connectedLeagueId: league.id,
        leagueName: league.league_name,
        platform: league.platform,
        status: 'failed',
        reason: err instanceof Error ? err.message : 'Unknown error computing this league',
      })
    }
  }

  const exposure = computeCrossPlatformExposure(snapshotEntries)
  return { exposure, health, coverage }
}
