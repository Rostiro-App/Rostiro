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

export function useGameDayKickoffTransition(rostiroState: RostiroState | null): boolean {
  const [sweeping, setSweeping] = useState(false)
  const prevRef = useRef<RostiroState | null>(null)

  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = rostiroState

    // Fires on any transition into game_day — including a fresh mount that
    // lands directly in it (e.g. opening the app mid-slate) — since that's
    // still the first time *this session* has seen Game Day today. Already
    // being in game_day on the previous check is the only thing that skips it.
    if (rostiroState !== 'game_day' || prev === 'game_day') return
    if (typeof window === 'undefined') return

    const key = `rostiro:kickoff-sweep:${todayEt()}`
    if (window.localStorage.getItem(key)) return

    window.localStorage.setItem(key, '1')
    setSweeping(true)
    const t = window.setTimeout(() => setSweeping(false), SWEEP_DURATION_MS)
    return () => window.clearTimeout(t)
  }, [rostiroState])

  return sweeping
}
