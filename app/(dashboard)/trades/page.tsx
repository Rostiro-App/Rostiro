'use client'

// T-65: Trade Analyzer. Reuses /api/draft/players for search (same cached
// ADP data, no new endpoint needed) — pick players you'd give up and receive,
// then POST to /api/trades/analyze for a verdict + reasoning.

import { useEffect, useMemo, useState } from 'react'
import { useMode } from '@/components/nav/AppShell'
import type { ADPPlayer, TradeAnalysis } from '@/types'

const VERDICT_LABEL: Record<TradeAnalysis['verdict'], string> = {
  win: 'You win this trade',
  lose: 'You lose this trade',
  even: 'Roughly even',
}

const VERDICT_COLOR: Record<TradeAnalysis['verdict'], string> = {
  win: '#43C077',
  lose: '#E8504A',
  even: '#F5A623',
}

export default function TradesPage() {
  const mode = useMode()
  const [players, setPlayers] = useState<ADPPlayer[]>([])
  const [give, setGive] = useState<ADPPlayer[]>([])
  const [receive, setReceive] = useState<ADPPlayer[]>([])
  const [analysis, setAnalysis] = useState<TradeAnalysis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/draft/players')
      .then((res) => res.json())
      .then((data: { players: ADPPlayer[] }) => setPlayers(data.players))
      .catch(() => setError('Failed to load player list'))
  }, [])

  async function analyze() {
    setAnalyzing(true)
    setError(null)
    setAnalysis(null)
    try {
      const res = await fetch('/api/trades/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          give: give.map((p) => p.playerId),
          receive: receive.map((p) => p.playerId),
          mode,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to analyze trade')
      setAnalysis(data.analysis)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze trade')
    } finally {
      setAnalyzing(false)
    }
  }

  const canAnalyze = give.length > 0 && receive.length > 0 && !analyzing

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-8 md:px-6 md:pt-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">Trade Analyzer</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--t2)' }}>
          Pick what you&apos;d give up and what you&apos;d receive.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <PlayerPicker
          label="You give"
          players={players}
          selected={give}
          onAdd={(p) => setGive((prev) => [...prev, p])}
          onRemove={(id) => setGive((prev) => prev.filter((p) => p.playerId !== id))}
        />
        <PlayerPicker
          label="You receive"
          players={players}
          selected={receive}
          onAdd={(p) => setReceive((prev) => [...prev, p])}
          onRemove={(id) => setReceive((prev) => prev.filter((p) => p.playerId !== id))}
        />
      </div>

      <button
        onClick={analyze}
        disabled={!canAnalyze}
        className="w-full text-sm font-semibold px-4 py-3 rounded-xl text-white transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ backgroundColor: 'var(--signal)' }}
      >
        {analyzing ? 'Analyzing...' : 'Analyze trade'}
      </button>

      {error && (
        <div className="rounded-xl p-4 mt-4" style={{ backgroundColor: 'rgba(8, 15, 26, 0.6)', border: '1px solid var(--hairline)' }}>
          <p className="text-sm" style={{ color: 'var(--crit)' }}>{error}</p>
        </div>
      )}

      {analysis && <AnalysisCard analysis={analysis} mode={mode} />}
    </div>
  )
}

function PlayerPicker({
  label,
  players,
  selected,
  onAdd,
  onRemove,
}: {
  label: string
  players: ADPPlayer[]
  selected: ADPPlayer[]
  onAdd: (p: ADPPlayer) => void
  onRemove: (id: string) => void
}) {
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const selectedIds = new Set(selected.map((p) => p.playerId))
    return players
      .filter((p) => !selectedIds.has(p.playerId) && p.name.toLowerCase().includes(q))
      .slice(0, 6)
  }, [query, players, selected])

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(8, 15, 26, 0.6)', border: '1px solid var(--hairline)' }}>
      <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--t3)' }}>{label}</p>

      <div className="flex flex-wrap gap-1.5 mb-2">
        {selected.map((p) => (
          <span
            key={p.playerId}
            className="text-xs font-medium px-2 py-1 rounded-lg flex items-center gap-1.5"
            style={{ backgroundColor: 'var(--signal-dim)', color: 'var(--signal)' }}
          >
            {p.name}
            <button onClick={() => onRemove(p.playerId)} className="hover:brightness-125">×</button>
          </span>
        ))}
      </div>

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a player..."
          className="w-full text-sm px-3 py-2 rounded-lg outline-none"
          style={{ backgroundColor: 'rgba(6, 11, 19, 0.55)', border: '1px solid var(--hairline)', color: 'white' }}
        />
        {results.length > 0 && (
          <div
            className="absolute z-10 mt-1 w-full rounded-lg overflow-hidden"
            style={{ backgroundColor: 'rgba(6, 11, 19, 0.55)', border: '1px solid var(--hairline)' }}
          >
            {results.map((p) => (
              <button
                key={p.playerId}
                onClick={() => {
                  onAdd(p)
                  setQuery('')
                }}
                className="w-full text-left text-sm px-3 py-2 hover:brightness-125 transition-all flex items-center justify-between"
                style={{ color: '#C5D6E3' }}
              >
                <span>{p.name}</span>
                <span className="text-xs" style={{ color: 'var(--t3)' }}>{p.position} · {p.nflTeam}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// T-105 / PRD 3: Focused gets the verdict + reasoning only — "stats hidden
// by default, tap 'why' to expand" — the value-comparison/roster-impact
// detail rows are exactly the kind of supporting stat Balanced/Savant show
// inline and Focused doesn't.
function AnalysisCard({ analysis, mode }: { analysis: TradeAnalysis; mode: string }) {
  const color = VERDICT_COLOR[analysis.verdict]
  const showDetail = mode !== 'focused'

  return (
    <div
      className="rounded-xl p-4 mt-4"
      style={{ backgroundColor: 'rgba(8, 15, 26, 0.6)', border: '1px solid var(--hairline)', borderLeft: `3px solid ${color}` }}
    >
      <span
        className="inline-block text-[10px] font-semibold tracking-widest uppercase px-1.5 py-0.5 rounded mb-3"
        style={{ backgroundColor: `${color}18`, color }}
      >
        {VERDICT_LABEL[analysis.verdict]}
      </span>
      <p className="text-sm mb-3" style={{ color: 'var(--t2)' }}>{analysis.reasoning}</p>
      {showDetail && (
        <div className="space-y-1">
          <p className="text-xs" style={{ color: 'var(--t3)' }}>{analysis.rosValueComparison}</p>
          <p className="text-xs" style={{ color: 'var(--t3)' }}>{analysis.rosterImpact}</p>
        </div>
      )}
    </div>
  )
}
