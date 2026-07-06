'use client'

// T-72: wraps one crucial instrument (health dots, ⌘K, Pulse actions, the
// ticker, the mode chip) and shows its coach mark the first time it's on
// screen and unseen. Registers/unregisters with HintProvider on mount —
// that's what makes this "first use of a surface," not "first login."

import { useEffect } from 'react'
import { useHints } from './HintProvider'
import { HINTS } from '@/lib/hints'

const PLACEMENT_CLASSES: Record<string, string> = {
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  'bottom-end': 'top-full right-0 mt-2',
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
}

export default function HintAnchor({
  id,
  children,
  className = 'relative inline-flex',
  desktopOnly = false,
}: {
  id: string
  children: React.ReactNode
  className?: string
  // Some anchors (⌘K) render in the DOM but CSS-hidden below md — without
  // this they'd still "register" on mobile, occupying the one active-hint
  // slot with a coach mark nobody can see or dismiss, permanently blocking
  // every hint after it in registry order for mobile users.
  desktopOnly?: boolean
}) {
  const hints = useHints()

  useEffect(() => {
    if (!hints) return
    if (!desktopOnly) return hints.registerAnchor(id)

    const mql = window.matchMedia('(min-width: 768px)')
    let unregister: (() => void) | null = null
    const sync = () => {
      if (mql.matches && !unregister) unregister = hints.registerAnchor(id)
      else if (!mql.matches && unregister) {
        unregister()
        unregister = null
      }
    }
    sync()
    mql.addEventListener('change', sync)
    return () => {
      mql.removeEventListener('change', sync)
      unregister?.()
    }
    // registerAnchor is stable (useCallback in the provider); id/desktopOnly
    // are the only real dependencies for register/unregister.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, desktopOnly])

  if (!hints) return <>{children}</>

  const isActive = hints.activeHintId === id
  const def = HINTS.find((h) => h.id === id)

  return (
    <span className={className}>
      {children}
      {isActive && def && (
        <span
          className={`glass-heavy absolute z-50 w-64 rounded-xl p-3.5 panel-enter ${PLACEMENT_CLASSES[def.placement]}`}
          style={{ boxShadow: '0 20px 50px rgba(0,0,0,.5), 0 0 30px rgba(75,163,245,.12)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[10px] font-bold tracking-wide" style={{ color: 'var(--signal)' }}>{def.title}</p>
          <p className="text-xs mt-1.5 leading-snug" style={{ color: 'var(--t2)' }}>{def.body}</p>
          <div className="flex items-center justify-between mt-3">
            <button
              type="button"
              onClick={() => hints.skipTour()}
              className="text-[10.5px]"
              style={{ color: 'var(--t4)' }}
            >
              Skip tour
            </button>
            <button
              type="button"
              onClick={() => hints.dismiss(id)}
              className="text-[10.5px] font-semibold px-2.5 py-1 rounded-full"
              style={{ color: 'var(--signal)', border: '1px solid rgba(75,163,245,.4)', backgroundColor: 'var(--signal-dim)' }}
            >
              Got it
            </button>
          </div>
        </span>
      )}
    </span>
  )
}
