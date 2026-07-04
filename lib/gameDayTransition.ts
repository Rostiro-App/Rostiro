'use client'

// T-92 / PRD 6.13: the kickoff-triggered transition plays once, the first
// time a client notices the state actually flip into Game Day — never on
// every poll while already there, never replayed by navigating away and
// back or refreshing mid-window. A ref alone doesn't survive a remount or a
// page refresh, so the "already played today" flag lives in localStorage,
// keyed by ET calendar date (matching the server's own date convention in
// lib/rostiroState.ts) so it resets naturally the next day.

import { useEffect, useRef, useState } from 'react'
import type { RostiroState } from '@/types'

const SWEEP_DURATION_MS = 1800

function todayEt(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())
}

// T-97: rostiroState alone isn't enough to mean "kickoff" anymore —
// computeState now returns 'game_day' up to 3h before the earliest kickoff
// (the pregame ramp window), so the sweep needs a second, real signal that
// a game has actually started. hasLiveGames is required, not optional,
// specifically so every call site has to pass its own real answer rather
// than silently keeping the old (now-premature) behavior.
export function useGameDayKickoffTransition(rostiroState: RostiroState | null, hasLiveGames: boolean): boolean {
  const [sweeping, setSweeping] = useState(false)
  const prevRef = useRef(false)

  useEffect(() => {
    const isLiveNow = rostiroState === 'game_day' && hasLiveGames
    const prev = prevRef.current
    prevRef.current = isLiveNow

    // Fires on any transition into "truly live" — including a fresh mount
    // that lands directly in it (e.g. opening the app mid-slate) — since
    // that's still the first time *this session* has seen it today.
    // Already being live on the previous check is the only thing that
    // skips it.
    if (!isLiveNow || prev) return
    if (typeof window === 'undefined') return

    const key = `rostiro:kickoff-sweep:${todayEt()}`
    if (window.localStorage.getItem(key)) return

    window.localStorage.setItem(key, '1')
    setSweeping(true)
    const t = window.setTimeout(() => setSweeping(false), SWEEP_DURATION_MS)
    return () => window.clearTimeout(t)
  }, [rostiroState, hasLiveGames])

  return sweeping
}
