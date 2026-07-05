'use client'

// T-111: Screen Wake Lock API — keeps the screen on while LIVE is the
// active tab, the same primitive video/nav apps use. Auto-releases the
// moment the tab is backgrounded (browser's own behavior, not something
// this hook has to implement) so it can never drain a phone left in a
// pocket. Re-requests on visibility return, since the lock doesn't
// survive a background/foreground cycle.
//
// Real, known gap: Wake Lock only reached iOS Safari in 16.4 — this
// no-ops silently on anything older rather than erroring, same posture
// as every other progressive-enhancement check in this codebase.
// Deliberately opt-in (the `enabled` param), not a silent default — an
// hours-long "screen always on" during a Sunday slate is a real battery
// cost the user should choose, not one this hook imposes on them.

import { useEffect } from 'react'

interface WakeLockSentinelLike {
  release: () => Promise<void>
}

export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    if (!('wakeLock' in navigator)) return

    let sentinel: WakeLockSentinelLike | null = null
    let cancelled = false

    async function requestLock() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lock = await (navigator as any).wakeLock.request('screen')
        if (cancelled) {
          lock.release().catch(() => {})
        } else {
          sentinel = lock
        }
      } catch {
        // Permission denied or unsupported mid-session — fine, just no lock.
      }
    }

    requestLock()

    function onVisibilityChange() {
      if (document.visibilityState === 'visible' && !sentinel) requestLock()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      sentinel?.release().catch(() => {})
    }
  }, [enabled])
}
