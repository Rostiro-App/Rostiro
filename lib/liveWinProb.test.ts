import { describe, it, expect } from 'vitest'
import { computeLeagueWinProbs } from './liveWinProb'
import type { LiveMatchupSummary } from './liveRoster'

const mk = (leagueId: string, my: number, opp: number, myProj: number | null = null, oppProj: number | null = null): LiveMatchupSummary =>
  ({ leagueId, leagueName: `L-${leagueId}`, myScore: my, myProjectedScore: myProj, opponentScore: opp, opponentProjectedScore: oppProj })

describe('computeLeagueWinProbs', () => {
  it('only emits rows for affected leagues', () => {
    const rows = computeLeagueWinProbs([mk('a', 80, 70), mk('b', 60, 90)], new Set(['a']))
    expect(rows).toHaveLength(1)
    expect(rows[0].leagueName).toBe('L-a')
    expect(rows[0].label).toBe('Win Prob')
  })
  it('a clear leader is > 50% and deltaPositive', () => {
    const [r] = computeLeagueWinProbs([mk('a', 110, 80, 110, 80)], new Set(['a']))
    expect(r.value).toMatch(/^\d{1,3}%$/)
    expect(Number(r.value.replace('%', ''))).toBeGreaterThan(50)
    expect(r.deltaPositive).toBe(true)
  })
  it('a clear trailer is < 50% and not deltaPositive', () => {
    const [r] = computeLeagueWinProbs([mk('a', 80, 110, 80, 110)], new Set(['a']))
    expect(Number(r.value.replace('%', ''))).toBeLessThan(50)
    expect(r.deltaPositive).toBe(false)
  })
  it('empty affected set yields no rows', () => {
    expect(computeLeagueWinProbs([mk('a', 80, 70)], new Set())).toHaveLength(0)
  })
})
