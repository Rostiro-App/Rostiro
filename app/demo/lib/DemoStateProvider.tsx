'use client'
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { RostiroState } from '@/types'
import type { DemoState, ScriptedAlert } from './types'
import { resolveAt, duration } from './timeline'
import { loadFixtures } from './loadFixtures'

export interface DemoControls {
  play(): void; pause(): void; seek(sec: number): void; setSpeed(x: number): void
  jumpToState(s: RostiroState): void; inject(alert: ScriptedAlert): void
}
interface Ctx { state: DemoState; clock: number; playing: boolean; controls: DemoControls }
const DemoCtx = createContext<Ctx | null>(null)

export function DemoStateProvider({ children, autoplay = true }: { children: ReactNode; autoplay?: boolean }) {
  const { timeline } = useMemo(() => loadFixtures(), [])
  const total = useMemo(() => duration(timeline), [timeline])
  const [clock, setClock] = useState(0)
  const [playing, setPlaying] = useState(autoplay)
  const [speed, setSpeed] = useState(1)
  const [override, setOverride] = useState<{ state?: RostiroState; alert?: ScriptedAlert } | null>(null)
  const raf = useRef<number | null>(null)
  const last = useRef<number>(0)

  useEffect(() => {
    if (!playing) return
    last.current = performance.now()
    const tick = (t: number) => {
      const dt = (t - last.current) / 1000 * speed
      last.current = t
      setClock((c) => (total > 0 ? (c + dt) % total : 0)) // loop
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [playing, speed, total])

  const base = resolveAt(timeline, clock, 'standard')
  const state: DemoState = {
    virtualClock: clock,
    currentState: override?.state ?? base.currentState,
    activeAlert: override?.alert ?? base.activeAlert,
  }

  const controls: DemoControls = {
    play: () => setPlaying(true),
    pause: () => setPlaying(false),
    seek: (sec) => { setOverride(null); setClock(Math.max(0, Math.min(total, sec))) },
    setSpeed: (x) => setSpeed(x),
    jumpToState: (s) => { setPlaying(false); setOverride({ state: s }) },
    inject: (alert) => setOverride((o) => ({ state: o?.state, alert })),
  }

  return <DemoCtx.Provider value={{ state, clock, playing, controls }}>{children}</DemoCtx.Provider>
}

export function useDemo(): Ctx {
  const ctx = useContext(DemoCtx)
  if (!ctx) throw new Error('useDemo must be used within DemoStateProvider')
  return ctx
}
