'use client'
import { useMemo, useState } from 'react'
import players from '@/app/demo/fixtures/players.json'
import { prefillInterruptMetrics, type InterruptSimEvent, type SimMetricRow } from '../lib/simEvents'
import { SURFACE_PACKS, type StudioStateKind } from '../lib/studioPacks'
import { LiveAuthorForm } from './live/LiveAuthorForm'
import type { LiveScenario } from '@/app/demo/lib/liveScenario'
import { PushAuthorForm } from './push/PushAuthorForm'
import type { PushMoment } from '@/app/demo/lib/pushMoment'

type PanelState = StudioStateKind | 'game_day' | 'live' | 'push'
const STATES: { key: PanelState; label: string }[] = [
  { key: 'standard', label: 'Standard' }, { key: 'waiver_day', label: 'Waiver Day' },
  { key: 'game_day', label: 'Game Day' }, { key: 'film_room', label: 'Film Room' },
  { key: 'live', label: 'Live' }, { key: 'push', label: 'Push' },
]
interface DemoPlayerLite { id: string; name: string; pos: string; nflTeam: string }
const POOL = players as DemoPlayerLite[]

export function StudioPanel({ state, onState, event, onChange, onFire, packContent, onPackChange }: {
  state: PanelState; onState: (s: PanelState) => void
  event: InterruptSimEvent; onChange: (e: InterruptSimEvent) => void; onFire: () => void
  packContent: unknown; onPackChange: (c: unknown) => void
}) {
  const [query, setQuery] = useState('')
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? POOL.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8) : []
  }, [query])
  function selectPlayer(p: DemoPlayerLite) {
    setQuery('')
    onChange({ ...event, playerLine: `${p.name} · ${p.pos} · ${p.nflTeam}`, metrics: prefillInterruptMetrics(p.id, event.points ?? 6) })
  }
  function setMetric(i: number, patch: Partial<SimMetricRow>) {
    onChange({ ...event, metrics: event.metrics.map((m, j) => (j === i ? { ...m, ...patch } : m)) })
  }
  const input = { width: '100%', background: 'rgba(8,15,26,.6)', border: '1px solid var(--hairline)', borderRadius: 8, padding: '6px 8px', color: 'var(--t1)', fontSize: 13 } as const
  const pack = state !== 'game_day' && state !== 'live' && state !== 'push' ? SURFACE_PACKS[state] : undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="mono-data" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {STATES.map((s) => (
          <button key={s.key} onClick={() => onState(s.key)} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 6,
            color: state === s.key ? 'var(--signal)' : 'var(--t3)',
            background: state === s.key ? 'var(--signal-dim)' : 'transparent', border: `1px solid ${state === s.key ? 'var(--signal)' : 'var(--hairline)'}` }}>{s.label}</button>
        ))}
      </div>

      {state === 'game_day' ? (
        <>
          <div>
            <label className="mono-data" style={{ display: 'block', fontSize: 12, color: 'var(--t3)', marginBottom: 4 }}>Player</label>
            <input style={input} placeholder="Search player…" value={query} onChange={(e) => setQuery(e.target.value)} />
            {matches.length > 0 && (
              <div className="glass-heavy" style={{ marginTop: 4, borderRadius: 8, overflow: 'hidden' }}>
                {matches.map((p) => (
                  <button key={p.id} onClick={() => selectPlayer(p)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', color: 'var(--t1)', fontSize: 13 }}>
                    {p.name} <span style={{ color: 'var(--t3)' }}>· {p.pos} · {p.nflTeam}</span>
                  </button>
                ))}
              </div>
            )}
            {event.playerLine && <div className="mono-data" style={{ marginTop: 6, fontSize: 11, color: 'var(--t2)' }}>{event.playerLine}</div>}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label className="mono-data" style={{ display: 'block', fontSize: 12, color: 'var(--t3)', marginBottom: 4 }}>Event label</label>
              <input style={input} value={event.eventLabel} onChange={(e) => onChange({ ...event, eventLabel: e.target.value })} /></div>
            <div style={{ width: 90 }}><label className="mono-data" style={{ display: 'block', fontSize: 12, color: 'var(--t3)', marginBottom: 4 }}>Points</label>
              <input style={input} type="number" step="0.1" value={event.points ?? ''} onChange={(e) => onChange({ ...event, points: e.target.value === '' ? null : Number(e.target.value) })} /></div>
          </div>
          <div>
            <label className="mono-data" style={{ display: 'block', fontSize: 12, color: 'var(--t3)', marginBottom: 4 }}>Metric rows (fully editable)</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {event.metrics.map((m, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input style={{ ...input, flex: 2 }} value={m.leagueName} onChange={(e) => setMetric(i, { leagueName: e.target.value })} />
                  <input style={{ ...input, flex: 1 }} value={m.label} onChange={(e) => setMetric(i, { label: e.target.value })} />
                  <input style={{ ...input, width: 64 }} value={m.value} onChange={(e) => setMetric(i, { value: e.target.value })} />
                  <button aria-label="Remove row" onClick={() => onChange({ ...event, metrics: event.metrics.filter((_, j) => j !== i) })} style={{ color: 'var(--t3)' }}>✕</button>
                </div>
              ))}
            </div>
            <button onClick={() => onChange({ ...event, metrics: [...event.metrics, { leagueName: 'New League', label: 'Win Prob', value: '+0%', deltaPositive: true }] })}
              className="mono-data" style={{ marginTop: 8, fontSize: 11, color: 'var(--signal)' }}>+ Add row</button>
          </div>
          <button onClick={onFire} style={{ background: 'var(--signal)', color: '#fff', fontWeight: 600, padding: '10px', borderRadius: 10, fontSize: 14 }}>Fire ⚡</button>
        </>
      ) : state === 'live' ? (
        <LiveAuthorForm content={packContent as LiveScenario} onChange={onPackChange as (s: LiveScenario) => void} />
      ) : state === 'push' ? (
        <PushAuthorForm content={packContent as PushMoment} onChange={onPackChange as (c: PushMoment) => void} />
      ) : pack ? (
        <pack.AuthorForm content={packContent} onChange={onPackChange} />
      ) : null}
    </div>
  )
}
