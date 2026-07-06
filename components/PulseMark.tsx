'use client'

// T-91 / Brand Kit v1.0 §2-5: the animated pulse mark. Renders to the left
// of the ROSTIRO wordmark; color/amplitude/cycle speed come from
// STATE_CONFIG (lib/brandTokens.ts), keyed off the active Rostiro State
// (lib/rostiroState.ts). The wordmark never changes — the pulse is the only
// thing that breathes, per the brand kit's one-sentence concept.
//
// Shape is a heartbeat-style trace (flat, dip, spike, dip, flat) rather than
// a plain sine wave — "the shape IS the state" (brand kit §4): each state's
// envelope is scaled by its own amplitude, and a full breath cycle takes
// cycleSec to go rest -> peak -> rest, per state.

import { useEffect, useRef, useState } from 'react'
import { STATE_CONFIG, PLAYOFFS_OVERLAY, STATE_TRANSITION_MS } from '@/lib/brandTokens'
import type { RostiroState } from '@/lib/rostiroState'

// Relative x-position (0-1) and envelope weight (-1..1) per point.
const ENVELOPE: { x: number; weight: number }[] = [
  { x: 0, weight: 0 },
  { x: 0.18, weight: 0 },
  { x: 0.34, weight: -0.35 },
  { x: 0.5, weight: 1 },
  { x: 0.66, weight: -0.5 },
  { x: 0.82, weight: 0 },
  { x: 1, weight: 0 },
]

interface PulseMarkProps {
  state: RostiroState
  /** NFL weeks 15-17 theming layer (PRD 6.10) — renders the gold overlay trace. */
  playoffs?: boolean
  /** 'nav' matches system-bar scale; 'hero' matches marketing/boot-sequence scale. */
  size?: 'nav' | 'hero'
  className?: string
}

export default function PulseMark({ state, playoffs = false, size = 'nav', className }: PulseMarkProps) {
  const config = STATE_CONFIG[state]
  const width = size === 'hero' ? 36 : 30
  const height = size === 'hero' ? 24 : 20
  const [reducedMotion, setReducedMotion] = useState(false)
  const [phase, setPhase] = useState(0)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const onChange = () => setReducedMotion(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (reducedMotion) return
    startRef.current = null
    function tick(t: number) {
      if (startRef.current === null) startRef.current = t
      const elapsed = (t - startRef.current) / 1000
      setPhase((elapsed % config.cycleSec) / config.cycleSec)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [reducedMotion, config.cycleSec])

  const centerY = height / 2
  // Breathe factor goes 0 -> 1 -> 0 across each cycle (rest at the seams
  // between beats, full amplitude mid-cycle) rather than travelling forever.
  const breathe = reducedMotion ? 1 : Math.sin(phase * Math.PI)
  const ampScale = config.amplitude * breathe

  const points = ENVELOPE.map((p) => {
    const x = p.x * width
    const y = centerY - p.weight * ampScale
    return `${x.toFixed(2)},${y.toFixed(2)}`
  }).join(' ')

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Rostiro ${state.replace('_', ' ')} state`}
      className={`flex-shrink-0 ${className ?? ''}`.trim()}
    >
      <polyline
        points={points}
        fill="none"
        stroke={config.color}
        strokeWidth={config.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={playoffs ? PLAYOFFS_OVERLAY.dimActiveStateOpacityTo : 1}
        style={{
          transition: `stroke ${STATE_TRANSITION_MS}ms ease-in-out, opacity ${STATE_TRANSITION_MS}ms ease-in-out`,
        }}
      />
      {playoffs && (
        <polyline
          points={points}
          fill="none"
          stroke={PLAYOFFS_OVERLAY.color}
          strokeWidth={PLAYOFFS_OVERLAY.strokeWidth}
          strokeDasharray={PLAYOFFS_OVERLAY.strokeDasharray}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={PLAYOFFS_OVERLAY.opacity}
        />
      )}
    </svg>
  )
}
