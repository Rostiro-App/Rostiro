'use client'

// T-111: shared by Sidebar and BottomNav so LIVE's dock icon lights up
// exactly when Game Day State is active — reuses the existing
// rostiroState computation (lib/rostiroState.ts) already returned by
// /api/system/status. Zero new detection logic, just a new consequence
// of a state that already gets computed.

import { useEffect, useState } from 'react'

export function useLiveUnlocked(): boolean {
  const [unlocked, setUnlocked] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/system/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { rostiroState?: string } | null) => {
        if (!cancelled && data?.rostiroState === 'game_day') setUnlocked(true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return unlocked
}
