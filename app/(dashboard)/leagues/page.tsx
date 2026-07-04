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
import type { LeagueHealthFactor, LeagueHealthStatus, RostiroState, SystemStatus, SystemStatusLeague } from '@/types'

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
    <div className="max-w-3xl mx-auto px-4 pt-6 pb-8 md:px-6 md:pt-8">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: 'var(--t1)' }}>Leagues</h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--t2)' }}>
            {leagues.length > 0
              ? `${leagues.length} ${leagues.length === 1 ? 'league' : 'leagues'} · Health recalculated on every sync`
              : 'Health recalculated on every sync'}
          </p>
        </div>
        {/* T-109: previously only reachable when leagues.length === 0 — a
            returning user with leagues already connected had no way to add
            another one anywhere in the app. */}
        <a
          href="/leagues/add"
          className="mono-data flex-shrink-0 text-[11px] font-semibold tracking-[0.05em] px-3 py-1.5 rounded-lg transition-all hover:brightness-110"
          style={{ backgroundColor: 'var(--signal-dim)', color: 'var(--signal)', border: '1px solid rgba(75,163,245,.4)' }}
        >
          + Add league
        </a>
      </div>

      {loading && <SkeletonGrid />}
      {!loading && error && (
        <p className="text-sm" style={{ color: 'var(--crit)' }}>{error}</p>
      )}
      {!loading && !error && leagues.length === 0 && <NoLeagues />}
      {!loading && !error && leagues.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {leagues.map((league) => (
            <LeagueCard key={league.id} league={league} rostiroState={status?.rostiroState ?? 'standard'} mode={mode} />
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
}: {
  league: SystemStatusLeague
  rostiroState: RostiroState
  mode: string
}) {
  const { health } = league
  const color = STATUS_COLOR[health.status]
  const factors = rostiroState === 'standard' ? sortFactorsByUrgency(health.factors) : health.factors
  // T-105 / PRD 3: Focused hides the factor breakdown — "5 max actions,
  // stats hidden by default" — the ring + one-line topFlag is the verdict;
  // Balanced/Savant keep the full breakdown (identical today, since there's
  // no deeper data layer to add for Savant here yet).
  const showFactors = mode !== 'focused'

  return (
    <div className="glass card-hover rounded-[14px] p-4">
      <div className="flex items-start gap-4">
        <HealthRing score={health.score} color={color} glow={STATUS_GLOW[health.status]} />
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold truncate" style={{ color: 'var(--t1)' }}>{league.name}</p>
          <div className="mono-data flex items-center gap-2 mt-1.5 text-[9px] tracking-[0.1em]">
            <span className="px-1.5 py-px rounded" style={{ color: 'var(--t3)', border: '1px solid var(--hairline)' }}>
              {PLATFORM_LABEL[league.platform] ?? league.platform.toUpperCase()}
            </span>
            <span style={{ color }}>{STATUS_LABEL[health.status]}</span>
          </div>
          {health.topFlag && (
            <p className="text-[11.5px] mt-2" style={{ color: 'var(--t2)' }}>{health.topFlag}</p>
          )}
          {/* T-109 follow-up: "NO DATA YET" alone doesn't say why — a real
              user reported an ESPN league showing nothing here with no
              explanation. Health/Pulse/Lineup are Sleeper-only today; say
              so honestly rather than leaving an unexplained blank. */}
          {health.status === 'unknown' && (
            <p className="text-[11.5px] mt-2" style={{ color: 'var(--t3)' }}>
              Rostiro's live health scoring, Pulse, and Start/Sit only run on Sleeper leagues today — {PLATFORM_LABEL[league.platform] ?? league.platform} support is coming.
            </p>
          )}
        </div>
      </div>

      {showFactors && factors.length > 0 && (
        <div className="mt-4 space-y-[7px]">
          {factors.map((factor) => (
            <FactorRow key={factor.key} factor={factor} />
          ))}
        </div>
      )}
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
    <div className="mono-data grid items-center gap-2 text-[9.5px]" style={{ gridTemplateColumns: '108px 1fr 30px' }}>
      <span style={{ color: 'var(--t3)' }}>
        {factor.label}
        <span className="ml-1" style={{ color: 'var(--t4)' }}>{factor.weight}%</span>
      </span>
      {factor.score !== null ? (
        <>
          <div className="h-[3px] rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(90,150,210,.1)' }}>
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
  const r = 23
  const circumference = 2 * Math.PI * r
  const filled = score !== null ? (circumference * score) / 100 : 0

  return (
    <div className="relative flex-shrink-0" style={{ width: 56, height: 56 }}>
      <svg width="56" height="56" viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(90,150,210,.12)" strokeWidth="4" />
        {score !== null && (
          <circle
            cx="28" cy="28" r={r} fill="none"
            stroke={color} strokeWidth="4" strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference - filled}`}
            style={{ filter: glow }}
          />
        )}
      </svg>
      <span
        className="mono-data absolute inset-0 flex items-center justify-center text-[15px] font-bold"
        style={{ color }}
      >
        {score !== null ? score : '—'}
      </span>
    </div>
  )
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {[0, 1].map((i) => (
        <div key={i} className="glass rounded-[14px] h-48 animate-pulse" />
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
