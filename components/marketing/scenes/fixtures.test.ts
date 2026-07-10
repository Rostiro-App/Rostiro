import { describe, it, expect } from 'vitest'
import { DEMO_LEAGUES, multiLeaguePulse } from './fixtures'

describe('multi-league fixtures', () => {
  it('names three leagues', () => {
    expect(DEMO_LEAGUES).toEqual(["Lawrence's Legends League", 'Sunday Money', 'The Bit League'])
  })
  it('produces cards spanning at least two distinct league labels', () => {
    const cards = multiLeaguePulse()
    const labels = new Set(cards.map((c) => c.leagueName))
    expect(labels.size).toBeGreaterThanOrEqual(2)
    expect(cards.length).toBeGreaterThanOrEqual(4)
  })
  it("no card's reasoning references a league other than its own tag", () => {
    const cards = multiLeaguePulse()
    for (const c of cards) {
      expect(c.reasoning).not.toContain("Lawrence's Legends League")
    }
  })
})
