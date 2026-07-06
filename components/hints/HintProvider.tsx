'use client'

// T-72: coach-mark state — which hints this user has already seen, which
// anchors are currently mounted, and which single hint (if any) should be
// showing right now. Mirrors AppShell's Mode pattern: a localStorage cache
// for instant, no-flash reads plus a one-time DB hydration, since
// users.seen_hints is the real cross-device source of truth.

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { HINTS, ALL_HINT_IDS } from '@/lib/hints'

const SEEN_HINTS_KEY = 'rostiro_seen_hints'

function readCache(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_HINTS_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function writeCache(ids: string[]) {
  localStorage.setItem(SEEN_HINTS_KEY, JSON.stringify(ids))
}

interface HintContextValue {
  activeHintId: string | null
  registerAnchor: (id: string) => () => void
  dismiss: (id: string) => void
  skipTour: () => void
  replayTour: () => void
}

const HintContext = createContext<HintContextValue | null>(null)

export function useHints() {
  return useContext(HintContext)
}

export default function HintProvider({ children }: { children: React.ReactNode }) {
  const [seenHints, setSeenHints] = useState<string[]>([])
  const [mountedIds, setMountedIds] = useState<Set<string>>(new Set())
  const [hydrated, setHydrated] = useState(false)
  const [readCacheDone, setReadCacheDone] = useState(false)

  // Read the localStorage cache during render, not in an effect — same
  // pattern this codebase already uses for mode/keep-awake/animation prefs:
  // avoids both a hydration mismatch (server has no localStorage) and a
  // setState-in-effect cascade. The DB fetch below still needs an effect
  // (it's async network I/O, not a synchronous local read).
  if (!readCacheDone && typeof window !== 'undefined') {
    setReadCacheDone(true)
    setSeenHints(readCache())
  }

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { seenHints?: string[] } | null) => {
        if (data?.seenHints) {
          setSeenHints(data.seenHints)
          writeCache(data.seenHints)
        }
      })
      .catch(() => {})
      .finally(() => setHydrated(true))
  }, [])

  const registerAnchor = useCallback((id: string) => {
    setMountedIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
    return () => {
      setMountedIds((prev) => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }, [])

  const persist = useCallback((ids: string[]) => {
    fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addSeenHints: ids }),
    }).catch(() => {})
  }, [])

  const dismiss = useCallback(
    (id: string) => {
      setSeenHints((current) => {
        if (current.includes(id)) return current
        const next = [...current, id]
        writeCache(next)
        return next
      })
      persist([id])
    },
    [persist]
  )

  const skipTour = useCallback(() => {
    setSeenHints(ALL_HINT_IDS)
    writeCache(ALL_HINT_IDS)
    persist(ALL_HINT_IDS)
  }, [persist])

  const replayTour = useCallback(() => {
    setSeenHints([])
    writeCache([])
    fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetSeenHints: true }),
    }).catch(() => {})
  }, [])

  // First registry-order hint whose anchor is on screen and not yet seen —
  // never more than one at a time, same "one persistent slot" discipline
  // as the Interrupt Stack (7.1). Nothing shows until DB hydration
  // resolves, so a returning user's already-seen hints never flash first.
  const activeHintId = hydrated
    ? HINTS.find((h) => mountedIds.has(h.id) && !seenHints.includes(h.id))?.id ?? null
    : null

  return (
    <HintContext.Provider value={{ activeHintId, registerAnchor, dismiss, skipTour, replayTour }}>
      {children}
    </HintContext.Provider>
  )
}
