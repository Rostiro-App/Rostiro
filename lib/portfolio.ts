// T-86: Portfolio data plumbing (no UI) — weekly roster grade + exposure
// snapshot storage, so the deferred Portfolio product has real history at
// launch instead of starting cold. "Roster grade" reuses the existing,
// already-verified Health Score (lib/healthScore.ts) rather than inventing
// a separate ADP-value grading methodology — confirmed with the founder
// rather than guessed, since this data gets stored historically and would
// be expensive to redo under a different formula later.

import type { SupabaseClient } from '@supabase/supabase-js'
import { getSleeperRosters } from '@/lib/sleeper'
import { computeLeagueHealth, type HealthPlayer } from '@/lib/healthScore'
export { currentWeekStart } from '@/lib/usageLimits'

interface LeagueRow {
  id: string
  league_id: string
  team_id: string | null
}

export interface HealthSnapshotRow {
  leagueId: string
  healthScore: number | null
  healthStatus: string
}

export interface ExposureCount {
  playerId: string
  leagueCount: number
}

export interface PortfolioSnapshot {
  health: HealthSnapshotRow[]
  exposure: ExposureCount[]
}

// Sleeper-only, same scope limit as every other per-league feature this
// session — ESPN/Yahoo roster fetches aren't part of this cron's existing
// loop (see app/api/cron/pulse/route.ts).
export async function computeUserPortfolioSnapshot(
  supabase: SupabaseClient,
  userId: string
): Promise<PortfolioSnapshot> {
  const { data: leagues } = await supabase
    .from('connected_leagues')
    .select('id, league_id, team_id')
    .eq('user_id', userId)
    .eq('platform', 'sleeper')

  const rows = (leagues ?? []) as LeagueRow[]
  if (rows.length === 0) return { health: [], exposure: [] }

  const health: HealthSnapshotRow[] = []
  const exposureCounts = new Map<string, number>()

  for (const league of rows) {
    if (!league.team_id) continue
    try {
      const rosters = await getSleeperRosters(league.league_id)
      const myRoster = rosters.find((r) => String(r.roster_id) === league.team_id)
      if (!myRoster) continue

      const myPlayerIds = Array.isArray(myRoster.players) ? myRoster.players : []
      for (const playerId of myPlayerIds) {
        exposureCounts.set(playerId, (exposureCounts.get(playerId) ?? 0) + 1)
      }

      // Sleeper pads unfilled starter slots with '0' — same filter lib/pulse.ts uses.
      const starterIds = (Array.isArray(myRoster.starters) ? myRoster.starters : []).filter(
        (id) => id && id !== '0'
      )

      let myPlayers: { player_id: string; adp_sleeper: number | null; injury_status: string | null }[] = []
      if (myPlayerIds.length > 0) {
        const { data } = await supabase
          .from('players_cache')
          .select('player_id, adp_sleeper, injury_status')
          .eq('platform', 'sleeper')
          .in('player_id', myPlayerIds)
        myPlayers = data ?? []
      }

      const healthPlayers: HealthPlayer[] = myPlayers.map((p) => ({
        playerId: p.player_id,
        adp: p.adp_sleeper,
        injuryStatus: p.injury_status,
      }))

      // No waiver-candidate context here (this is a background snapshot,
      // not a live Pulse card) — computeLeagueHealth already handles a
      // null bestFreeAgentAdp by reweighting across the factors it does
      // have, same as its bye/matchup preseason gaps. Never a fake number.
      const result = computeLeagueHealth({
        myPlayers: healthPlayers,
        starterIds,
        bestFreeAgentAdp: null,
        bestFreeAgentName: null,
      })

      health.push({ leagueId: league.id, healthScore: result.score, healthStatus: result.status })
    } catch {
      // One league's Sleeper call failing shouldn't blank the user's others.
      continue
    }
  }

  const exposure: ExposureCount[] = Array.from(exposureCounts.entries()).map(([playerId, leagueCount]) => ({
    playerId,
    leagueCount,
  }))

  return { health, exposure }
}
