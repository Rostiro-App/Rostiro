import { describe, it, expect } from 'vitest'
import { defaultInterruptEvent, prefillInterruptMetrics } from './simEvents'
import { CORE_ROSTER_IDS } from './demoLeagues'

describe('simEvents', () => {
  it('default interrupt event is a TOUCHDOWN with 6.0 points and no metrics', () => {
    const e = defaultInterruptEvent()
    expect(e.kind).toBe('interrupt')
    expect(e.eventLabel).toBe('TOUCHDOWN')
    expect(e.points).toBe(6)
    expect(e.metrics).toEqual([])
    expect(e.autoDismissMs).toBe(7000)
  })
  it('prefill maps a core star + points to real win-prob rows', () => {
    const rows = prefillInterruptMetrics(CORE_ROSTER_IDS[0], 6)
    expect(rows).toHaveLength(3)
    expect(rows[0].label).toBe('Win Prob')
    expect(rows[0].value).toMatch(/^\+\d+%$/)
    expect(rows[0].deltaPositive).toBe(true)
  })
})
