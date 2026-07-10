import type { TimelineBeat, DemoState, PlayerStatline } from './types'
import type { RostiroState } from '@/types'

/** Pure: the demo state at `clock` seconds, given the ordered beats. */
export function resolveAt(beats: TimelineBeat[], clock: number, initialState: RostiroState): DemoState {
  let currentState = initialState
  let activeAlert: DemoState['activeAlert'] = null
  for (const beat of beats) {
    if (beat.timeOffset > clock) break
    if (beat.state) currentState = beat.state
    if (beat.activeAlert) activeAlert = beat.activeAlert
  }
  return { virtualClock: clock, currentState, activeAlert }
}

/** Pure: every box-score upsert applied at or before `uptoClock`, in order. */
export function collectPatches(beats: TimelineBeat[], uptoClock: number): PlayerStatline[] {
  const out: PlayerStatline[] = []
  for (const beat of beats) {
    if (beat.timeOffset > uptoClock) break
    if (beat.patch?.boxScore) out.push(beat.patch.boxScore)
  }
  return out
}

export function duration(beats: TimelineBeat[]): number {
  return beats.reduce((max, b) => Math.max(max, b.timeOffset), 0)
}
