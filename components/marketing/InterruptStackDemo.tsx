'use client'

// Interactive proof for Features Pillar 3's Interrupt Stack claim. Mirrors
// the real InterruptStack.tsx (components/InterruptStack.tsx) visual
// language exactly — glass-heavy card, colored left border, mono-data type
// label — rather than inventing a separate look, since PRD 7.1 draws a real
// distinction between the two priorities shown here: touchdown_swing
// (P1, auto-dismisses) vs lineup_lock (P0, persists until dismissed).
// Sample data only, no live fetch, no auth.

import { useEffect, useRef, useState } from 'react'

const AUTO_DISMISS_MS = 3_500

// Matches app/globals.css's --warn / --crit token values. Hardcoded rather
// than var(--warn) because the alpha-suffix trick (color + hex opacity)
// needs a real hex string to concatenate onto, the same reason the real
// InterruptStack.tsx resolves PRIORITY_COLOR to hex before building this
// same boxShadow string.
const WARN = '#F5A623'
const CRIT = '#E8504A'

export default function InterruptStackDemo() {
  const [touchdownVisible, setTouchdownVisible] = useState(false)
  const [touchdownLeaving, setTouchdownLeaving] = useState(false)
  const [lockDismissed, setLockDismissed] = useState(false)
  const dismissTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (dismissTimer.current) window.clearTimeout(dismissTimer.current)
    }
  }, [])

  function simulateTouchdown() {
    if (dismissTimer.current) window.clearTimeout(dismissTimer.current)
    setTouchdownLeaving(false)
    setTouchdownVisible(true)
    dismissTimer.current = window.setTimeout(() => {
      setTouchdownLeaving(true)
      window.setTimeout(() => setTouchdownVisible(false), 340)
    }, AUTO_DISMISS_MS)
  }

  return (
    <div className="grid md:grid-cols-2 gap-6 items-start">
      <div className="flex flex-col items-center">
        <button
          onClick={simulateTouchdown}
          className="text-sm font-semibold px-5 py-2.5 rounded-xl transition-all hover:brightness-110"
          style={{ backgroundColor: 'var(--signal-dim)', color: 'var(--signal)', border: '1px solid var(--signal)' }}
        >
          Simulate a touchdown
        </button>
        <p className="mono-data text-[10px] tracking-[0.1em] uppercase mt-3" style={{ color: 'var(--t4)' }}>
          Priority: important &middot; auto-dismisses
        </p>
        <div className="relative h-[110px] w-full flex items-start justify-center mt-4">
          {touchdownVisible && (
            <div
              className={`glass-heavy rounded-xl px-4 py-3 w-full max-w-[320px] ${touchdownLeaving ? 'card-leave' : 'panel-enter'}`}
              style={{
                borderLeft: `2.5px solid ${WARN}`,
                boxShadow: `0 12px 32px rgba(0,0,0,.35), 0 0 20px ${WARN}22`,
              }}
              role="status"
            >
              <span className="mono-data text-[9px] tracking-[0.16em]" style={{ color: WARN }}>
                TOUCHDOWN
              </span>
              <p className="text-[13px] font-semibold mt-1" style={{ color: 'var(--t1)' }}>
                Bijan Robinson, 14-yard TD.
              </p>
              <p className="text-[12px] mt-1 leading-snug" style={{ color: 'var(--t2)' }}>
                +8.4 pts in League 2. Clears itself in a few seconds.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center">
        <span
          className="text-sm font-semibold px-5 py-2.5 rounded-xl"
          style={{ backgroundColor: 'var(--glass)', color: 'var(--t3)', border: '1px solid var(--hairline)' }}
        >
          A lineup lock always waits for you
        </span>
        <p className="mono-data text-[10px] tracking-[0.1em] uppercase mt-3" style={{ color: 'var(--t4)' }}>
          Priority: critical &middot; stays until dismissed
        </p>
        <div className="relative h-[110px] w-full flex items-start justify-center mt-4">
          {!lockDismissed && (
            <div
              className="glass-heavy rounded-xl px-4 py-3 w-full max-w-[320px]"
              style={{
                borderLeft: `2.5px solid ${CRIT}`,
                boxShadow: `0 12px 32px rgba(0,0,0,.35), 0 0 20px ${CRIT}22`,
              }}
              role="alert"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="mono-data text-[9px] tracking-[0.16em]" style={{ color: CRIT }}>
                  LINEUP LOCK
                </span>
                <button
                  onClick={() => setLockDismissed(true)}
                  aria-label="Dismiss"
                  className="text-[13px] leading-none -mt-0.5"
                  style={{ color: 'var(--t3)' }}
                >
                  ✕
                </button>
              </div>
              <p className="text-[13px] font-semibold mt-1" style={{ color: 'var(--t1)' }}>
                Joe Mixon is questionable, kickoff in 12 minutes.
              </p>
              <p className="text-[12px] mt-1 leading-snug" style={{ color: 'var(--t2)' }}>
                Pivot option ready: Zach Moss. This stays until you act on it.
              </p>
            </div>
          )}
          {lockDismissed && (
            <button
              onClick={() => setLockDismissed(false)}
              className="text-xs mt-8"
              style={{ color: 'var(--t4)' }}
            >
              Reset demo
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
