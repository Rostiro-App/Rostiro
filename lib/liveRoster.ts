// T-111: LIVE tab's cross-league merge + live-only filtering. Sleeper-only
// for now — ESPN's connection flow never captures team_id (verified: zero
// references anywhere in app/api/leagues/espn/route.ts), the same
// pre-existing gap that's kept every other roster-dependent feature this
// session (Lineups, Trades, Draft Copilot) Sleeper-first. A league row
// with a null team_id is skipped here, not guessed at. The data layer
// underneath (lib/espn.ts's getEspnLivePoints, verified against real box
// scores) is ready the moment that gap is fixed.
//
// "Live now" only ever includes a player whose real NFL game is actually
// in progress right now (live_scores.status_state = 'in') — never
// pregame, bye, or final. One rostered player held across several of a
// user's own Sleeper leagues is merged into one card, tagged with which
// leagues and their starter/bench status in each — the standing
// "cross-league before single-league" rule (Section 1), applied here for
// the first time to a live view.

import { getSleeperRosters, getSleeperMatchups } from '@/lib/sleeper'
import { toNflverseTeamCode } from '@/lib/liveScores'
import { currentNflWeek } from '@/lib/liveMatchupPoints'
import { createAdminClient } from '@/lib/supabase'

type AdminClient = ReturnType<typeof createAdminClient>

interface ConnectedLeagueRow {
  id: string
  platform: 'sleeper' | 'espn' | 'yahoo'
  league_id: string
  league_name: string
  team_id: string | null
}

interface CachedPlayer {
  player_id: string
  name: string
  position: string | null
  nfl_team: string | null
}

export interface LiveGameContext {
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  period: number
  displayClock: string
}

export interface LiveRosterPlayer {
  playerId: string
  name: string
  position: string | null
  nflTeam: string | null
  points: number
  game: LiveGameContext
  leagues: { leagueId: string; leagueName: string; status: 'starting' | 'bench' }[]
}

export interface LiveMatchupSummary {
  leagueId: string
  leagueName: string
  myScore: number
  opponentScore: number
}

export async function buildLiveRoster(
  admin: AdminClient,
  userId: string
): Promise<{ liveRoster: LiveRosterPlayer[]; matchups: LiveMatchupSummary[] }> {
  const { data: leagues } = await admin
    .from('connected_leagues')
    .select('id, platform, league_id, league_name, team_id')
    .eq('user_id', userId)
    .eq('platform', 'sleeper')
  const sleeperLeagues = ((leagues ?? []) as ConnectedLeagueRow[]).filter((l) => l.team_id !== null)
  if (sleeperLeagues.length === 0) return { liveRoster: [], matchups: [] }

  const { data: liveGames } = await admin.from('live_scores').select('game_id, home_score, away_score, period, display_clock').eq('status_state', 'in')

  const { data: scheduleRows } = liveGames && liveGames.length > 0
    ? await admin
        .from('nfl_schedule')
        .select('game_id, home_team, away_team')
        .in('game_id', liveGames.map((g: { game_id: string }) => g.game_id))
    : { data: [] }
  const scheduleByGameId = new Map(
    ((scheduleRows ?? []) as { game_id: string; home_team: string; away_team: string }[]).map((r) => [r.game_id, r])
  )

  // Real NFL team (nflverse code) -> its live game context, for every team
  // currently playing.
  const liveTeamContext = new Map<string, LiveGameContext>()
  for (const g of (liveGames ?? []) as { game_id: string; home_score: number; away_score: number; period: number; display_clock: string }[]) {
    const sched = scheduleByGameId.get(g.game_id)
    if (!sched) continue
    const ctx: LiveGameContext = {
      homeTeam: sched.home_team,
      awayTeam: sched.away_team,
      homeScore: g.home_score,
      awayScore: g.away_score,
      period: g.period,
      displayClock: g.display_clock,
    }
    liveTeamContext.set(sched.home_team, ctx)
    liveTeamContext.set(sched.away_team, ctx)
  }
  // Deliberately no early-exit here when liveTeamContext is empty (e.g.
  // between a user's early and late windows on the same Sunday, or a
  // finished early game with a still-open live_window) — the roster list
  // below naturally comes back empty in that case (every player fails the
  // `if (!game) continue` check), but the matchup rail must still compute:
  // it reflects real points already accrued from a finished window, which
  // are just as real between windows as they are while something's mid-
  // play. Found while building the "stay open between windows" behavior —
  // the old gate returned empty matchups too, which would have blanked a
  // real, correct score the moment the literal live game ended.
  const playersById = new Map<string, LiveRosterPlayer>()
  const matchups: LiveMatchupSummary[] = []

  for (const league of sleeperLeagues) {
    const rosters = await getSleeperRosters(league.league_id).catch(() => [])
    const myRoster = rosters.find((r) => String(r.roster_id) === league.team_id)
    if (!myRoster) continue

    const starterIds = new Set((myRoster.starters ?? []).filter((id: string) => id && id !== '0'))
    const allIds: string[] = myRoster.players ?? []
    if (allIds.length === 0) continue

    const { data: cached } = await admin
      .from('players_cache')
      .select('player_id, name, position, nfl_team')
      .eq('platform', 'sleeper')
      .in('player_id', allIds)
    const byId = new Map(((cached ?? []) as CachedPlayer[]).map((p) => [p.player_id, p]))

    const { data: pointsRow } = await admin
      .from('live_matchup_points')
      .select('players_points')
      .eq('league_id', league.league_id)
      .eq('platform', 'sleeper')
      .eq('roster_id', String(myRoster.roster_id))
      .order('week', { ascending: false })
      .limit(1)
      .maybeSingle()
    const myPoints: Record<string, number> = pointsRow?.players_points ?? {}

    for (const playerId of allIds) {
      const player = byId.get(playerId)
      if (!player?.nfl_team) continue
      const game = liveTeamContext.get(player.nfl_team)
      if (!game) continue // not currently playing — belongs in the updates digest, not here

      const status: 'starting' | 'bench' = starterIds.has(playerId) ? 'starting' : 'bench'
      const existing = playersById.get(playerId)
      if (existing) {
        existing.leagues.push({ leagueId: league.id, leagueName: league.league_name, status })
      } else {
        playersById.set(playerId, {
          playerId,
          name: player.name,
          position: player.position,
          nflTeam: player.nfl_team,
          points: myPoints[playerId] ?? 0,
          game,
          leagues: [{ leagueId: league.id, leagueName: league.league_name, status }],
        })
      }
    }

    // Matchup summary — sums starters' points from the exact same
    // live_matchup_points cache the player cards above already read, not a
    // second, independently-timed fetch of Sleeper's own matchup.points.
    // Found while building a test scenario for this: reading Sleeper's
    // live matchup total directly (the original approach) meant the
    // matchup rail and the per-player cards could show numbers computed
    // at two different poll moments — same real drift risk a scenario
    // couldn't even simulate, since Sleeper's own live response can't be
    // faked. One cache, one source of truth, fixes both.
    const week = await currentNflWeek(admin)
    if (week !== null) {
      const weekMatchups = await getSleeperMatchups(league.league_id, week).catch(() => [])
      const mine = weekMatchups.find((m) => m.roster_id === myRoster.roster_id)
      if (mine && mine.matchup_id !== null) {
        const opponentRosterId = weekMatchups.find((m) => m.roster_id !== myRoster.roster_id && m.matchup_id === mine.matchup_id)?.roster_id
        const opponentRoster = opponentRosterId !== undefined ? rosters.find((r) => r.roster_id === opponentRosterId) : undefined

        const sumStarters = (starters: string[], points: Record<string, number>): number =>
          starters.filter((id) => id && id !== '0').reduce((sum, id) => sum + (points[id] ?? 0), 0)

        let opponentPoints: Record<string, number> = {}
        if (opponentRoster) {
          const { data: row } = await admin
            .from('live_matchup_points')
            .select('players_points')
            .eq('league_id', league.league_id)
            .eq('platform', 'sleeper')
            .eq('week', week)
            .eq('roster_id', String(opponentRoster.roster_id))
            .maybeSingle()
          opponentPoints = row?.players_points ?? {}
        }

        const myScore = sumStarters(myRoster.starters ?? [], myPoints)
        const opponentScore = opponentRoster ? sumStarters(opponentRoster.starters ?? [], opponentPoints) : 0

        matchups.push({ leagueId: league.id, leagueName: league.league_name, myScore, opponentScore })
      }
    }
  }

  return { liveRoster: [...playersById.values()], matchups }
}

// Re-exported for API-route convenience — resolving "which real NFL team
// is this" is the one cross-platform-shared piece (T-90 already
// established this same normalization for touchdown_swing).
export { toNflverseTeamCode }
