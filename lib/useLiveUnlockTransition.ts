'use client'

// T-111 follow-up: the LIVE-specific "just opened" moment — mirrors
// lib/gameDayTransition.ts's useGameDayKickoffTransition exactly (same
// once-per-ET-day localStorage guard, same ref-based edge detection) but
// keyed off the per-user liveUnlocked signal instead of day-wide
// rostiroState. Shared by the nav icon (a one-time flash layered on top
// of its continuous .breathe loop) and the /live page itself (a brief
// full-screen reveal instead of an instant content swap).

import { useEffect, useRef, useState } from 'react'

const SWEEP_DURATION_MS = 2200

function todayEt(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())
}

export function useLiveUnlockTransition(unlocked: boolean): boolean {
  const [sweeping, setSweeping] = useState(false)
  const prevRef = useRef(false)

  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = unlocked

    // Fires on any transition into unlocked — including a fresh mount that
    // lands directly in it — since that's still the first time *this
    // session* has seen it today. Already unlocked on the previous check
    // is the only thing that skips it.
    if (!unlocked || prev) return
    if (typeof window === 'undefined') return

    const key = `rostiro:live-unlock-sweep:${todayEt()}`
    if (window.localStorage.getItem(key)) return

    window.localStorage.setItem(key, '1')
    // Deferred rather than called directly in the effect body — an
    // immediate next-tick timer, not a perceptible delay, but it keeps
    // the state update in a callback rather than synchronous effect-body
    // code (react-hooks/set-state-in-effect).
    const startTimer = window.setTimeout(() => setSweeping(true), 0)
    const stopTimer = window.setTimeout(() => setSweeping(false), SWEEP_DURATION_MS)
    return () => {
      window.clearTimeout(startTimer)
      window.clearTimeout(stopTimer)
    }
  }, [unlocked])

  return sweeping
}
