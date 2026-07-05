// T-63: Start/Sit engine — real Sleeper data.
//
// The verdict is computed deterministically from the ADP gap between a
// starter and the best bench player at the same position — Claude is only
// asked to write the explanation sentence for a gap we already found, never
// to decide the swap itself (same split as the Pulse waiver logic).
//
// T-103: Free is 3 AI-written explanations/week (PRD Section 9) — but the
// verdict/confidence above are already deterministic, so hitting the cap
// never blocks the feature. It just falls back to the same plain ADP
// sentence the catch-block already used for a failed Claude call — Free
// users always get a correct recommendation, Pro gets the fuller prose.

import { createSSRClient, createAdminClient } from '@/lib/supabase'
import { getSleeperRosters } from '@/lib/sleeper'
import { generateStartSitReasoning } from '@/lib/claude'
import { checkAndIncrementUsage, isFreePlan } from '@/lib/usageLimits'
import { NFL_TEAM_NAMES } from '@/lib/nflTeams'
import { NextResponse, type NextRequest } from 'next/server'
import type { Mode } from '@/components/nav/AppShell'
import type { Confidence, LeagueLineup, LineupSlot, NFLPosition, Platform, Player, StartSitRecommendation } from '@/types'

const WEEKLY_FREE_LIMIT = 3

const VALID_MODES: readonly Mode[] = ['focused', 'balanced', 'savant']

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

export async function GET(request: NextRequest) {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // T-102: GET has no body, so mode travels as a query param — client
  // already knows it via useMode(), this just carries it server-side.
  const modeParam = request.nextUrl.searchParams.get('mode')
  const mode: Mode = VALID_MODES.includes(modeParam as Mode) ? (modeParam as Mode) : 'balanced'

  const { data: leagues, error: leaguesError } = await supabase
    .from('connected_leagues')
    .select('id, league_id, league_name, team_id, roster_slots_json')
    .eq('user_id', user.id)
    .eq('platform', 'sleeper')

  if (leaguesError) {
    return NextResponse.json({ error: leaguesError.message }, { status: 500 })
  }

  if (!leagues || leagues.length === 0) {
    return NextResponse.json({ recommendations: [], lineups: [], leagueCount: 0 })
  }

  const admin = createAdminClient()
  const free = await isFreePlan(admin, user.id)

  const recommendations: StartSitRecommendation[] = []
  // Found via a real user report (July 4, 2026): a page called "Lineups"
  // showed nothing but a recommendation card, and rendered no lineup at
  // all once the lineup was already optimal ("looks right" with zero
  // roster visible). Added alongside the existing recommendation logic,
  // not replacing it — see buildLeagueLineup below.
  const lineups: LeagueLineup[] = []

  for (const league of leagues) {
    try {
      const leagueRecs = await buildLeagueRecommendations(supabase, league, mode, admin, user.id, free)
      recommendations.push(...leagueRecs)
    } catch {
      continue
    }

    try {
      const lineup = await buildLeagueLineup(supabase, league)
      if (lineup) lineups.push(lineup)
    } catch {
      continue
    }
  }

  return NextResponse.json({ recommendations, lineups, leagueCount: leagues.length })
}

// Verified live against a real roster (July 4, 2026): Sleeper's `starters`
// array is positionally ordered to match the league's own roster slot
// order (starter slots only — connected_leagues.roster_slots_json minus
// 'BN' entries), confirmed by cross-checking every starter's real cached
// position against its expected slot. A player id with no players_cache
// row (seen live: a kicker outside the ADP-ranked cache, and DEF entries
// keyed by team abbreviation like "TEN") falls back to showing the raw id
// rather than silently dropping the slot.
async function buildLeagueLineup(
  supabase: Awaited<ReturnType<typeof createSSRClient>>,
  league: { id: string; league_id: string; league_name: string; team_id: string | null; roster_slots_json: string[] | null }
): Promise<LeagueLineup | null> {
  if (!league.team_id || !league.roster_slots_json) return null

  const rosters = await getSleeperRosters(league.league_id)
  const myRoster = rosters.find((r) => String(r.roster_id) === league.team_id)
  if (!myRoster) return null

  const starterIds = (myRoster.starters ?? []).filter((id) => id && id !== '0')
  const allIds = myRoster.players ?? []
  const benchIds = allIds.filter((id) => !starterIds.includes(id))

  const { data: cached } = await supabase
    .from('players_cache')
    .select('player_id, name, position, nfl_team, injury_status, adp_sleeper')
    .eq('platform', 'sleeper')
    .in('player_id', [...starterIds, ...benchIds])
  const byId = new Map((cached ?? []).map((p) => [p.player_id, p as CachedPlayer]))

  const starterSlotLabels = league.roster_slots_json.filter((s) => s !== 'BN')
  const slots: LineupSlot[] = starterSlotLabels.map((slotLabel, i) => {
    const playerId = starterIds[i] ?? null
    return {
      slotLabel,
      player: playerId ? resolvePlayer(playerId, byId) : null,
      playerIdRaw: playerId,
    }
  })

  const bench: Player[] = benchIds
    .map((id) => resolvePlayer(id, byId))
    .filter((p): p is Player => !!p)

  return { leagueId: league.id, leagueName: league.league_name, slots, bench }
}

// Sleeper keys DEF rosters by team abbreviation (e.g. "TEN"), not a
// players_cache row — resolved via a static team-name map rather than
// falling back to a bare, meaningless id (found live, July 4, 2026: every
// single roster hits this once, for its one DEF slot, not an edge case).
// A player genuinely missing from players_cache (e.g. a kicker with no
// ADP rank, also seen live) still falls back to the raw id — rarer, and
// resolving it would need a second network call this route doesn't make.
function resolvePlayer(id: string, byId: Map<string, CachedPlayer>): Player | null {
  const cached = byId.get(id)
  if (cached) return toPlayer(cached)

  const teamName = NFL_TEAM_NAMES[id]
  if (teamName) {
    return toPlayer({ player_id: id, name: `${teamName} D/ST`, position: 'DEF', nfl_team: id, injury_status: null, adp_sleeper: null })
  }
  return null
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
  league: { id: string; league_id: string; league_name: string; team_id: string | null },
  mode: Mode,
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  free: boolean
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

    const fallbackReasoning = `${c.bench.name} has a stronger ADP (${Math.round(c.bench.adp_sleeper!)}) than ${c.starter.name} (${Math.round(c.starter.adp_sleeper!)}).`

    let reasoning: string
    // Fail open on a metering error (e.g. migration_usage_limits.sql not
    // run yet) — a broken quota check should never take down a working
    // recommendation, same posture as every other degradation in this file.
    const withinQuota = !free || (await checkAndIncrementUsage(admin, userId, 'start_sit', WEEKLY_FREE_LIMIT).catch(() => ({ allowed: true, remaining: 0 }))).allowed
    if (!withinQuota) {
      reasoning = fallbackReasoning
    } else {
      try {
        reasoning = await generateStartSitReasoning({
          starterName: c.starter.name,
          starterPosition: c.starter.position ?? '',
          starterAdp: c.starter.adp_sleeper!,
          benchName: c.bench.name,
          benchPosition: c.bench.position ?? '',
          benchAdp: c.bench.adp_sleeper!,
          mode,
        })
      } catch {
        reasoning = fallbackReasoning
      }
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
