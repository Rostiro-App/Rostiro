'use client'

// Dev-only Simulation Suite — the Developer Override Panel.
//
// P3.5-4B: authorization no longer works by "probe the route to discover
// whether I'm allowed." The server layouts (app/(dashboard)/layout.tsx,
// app/draft/layout.tsx) resolve the authenticated user and only mount this
// panel via AppShell when isAdminUserId(user.id) is true, so an ordinary user
// NEVER mounts it and never requests /api/admin/simulate. When it IS mounted
// (admin only), it fetches its real state from GET /api/admin/simulate and
// renders once that status is loaded; an unexpected failed status request is
// handled honestly (it just doesn't render, no uncaught error). Defense in
// depth: the route independently rechecks authorization via requireAdmin()
// and returns a plain 404 (not 401/403 — it shouldn't announce its existence)
// to anyone unauthorized, so client capability state is never the security
// boundary. Works identically on localhost and the deployed app — see the
// route's own header comment for why NODE_ENV alone wasn't the right gate.

import { useEffect, useState } from 'react'
import type { RostiroState } from '@/types'

interface SimStatus {
  isActive: boolean
  simTimestamp: string | null
  forcedState: RostiroState | null
  activeScenario: string | null
  currentPlan: string | null
  promoStartsAt: string | null
  promoEndsAt: string | null
}

// Real users.plan values (types/index.ts) — the aspirational T-85/T-112
// model (Free/Pro/Founder Season Pass/Founding 500) isn't in the schema or
// Stripe yet, so testing gating means exercising what production code
// actually reads today, not the future label.
const PLAN_OPTIONS: { key: string; label: string }[] = [
  { key: 'free', label: 'Free' },
  { key: 'starter', label: 'Starter' },
  { key: 'pro', label: 'Pro' },
  { key: 'commissioner', label: 'Founder' },
]

const STATE_OPTIONS: { key: RostiroState; label: string; color: string }[] = [
  { key: 'draft', label: 'Draft', color: '#1D9E75' },
  { key: 'standard', label: 'Standard', color: '#378ADD' },
  { key: 'waiver_day', label: 'Waiver Day', color: '#1D9E75' },
  { key: 'game_day', label: 'Game Day', color: '#E24B4A' },
  { key: 'film_room', label: 'Film Room', color: '#7F77DD' },
]

const SCENARIOS: { key: string; label: string; desc: string }[] = [
  { key: '1', label: 'Pregame Lineup Panic', desc: 'P0 injury (real starter -> Doubtful), a weather_alert card, lock-countdown in 4 min.' },
  { key: '2', label: 'Live Touchdown (Pulse)', desc: 'Real detectTouchdownSwings, team-level, routed to the Interrupt layer.' },
  { key: '3', label: 'Tuesday Waiver Briefing', desc: 'Real-shaped waiver_alert with FAAB + League Health delta.' },
  { key: '4', label: 'Monday Night Film Room', desc: 'Forces Film Room + the existing demo recap path (real Claude call).' },
]

// T-111 follow-up: LIVE tab scenarios, all data-driven — each seeds real
// rows and calls the real production functions (classifyDeltas,
// detectAndSendLiveUnlockPush), never a hardcoded fake notification.
const LIVE_SCENARIOS: { key: string; label: string; desc: string }[] = [
  { key: '5', label: 'LIVE Unlocks', desc: 'Real kickoff seeded right now — watch the dock icon light up within ~20s, no forced state.' },
  { key: '6', label: 'Touchdown (LIVE)', desc: 'Real classifyDeltas call — proves the classifier reads it as a touchdown. Open /live for the big-play takeover.' },
  { key: '7', label: 'Interception', desc: 'Real negative-delta classification — muted amber pulse on /live, never a red alarm.' },
  { key: '8', label: 'Lead change', desc: 'Real starter points seeded on both rosters — the matchup rail sums them, nothing hardcoded.' },
  { key: '9', label: 'Player injury (not live)', desc: 'No live game seeded — proves it lands in Player updates, never as a live roster card.' },
  { key: '10', label: 'Big play (no score)', desc: '+4.5 pts — classifier must say big_play; takeover reads BIG PLAY, never TOUCHDOWN.' },
  { key: '11', label: 'Lineup-lock urgency', desc: 'Real detectLineupLockUrgency — starter flagged doubtful, kickoff 12 min out, real P0 interrupt.' },
  { key: '12', label: 'Mission complete', desc: 'Real detectMissionComplete — roster-relevant game seeded final, fires the calm end-of-day summary.' },
  { key: '13', label: 'Cross-league touchdown dedup', desc: 'Real detectTouchdownSwings across 2+ leagues sharing a team — one card naming every league, not one per league.' },
  { key: '14', label: 'Lineup-lock (empty slot)', desc: 'Opportunistic, read-only — fires only if a connected roster genuinely has an empty starter slot right now.' },
]

// useLiveUnlockTransition and useGameDayKickoffTransition each gate their
// full-screen animation behind a once-per-ET-day localStorage key — real,
// deliberate production behavior (don't replay the reveal on every refresh),
// but it also means a scenario that triggers one can only ever show it once
// per calendar day per browser. Clearing both here lets the same scenario
// be retriggered same-day without waiting for midnight ET or digging into
// devtools.
function todayEtKey(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())
}

async function callSimulate(body: Record<string, unknown>) {
  const res = await fetch('/api/admin/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.ok ? res.json() : Promise.reject(new Error('Request failed'))
}

export default function SimulationPanel() {
  // Whether the real sim status has loaded. This is NOT an authorization gate
  // (that's the server layout + the route's own requireAdmin()); it only
  // defers rendering until the panel's status GET succeeds, and fails closed
  // (stays hidden, no throw) if that unexpectedly returns non-OK.
  const [statusReady, setStatusReady] = useState(false)
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<SimStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [lastNote, setLastNote] = useState<string | null>(null)
  const [timeInput, setTimeInput] = useState('')
  const [promoStartInput, setPromoStartInput] = useState('')
  const [promoEndInput, setPromoEndInput] = useState('')

  function resetAnimations() {
    const today = todayEtKey()
    localStorage.removeItem(`rostiro:live-unlock-sweep:${today}`)
    localStorage.removeItem(`rostiro:kickoff-sweep:${today}`)
    setLastNote('Cleared today\'s once-per-day animation flags — LIVE Unlocks and any kickoff-triggered sweep can replay now.')
  }

  const refresh = () => {
    fetch('/api/admin/simulate')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: SimStatus) => {
        setStatusReady(true)
        setStatus(data)
      })
      // An unexpected non-OK status (e.g. ADMIN_USER_ID drifted so the route
      // 404s even for a mounted admin) fails closed — hidden, never a throw.
      .catch(() => setStatusReady(false))
  }

  useEffect(() => {
    refresh()
  }, [])

  if (!statusReady) return null

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

          <p className="mono-data text-[9px] tracking-[0.12em] mt-4 mb-2" style={{ color: 'var(--t3)' }}>
            FORCE PLAN{status?.currentPlan ? ` · currently ${status.currentPlan}` : ''}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {PLAN_OPTIONS.map((p) => (
              <button
                key={p.key}
                disabled={busy}
                onClick={() => runAction({ action: 'force_plan', plan: p.key }, `Plan forced to ${p.label} — real users.plan updated, restorable via Clear simulation.`)}
                className="text-[11px] font-medium px-2 py-1.5 rounded-lg text-left disabled:opacity-50"
                style={{
                  color: status?.currentPlan === p.key ? 'var(--signal)' : 'var(--t2)',
                  border: `1px solid ${status?.currentPlan === p.key ? 'var(--signal)' : 'var(--hairline)'}`,
                  backgroundColor: status?.currentPlan === p.key ? 'var(--signal-dim)' : 'transparent',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Real, persistent production setting — not a dev/test scenario
              like everything else in this panel, so it lives in its own
              table (promo_windows) and its own color (gold, matching
              Founder/pricing accents elsewhere) to visually separate it
              from the Dev Simulation Suite around it. "Clear simulation"
              at the bottom never touches this. */}
          <p className="mono-data text-[9px] tracking-[0.12em] mt-4 mb-2" style={{ color: '#F5C842' }}>
            PROMO WINDOW (LIVE, NOT SIMULATED)
          </p>
          {status?.promoStartsAt && status?.promoEndsAt ? (
            <p className="text-[10.5px] mb-2" style={{ color: 'var(--t2)' }}>
              Active: {new Date(status.promoStartsAt).toLocaleString()} → {new Date(status.promoEndsAt).toLocaleString()}
            </p>
          ) : (
            <p className="text-[10.5px] mb-2" style={{ color: 'var(--t3)' }}>Not set — every free user is gated normally.</p>
          )}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] w-9 flex-shrink-0" style={{ color: 'var(--t3)' }}>Start</span>
              <input
                type="datetime-local"
                value={promoStartInput}
                onChange={(e) => setPromoStartInput(e.target.value)}
                className="flex-1 min-w-0 text-[11px] px-2 py-1.5 rounded-lg mono-data"
                style={{ backgroundColor: 'var(--glass-solid)', border: '1px solid var(--hairline)', color: 'var(--t1)' }}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] w-9 flex-shrink-0" style={{ color: 'var(--t3)' }}>End</span>
              <input
                type="datetime-local"
                value={promoEndInput}
                onChange={(e) => setPromoEndInput(e.target.value)}
                className="flex-1 min-w-0 text-[11px] px-2 py-1.5 rounded-lg mono-data"
                style={{ backgroundColor: 'var(--glass-solid)', border: '1px solid var(--hairline)', color: 'var(--t1)' }}
              />
            </div>
            <div className="flex gap-1.5">
              <button
                disabled={busy || !promoStartInput || !promoEndInput}
                onClick={() =>
                  runAction(
                    { action: 'set_promo_window', startsAt: new Date(promoStartInput).toISOString(), endsAt: new Date(promoEndInput).toISOString() },
                    'Promo window saved — every free user gets full Pro depth during that window, real production behavior starting now.'
                  )
                }
                className="flex-1 text-[11px] font-medium px-2 py-1.5 rounded-lg disabled:opacity-50"
                style={{ color: '#F5C842', border: '1px solid rgba(245,200,66,0.5)' }}
              >
                Save
              </button>
              <button
                disabled={busy}
                onClick={() => runAction({ action: 'clear_promo_window' }, 'Promo window cleared — free users are gated normally again.')}
                className="flex-1 text-[11px] font-medium px-2 py-1.5 rounded-lg disabled:opacity-50"
                style={{ color: 'var(--t3)', border: '1px solid var(--hairline)' }}
              >
                Clear
              </button>
            </div>
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

          <p className="mono-data text-[9px] tracking-[0.12em] mt-4 mb-2" style={{ color: 'var(--live)' }}>LIVE TAB — DATA-DRIVEN</p>
          <div className="space-y-1.5">
            {LIVE_SCENARIOS.map((s) => (
              <button
                key={s.key}
                disabled={busy}
                onClick={() => runAction({ action: 'run_scenario', scenario: s.key })}
                className="w-full text-left px-2.5 py-2 rounded-lg disabled:opacity-50"
                style={{
                  border: `1px solid ${status?.activeScenario === s.key ? 'var(--live)' : 'var(--hairline)'}`,
                  backgroundColor: status?.activeScenario === s.key ? 'rgba(67,192,119,.14)' : 'transparent',
                }}
              >
                <p className="text-[11.5px] font-medium" style={{ color: 'var(--t1)' }}>{s.label}</p>
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--t3)' }}>{s.desc}</p>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={resetAnimations}
            className="w-full mt-3 mono-data text-[9.5px] font-semibold tracking-wide px-2.5 py-1.5 rounded-lg"
            style={{ color: 'var(--live)', border: '1px solid var(--hairline)' }}
          >
            Reset today&rsquo;s unlock/kickoff animations
          </button>

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
