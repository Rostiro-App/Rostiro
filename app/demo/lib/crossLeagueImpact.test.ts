import { describe, it, expect } from 'vitest'
import { computeInjectionImpact } from './crossLeagueImpact'
import { CORE_ROSTER_IDS, DEMO_LEAGUES } from './demoLeagues'

describe('computeInjectionImpact', () => {
  it('a core star affects all three leagues', () => {
    const out = computeInjectionImpact(CORE_ROSTER_IDS[0], 6)
    expect(out).toHaveLength(3)
    expect(out.map((i) => i.leagueId)).toEqual(DEMO_LEAGUES.map((l) => l.id))
  })
  it('an unrostered id affects no leagues', () => {
    expect(computeInjectionImpact('does-not-exist', 6)).toHaveLength(0)
  })
  it('more points yields a larger positive delta', () => {
    const small = computeInjectionImpact(CORE_ROSTER_IDS[0], 3)[0].deltaPct
    const big = computeInjectionImpact(CORE_ROSTER_IDS[0], 12)[0].deltaPct
    expect(big).toBeGreaterThan(small)
  })
  it('percentages stay within 0..100', () => {
    for (const i of computeInjectionImpact(CORE_ROSTER_IDS[0], 30)) {
      expect(i.beforePct).toBeGreaterThanOrEqual(0); expect(i.beforePct).toBeLessThanOrEqual(100)
      expect(i.afterPct).toBeGreaterThanOrEqual(0); expect(i.afterPct).toBeLessThanOrEqual(100)
    }
  })
})
