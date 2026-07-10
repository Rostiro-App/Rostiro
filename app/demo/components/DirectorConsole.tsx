'use client'
import type { RostiroState } from '@/types'
import { useDemo } from '../lib/DemoStateProvider'

const STATES: { label: string; value: RostiroState }[] = [
  { label: 'Draft', value: 'draft' },
  { label: 'Standard', value: 'standard' },
  { label: 'Waiver', value: 'waiver_day' },
  { label: 'Game Day', value: 'game_day' },
  { label: 'Film Room', value: 'film_room' },
]

export function DirectorConsole({ visible }: { visible: boolean }) {
  const { state, clock, playing, controls } = useDemo()
  if (!visible) return null
  return (
    <aside style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: '#0b1c3a', color: '#fff', padding: '10px 16px', display: 'flex',
      gap: 12, alignItems: 'center', flexWrap: 'wrap', fontFamily: 'system-ui', fontSize: 13 }}>
      <strong>🎬 Director</strong>
      <button onClick={() => (playing ? controls.pause() : controls.play())}>{playing ? 'Pause' : 'Play'}</button>
      <span>clock {clock.toFixed(1)}s</span>
      <input type="range" min={0} max={60} step={0.5} value={Math.min(clock, 60)}
             onChange={(e) => controls.seek(Number(e.target.value))} aria-label="scrub" />
      <label>speed
        <select onChange={(e) => controls.setSpeed(Number(e.target.value))} defaultValue="1">
          <option value="0.5">0.5x</option><option value="1">1x</option><option value="2">2x</option>
        </select>
      </label>
      <span>|</span>
      {STATES.map((s) => (
        <button key={s.value} onClick={() => controls.jumpToState(s.value)}
                style={{ fontWeight: state.currentState === s.value ? 700 : 400 }}>{s.label}</button>
      ))}
      <span>|</span>
      <button onClick={() => controls.inject({ id: `td-${Date.now()}`, kind: 'touchdown', title: 'TOUCHDOWN', body: 'Injected score — +6.0' })}>Inject TD</button>
    </aside>
  )
}
