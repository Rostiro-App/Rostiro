import { describe, it, expect } from 'vitest'
import { resolveAt, collectPatches, duration } from './timeline'
import type { TimelineBeat } from './types'

const beats: TimelineBeat[] = [
  { timeOffset: 0, state: 'standard', label: 'intro' },
  { timeOffset: 10, state: 'game_day', activeAlert: { id: 'a1', kind: 'touchdown', title: 'TD', body: 'x' } },
  { timeOffset: 20, patch: { boxScore: { playerId: 'p1', points: 12.4, line: '1 TD' } } },
]

describe('resolveAt', () => {
  it('returns initial state before first beat effect', () => {
    expect(resolveAt(beats, -1, 'standard').currentState).toBe('standard')
  })
  it('applies the latest state beat at or before the clock', () => {
    expect(resolveAt(beats, 15, 'standard').currentState).toBe('game_day')
  })
  it('surfaces the alert from the most recent alert beat', () => {
    expect(resolveAt(beats, 12, 'standard').activeAlert?.id).toBe('a1')
  })
  it('keeps the active alert until a later alert beat replaces it', () => {
    // resolveAt is sticky: a state-only beat does not clear a prior alert.
    expect(resolveAt(beats, 25, 'standard').activeAlert?.id).toBe('a1')
  })
})

describe('collectPatches', () => {
  it('includes patches at or before the clock', () => {
    expect(collectPatches(beats, 20)).toHaveLength(1)
  })
  it('excludes future patches', () => {
    expect(collectPatches(beats, 19)).toHaveLength(0)
  })
})

describe('duration', () => {
  it('is the max timeOffset', () => { expect(duration(beats)).toBe(20) })
})
