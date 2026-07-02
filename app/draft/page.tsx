'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useMode } from '@/components/nav/AppShell'
import type { ADPPlayer, NFLPosition } from '@/types'

// DEF omitted — Sleeper never assigns search_rank to team defenses, so there's
// no ranking signal for them yet. Add back once consensus ADP covers DEF.
const POSITION_FILTERS: Array<NFLPosition | 'ALL'> = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K']

const POSITION_COLOR: Record<string, string> = {
  QB: '#E8A040',
  RB: '#4CAF72',
  WR: '#378ADD',
  TE: '#B57EDC',
  K: '#5A7A9A',
  DEF: '#8AAABB',
}

export default function DraftPage() {
  const mode = useMode()
  const [players, setPlayers] = useState<ADPPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [position, setPosition] = useState<NFLPosition | 'ALL'>('ALL')
  const [search, setSearch] = useState('')

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
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-bold text-white tracking-tight">Draft Kit</h1>
          {lastUpdated && (
            <span className="text-xs" style={{ color: '#3A5A7A' }}>
              Updated {formatRelative(lastUpdated)}
            </span>
          )}
        </div>
        <Link
          href="/draft/join"
          className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 mb-4 transition-all hover:brightness-110"
          style={{ backgroundColor: '#378ADD18', border: '1px solid #378ADD40' }}
        >
          <div>
            <p className="text-sm font-semibold" style={{ color: '#378ADD' }}>Drafting right now? Try Draft Copilot →</p>
            <p className="text-xs mt-0.5" style={{ color: '#5A7A9A' }}>
              Live tracking during your actual draft — best available, a heads-up before your turn, and an alert the moment a run starts.
            </p>
          </div>
        </Link>
        <p className="text-sm mt-0.5" style={{ color: '#5A7A9A' }}>
          Consensus ADP from Sleeper · {players.length} players
        </p>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search players..."
        className="w-full text-sm px-4 py-2.5 rounded-xl mb-3 outline-none"
        style={{ backgroundColor: '#0A1520', border: '1px solid #1A3048', color: 'white' }}
      />

      {/* Position filter tabs */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {POSITION_FILTERS.map((pos) => {
          const isActive = position === pos
          return (
            <button
              key={pos}
              onClick={() => setPosition(pos)}
              className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
              style={{
                backgroundColor: isActive ? '#378ADD' : '#0A1520',
                color: isActive ? 'white' : '#5A7A9A',
                border: `1px solid ${isActive ? '#378ADD' : '#1A3048'}`,
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

      <p className="text-xs text-center mt-8" style={{ color: '#3A5A7A' }}>
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
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1A3048' }}>
      {players.map((p, i) => {
        const prevTier = i > 0 ? players[i - 1].tier : null
        const showTierDivider = showTier && p.tier !== prevTier && i > 0

        return (
          <div key={`${p.playerId}-${p.position}`}>
            {showTierDivider && (
              <div
                className="px-4 py-1 text-[10px] font-semibold tracking-widest uppercase"
                style={{ backgroundColor: '#07111C', color: '#3A5A7A' }}
              >
                Tier {p.tier}
              </div>
            )}
            <div
              className="flex items-center gap-3 px-4 py-2.5"
              style={{ backgroundColor: '#0A1520', borderTop: i === 0 ? 'none' : '1px solid #1A3048' }}
            >
              <span
                className="text-xs font-semibold flex-shrink-0 w-7 text-right"
                style={{ color: '#3A5A7A' }}
              >
                {Math.round(p.adpConsensus)}
              </span>

              <span
                className="text-[10px] font-bold flex-shrink-0 w-9 text-center py-0.5 rounded"
                style={{
                  backgroundColor: `${POSITION_COLOR[p.position] ?? '#5A7A9A'}18`,
                  color: POSITION_COLOR[p.position] ?? '#5A7A9A',
                }}
              >
                {p.position}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">{p.name}</p>
                <p className="text-xs truncate" style={{ color: '#3A5A7A' }}>
                  {p.nflTeam || 'FA'}
                  {showInjury && p.injuryStatus && (
                    <span style={{ color: '#E84040' }}> · {p.injuryStatus}</span>
                  )}
                </p>
              </div>

              {mode === 'savant' && (
                <span className="text-xs flex-shrink-0" style={{ color: '#3A5A7A' }}>
                  ADP {p.adpConsensus.toFixed(1)}
                </span>
              )}
            </div>
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
        <div
          key={i}
          className="h-12 rounded-xl animate-pulse"
          style={{ backgroundColor: '#0A1520', border: '1px solid #1A3048' }}
        />
      ))}
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl p-6 text-center" style={{ backgroundColor: '#0A1520', border: '1px solid #1A3048' }}>
      <p className="text-sm" style={{ color: '#E84040' }}>{message}</p>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-xl p-6 text-center" style={{ backgroundColor: '#0A1520', border: '1px solid #1A3048' }}>
      <p className="text-sm" style={{ color: '#5A7A9A' }}>No players match your search.</p>
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
