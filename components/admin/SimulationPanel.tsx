'use client'

// Dev-only Simulation Suite — the Developer Override Panel. Self-hides for
// everyone except the founder's own account: GET /api/admin/simulate
// returns a plain 404 (not 401/403 — this shouldn't announce its own
// existence) to anyone whose session email doesn't match ADMIN_EMAIL, and
// this component renders nothing at all until that check succeeds. Works
// identically on localhost and the deployed app — see the route's own
// header comment for why NODE_ENV alone wasn't the right gate.

import { useEffect, useState } from 'react'
import type { RostiroState } from '@/types'

interface SimStatus {
  isActive: boolean
  simTimestamp: string | null
  forcedState: RostiroState | null
  activeScenario: string | null
}

const STATE_OPTIONS: { key: RostiroState; label: string; color: string }[] = [
  { key: 'draft', label: 'Draft', color: '#EF9F27' },
  { key: 'standard', label: 'Standard', color: '#378ADD' },
  { key: 'waiver_day', label: 'Waiver Day', color: '#1D9E75' },
  { key: 'game_day', label: 'Game Day', color: '#E24B4A' },
  { key: 'film_room', label: 'Film Room', color: '#7F77DD' },
]

const SCENARIOS: { key: string; label: string; desc: string }[] = [
  { key: '1', label: 'Pregame Lineup Panic', desc: 'P0 injury (real starter -> Doubtful), a weather_alert card, lock-countdown in 4 min.' },
  { key: '2', label: 'Live Touchdown', desc: 'Real detectTouchdownSwings, team-level, routed to the Interrupt layer.' },
  { key: '3', label: 'Tuesday Waiver Briefing', desc: 'Real-shaped waiver_alert with FAAB + League Health delta.' },
  { key: '4', label: 'Monday Night Film Room', desc: 'Forces Film Room + the existing demo recap path (real Claude call).' },
]

async function callSimulate(body: Record<string, unknown>) {
  const res = await fetch('/api/admin/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.ok ? res.json() : Promise.reject(new Error('Request failed'))
}

export default function SimulationPanel() {
  const [allowed, setAllowed] = useState(false)
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<SimStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [lastNote, setLastNote] = useState<string | null>(null)
  const [timeInput, setTimeInput] = useState('')

  const refresh = () => {
    fetch('/api/admin/simulate')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: SimStatus) => {
        setAllowed(true)
        setStatus(data)
      })
      .catch(() => setAllowed(false))
  }

  useEffect(() => {
    refresh()
  }, [])

  if (!allowed) return null

  async function runAction(body: Record<string, unknown>, note?: string) {
    setBusy(true)
    try {
      const result = await callSimulate(body)
      if (note) setLastNote(note)
      else if (typeof result?.note === 'string') setLastNote(result.note)
      refresh()
    } catch {
      setLastNote('Request failed — check the server console.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed z-40 mono-data text-[10px] font-semibold tracking-widest uppercase px-3 py-2 rounded-full"
        style={{
          left: 16,
          bottom: 'calc(16px + env(safe-area-inset-bottom))',
          color: status?.isActive ? 'var(--warn)' : 'var(--t3)',
          backgroundColor: 'rgba(12, 24, 40, 0.85)',
          border: `1px solid ${status?.isActive ? 'var(--warn)' : 'var(--hairline)'}`,
          backdropFilter: 'blur(14px)',
        }}
      >
        {status?.isActive ? '⚡ SIM ACTIVE' : 'SIM'}
      </button>

      {open && (
        <div
          className="fixed z-50 glass-heavy panel-enter rounded-[15px] p-5 overflow-y-auto"
          style={{
            left: 16,
            bottom: 'calc(64px + env(safe-area-inset-bottom))',
            width: 340,
            maxHeight: '76vh',
            boxShadow: '0 30px 90px rgba(0,0,0,.6), 0 0 50px rgba(75,163,245,.10)',
          }}
        >
          <div className="flex items-center justify-between">
            <span className="mono-data text-[9px] tracking-[0.16em]" style={{ color: 'var(--signal)' }}>
              DEV SIMULATION SUITE
            </span>
            <button onClick={() => setOpen(false)} aria-label="Close" style={{ color: 'var(--t3)' }} className="text-[15px] px-1">✕</button>
          </div>

          {status?.isActive && (
            <div className="mono-data text-[10px] mt-2 px-2.5 py-1.5 rounded" style={{ color: 'var(--warn)', border: '1px solid var(--warn)', backgroundColor: 'rgba(245,166,35,0.08)' }}>
              ACTIVE{status.forcedState ? ` · ${status.forcedState.toUpperCase()}` : ''}{status.activeScenario ? ` · SCENARIO ${status.activeScenario}` : ''}
            </div>
          )}

          <p className="mono-data text-[9px] tracking-[0.12em] mt-4 mb-2" style={{ color: 'var(--t3)' }}>FORCE STATE</p>
          <div className="grid grid-cols-2 gap-1.5">
            {STATE_OPTIONS.map((s) => (
              <button
                key={s.key}
                disabled={busy}
                onClick={() => runAction({ action: 'force_state', state: s.key }, `Forced ${s.label} State.`)}
                className="text-[11px] font-medium px-2 py-1.5 rounded-lg text-left disabled:opacity-50"
                style={{
                  color: status?.forcedState === s.key ? s.color : 'var(--t2)',
                  border: `1px solid ${status?.forcedState === s.key ? s.color : 'var(--hairline)'}`,
                  backgroundColor: status?.forcedState === s.key ? `${s.color}18` : 'transparent',
                }}
              >
                {s.label}
              </button>
            ))}
            <button
              disabled={busy}
              onClick={() => runAction({ action: 'force_state', state: null }, 'State override cleared — computeState runs normally again.')}
              className="text-[11px] font-medium px-2 py-1.5 rounded-lg text-left disabled:opacity-50"
              style={{ color: 'var(--t3)', border: '1px solid var(--hairline)' }}
            >
              Auto (clear)
            </button>
          </div>

          <p className="mono-data text-[9px] tracking-[0.12em] mt-4 mb-2" style={{ color: 'var(--t3)' }}>TIME OVERRIDE</p>
          <div className="flex gap-1.5">
            <input
              type="datetime-local"
              value={timeInput}
              onChange={(e) => setTimeInput(e.target.value)}
              className="flex-1 min-w-0 text-[11px] px-2 py-1.5 rounded-lg mono-data"
              style={{ backgroundColor: 'var(--glass-solid)', border: '1px solid var(--hairline)', color: 'var(--t1)' }}
            />
            <button
              disabled={busy || !timeInput}
              onClick={() => runAction({ action: 'set_time', timestamp: new Date(timeInput).toISOString() }, `Sim time set to ${timeInput}.`)}
              className="text-[11px] font-medium px-3 rounded-lg disabled:opacity-50"
              style={{ color: 'var(--signal)', border: '1px solid var(--signal)' }}
            >
              Set
            </button>
          </div>

          <p className="mono-data text-[9px] tracking-[0.12em] mt-4 mb-2" style={{ color: 'var(--t3)' }}>SCENARIOS</p>
          <div className="space-y-1.5">
            {SCENARIOS.map((s) => (
              <button
                key={s.key}
                disabled={busy}
                onClick={() => runAction({ action: 'run_scenario', scenario: s.key })}
                className="w-full text-left px-2.5 py-2 rounded-lg disabled:opacity-50"
                style={{
                  border: `1px solid ${status?.activeScenario === s.key ? 'var(--signal)' : 'var(--hairline)'}`,
                  backgroundColor: status?.activeScenario === s.key ? 'var(--signal-dim)' : 'transparent',
                }}
              >
                <p className="text-[11.5px] font-medium" style={{ color: 'var(--t1)' }}>{s.label}</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--t3)' }}>{s.desc}</p>
              </button>
            ))}
          </div>

          {lastNote && (
            <p className="text-[10.5px] mt-4 leading-relaxed" style={{ color: 'var(--t2)' }}>{lastNote}</p>
          )}

          <button
            disabled={busy}
            onClick={() => runAction({ action: 'clear' }, 'Simulation cleared — all mutated rows restored.')}
            className="w-full mt-4 mono-data text-[10px] font-semibold tracking-widest uppercase px-3 py-2 rounded-lg disabled:opacity-50"
            style={{ color: 'var(--crit)', border: '1px solid var(--crit)' }}
          >
            Clear simulation
          </button>
        </div>
      )}
    </>
  )
}
