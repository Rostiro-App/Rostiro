'use client'

// T-68 + OS redesign: league health on glass. Rings glow in their status
// color, factors are dense mono rows, and null factors still render their
// note ("Loads Week 1") instead of a bar — honest preseason degradation,
// never a fake number. Same /api/system/status payload the system bar
// polls: one computation, two surfaces.
//
// T-104: Standard State's emotion is preparation — factors within each
// card sort by urgency (worst score first) rather than a fixed order, so
// what actually needs attention this week leads. Every other State keeps
// the original weight-order; this is the one page where Standard actively
// changes something, not just an ambient accent (6.10's "resting state"
// deliberately stays untagged everywhere else).

import { useEffect, useState } from 'react'
import { useMode } from '@/components/nav/AppShell'
import { sleeperLeagueUrl, espnLeagueUrl, yahooLeagueUrl } from '@/lib/leagueLinks'
import NotesPanel from '@/components/NotesPanel'
import type { LeagueHealthFactor, LeagueHealthStatus, RostiroState, SystemStatus, SystemStatusLeague } from '@/types'

// T-117: plain-language reference for the 5 Health Score factors (PRD 6.2)
// — the page showed the raw factor labels/weights with nothing explaining
// what they mean or how they're computed, real feedback from watching
// someone actually use this page. Wording matches lib/healthScore.ts's real
// formulas, not a generic gloss.
// Labels match lib/healthScore.ts's allFactors() exactly (30/20/20/20/10%).
const FACTOR_LABEL: Record<string, string> = {
  injury: 'Starter injury risk',
  bye: 'Bye exposure',
  waiver: 'Waiver opportunity',
  matchup: 'Matchup difficulty',
  depth: 'Roster depth',
}

const FACTOR_EXPLAINER: Record<string, string> = {
  injury: 'How healthy your starters are right now. A core player marked Out/IR costs a lot; Questionable/Doubtful costs less.',
  bye: 'How many of your rostered players are on bye in a given week. Loads once the season schedule is live.',
  waiver: 'Whether a free agent on the wire is a better player (by ADP) than your weakest starter — a sign there’s a real upgrade sitting unclaimed.',
  matchup: 'How tough your opponent’s roster is this week. Loads once weekly matchups are set.',
  depth: 'How close your bench is to your starters in talent — deep bench survives an injury, thin bench doesn’t.',
}

const WAIVER_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function platformLeagueUrl(league: SystemStatusLeague): string | null {
  if (!league.leagueId) return null
  if (league.platform === 'sleeper') return sleeperLeagueUrl(league.leagueId)
  if (league.platform === 'espn') return espnLeagueUrl(league.leagueId)
  if (league.platform === 'yahoo') return yahooLeagueUrl(league.leagueId)
  return null
}

function sortFactorsByUrgency(factors: LeagueHealthFactor[]): LeagueHealthFactor[] {
  return [...factors].sort((a, b) => {
    if (a.score === null && b.score === null) return 0
    if (a.score === null) return 1
    if (b.score === null) return -1
    return a.score - b.score
  })
}

const STATUS_COLOR: Record<LeagueHealthStatus, string> = {
  healthy: 'var(--live)',
  monitor: 'var(--warn)',
  action: 'var(--crit)',
  unknown: 'var(--t3)',
}

const STATUS_GLOW: Record<LeagueHealthStatus, string> = {
  healthy: 'drop-shadow(0 0 5px rgba(67,192,119,.6))',
  monitor: 'drop-shadow(0 0 5px rgba(245,166,35,.6))',
  action: 'drop-shadow(0 0 5px rgba(232,80,74,.6))',
  unknown: 'none',
}

const STATUS_LABEL: Record<LeagueHealthStatus, string> = {
  healthy: 'HEALTHY',
  monitor: 'MONITOR',
  action: 'ACTION NEEDED',
  unknown: 'NO DATA YET',
}

const PLATFORM_LABEL: Record<string, string> = {
  sleeper: 'SLEEPER',
  yahoo: 'YAHOO',
  espn: 'ESPN',
}

export default function LeaguesPage() {
  const mode = useMode()
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showExplainer, setShowExplainer] = useState(false)

  // Optimistic-update-with-rollback, same pattern as Settings' identical
  // controls — this page and Settings both write through the same
  // /api/leagues/[id] routes, just from the context where a user actually
  // looks (real feedback: "there's no league management here").
  async function disconnect(leagueId: string) {
    const prevLeagues = status?.leagues ?? []
    setStatus((prev) => (prev ? { ...prev, leagues: prev.leagues.filter((l) => l.id !== leagueId) } : prev))
    const res = await fetch(`/api/leagues/${leagueId}`, { method: 'DELETE' })
    if (!res.ok) {
      setStatus((prev) => (prev ? { ...prev, leagues: prevLeagues } : prev))
      setError('Could not disconnect that league — try again.')
    }
  }

  async function updateWaiverCutoff(leagueId: string, waiverCutoffDay: number | null, waiverCutoffHour: number | null) {
    const prevLeagues = status?.leagues ?? []
    setStatus((prev) =>
      prev
        ? { ...prev, leagues: prev.leagues.map((l) => (l.id === leagueId ? { ...l, waiverCutoffDay, waiverCutoffHour } : l)) }
        : prev
    )
    const res = await fetch(`/api/leagues/${leagueId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ waiverCutoffDay, waiverCutoffHour }),
    })
    if (!res.ok) {
      setStatus((prev) => (prev ? { ...prev, leagues: prevLeagues } : prev))
      setError('Could not save that waiver cutoff — try again.')
    }
  }

  useEffect(() => {
    let cancelled = false
    fetch('/api/system/status')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load leagues')
        return res.json()
      })
      .then((data: SystemStatus) => {
        if (!cancelled) setStatus(data)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const leagues = status?.leagues ?? []

  return (
    <div className="max-w-6xl mx-auto px-4 pt-6 pb-8 md:px-6 md:pt-8">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: 'var(--t1)' }}>Leagues</h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--t2)' }}>
            {leagues.length > 0
              ? `${leagues.length} ${leagues.length === 1 ? 'league' : 'leagues'} · Health recalculated on every sync`
              : 'Health recalculated on every sync'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => setShowExplainer((v) => !v)}
            className="mono-data text-[11px] font-semibold tracking-[0.05em] px-3 py-1.5 rounded-lg transition-all"
            style={{ color: 'var(--t2)', border: '1px solid var(--hairline)' }}
          >
            {showExplainer ? 'Hide' : 'What do these mean?'}
          </button>
          {/* T-109: previously only reachable when leagues.length === 0 — a
              returning user with leagues already connected had no way to add
              another one anywhere in the app. */}
          <a
            href="/leagues/add"
            className="mono-data text-[11px] font-semibold tracking-[0.05em] px-3 py-1.5 rounded-lg transition-all hover:brightness-110"
            style={{ backgroundColor: 'var(--signal-dim)', color: 'var(--signal)', border: '1px solid rgba(75,163,245,.4)' }}
          >
            + Add league
          </a>
        </div>
      </div>

      {showExplainer && (
        <div className="glass rounded-[14px] p-5 mb-5">
          <p className="text-[13px] font-semibold mb-1" style={{ color: 'var(--t1)' }}>What is Health Score?</p>
          <p className="text-[12.5px] mb-3" style={{ color: 'var(--t2)' }}>
            0–100, a weighted average of the factors below. If a factor has no data yet (preseason bye/matchup),
            it&apos;s dropped and the rest reweight to fill the gap — never a guessed number standing in.
          </p>
          <div className="space-y-2">
            {Object.entries(FACTOR_EXPLAINER).map(([key, text]) => (
              <p key={key} className="text-[12px] leading-snug" style={{ color: 'var(--t2)' }}>
                <span className="font-semibold" style={{ color: 'var(--t1)' }}>
                  {FACTOR_LABEL[key] ?? key}:
                </span>{' '}
                {text}
              </p>
            ))}
          </div>
        </div>
      )}

      {loading && <SkeletonGrid />}
      {!loading && error && (
        <p className="text-sm" style={{ color: 'var(--crit)' }}>{error}</p>
      )}
      {!loading && !error && leagues.length === 0 && <NoLeagues />}
      {/* Found via a real user report (July 4, 2026): tiles were capped at
          max-w-3xl (768px) regardless of actual screen width, reading as
          small and hemmed-in on anything wider than a laptop. Widened the
          container and the tiles' own content (ring, type scale, padding)
          together — just widening the grid without the content inside it
          growing to match would have left the same small card floating in
          more empty space, not actually looking bigger. */}
      {!loading && !error && leagues.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {leagues.map((league) => (
            <LeagueCard
              key={league.id}
              league={league}
              rostiroState={status?.rostiroState ?? 'standard'}
              mode={mode}
              onDisconnect={disconnect}
              onUpdateWaiverCutoff={updateWaiverCutoff}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function LeagueCard({
  league,
  rostiroState,
  mode,
  onDisconnect,
  onUpdateWaiverCutoff,
}: {
  league: SystemStatusLeague
  rostiroState: RostiroState
  mode: string
  onDisconnect: (leagueId: string) => void
  onUpdateWaiverCutoff: (leagueId: string, day: number | null, hour: number | null) => void
}) {
  const { health } = league
  const color = STATUS_COLOR[health.status]
  const factors = rostiroState === 'standard' ? sortFactorsByUrgency(health.factors) : health.factors
  // T-105 / PRD 3: Focused hides the factor breakdown — "5 max actions,
  // stats hidden by default" — the ring + one-line topFlag is the verdict;
  // Balanced/Savant keep the full breakdown (identical today, since there's
  // no deeper data layer to add for Savant here yet).
  const showFactors = mode !== 'focused'
  const [managing, setManaging] = useState(false)
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false)
  const leagueUrl = platformLeagueUrl(league)

  return (
    <div className="glass card-hover rounded-[16px] p-6">
      <div className="flex items-start gap-5">
        <HealthRing score={health.score} color={color} glow={STATUS_GLOW[health.status]} />
        <div className="min-w-0">
          <p className="text-[17px] font-semibold truncate" style={{ color: 'var(--t1)' }}>{league.name}</p>
          <div className="mono-data flex items-center gap-2 mt-2 text-[10px] tracking-[0.1em]">
            <span className="px-1.5 py-0.5 rounded" style={{ color: 'var(--t3)', border: '1px solid var(--hairline)' }}>
              {PLATFORM_LABEL[league.platform] ?? league.platform.toUpperCase()}
            </span>
            <span style={{ color }}>{STATUS_LABEL[health.status]}</span>
          </div>
          {health.topFlag && (
            <p className="text-[13px] mt-2.5" style={{ color: 'var(--t2)' }}>{health.topFlag}</p>
          )}
          {/* T-109 follow-up: "NO DATA YET" alone doesn't say why — a real
              user reported an ESPN league showing nothing here with no
              explanation. Health/Pulse/Lineup are Sleeper-only today; say
              so honestly rather than leaving an unexplained blank. */}
          {health.status === 'unknown' && (
            <p className="text-[13px] mt-2.5" style={{ color: 'var(--t3)' }}>
              Rostiro&apos;s live health scoring, Pulse, and Start/Sit only run on Sleeper leagues today — {PLATFORM_LABEL[league.platform] ?? league.platform} support is coming.
            </p>
          )}
        </div>
      </div>

      {showFactors && factors.length > 0 && (
        <div className="mt-5 space-y-2.5">
          {factors.map((factor) => (
            <FactorRow key={factor.key} factor={factor} />
          ))}
        </div>
      )}

      {/* T-141: scoped to this exact league (leagueId fixed) — no picker,
          no cross-league list, just this league's own notes. */}
      <NotesPanel leagueId={league.id} />

      {/* T-117: this page had zero league management — found via direct
          founder feedback ("no league management options here"). Deep-link
          to the platform's own league, and the same disconnect/waiver-
          cutoff controls Settings already has, reachable from where a user
          actually looks at a specific league. */}
      <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--hairline)' }}>
        <div className="flex items-center justify-between gap-2">
          {leagueUrl ? (
            <a
              href={leagueUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11.5px] font-semibold"
              style={{ color: 'var(--signal)' }}
            >
              Open in {PLATFORM_LABEL[league.platform] ?? league.platform} →
            </a>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => setManaging((v) => !v)}
            className="text-[11.5px] px-2.5 py-1 rounded-lg transition-all"
            style={{ color: 'var(--t3)', border: '1px solid var(--hairline)' }}
          >
            {managing ? 'Done' : 'Manage'}
          </button>
        </div>

        {managing && (
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px]" style={{ color: 'var(--t3)' }}>Waiver cutoff</span>
              <select
                value={league.waiverCutoffDay ?? ''}
                onChange={(e) => {
                  const day = e.target.value === '' ? null : Number(e.target.value)
                  onUpdateWaiverCutoff(league.id, day, day === null ? null : league.waiverCutoffHour ?? 3)
                }}
                className="text-[10px] rounded px-1.5 py-0.5 outline-none"
                style={{ backgroundColor: 'rgba(6,11,19,0.55)', border: '1px solid var(--hairline)', color: 'var(--t2)' }}
              >
                <option value="">Default (Tue/Wed)</option>
                {WAIVER_DAYS.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
              {league.waiverCutoffDay !== null && (
                <select
                  value={league.waiverCutoffHour ?? 3}
                  onChange={(e) => onUpdateWaiverCutoff(league.id, league.waiverCutoffDay, Number(e.target.value))}
                  className="text-[10px] rounded px-1.5 py-0.5 outline-none"
                  style={{ backgroundColor: 'rgba(6,11,19,0.55)', border: '1px solid var(--hairline)', color: 'var(--t2)' }}
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{String(h).padStart(2, '0')}:00 ET</option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-[10.5px]" style={{ color: 'var(--t4)' }}>
                Overrides the global Tue/Wed default for Waiver Day.
              </p>
              {confirmingDisconnect ? (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => onDisconnect(league.id)}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-lg"
                    style={{ backgroundColor: 'rgba(232,80,74,.13)', color: 'var(--crit)' }}
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmingDisconnect(false)}
                    className="text-[11px] px-2.5 py-1 rounded-lg"
                    style={{ color: 'var(--t2)' }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingDisconnect(true)}
                  className="text-[11px] px-2.5 py-1 rounded-lg flex-shrink-0 transition-all"
                  style={{ color: 'var(--t3)', border: '1px solid var(--hairline)' }}
                >
                  Disconnect
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function FactorRow({ factor }: { factor: LeagueHealthFactor }) {
  const barColor =
    factor.score === null ? 'var(--hairline)'
    : factor.score >= 70 ? 'var(--live)'
    : factor.score >= 50 ? 'var(--warn)'
    : 'var(--crit)'

  return (
    <div className="mono-data grid items-center gap-3 text-[11px]" style={{ gridTemplateColumns: '132px 1fr 34px' }}>
      <span style={{ color: 'var(--t3)' }}>
        {factor.label}
        <span className="ml-1" style={{ color: 'var(--t4)' }}>{factor.weight}%</span>
      </span>
      {factor.score !== null ? (
        <>
          <div className="h-[4px] rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(90,150,210,.1)' }}>
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${factor.score}%`, backgroundColor: barColor }}
            />
          </div>
          <span className="text-right" style={{ color: 'var(--t2)' }}>
            {factor.score}
          </span>
        </>
      ) : (
        <span className="col-span-2" style={{ color: 'var(--t4)' }}>
          {factor.note}
        </span>
      )}
    </div>
  )
}

function HealthRing({ score, color, glow }: { score: number | null; color: string; glow: string }) {
  const r = 30
  const circumference = 2 * Math.PI * r
  const filled = score !== null ? (circumference * score) / 100 : 0

  return (
    <div className="relative flex-shrink-0" style={{ width: 72, height: 72 }}>
      <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(90,150,210,.12)" strokeWidth="5" />
        {score !== null && (
          <circle
            cx="36" cy="36" r={r} fill="none"
            stroke={color} strokeWidth="5" strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference - filled}`}
            style={{ filter: glow }}
          />
        )}
      </svg>
      <span
        className="mono-data absolute inset-0 flex items-center justify-center text-[19px] font-bold"
        style={{ color }}
      >
        {score !== null ? score : '—'}
      </span>
    </div>
  )
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {[0, 1].map((i) => (
        <div key={i} className="glass rounded-[16px] h-60 animate-pulse" />
      ))}
    </div>
  )
}

function NoLeagues() {
  return (
    <div className="glass rounded-[14px] p-8 text-center">
      <p className="text-sm font-semibold mb-1" style={{ color: 'var(--t1)' }}>No leagues connected</p>
      <p className="text-xs mb-4" style={{ color: 'var(--t2)' }}>
        Connect a league and Rostiro starts scoring its health on every sync.
      </p>
      <a
        href="/leagues/add"
        className="inline-block text-sm font-semibold px-4 py-2 rounded-lg transition-all hover:shadow-[0_0_18px_rgba(75,163,245,0.35)]"
        style={{ backgroundColor: 'var(--signal-dim)', color: 'var(--signal)', border: '1px solid rgba(75,163,245,.4)' }}
      >
        Connect a league →
      </a>
    </div>
  )
}
