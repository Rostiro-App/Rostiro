'use client'

// Marketing hero visual for the homepage StatesSection: the weekly loop the
// four in-season states actually run on, in true chronological order —
// Game Day -> Film Room -> Waiver Day -> Standard -> back to Game Day.
// Draft isn't part of this loop (PRD 6.10: "Preseason through last draft
// completion," a seasonal state, not a weekly one), so it renders as a
// separate preseason chip feeding into the loop rather than a fifth node
// inside it — folding it in as a 5th loop node would misrepresent the
// product's own "five states" framing as "five days," which isn't true.
//
// Real component, not an illustration: colors and relative amplitude come
// straight from STATE_CONFIG (lib/brandTokens.ts), the same source of truth
// PulseMark reads from, so this can't drift out of sync with the product.

import { useEffect, useRef, useState } from 'react'
import { STATE_CONFIG } from '@/lib/brandTokens'
import type { RostiroState } from '@/lib/rostiroState'

const LOOP: { key: RostiroState; label: string; when: string }[] = [
  { key: 'game_day', label: 'Game Day', when: 'Thu / Sun / Mon' },
  { key: 'film_room', label: 'Film Room', when: 'Mon night–Tue AM' },
  { key: 'waiver_day', label: 'Waiver Day', when: 'Tue night–Wed' },
  { key: 'standard', label: 'Standard', when: 'Wed–Sat' },
]

export default function RostiroStatesCycle() {
  const [reducedMotion, setReducedMotion] = useState(false)
  const [active, setActive] = useState(0)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const onChange = () => setReducedMotion(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (reducedMotion) return
    function advance() {
      setActive((prev) => (prev + 1) % LOOP.length)
      const nextIdx = (active + 1) % LOOP.length
      timerRef.current = window.setTimeout(advance, STATE_CONFIG[LOOP[nextIdx].key].cycleSec * 900)
    }
    timerRef.current = window.setTimeout(advance, STATE_CONFIG[LOOP[active].key].cycleSec * 900)
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [active, reducedMotion])

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-2 mb-8">
        <PreseasonChip />
        <svg width="28" height="12" viewBox="0 0 28 12" aria-hidden="true">
          <line x1="0" y1="6" x2="20" y2="6" stroke="var(--hairline-bright)" strokeWidth="1.5" strokeDasharray="3,3" />
          <path d="M20 1 L27 6 L20 11" fill="none" stroke="var(--hairline-bright)" strokeWidth="1.5" />
        </svg>
        <span className="mono-data text-[10px] tracking-[0.1em] uppercase" style={{ color: 'var(--t4)' }}>
          season starts
        </span>
      </div>

      <div className="w-full flex items-center justify-between relative">
        <svg
          className="absolute left-0 right-0"
          style={{ top: '19px', zIndex: 0 }}
          width="100%"
          height="2"
          preserveAspectRatio="none"
        >
          <line x1="10%" y1="1" x2="90%" y2="1" stroke="var(--hairline)" strokeWidth="2" strokeDasharray="1,5" strokeLinecap="round" />
        </svg>

        {LOOP.map((s, i) => {
          const config = STATE_CONFIG[s.key]
          const isActive = i === active
          return (
            <div key={s.key} className="flex flex-col items-center gap-2 relative z-10" style={{ flex: 1 }}>
              <div
                className="rounded-full flex items-center justify-center"
                style={{
                  width: 38,
                  height: 38,
                  backgroundColor: 'var(--void)',
                  border: `2.5px solid ${config.color}`,
                  boxShadow: isActive ? `0 0 0 5px ${config.color}22` : 'none',
                  transition: `box-shadow ${STATE_CONFIG.standard.cycleSec * 100}ms ease-in-out`,
                }}
              >
                <span
                  className="rounded-full"
                  style={{
                    width: isActive ? 12 : 8,
                    height: isActive ? 12 : 8,
                    backgroundColor: config.color,
                    transition: 'width 400ms ease-in-out, height 400ms ease-in-out',
                  }}
                />
              </div>
              <span
                className="mono-data text-[10px] font-bold tracking-[0.1em] uppercase text-center"
                style={{ color: isActive ? config.color : 'var(--t3)' }}
              >
                {s.label}
              </span>
              <span className="mono-data text-[9px] text-center" style={{ color: 'var(--t4)' }}>
                {s.when}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PreseasonChip() {
  const config = STATE_CONFIG.draft
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 rounded-full"
      style={{ border: `1.5px solid ${config.color}`, backgroundColor: `${config.color}14` }}
    >
      <span className="rounded-full" style={{ width: 7, height: 7, backgroundColor: config.color }} />
      <span className="mono-data text-[10px] font-bold tracking-[0.1em] uppercase" style={{ color: config.color }}>
        Draft
      </span>
    </div>
  )
}
