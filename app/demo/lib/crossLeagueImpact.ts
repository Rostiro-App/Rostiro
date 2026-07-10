import { winProb } from './winProb'
import { DEMO_LEAGUES, type DemoLeagueEntry } from './demoLeagues'

export interface LeagueImpact {
  leagueId: string
  leagueName: string
  beforePct: number
  afterPct: number
  deltaPct: number
}

/** Pure: per-league win-prob impact of adding `points` to the founder's side,
 *  for every league where the player is on the founder roster. */
export function computeInjectionImpact(
  playerId: string,
  points: number,
  leagues: DemoLeagueEntry[] = DEMO_LEAGUES,
): LeagueImpact[] {
  return leagues
    .filter((lg) => lg.founderRoster.includes(playerId))
    .map((lg) => {
      const { myScore, oppScore, secondsRemaining, projMargin } = lg.matchup
      const before = winProb({ marginNow: myScore - oppScore, secondsRemaining, projMargin })
      const after = winProb({ marginNow: myScore - oppScore + points, secondsRemaining, projMargin: projMargin + points })
      const beforePct = Math.round(before * 100)
      const afterPct = Math.round(after * 100)
      return { leagueId: lg.id, leagueName: lg.name, beforePct, afterPct, deltaPct: afterPct - beforePct }
    })
}
