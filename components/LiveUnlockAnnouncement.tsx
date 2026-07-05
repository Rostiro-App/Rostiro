'use client'

// The real "LIVE just opened" announcement — global, not page-scoped.
// This used to live inside app/(dashboard)/live/page.tsx, gated on that
// page's own justUnlocked transition. That never actually worked as an
// announcement: the LIVE nav item (BottomNav.tsx / Sidebar.tsx) renders as
// a plain, non-clickable dimmed span with no href at all until the window
// opens, so nobody arriving through normal navigation could ever be
// sitting on /live at the moment it unlocked to see it. Moved here and
// mounted once in AppShell (same pattern as BootSequence/InterruptStack)
// so it fires from wherever the user actually is — Pulse, Leagues,
// anywhere — which is the whole point of an announcement.
//
// Founder feedback (2026-07-05): the original version held for
// useLiveUnlockTransition's SWEEP_DURATION_MS then hard-unmounted — a
// jarring cut straight back to whatever page was underneath. Fixed with a
// real 'visible' -> 'leaving' phase: once the hook's hold timer ends, this
// plays a slower fade-out (LIVE_ANNOUNCE_FADE_MS) instead of disappearing
// instantly, so the still-pulsing LIVE nav icon is what's left standing
// once the screen clears, rather than competing with an abrupt page swap.
// Tap-to-dismiss short-circuits straight into the same fade-out, never an
// instant vanish either. Gated by the same once-per-ET-day localStorage
// key useLiveUnlockTransition already owns, and skippable via the
// Settings "big animations" toggle, same as every other full-screen
// takeover.

import { useEffect, useState } from 'react'
import { useLiveUnlocked } from '@/lib/useLiveUnlocked'
import { useLiveUnlockTransition } from '@/lib/useLiveUnlockTransition'
import { bigAnimationsEnabled } from '@/lib/animationPrefs'

// Matches the .live-announce-out animation duration in app/globals.css —
// kept in sync here so the DOM node is removed exactly when the fade
// finishes, never a beat early (a visible pop) or late (an invisible but
// still-there click target).
const LIVE_ANNOUNCE_FADE_MS = 1400

type Phase = 'hidden' | 'visible' | 'leaving'

export default function LiveUnlockAnnouncement() {
  const liveUnlocked = useLiveUnlocked()
  const justUnlocked = useLiveUnlockTransition(liveUnlocked)
  const [phase, setPhase] = useState<Phase>('hidden')

  useEffect(() => {
    // Deferred rather than called directly in the effect body — same
    // react-hooks/set-state-in-effect avoidance lib/useLiveUnlockTransition.ts
    // already uses for its own phase flips.
    const t = window.setTimeout(() => {
      if (justUnlocked && bigAnimationsEnabled()) {
        setPhase('visible')
      } else if (!justUnlocked) {
        // The hook's own hold timer just ended — begin the fade-out rather
        // than vanishing. If we were never visible (animations were off, or
        // this fired before mount) there's nothing to fade, so stay hidden.
        setPhase((current) => (current === 'visible' ? 'leaving' : current))
      }
    }, 0)
    return () => window.clearTimeout(t)
  }, [justUnlocked])

  useEffect(() => {
    if (phase !== 'leaving') return
    const t = setTimeout(() => setPhase('hidden'), LIVE_ANNOUNCE_FADE_MS)
    return () => clearTimeout(t)
  }, [phase])

  function dismiss() {
    if (phase === 'visible') setPhase('leaving')
  }

  if (phase === 'hidden') return null

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center ${phase === 'leaving' ? 'live-announce-out' : 'panel-enter'}`}
      style={{ background: 'radial-gradient(circle at 50% 42%, rgba(226,75,74,.18), rgba(5,9,16,.96) 70%)' }}
      onClick={dismiss}
    >
      <span className="w-3 h-3 rounded-full breathe" style={{ backgroundColor: '#E24B4A', boxShadow: '0 0 40px rgba(226,75,74,.8)' }} />
      <p className="mono-data text-3xl font-extrabold tracking-[0.3em] mt-6" style={{ color: '#E24B4A', textShadow: '0 0 40px rgba(226,75,74,.55)' }}>
        LIVE IS OPEN
      </p>
      <p className="text-sm mt-3" style={{ color: 'var(--t2)' }}>
        Your players are taking the field.
      </p>
    </div>
  )
}
