'use client'

// T-72 (revised, July 4 2026): boot sequence — now every login, not just
// first-ever (a deliberate change from the original "skippable, never
// repeats" spec, confirmed with the founder). Reuses PulseMark (T-91),
// which was already built anticipating this exact use ("'hero' matches
// marketing/boot-sequence scale") rather than inventing a second mark.
//
// State-colored where possible, never blocked on it: renders with
// 'standard' immediately (no network wait), then swaps in the real
// Rostiro State if /api/system/status resolves before the sequence ends —
// PulseMark's own stroke-color transition makes that swap read as a
// smooth correction, not a flash. Total runtime ~2.2s, well under the
// 2-3s ceiling; a click anywhere skips straight to the fade-out. Gated by
// sessionStorage (once per tab session, not per page navigation) —
// app/(auth)/login/page.tsx clears the flag on mount so a real repeat
// login in the same tab still replays it.
//
// Starts every render (server AND initial client paint) at 'skip' —
// sessionStorage is only ever read inside the effect below, never as part
// of initial state, since window doesn't exist during SSR and branching
// the very first render on it is a real hydration mismatch (caught live:
// server has no overlay, client tried to render one, React flagged it).

import { useEffect, useState } from 'react'
import PulseMark from '@/components/PulseMark'
import type { RostiroState } from '@/lib/rostiroState'

const BOOT_KEY = 'rostiro:booted'
const HOLD_MS = 1300
const MARK_IN_MS = 500
const FADE_OUT_MS = 400

type Phase = 'in' | 'out' | 'done' | 'skip'

export default function BootSequence() {
  const [phase, setPhase] = useState<Phase>('skip')
  const [state, setState] = useState<RostiroState>('standard')

  // Runs once, client-only, after hydration — the one-time "should this
  // tab session boot?" decision belongs here, not in initial render state.
  useEffect(() => {
    if (window.sessionStorage.getItem(BOOT_KEY)) return
    window.sessionStorage.setItem(BOOT_KEY, '1')
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount check, not a derived-state loop; same pre-existing pattern as InterruptStack/gameDayTransition.
    setPhase('in')
  }, [])

  useEffect(() => {
    if (phase !== 'in') return

    // Best-effort — a slow or failed fetch just means the boot plays in
    // Standard's default blue rather than the real active state.
    fetch('/api/system/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { rostiroState?: RostiroState } | null) => {
        if (data?.rostiroState) setState(data.rostiroState)
      })
      .catch(() => {})

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const holdMs = reduced ? 200 : HOLD_MS
    const fadeMs = reduced ? 150 : FADE_OUT_MS

    const timers = [
      window.setTimeout(() => setPhase('out'), MARK_IN_MS + holdMs),
      window.setTimeout(() => setPhase('done'), MARK_IN_MS + holdMs + fadeMs),
    ]
    return () => timers.forEach(window.clearTimeout)
  }, [phase])

  function skip() {
    if (phase !== 'in') return
    setPhase('out')
    window.setTimeout(() => setPhase('done'), 200)
  }

  if (phase === 'done' || phase === 'skip') return null

  return (
    <div
      onClick={skip}
      role="presentation"
      className={`fixed inset-0 z-[100] flex items-center justify-center cursor-pointer ${phase === 'out' ? 'boot-fade-out' : ''}`}
      style={{ backgroundColor: 'var(--void)' }}
    >
      <div className="ambient-ground" aria-hidden="true" />
      <div className="boot-mark-in flex items-center gap-3 relative z-10">
        <PulseMark state={state} size="hero" />
        <span className="mono-data text-2xl font-bold tracking-[0.2em]" style={{ color: 'var(--t1)' }}>
          ROSTIRO
        </span>
      </div>
    </div>
  )
}
