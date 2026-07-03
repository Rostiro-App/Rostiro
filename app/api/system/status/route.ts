// T-67: /api/system/status — the one endpoint behind the OS Shell system
// bar (PRD 6.7 W1). Returns everything the bar's ambient state needs in a
// single call: per-league health scores (computed by lib/healthScore.ts,
// deterministic), and the nearest hard deadline across all leagues. Polled
// by the client on an interval; "Synced Xs ago" is the time since the last
// successful poll, which is honestly when this data was last fresh.
//
// Deadline detection, July 2026 reality: it's the offseason, so the real
// deadline in every league is the scheduled draft (Sleeper exposes
// start_time on the draft object). In-season waiver cutoffs are a T-69
// follow-up — Sleeper's waiver_day_of_week semantics need live verification
// against a real in-season league before we show a countdown to it.

import { createSSRClient } from '@/lib/supabase'
import { getSleeperDrafts, getSleeperRosters } from '@/lib/sleeper'
import { computeLeagueHealth, type HealthPlayer } from '@/lib/healthScore'
import { NextResponse } from 'next/server'
import type { LeagueHealth, SystemDeadline, SystemStatus, SystemStatusLeague } from '@/types'

interface LeagueRow {
  id: string
  platform: 'espn' | 'yahoo' | 'sleeper'
  league_id: string
  league_name: string
  team_id: string | null
}

interface CacheRow {
  player_id: string
  name: string
  adp_sleeper: number | null
  injury_status: string | null
}

const UNKNOWN_HEALTH: LeagueHealth = {
  score: null,
  status: 'unknown',
  factors: [],
  topFlag: null,
}

export async function GET() {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: leagues, error } = await supabase
    .from('connected_leagues')
    .select('id, platform, league_id, league_name, team_id')
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (leagues ?? []) as LeagueRow[]

  // One free-agent pool query serves every league: top of the ADP board,
  // filtered per league against that league's rostered IDs.
  const { data: topPlayers } = await supabase
    .from('players_cache')
    .select('player_id, name, adp_sleeper, injury_status')
    .eq('platform', 'sleeper')
    .not('adp_sleeper', 'is', null)
    .order('adp_sleeper', { ascending: true })
    .limit(200)
  const topPool = (topPlayers ?? []) as CacheRow[]

  const deadlines: SystemDeadline[] = []

  const results = await Promise.allSettled(
    rows.map(async (league): Promise<SystemStatusLeague> => {
      // Health + deadlines are Sleeper-only until Yahoo/ESPN league sync is
      // live end-to-end; other platforms still appear in the bar as unknown.
      if (league.platform !== 'sleeper') {
        return { id: league.id, name: league.league_name, platform: league.platform, health: UNKNOWN_HEALTH }
      }

      const [rosters, drafts] = await Promise.all([
        getSleeperRosters(league.league_id),
        getSleeperDrafts(league.league_id).catch(() => []),
      ])

      // Nearest scheduled-but-not-finished draft in this league.
      const now = Date.now()
      for (const draft of drafts) {
        if (draft.status === 'pre_draft' && draft.start_time && draft.start_time > now) {
          deadlines.push({
            kind: 'draft',
            label: 'Draft',
            leagueName: league.league_name,
            at: new Date(draft.start_time).toISOString(),
          })
        }
      }

      const myRoster = rosters.find((r) => String(r.roster_id) === league.team_id)
      if (!myRoster) {
        return { id: league.id, name: league.league_name, platform: 'sleeper', health: UNKNOWN_HEALTH }
      }

      const allRosteredIds = new Set(rosters.flatMap((r) => r.players ?? []))
      const myIds = myRoster.players ?? []

      // Enrich my roster from the cache in one query.
      const { data: myRows } = await supabase
        .from('players_cache')
        .select('player_id, name, adp_sleeper, injury_status')
        .eq('platform', 'sleeper')
        .in('player_id', myIds.length > 0 ? myIds : ['__none__'])
      const cacheById = new Map(((myRows ?? []) as CacheRow[]).map((r) => [r.player_id, r]))

      const myPlayers: HealthPlayer[] = myIds.map((id) => ({
        playerId: id,
        adp: cacheById.get(id)?.adp_sleeper ?? null,
        injuryStatus: cacheById.get(id)?.injury_status ?? null,
      }))

      const bestFreeAgent = topPool.find((p) => !allRosteredIds.has(p.player_id)) ?? null

      const health = computeLeagueHealth({
        myPlayers,
        starterIds: myRoster.starters ?? [],
        bestFreeAgentAdp: bestFreeAgent?.adp_sleeper ?? null,
        bestFreeAgentName: bestFreeAgent?.name ?? null,
      })

      return { id: league.id, name: league.league_name, platform: 'sleeper', health }
    })
  )

  const statusLeagues: SystemStatusLeague[] = results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { id: rows[i].id, name: rows[i].league_name, platform: rows[i].platform, health: UNKNOWN_HEALTH }
  )

  deadlines.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())

  const status: SystemStatus = {
    syncedAt: new Date().toISOString(),
    leagues: statusLeagues,
    nextDeadline: deadlines[0] ?? null,
  }

  return NextResponse.json(status)
}
