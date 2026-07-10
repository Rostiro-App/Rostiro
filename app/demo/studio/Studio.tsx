'use client'
import { useRef, useState } from 'react'
import { StudioPanel } from './StudioPanel'
import { StudioCanvas } from './StudioCanvas'
import { defaultInterruptEvent, type InterruptSimEvent } from '../lib/simEvents'

export function Studio() {
  const [draft, setDraft] = useState<InterruptSimEvent>(defaultInterruptEvent())
  const [fired, setFired] = useState<InterruptSimEvent | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [aspect, setAspect] = useState<'16:9' | '9:16'>('16:9')
  const [showPanel, setShowPanel] = useState(true)
  const timer = useRef<number | null>(null)

  function fire() {
    if (timer.current) window.clearTimeout(timer.current)
    setLeaving(false)
    setFired(draft)
    if (draft.autoDismissMs != null) {
      timer.current = window.setTimeout(() => {
        setLeaving(true)
        window.setTimeout(() => setFired(null), 340)
      }, draft.autoDismissMs)
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--void)' }}>
      <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="mono-data" style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 11, color: 'var(--t3)' }}>
          <strong style={{ color: 'var(--t1)' }}>🎬 SIMULATION STUDIO</strong>
          <button onClick={() => setAspect(aspect === '16:9' ? '9:16' : '16:9')}>{aspect}</button>
          <button onClick={() => setShowPanel((s) => !s)}>{showPanel ? 'Hide controls (H)' : 'Show controls'}</button>
        </div>
        <StudioCanvas event={fired} aspect={aspect} leaving={leaving} />
      </div>
      {showPanel && (
        <aside style={{ width: 340, padding: 20, borderLeft: '1px solid var(--hairline)', background: 'rgba(8,15,26,.5)' }}>
          <StudioPanel event={draft} onChange={setDraft} onFire={fire} />
        </aside>
      )}
    </div>
  )
}
