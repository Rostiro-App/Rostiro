'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useMode } from '@/components/nav/AppShell'
import { openPlayerCard } from '@/lib/openPlayerCard'
import type { ADPPlayer, NFLPosition, RostiroState } from '@/types'

// T-104 / 6.13: matches STATE_CONFIG.draft's opportunity green — founder
// confirmed (July 6, 2026) Draft should read as the same "opportunity"
// emotion as Waiver Day, resolving the amber-vs-green mismatch this
// comment used to flag.
const DRAFT_STATE_COLOR = '#1D9E75'

// DEF omitted — Sleeper never assigns search_rank to team defenses, so there's
// no ranking signal for them yet. Add back once consensus ADP covers DEF.
const POSITION_FILTERS: Array<NFLPosition | 'ALL'> = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K']

const POSITION_COLOR: Record<string, string> = {
  QB: '#E8A040',
  RB: '#55C58A',
  WR: '#5FB0F5',
  TE: '#B57EDC',
  K: '#8FA9C0',
  DEF: '#8FA9C0',
}

// useSearchParams requires a Suspense boundary at build time — the wrapper
// exists only for that.
export default function DraftPage() {
  return (
    <Suspense fallback={null}>
      <DraftPageInner />
    </Suspense>
  )
}

function DraftPageInner() {
  const mode = useMode()
  const searchParams = useSearchParams()
  const [players, setPlayers] = useState<ADPPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [position, setPosition] = useState<NFLPosition | 'ALL'>('ALL')
  // T-70: the command palette deep-links players here as /draft?q=Name.
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '')
  const [rostiroState, setRostiroState] = useState<RostiroState>('standard')

  // T-104: one-shot fetch, same pattern Pulse already uses for its own
  // state-driven framing — this page doesn't need the 60s freshness
  // System Bar polls for, just the state at load.
  useEffect(() => {
    let cancelled = false
    fetch('/api/system/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { rostiroState?: RostiroState } | null) => {
        if (!cancelled && data?.rostiroState) setRostiroState(data.rostiroState)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    fetch('/api/draft/players')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load player rankings')
        return res.json()
      })
      .then((data: { players: ADPPlayer[] }) => {
        if (!cancelled) setPlayers(data.players)
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return players.filter((p) => {
      if (position !== 'ALL' && p.position !== position) return false
      if (q && !p.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [players, position, search])

  const lastUpdated = players[0]?.lastUpdated

  return (
    <div className="max-w-3xl mx-auto px-4 pt-6 pb-8 md:px-6 md:pt-8">
      {/* Header */}
      <div className="mb-5">
        {rostiroState === 'draft' && (
          <span
            className="mono-data inline-block text-[9.5px] tracking-[0.16em] px-2 py-0.5 rounded-full mb-2"
            style={{
              color: DRAFT_STATE_COLOR,
              border: `1px solid ${DRAFT_STATE_COLOR}`,
              backgroundColor: 'color-mix(in srgb, currentColor 12%, transparent)',
            }}
          >
            DRAFT SEASON
          </span>
        )}
        <div className="flex items-baseline justify-between">
          <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: 'var(--t1)' }}>Draft Kit</h1>
          {lastUpdated && (
            <span className="mono-data text-[10px] tracking-[0.08em]" style={{ color: 'var(--t3)' }}>
              UPDATED {formatRelative(lastUpdated).toUpperCase()}
            </span>
          )}
        </div>
        <Link
          href="/draft/join"
          className="glass card-hover flex items-center justify-between gap-3 rounded-xl px-4 py-3 my-4"
          style={{ borderColor: 'rgba(75,163,245,.3)' }}
        >
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--signal)' }}>Drafting right now? Try Draft Copilot →</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--t2)' }}>
              Live tracking during your actual draft — best available, a heads-up before your turn, and an alert the moment a run starts.
            </p>
          </div>
        </Link>
        <p className="mono-data text-[10px] tracking-[0.08em] mt-0.5" style={{ color: 'var(--t3)' }}>
          CONSENSUS ADP · SLEEPER · {players.length} PLAYERS
        </p>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search players..."
        className="glass w-full text-sm px-4 py-2.5 rounded-xl mb-3 outline-none focus:border-[var(--signal)]"
        style={{ color: 'var(--t1)' }}
      />

      {/* Position filter tabs — accent switches to Draft State's amber when
          it's active, matching STATE_CONFIG rather than the default blue. */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {POSITION_FILTERS.map((pos) => {
          const isActive = position === pos
          const accent = rostiroState === 'draft' ? DRAFT_STATE_COLOR : '#4BA3F5'
          return (
            <button
              key={pos}
              onClick={() => setPosition(pos)}
              className="mono-data flex-shrink-0 text-[11px] tracking-[0.06em] px-3 py-1.5 rounded-lg transition-all"
              style={{
                backgroundColor: isActive ? `color-mix(in srgb, ${accent} 14%, transparent)` : 'rgba(8, 15, 26, 0.6)',
                color: isActive ? accent : 'var(--t3)',
                border: `1px solid ${isActive ? accent : 'var(--hairline)'}`,
                boxShadow: isActive ? `0 0 14px color-mix(in srgb, ${accent} 20%, transparent)` : 'none',
              }}
            >
              {pos}
            </button>
          )
        })}
      </div>

      {/* Body */}
      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} />}
      {!loading && !error && filtered.length === 0 && <EmptyState />}
      {!loading && !error && filtered.length > 0 && (
        <RankingsTable players={filtered} mode={mode} />
      )}

      <p className="text-xs text-center mt-8" style={{ color: 'var(--t3)' }}>
        Rankings refresh daily · Create a free account to sync this draft to your league
      </p>
    </div>
  )
}

// ─── Rankings table ────────────────────────────────────────────────────────────

function RankingsTable({ players, mode }: { players: ADPPlayer[]; mode: string }) {
  const showTier = mode !== 'focused'
  const showInjury = mode === 'savant'

  return (
    <div className="glass rounded-[14px] overflow-hidden">
      {players.map((p, i) => {
        const prevTier = i > 0 ? players[i - 1].tier : null
        const showTierDivider = showTier && p.tier !== prevTier && i > 0

        return (
          <div key={`${p.playerId}-${p.position}`}>
            {showTierDivider && (
              <div
                className="mono-data px-4 py-1 text-[8.5px] tracking-[0.18em] uppercase"
                style={{ backgroundColor: 'rgba(6, 11, 19, 0.55)', color: 'var(--t3)' }}
              >
                Tier {p.tier}
              </div>
            )}
            <button
              type="button"
              onClick={() => openPlayerCard(p.playerId)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[rgba(75,163,245,0.05)]"
              style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(90,150,210,.07)' }}
            >
              <span
                className="mono-data text-[11px] flex-shrink-0 w-7 text-right"
                style={{ color: 'var(--t3)' }}
              >
                {p.overallRank}
              </span>

              <span
                className="mono-data text-[9px] tracking-[0.1em] flex-shrink-0 w-9 text-center py-0.5 rounded"
                style={{
                  backgroundColor: `${POSITION_COLOR[p.position] ?? '#8FA9C0'}18`,
                  color: POSITION_COLOR[p.position] ?? 'var(--t2)',
                }}
              >
                {p.position}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-medium truncate" style={{ color: 'var(--t1)' }}>{p.name}</p>
                <p className="mono-data text-[10px] truncate" style={{ color: 'var(--t3)' }}>
                  {p.nflTeam || 'FA'}
                  {showInjury && p.injuryStatus && (
                    <span style={{ color: 'var(--crit)' }}> · {p.injuryStatus.toUpperCase()}</span>
                  )}
                </p>
              </div>

              {mode === 'savant' && (
                <span className="mono-data text-[10.5px] flex-shrink-0" style={{ color: 'var(--t3)' }}>
                  RAW {p.adpConsensus}
                </span>
              )}
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ─── States ────────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="glass h-12 rounded-xl animate-pulse" />
      ))}
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="glass rounded-xl p-6 text-center">
      <p className="text-sm" style={{ color: 'var(--crit)' }}>{message}</p>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="glass rounded-xl p-6 text-center">
      <p className="text-sm" style={{ color: 'var(--t2)' }}>No players match your search.</p>
    </div>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
