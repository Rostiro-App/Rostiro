import { describe, it, expect } from 'vitest'
import { buildPulseFeed } from './pulseFeed'
import { demoHealth } from './demoHealth'

describe('buildPulseFeed', () => {
  const items = buildPulseFeed(demoHealth())

  it('produces at least 3 real decision cards', () => {
    expect(items.length).toBeGreaterThanOrEqual(3)
  })
  it('leads with a waiver alert naming the top real breakout', () => {
    const waiver = items.find((i) => i.type === 'waiver_alert')
    expect(waiver).toBeTruthy()
    expect(waiver!.reasoning).toMatch(/FAAB/)
  })
  it('surfaces the real best free agent from the Health engine', () => {
    const fa = items.find((i) => i.id.startsWith('fa-'))
    expect(fa).toBeTruthy()
    expect(fa!.headline).toMatch(/unrostered/)
  })
  it('gives every card a non-empty headline and reasoning', () => {
    for (const i of items) {
      expect(i.headline.length).toBeGreaterThan(0)
      expect(i.reasoning.length).toBeGreaterThan(0)
    }
  })
})
