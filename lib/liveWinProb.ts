import { winProb } from './winProb'
import type { LiveMatchupSummary } from './liveRoster'
import type { InterruptMetricRow } from '@/types'

// No per-matchup game clock exists in LiveMatchupSummary, so estimate how much
// game is left from the projection gap: a large (projected - current) means
// early in the slate (trust projection); ~0 means the games are effectively
// done (trust the current margin). Tuned so a full slate maps near a full game.
const EXPECTED_REMAINING_PTS = 120

/** Pure: current per-league win probability for the affected leagues. */
export function computeLeagueWinProbs(
  matchups: LiveMatchupSummary[],
  affectedLeagueIds: Set<string>,
): InterruptMetricRow[] {
  return matchups
    .filter((m) => affectedLeagueIds.has(m.leagueId))
    .map((m) => {
      const marginNow = m.myScore - m.opponentScore
      const myProj = m.myProjectedScore ?? m.myScore
      const oppProj = m.opponentProjectedScore ?? m.opponentScore
      const projMargin = myProj - oppProj
      const remainingPts = Math.max(0, (myProj - m.myScore) + (oppProj - m.opponentScore))
      const secondsRemaining = Math.min(3600, (remainingPts / EXPECTED_REMAINING_PTS) * 3600)
      const pct = Math.round(winProb({ marginNow, secondsRemaining, projMargin }) * 100)
      return { leagueName: m.leagueName, label: 'Win Prob', value: `${pct}%`, deltaPositive: pct >= 50 }
    })
}
