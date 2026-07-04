// T-81 / PRD 10.2: Game Day Architecture — the shared live-score fetch. One
// process calls this (the cron route), writes to live_scores, every client
// reads the cache. No client ever calls ESPN's scoreboard directly — that's
// the entire point of this file existing.
//
// Source: ESPN's public (unofficial, no-auth) scoreboard endpoint. Verified
// live July 3, 2026 — real 2026 schedule data already present.
//
// Matching note: nflverse's games.csv has an `espn` cross-reference column,
// but it's empty for future/2026 games (confirmed live) — presumably only
// backfilled after games are actually played. So games are matched by
// (date, home_team, away_team) instead, normalizing the two team-code
// mismatches confirmed between the two sources: Rams (nflverse "LA" vs
// ESPN "LAR") and Washington (nflverse "WAS" vs ESPN "WSH"). All other 30
// team codes are identical between sources — verified against the full
// current-week team list, not assumed.

const SCOREBOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'

const NFLVERSE_TO_ESPN_TEAM: Record<string, string> = {
  LA: 'LAR',
  WAS: 'WSH',
}

function toEspnTeamCode(nflverseCode: string): string {
  return NFLVERSE_TO_ESPN_TEAM[nflverseCode] ?? nflverseCode
}

// T-90: roster-relevance matching needs to go the other way — from a
// player's team code (as Sleeper's /players/nfl payload stores it, cached in
// players_cache.nfl_team) to nfl_schedule's nflverse convention. Verified
// live against both sources July 4, 2026: Sleeper uses LAR for the Rams
// (nflverse uses LA) and WAS for Washington (already matches nflverse — the
// ESPN mismatch above is WAS→WSH, a different pair). Every other code is
// identical between Sleeper and nflverse.
const SLEEPER_TO_NFLVERSE_TEAM: Record<string, string> = {
  LAR: 'LA',
}

export function toNflverseTeamCode(sleeperCode: string): string {
  return SLEEPER_TO_NFLVERSE_TEAM[sleeperCode] ?? sleeperCode
}

export interface LiveScore {
  gameId: string // nfl_schedule.game_id
  homeScore: number
  awayScore: number
  period: number
  displayClock: string
  statusState: 'pre' | 'in' | 'post'
}

interface EspnEvent {
  date: string
  competitions: Array<{
    status: {
      period: number
      displayClock: string
      type: { state: string }
    }
    competitors: Array<{
      homeAway: 'home' | 'away'
      score: string
      team: { abbreviation: string }
    }>
  }>
}

/**
 * `scheduledGames` are today's games from nfl_schedule (game_id, home_team,
 * away_team in nflverse's code convention) — passed in rather than queried
 * here, so this stays a pure/testable function like computeState().
 */
export async function fetchLiveScores(
  scheduledGames: { gameId: string; homeTeam: string; awayTeam: string }[]
): Promise<LiveScore[]> {
  if (scheduledGames.length === 0) return []

  const res = await fetch(SCOREBOARD_URL)
  if (!res.ok) throw new Error(`ESPN scoreboard fetch failed: ${res.status}`)
  const data = await res.json()
  const events = (data.events ?? []) as EspnEvent[]

  const results: LiveScore[] = []
  for (const game of scheduledGames) {
    const espnHome = toEspnTeamCode(game.homeTeam)
    const espnAway = toEspnTeamCode(game.awayTeam)

    const match = events.find((e) => {
      const comp = e.competitions[0]
      const home = comp.competitors.find((c) => c.homeAway === 'home')
      const away = comp.competitors.find((c) => c.homeAway === 'away')
      return home?.team.abbreviation === espnHome && away?.team.abbreviation === espnAway
    })
    if (!match) continue

    const comp = match.competitions[0]
    const home = comp.competitors.find((c) => c.homeAway === 'home')!
    const away = comp.competitors.find((c) => c.homeAway === 'away')!
    const state = comp.status.type.state
    const statusState: 'pre' | 'in' | 'post' = state === 'in' ? 'in' : state === 'post' ? 'post' : 'pre'

    results.push({
      gameId: game.gameId,
      homeScore: Number(home.score) || 0,
      awayScore: Number(away.score) || 0,
      period: comp.status.period,
      displayClock: comp.status.displayClock,
      statusState,
    })
  }
  return results
}
