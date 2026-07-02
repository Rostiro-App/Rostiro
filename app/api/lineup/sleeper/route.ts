// T-63: Start/Sit engine — real Sleeper data.
//
// The verdict is computed deterministically from the ADP gap between a
// starter and the best bench player at the same position — Claude is only
// asked to write the explanation sentence for a gap we already found, never
// to decide the swap itself (same split as the Pulse waiver logic).
//
// v1 scope: no weekly quota gate yet (PRD says Free: 3/week, Starter+:
// unlimited) — that needs a usage-tracking table that doesn't exist yet.
// Computed live per request, same as /api/pulse/sleeper, for the same reason:
// no dismiss/cache table built yet.

import { createSSRClient } from '@/lib/supabase'
import { getSleeperRosters } from '@/lib/sleeper'
import { generateStartSitReasoning } from '@/lib/claude'
import { NextResponse } from 'next/server'
import type { Confidence, NFLPosition, Platform, Player, StartSitRecommendation } from '@/types'

interface CachedPlayer {
  player_id: string
  name: string
  position: string | null
  nfl_team: string | null
  injury_status: string | null
  adp_sleeper: number | null
}

const MAX_PER_LEAGUE = 2
const PLATFORM: Platform = 'sleeper'

export async function GET() {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: leagues, error: leaguesError } = await supabase
    .from('connected_leagues')
    .select('id, league_id, league_name, team_id')
    .eq('user_id', user.id)
    .eq('platform', 'sleeper')

  if (leaguesError) {
    return NextResponse.json({ error: leaguesError.message }, { status: 500 })
  }

  if (!leagues || leagues.length === 0) {
    return NextResponse.json({ recommendations: [], leagueCount: 0 })
  }

  const recommendations: StartSitRecommendation[] = []

  for (const league of leagues) {
    try {
      const leagueRecs = await buildLeagueRecommendations(supabase, league)
      recommendations.push(...leagueRecs)
    } catch {
      continue
    }
  }

  return NextResponse.json({ recommendations, leagueCount: leagues.length })
}

function toPlayer(p: CachedPlayer): Player {
  return {
    id: p.player_id,
    name: p.name,
    firstName: '',
    lastName: '',
    position: (p.position as NFLPosition) ?? 'BN',
    nflTeam: p.nfl_team ?? '',
    platform: PLATFORM,
    platformPlayerId: p.player_id,
    injuryStatus: (p.injury_status as Player['injuryStatus']) ?? null,
    injuryDesignation: null,
    adpConsensus: p.adp_sleeper,
    isOnBye: false,
    byeWeek: null,
    projectedPoints: null,
    ownership: null,
  }
}

function verdictForDelta(delta: number): { verdict: StartSitRecommendation['verdict']; confidence: Confidence } {
  if (delta >= 40) return { verdict: 'start_b', confidence: 'high' }
  if (delta >= 15) return { verdict: 'lean_b', confidence: 'medium' }
  return { verdict: 'toss_up', confidence: 'low' }
}

async function buildLeagueRecommendations(
  supabase: Awaited<ReturnType<typeof createSSRClient>>,
  league: { id: string; league_id: string; league_name: string; team_id: string | null }
): Promise<StartSitRecommendation[]> {
  const rosters = await getSleeperRosters(league.league_id)
  const myRoster = rosters.find((r) => String(r.roster_id) === league.team_id)
  if (!myRoster) return []

  const starterIds = (myRoster.starters ?? []).filter((id) => id && id !== '0')
  const allIds = myRoster.players ?? []
  const benchIds = allIds.filter((id) => !starterIds.includes(id))
  if (starterIds.length === 0 || benchIds.length === 0) return []

  const { data: cached } = await supabase
    .from('players_cache')
    .select('player_id, name, position, nfl_team, injury_status, adp_sleeper')
    .eq('platform', 'sleeper')
    .in('player_id', [...starterIds, ...benchIds])

  const byId = new Map((cached ?? []).map((p) => [p.player_id, p as CachedPlayer]))

  const startersByPosition = new Map<string, CachedPlayer[]>()
  for (const id of starterIds) {
    const p = byId.get(id)
    if (!p || p.adp_sleeper == null) continue
    const list = startersByPosition.get(p.position ?? '') ?? []
    list.push(p)
    startersByPosition.set(p.position ?? '', list)
  }

  const benchByPosition = new Map<string, CachedPlayer[]>()
  for (const id of benchIds) {
    const p = byId.get(id)
    if (!p || p.adp_sleeper == null) continue
    const list = benchByPosition.get(p.position ?? '') ?? []
    list.push(p)
    benchByPosition.set(p.position ?? '', list)
  }

  type Candidate = { starter: CachedPlayer; bench: CachedPlayer; delta: number }
  const candidates: Candidate[] = []

  for (const [position, starters] of startersByPosition) {
    const benchAtPosition = benchByPosition.get(position)
    if (!benchAtPosition || benchAtPosition.length === 0) continue

    const bestBench = benchAtPosition.reduce((a, b) => (a.adp_sleeper! < b.adp_sleeper! ? a : b))
    const worstStarter = starters.reduce((a, b) => (a.adp_sleeper! > b.adp_sleeper! ? a : b))
    const delta = worstStarter.adp_sleeper! - bestBench.adp_sleeper!
    if (delta > 0) candidates.push({ starter: worstStarter, bench: bestBench, delta })
  }

  candidates.sort((a, b) => b.delta - a.delta)
  const top = candidates.slice(0, MAX_PER_LEAGUE)

  const recommendations: StartSitRecommendation[] = []
  for (const c of top) {
    const { verdict, confidence } = verdictForDelta(c.delta)

    let reasoning: string
    try {
      reasoning = await generateStartSitReasoning({
        starterName: c.starter.name,
        starterPosition: c.starter.position ?? '',
        starterAdp: c.starter.adp_sleeper!,
        benchName: c.bench.name,
        benchPosition: c.bench.position ?? '',
        benchAdp: c.bench.adp_sleeper!,
      })
    } catch {
      reasoning = `${c.bench.name} has a stronger ADP (${Math.round(c.bench.adp_sleeper!)}) than ${c.starter.name} (${Math.round(c.starter.adp_sleeper!)}).`
    }

    recommendations.push({
      leagueId: league.id,
      leagueName: league.league_name,
      platform: PLATFORM,
      playerA: toPlayer(c.starter),
      playerB: toPlayer(c.bench),
      verdict,
      confidence,
      reasoning,
    })
  }

  return recommendations
}
