'use client'

// T-111: shared by Sidebar and BottomNav so LIVE's dock icon lights up
// exactly when this user's own LIVE window is open (lib/liveWindow.ts,
// returned as liveUnlocked by /api/system/status) — not the day-wide
// rostiroState. The two used to disagree: rostiroState is "some game is
// happening across the whole league," which isn't the same thing as "one
// of THIS user's rostered players is in a relevant window," and the icon
// lighting up on the former while /live itself gated on the latter (via
// buildLiveRoster) was a real, confusing desync, not just a polling-phase
// lag — both now read the same per-user window.

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
        .then((data: { liveUnlocked?: boolean } | null) => {
          if (cancelled || !data) return
          setUnlocked((current) => {
            const next = data.liveUnlocked === true
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
