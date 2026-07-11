import { describe, it, expect } from 'vitest'
import { defaultPushMoment, prefillPushMoment, formatLeagueLine } from './pushMoment'

describe('formatLeagueLine', () => {
  it('single league', () => {
    expect(formatLeagueLine(["Lawrence's Legends League"])).toBe("Lawrence's Legends League")
  })
  it('two leagues uses +1 other (singular)', () => {
    expect(formatLeagueLine(['A', 'B'])).toBe('A +1 other')
  })
  it('three+ leagues uses +N others (plural)', () => {
    expect(formatLeagueLine(['A', 'B', 'C'])).toBe('A +2 others')
  })
})

describe('defaultPushMoment', () => {
  it('returns a fully-populated scratch example', () => {
    const m = defaultPushMoment()
    expect(m.appName).toBe('Rostiro')
    expect(m.title.length).toBeGreaterThan(0)
    expect(m.body.length).toBeGreaterThan(0)
    expect(m.timeLabel).toBe('now')
    expect(m.clockTime).toMatch(/^\d{1,2}:\d{2}$/)
    expect(m.dateLabel.length).toBeGreaterThan(0)
  })
})

describe('prefillPushMoment', () => {
  it('uses a real fixture player name and real demo league names', () => {
    const m = prefillPushMoment()
    // body references a real DEMO_LEAGUES name
    expect(m.body).toContain("Lawrence's Legends League")
    // title carries the ruled-out framing
    expect(m.title.toLowerCase()).toContain('ruled out')
  })
})
