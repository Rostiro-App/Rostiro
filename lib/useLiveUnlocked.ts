'use client'

// T-111: shared by Sidebar and BottomNav so LIVE's dock icon lights up
// exactly when Game Day State is active — reuses the existing
// rostiroState computation (lib/rostiroState.ts) already returned by
// /api/system/status. Zero new detection logic, just a new consequence
// of a state that already gets computed.

import { useEffect, useState } from 'react'

// Polled, not fetched once — found while scoping real test scenarios that
// a one-shot check meant the dock icon could only ever transition on a
// fresh page load, never while someone was already sitting on another
// page watching kickoff approach. Bidirectional too: the original version
// only ever flipped to true, never back, so the icon would stay lit all
// day once a game ended.
const POLL_MS = 20_000

export function useLiveUnlocked(): boolean {
  const [unlocked, setUnlocked] = useState(false)

  useEffect(() => {
    let cancelled = false

    function poll() {
      fetch('/api/system/status')
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { rostiroState?: string } | null) => {
          if (cancelled || !data) return
          setUnlocked((current) => {
            const next = data.rostiroState === 'game_day'
            return next === current ? current : next
          })
        })
        .catch(() => {})
    }

    poll()
    const interval = setInterval(poll, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return unlocked
}
