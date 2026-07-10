import { describe, it, expect } from 'vitest'
import { DEMO_LEAGUES, CORE_ROSTER_IDS } from './demoLeagues'
import players from '@/app/demo/fixtures/players.json'

describe('DEMO_LEAGUES', () => {
  it('has the three named leagues', () => {
    expect(DEMO_LEAGUES.map((l) => l.name)).toEqual(["Lawrence's Legends League", 'Sunday Money', 'The Bit League'])
  })
  it('rosters reference real player ids', () => {
    const ids = new Set((players as { id: string }[]).map((p) => p.id))
    for (const lg of DEMO_LEAGUES) for (const pid of lg.founderRoster) expect(ids.has(pid)).toBe(true)
  })
  it('core players are on the founder roster in all three leagues', () => {
    for (const pid of CORE_ROSTER_IDS) {
      for (const lg of DEMO_LEAGUES) expect(lg.founderRoster).toContain(pid)
    }
    expect(CORE_ROSTER_IDS.length).toBeGreaterThanOrEqual(6)
  })
  it('each matchup is a tight game (small margin, real inputs)', () => {
    for (const lg of DEMO_LEAGUES) {
      expect(Math.abs(lg.matchup.myScore - lg.matchup.oppScore)).toBeLessThanOrEqual(12)
      expect(lg.matchup.secondsRemaining).toBeGreaterThan(0)
    }
  })
})
