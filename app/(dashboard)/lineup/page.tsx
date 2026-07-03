'use client'

// T-63: Real Sleeper data via /api/lineup/sleeper. No weekly free/paid quota
// yet — that needs a usage-tracking table (see PRD: Free 3/week, Starter+
// unlimited), tracked as a follow-up.

import { useEffect, useState } from 'react'
import { useMode, type Mode } from '@/components/nav/AppShell'
import type { Confidence, StartSitRecommendation } from '@/types'

const VERDICT_LABEL: Record<StartSitRecommendation['verdict'], string> = {
  start_a: 'Start current',
  start_b: 'Start the swap',
  lean_a: 'Lean current',
  lean_b: 'Lean swap',
  toss_up: 'Toss-up',
}

const VERDICT_COLOR: Record<StartSitRecommendation['verdict'], string> = {
  start_a: '#4BA3F5',
  start_b: '#43C077',
  lean_a: '#4BA3F5',
  lean_b: '#43C077',
  toss_up: '#F5A623',
}

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
}

export default function LineupPage() {
  const mode = useMode()
  const [recs, setRecs] = useState<StartSitRecommendation[]>([])
  const [leagueCount, setLeagueCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch('/api/lineup/sleeper')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load lineup recommendations')
        return res.json()
      })
      .then((data: { recommendations: StartSitRecommendation[]; leagueCount: number }) => {
        if (cancelled) return
        setRecs(data.recommendations)
        setLeagueCount(data.leagueCount)
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

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-8 md:px-6 md:pt-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">Lineups</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--t2)' }}>
          {leagueCount > 0
            ? `Start/sit calls across ${leagueCount} ${leagueCount === 1 ? 'league' : 'leagues'} · Sleeper`
            : 'No leagues connected yet'}
        </p>
      </div>

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} />}
      {!loading && !error && leagueCount === 0 && <NoLeaguesState />}
      {!loading && !error && leagueCount > 0 && recs.length === 0 && <AllClearState />}
      {!loading && !error && recs.length > 0 && (
        <div className="space-y-3">
          {recs.map((rec, i) => (
            <StartSitCard key={i} rec={rec} mode={mode} />
          ))}
        </div>
      )}
    </div>
  )
}

function StartSitCard({ rec, mode }: { rec: StartSitRecommendation; mode: Mode }) {
  const color = VERDICT_COLOR[rec.verdict]

  return (
    <div
      className="rounded-xl p-4"
      style={{ backgroundColor: 'rgba(8, 15, 26, 0.6)', border: '1px solid var(--hairline)', borderLeft: `3px solid ${color}` }}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-xs" style={{ color: 'var(--t3)' }}>{rec.leagueName}</p>
        <span
          className="text-[10px] font-semibold tracking-widest uppercase px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ backgroundColor: `${color}18`, color }}
        >
          {VERDICT_LABEL[rec.verdict]}
        </span>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <PlayerChip name={rec.playerA.name} position={rec.playerA.position} label="Currently started" />
        <span className="text-sm" style={{ color: 'var(--t3)' }}>vs</span>
        <PlayerChip name={rec.playerB.name} position={rec.playerB.position} label="On bench" />
      </div>

      <p className="text-sm" style={{ color: 'var(--t2)' }}>{rec.reasoning}</p>

      {mode === 'savant' && (
        <p className="text-xs mt-3" style={{ color: 'var(--t3)' }}>{CONFIDENCE_LABEL[rec.confidence]}</p>
      )}
    </div>
  )
}

function PlayerChip({ name, position, label }: { name: string; position: string; label: string }) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-semibold text-white truncate">{name}</p>
      <p className="text-xs truncate" style={{ color: 'var(--t3)' }}>{position} · {label}</p>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-24 rounded-xl animate-pulse"
          style={{ backgroundColor: 'rgba(8, 15, 26, 0.6)', border: '1px solid var(--hairline)' }}
        />
      ))}
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl p-6 text-center" style={{ backgroundColor: 'rgba(8, 15, 26, 0.6)', border: '1px solid var(--hairline)' }}>
      <p className="text-sm" style={{ color: 'var(--crit)' }}>{message}</p>
    </div>
  )
}

function NoLeaguesState() {
  return (
    <div className="rounded-xl p-6 text-center" style={{ backgroundColor: 'rgba(8, 15, 26, 0.6)', border: '1px solid var(--hairline)' }}>
      <p className="text-sm font-medium text-white">Connect a league to see start/sit calls.</p>
      <p className="text-sm mt-1" style={{ color: 'var(--t2)' }}>
        Once a Sleeper league is connected, Rostiro compares your bench against your lineup every time you open this page.
      </p>
    </div>
  )
}

function AllClearState() {
  return (
    <div className="rounded-xl p-6 text-center" style={{ backgroundColor: 'rgba(8, 15, 26, 0.6)', border: '1px solid var(--hairline)' }}>
      <p className="text-sm font-medium text-white">Your lineup looks right.</p>
      <p className="text-sm mt-1" style={{ color: 'var(--t2)' }}>
        No bench player has a clear ADP edge over your current starters.
      </p>
    </div>
  )
}
