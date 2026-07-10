'use client'
import { useEffect, useRef, useState } from 'react'
import { StudioPanel } from './StudioPanel'
import { StudioCanvas } from './StudioCanvas'
import { defaultInterruptEvent, type InterruptSimEvent } from '../lib/simEvents'
import { SURFACE_PACKS, type StudioStateKind } from '../lib/studioPacks'

type PanelState = StudioStateKind | 'game_day'

export function Studio() {
  const [state, setState] = useState<PanelState>('game_day')
  const [draft, setDraft] = useState<InterruptSimEvent>(defaultInterruptEvent())
  const [fired, setFired] = useState<InterruptSimEvent | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [aspect, setAspect] = useState<'16:9' | '9:16'>('16:9')
  const [showPanel, setShowPanel] = useState(true)
  const [packContent, setPackContent] = useState<unknown>(null)
  const timers = useRef<number[]>([])
  function clearTimers() { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = [] }

  function selectState(s: PanelState) {
    setState(s); setFired(null); clearTimers()
    if (s !== 'game_day') setPackContent(SURFACE_PACKS[s]!.prefill())
  }
  function fire() {
    clearTimers(); setLeaving(false); setFired(draft)
    if (draft.autoDismissMs != null) {
      const t1 = window.setTimeout(() => {
        setLeaving(true)
        const t2 = window.setTimeout(() => setFired(null), 340)
        timers.current.push(t2)
      }, draft.autoDismissMs)
      timers.current.push(t1)
    }
  }
  useEffect(() => () => clearTimers(), [])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--void)' }}>
      <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="mono-data" style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 11, color: 'var(--t3)' }}>
          <strong style={{ color: 'var(--t1)' }}>🎬 SIMULATION STUDIO</strong>
          <button onClick={() => setAspect(aspect === '16:9' ? '9:16' : '16:9')}>{aspect}</button>
          <button onClick={() => setShowPanel((s) => !s)}>{showPanel ? 'Hide controls (H)' : 'Show controls'}</button>
        </div>
        <StudioCanvas state={state} aspect={aspect} event={state === 'game_day' ? fired : null} leaving={leaving} content={packContent} />
      </div>
      {showPanel && (
        <aside style={{ width: 340, padding: 20, borderLeft: '1px solid var(--hairline)', background: 'rgba(8,15,26,.5)' }}>
          <StudioPanel state={state} onState={selectState} event={draft} onChange={setDraft} onFire={fire} packContent={packContent} onPackChange={setPackContent} />
        </aside>
      )}
    </div>
  )
}
