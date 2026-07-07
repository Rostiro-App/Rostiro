'use client'

// T-83: plays once per real fantasy season, the first time a client
// notices this user has actually reached the championship — same
// once-only-reveal shape as useGameDayKickoffTransition
// (lib/gameDayTransition.ts), just keyed by season instead of by ET
// calendar date, since "made the championship" is a once-a-year moment,
// not a daily one. A ref alone doesn't survive a remount/refresh, so the
// "already shown this season" flag lives in localStorage.

import { useEffect, useRef, useState } from 'react'
import type { PlayoffTier } from '@/types'

const SWEEP_DURATION_MS = 2200

// Deliberately not imported from lib/sleeper.ts's own SEASON constant —
// that file also pulls in server-only code (lib/observability.ts ->
// lib/supabase.ts), which has no business being reachable from a 'use
// client' hook's bundle. Same value, kept in sync by hand.
const SEASON = 2026

export function useChampionshipReveal(playoffTier: PlayoffTier | null): boolean {
  const [sweeping, setSweeping] = useState(false)
  const prevRef = useRef<PlayoffTier | null>(null)

  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = playoffTier

    // Fires on any transition into 'championship' — including a fresh
    // mount that lands directly in it — since that's still the first time
    // this session has seen it. Already being there on the previous check
    // is the only thing that skips it.
    if (playoffTier !== 'championship' || prev === 'championship') return
    if (typeof window === 'undefined') return

    const key = `rostiro:championship-reveal:${SEASON}`
    if (window.localStorage.getItem(key)) return

    window.localStorage.setItem(key, '1')
    setSweeping(true)
    const t = window.setTimeout(() => setSweeping(false), SWEEP_DURATION_MS)
    return () => window.clearTimeout(t)
  }, [playoffTier])

  return sweeping
}
