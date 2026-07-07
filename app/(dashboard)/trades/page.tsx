'use client'

// T-65: Trade Analyzer. Reuses /api/draft/players for search (same cached
// ADP data, no new endpoint needed) — pick players you'd give up and receive,
// then POST to /api/trades/analyze for a verdict + reasoning.

import { useEffect, useMemo, useState } from 'react'
import { useMode } from '@/components/nav/AppShell'
import { openPlayerCard } from '@/lib/openPlayerCard'
import NotesPanel from '@/components/NotesPanel'
import AskCopilotPanel from '@/components/AskCopilotPanel'
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
  const [leagues, setLeagues] = useState<{ id: string; name: string }[]>([])
  // T-143: optional — which league's general notes (T-141) should feed
  // this trade's reasoning. Not required to analyze a trade at all, unlike
  // Ask Copilot's league select, since the deterministic verdict/value
  // never depended on a league to begin with.
  const [notesLeagueId, setNotesLeagueId] = useState('')
  // T-147: "Save this trade" — the analysis card only ever holds component
  // state today (unlike a typed note in NotesPanel, which does persist),
  // gone the moment the page navigates away. Saved as an ordinary general
  // note (type: 'general'), reusing T-141's schema/route rather than a
  // second one.
  const [savingTrade, setSavingTrade] = useState(false)
  const [tradeSaved, setTradeSaved] = useState(false)

  useEffect(() => {
    fetch('/api/draft/players')
      .then((res) => res.json())
      .then((data: { players: ADPPlayer[] }) => setPlayers(data.players))
      .catch(() => setError('Failed to load player list'))
  }, [])

  // T-141: this page isn't scoped to one league the way a LeagueCard is, so
  // its NotesPanel needs a real league list to pick from instead of a fixed id.
  useEffect(() => {
    fetch('/api/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { leagues?: { id: string; league_name: string }[] } | null) => {
        if (data?.leagues) setLeagues(data.leagues.map((l) => ({ id: l.id, name: l.league_name })))
      })
      .catch(() => {})
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
          leagueId: notesLeagueId || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to analyze trade')
      setAnalysis(data.analysis)
      setTradeSaved(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze trade')
    } finally {
      setAnalyzing(false)
    }
  }

  async function saveTrade() {
    if (!analysis) return
    setSavingTrade(true)
    setError(null)
    try {
      const body = `Give: ${give.map((p) => p.name).join(', ')} → Receive: ${receive.map((p) => p.name).join(', ')}. Verdict: ${VERDICT_LABEL[analysis.verdict]}. ${analysis.rosValueComparison}`.slice(0, 500)
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'general', body, leagueId: notesLeagueId || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not save this trade')
      setTradeSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this trade')
    } finally {
      setSavingTrade(false)
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

      {leagues.length > 0 && (
        <select
          value={notesLeagueId}
          onChange={(e) => setNotesLeagueId(e.target.value)}
          className="w-full text-xs mb-4 rounded-lg px-2.5 py-2 outline-none"
          style={{ backgroundColor: 'rgba(6, 11, 19, 0.55)', border: '1px solid var(--hairline)', color: 'white' }}
        >
          <option value="">No specific league (notes won&apos;t be used)</option>
          {leagues.map((l) => (
            <option key={l.id} value={l.id}>{l.name} — use my notes on this league</option>
          ))}
        </select>
      )}

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

      {analysis && (
        <AnalysisCard
          analysis={analysis}
          mode={mode}
          onSave={saveTrade}
          saving={savingTrade}
          saved={tradeSaved}
        />
      )}

      <NotesPanel leagues={leagues} />
      <AskCopilotPanel leagues={leagues} mode={mode} />
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
            <button
              type="button"
              onClick={() => openPlayerCard(p.playerId)}
              className="underline decoration-dotted underline-offset-2 hover:brightness-125"
            >
              {p.name}
            </button>
            <button onClick={() => onRemove(p.playerId)} className="hover:brightness-125" aria-label={`Remove ${p.name}`}>×</button>
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
              <div
                key={p.playerId}
                className="w-full text-sm px-3 py-2 flex items-center justify-between"
                style={{ color: '#C5D6E3' }}
              >
                {/* Name opens the Player Intelligence Card; the rest of the
                    row (position/team) is the "add to trade" click target —
                    split so neither action is silently overloaded onto the
                    other, since this row used to be one big add-on-click
                    button covering the name too. */}
                <button
                  type="button"
                  onClick={() => openPlayerCard(p.playerId)}
                  className="text-left underline decoration-dotted underline-offset-2 hover:text-white"
                >
                  {p.name}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onAdd(p)
                    setQuery('')
                  }}
                  className="text-xs flex items-center gap-1.5 hover:brightness-125 transition-all"
                  style={{ color: 'var(--t3)' }}
                >
                  {p.position} · {p.nflTeam}
                  <span style={{ color: 'var(--signal)' }}>+ Add</span>
                </button>
              </div>
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
function AnalysisCard({
  analysis,
  mode,
  onSave,
  saving,
  saved,
}: {
  analysis: TradeAnalysis
  mode: string
  onSave: () => void
  saving: boolean
  saved: boolean
}) {
  const color = VERDICT_COLOR[analysis.verdict]
  const showDetail = mode !== 'focused'

  return (
    <div
      className="rounded-xl p-4 mt-4"
      style={{ backgroundColor: 'rgba(8, 15, 26, 0.6)', border: '1px solid var(--hairline)', borderLeft: `3px solid ${color}` }}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <span
          className="inline-block text-[10px] font-semibold tracking-widest uppercase px-1.5 py-0.5 rounded"
          style={{ backgroundColor: `${color}18`, color }}
        >
          {VERDICT_LABEL[analysis.verdict]}
        </span>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || saved}
          className="text-xs font-semibold flex-shrink-0 hover:brightness-125 disabled:opacity-60"
          style={{ color: saved ? 'var(--live)' : 'var(--signal)' }}
        >
          {saved ? 'Saved ✓' : saving ? 'Saving...' : 'Save this trade'}
        </button>
      </div>
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
