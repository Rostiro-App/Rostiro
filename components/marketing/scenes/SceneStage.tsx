'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'

interface SceneStageProps {
  durationFrames: number
  caption: string
  fps?: number
  /** When set, overrides the clock (deterministic tests / capture). */
  frame?: number
  /** Frame held when prefers-reduced-motion is on. */
  staticFrame?: number
  children: (frame: number) => ReactNode
}

export function SceneStage({ durationFrames, caption, fps = 30, frame, staticFrame = 0, children }: SceneStageProps) {
  const [tick, setTick] = useState(0)
  const [visible, setVisible] = useState(false)
  const [reduced, setReduced] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const raf = useRef<number | null>(null)
  const start = useRef<number>(0)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const on = () => setReduced(mq.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])

  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === 'undefined') { setVisible(true); return }
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.25 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (frame !== undefined || reduced || !visible) return
    start.current = performance.now()
    const loop = (t: number) => {
      setTick(Math.floor(((t - start.current) / 1000) * fps) % durationFrames)
      raf.current = requestAnimationFrame(loop)
    }
    raf.current = requestAnimationFrame(loop)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [frame, reduced, visible, fps, durationFrames])

  const current = frame !== undefined ? frame : reduced ? staticFrame : tick

  return (
    <div>
      <div
        ref={rootRef}
        className="glass-heavy rounded-2xl overflow-hidden relative"
        style={{ aspectRatio: '16 / 9', border: '1px solid var(--hairline-bright)' }}
      >
        {children(current)}
      </div>
      <p className="text-sm mt-3 text-center" style={{ color: 'var(--t3)' }}>{caption}</p>
    </div>
  )
}
