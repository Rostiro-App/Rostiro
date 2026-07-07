'use client'

// T-142: Ask Copilot — trade/scenario queries. A league is required (a
// trade ask is meaningless without knowing which league's real rosters to
// search), unlike NotesPanel's general notes where a league is optional.
// POSTs to /api/notes/ask-copilot, which finds real candidates on that
// league's actual rosters before Claude ever explains them.

import { useState } from 'react'
import type { Mode } from '@/components/nav/AppShell'

const MAX_LENGTH = 280

export default function AskCopilotPanel({
  leagues,
  mode,
}: {
  leagues: { id: string; name: string }[]
  mode: Mode
}) {
  const [expanded, setExpanded] = useState(false)
  const [leagueId, setLeagueId] = useState('')
  const [body, setBody] = useState('')
  const [asking, setAsking] = useState(false)
  const [response, setResponse] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function ask() {
    const trimmed = body.trim()
    if (!trimmed || !leagueId) return
    setAsking(true)
    setError(null)
    setResponse(null)
    try {
      const res = await fetch('/api/notes/ask-copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueId, body: trimmed, mode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not get an answer')
      setResponse(data.response)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not get an answer')
    } finally {
      setAsking(false)
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-xs font-semibold transition-all hover:brightness-125"
        style={{ color: 'var(--signal)' }}
      >
        {expanded ? 'Hide Ask Copilot' : '+ Ask Copilot about a trade'}
      </button>

      {expanded && (
        <div className="mt-2 rounded-lg p-3" style={{ backgroundColor: 'rgba(8, 15, 26, 0.5)', border: '1px solid var(--hairline)' }}>
          <select
            value={leagueId}
            onChange={(e) => setLeagueId(e.target.value)}
            className="w-full text-xs mb-2 rounded-lg px-2.5 py-2 outline-none"
            style={{ backgroundColor: 'rgba(6, 11, 19, 0.55)', border: '1px solid var(--hairline)', color: 'white' }}
          >
            <option value="">Select a league...</option>
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, MAX_LENGTH))}
            placeholder="e.g. find me a trade for Patrick Mahomes, looking for RB or TE of similar return"
            rows={2}
            className="w-full text-xs rounded-lg px-2.5 py-2 outline-none resize-none"
            style={{ backgroundColor: 'rgba(6, 11, 19, 0.55)', border: '1px solid var(--hairline)', color: 'white' }}
          />
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px]" style={{ color: 'var(--t4)' }}>{body.length}/{MAX_LENGTH}</span>
            <button
              type="button"
              onClick={ask}
              disabled={asking || !body.trim() || !leagueId}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-40"
              style={{ backgroundColor: 'var(--signal)', color: 'white' }}
            >
              {asking ? 'Asking...' : 'Ask'}
            </button>
          </div>

          {error && <p className="text-xs mt-1.5" style={{ color: 'var(--crit)' }}>{error}</p>}

          {response && (
            <div className="mt-3 rounded-lg px-2.5 py-2" style={{ backgroundColor: 'rgba(6, 11, 19, 0.4)' }}>
              <p className="text-xs" style={{ color: 'var(--t2)' }}>{response}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
