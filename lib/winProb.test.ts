import { describe, it, expect } from 'vitest'
import { winProb } from './winProb'

describe('winProb', () => {
  it('is ~0.5 for a tie with everything remaining', () => {
    expect(winProb({ marginNow: 0, secondsRemaining: 3600, projMargin: 0 })).toBeCloseTo(0.5, 1)
  })
  it('approaches 1 for a large lead near the end', () => {
    expect(winProb({ marginNow: 40, secondsRemaining: 30, projMargin: 40 })).toBeGreaterThan(0.98)
  })
  it('approaches 0 for a large deficit near the end', () => {
    expect(winProb({ marginNow: -40, secondsRemaining: 30, projMargin: -40 })).toBeLessThan(0.02)
  })
  it('is monotonic in margin', () => {
    const a = winProb({ marginNow: 5, secondsRemaining: 1800, projMargin: 5 })
    const b = winProb({ marginNow: 15, secondsRemaining: 1800, projMargin: 15 })
    expect(b).toBeGreaterThan(a)
  })
  it('stays within [0,1]', () => {
    const p = winProb({ marginNow: 200, secondsRemaining: 0, projMargin: 200 })
    expect(p).toBeGreaterThanOrEqual(0); expect(p).toBeLessThanOrEqual(1)
  })
})
