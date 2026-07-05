'use client'

// T-111: after a stretch of no interaction, LIVE dims itself and (via the
// returned `idle` flag) the page slows its own polling cadence — keeping
// the screen on via Wake Lock shouldn't also mean hammering the network/
// battery at full frequency for a phone sitting untouched on a counter.
// Any interaction snaps straight back to full brightness/cadence.

import { useCallback, useEffect, useRef, useState } from 'react'

const IDLE_AFTER_MS = 90_000
const ACTIVITY_EVENTS = ['pointerdown', 'touchstart', 'keydown', 'scroll'] as const

export function useIdleDim(): { idle: boolean; wake: () => void } {
  const [idle, setIdle] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Resets the timer and, only when actually transitioning out of idle,
  // clears the flag — avoids an unconditional setState on every single
  // interaction event (scroll fires constantly) and on the initial mount,
  // where `idle` is already false by default.
  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setIdle(true), IDLE_AFTER_MS)
  }, [])

  const wake = useCallback(() => {
    setIdle((current) => (current ? false : current))
    resetTimer()
  }, [resetTimer])

  useEffect(() => {
    resetTimer()
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, wake, { passive: true }))
    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, wake))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [resetTimer, wake])

  return { idle, wake }
}
