'use client'

// T-68: Leagues page — the nav item PRD v4 specified that never got built,
// plus League Health Score (PRD 6.2, closes T-52). Reads the same
// /api/system/status payload the system bar polls: one computation, two
// surfaces. Factors with score: null render their note ("Loads Week 1")
// instead of a bar — honest preseason degradation, never a fake number.

import { useEffect, useState } from 'react'
import type { LeagueHealthFactor, LeagueHealthStatus, SystemStatus, SystemStatusLeague } from '@/types'

const STATUS_COLOR: Record<LeagueHealthStatus, string> = {
  healthy: '#4CAF72',
  monitor: '#F59E0B',
  action: '#E84040',
  unknown: '#3A5A7A',
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">Leagues</h1>
        <p className="text-sm mt-0.5" style={{ color: '#5A7A9A' }}>
          {leagues.length > 0
            ? `${leagues.length} ${leagues.length === 1 ? 'league' : 'leagues'} · Health recalculated on every sync`
            : 'Health recalculated on every sync'}
        </p>
      </div>

      {loading && <SkeletonGrid />}
      {!loading && error && (
        <p className="text-sm" style={{ color: '#E84040' }}>{error}</p>
      )}
      {!loading && !error && leagues.length === 0 && <NoLeagues />}
      {!loading && !error && leagues.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {leagues.map((league) => (
            <LeagueCard key={league.id} league={league} />
          ))}
        </div>
      )}
    </div>
  )
}

function LeagueCard({ league }: { league: SystemStatusLeague }) {
  const { health } = league
  const color = STATUS_COLOR[health.status]

  return (
    <div
      className="rounded-xl p-4"
      style={{ backgroundColor: '#0F2235', border: '1px solid #1A3048' }}
    >
      <div className="flex items-start gap-4">
        <HealthRing score={health.score} color={color} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{league.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="text-[10px] font-semibold px-1.5 rounded"
              style={{ color: '#5A7A9A', border: '1px solid #1A3048' }}
            >
              {PLATFORM_LABEL[league.platform] ?? league.platform.toUpperCase()}
            </span>
            <span className="text-[11px] font-bold tracking-wider" style={{ color }}>
              {STATUS_LABEL[health.status]}
            </span>
          </div>
          {health.topFlag && (
            <p className="text-xs mt-2" style={{ color: '#5A7A9A' }}>{health.topFlag}</p>
          )}
        </div>
      </div>

      {health.factors.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {health.factors.map((factor) => (
            <FactorRow key={factor.key} factor={factor} />
          ))}
        </div>
      )}
    </div>
  )
}

function FactorRow({ factor }: { factor: LeagueHealthFactor }) {
  const barColor =
    factor.score === null ? '#1A3048'
    : factor.score >= 70 ? '#4CAF72'
    : factor.score >= 50 ? '#F59E0B'
    : '#E84040'

  return (
    <div className="grid items-center gap-2" style={{ gridTemplateColumns: '128px 1fr 34px' }}>
      <span className="text-[10.5px]" style={{ color: '#3A5A7A' }}>
        {factor.label}
        <span className="ml-1" style={{ color: '#2A4258' }}>{factor.weight}%</span>
      </span>
      {factor.score !== null ? (
        <>
          <div className="h-[3px] rounded-full overflow-hidden" style={{ backgroundColor: '#1A3048' }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${factor.score}%`, backgroundColor: barColor }}
            />
          </div>
          <span
            className="text-[10.5px] text-right"
            style={{ color: '#5A7A9A', fontVariantNumeric: 'tabular-nums' }}
          >
            {factor.score}
          </span>
        </>
      ) : (
        <span className="text-[10.5px] col-span-2" style={{ color: '#2A4258' }}>
          {factor.note}
        </span>
      )}
    </div>
  )
}

function HealthRing({ score, color }: { score: number | null; color: string }) {
  const r = 24
  const circumference = 2 * Math.PI * r
  const filled = score !== null ? (circumference * score) / 100 : 0

  return (
    <div className="relative flex-shrink-0" style={{ width: 58, height: 58 }}>
      <svg width="58" height="58" viewBox="0 0 58 58" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="29" cy="29" r={r} fill="none" stroke="#1A3048" strokeWidth="4" />
        {score !== null && (
          <circle
            cx="29" cy="29" r={r} fill="none"
            stroke={color} strokeWidth="4" strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference - filled}`}
          />
        )}
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-base font-bold"
        style={{ color, fontVariantNumeric: 'tabular-nums' }}
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
        <div
          key={i}
          className="rounded-xl h-48 animate-pulse"
          style={{ backgroundColor: '#0F2235', border: '1px solid #1A3048' }}
        />
      ))}
    </div>
  )
}

function NoLeagues() {
  return (
    <div
      className="rounded-xl p-8 text-center"
      style={{ backgroundColor: '#0F2235', border: '1px solid #1A3048' }}
    >
      <p className="text-sm font-semibold text-white mb-1">No leagues connected</p>
      <p className="text-xs mb-4" style={{ color: '#5A7A9A' }}>
        Connect a league and Rostiro starts scoring its health on every sync.
      </p>
      <a
        href="/onboarding"
        className="inline-block text-sm font-semibold px-4 py-2 rounded-lg text-white"
        style={{ backgroundColor: '#185FA5' }}
      >
        Connect a league →
      </a>
    </div>
  )
}
