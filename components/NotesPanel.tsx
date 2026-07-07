'use client'

// T-141: General notes — a contextual "Add note" entry point rather than a
// standalone notebook nobody checks unprompted (a page reachable only from
// a new nav tab is the one form nobody fills in, per the original scoping
// discussion). Embedded directly in Leagues (scoped to that league) and
// Trades (unscoped, with a league picker) — no new route, no new nav item.
//
// 'ask_copilot' (T-142) isn't exposed here yet; this only ever POSTs
// type: 'general'.

import { useEffect, useState } from 'react'
import type { Note } from '@/types'

const MAX_LENGTH = 500

export default function NotesPanel({
  leagueId,
  leagues,
  defaultExpanded,
}: {
  /** Fixed league context (e.g. rendered inside a specific LeagueCard) — hides the league picker. */
  leagueId?: string
  /** Selectable leagues, used only when `leagueId` isn't fixed (e.g. the Trades page). */
  leagues?: { id: string; name: string }[]
  /** T-146: Profile's "My Notes" is the dedicated full-list surface, not a
   * small contextual annex — starts open instead of behind a "+ Add note"
   * toggle nobody would think to click on a page that's just a list. */
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false)
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(defaultExpanded ?? false)
  const [body, setBody] = useState('')
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>(leagueId ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!expanded) return
    let cancelled = false
    fetch('/api/notes')
      .then((res) => res.json())
      .then((data: { notes: Note[] }) => {
        if (!cancelled) setNotes(data.notes ?? [])
      })
      .catch(() => {
        if (!cancelled) setError('Could not load notes.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [expanded])

  function toggleExpanded() {
    const next = !expanded
    setExpanded(next)
    if (next) setLoading(true)
  }

  const visibleNotes = leagueId ? notes.filter((n) => n.leagueId === leagueId) : notes

  async function saveNote() {
    const trimmed = body.trim()
    if (!trimmed) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'general', body: trimmed, leagueId: selectedLeagueId || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not save note')
      setBody('')
      setExpanded(true)
      const refreshed = await fetch('/api/notes').then((r) => r.json())
      setNotes(refreshed.notes ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save note')
    } finally {
      setSaving(false)
    }
  }

  async function deleteNote(id: string) {
    const prev = notes
    setNotes((n) => n.filter((note) => note.id !== id))
    const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' })
    if (!res.ok) setNotes(prev)
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={toggleExpanded}
        className="text-xs font-semibold transition-all hover:brightness-125"
        style={{ color: 'var(--signal)' }}
      >
        {expanded ? 'Hide notes' : visibleNotes.length > 0 ? `Notes (${visibleNotes.length})` : '+ Add note'}
      </button>

      {expanded && (
        <div className="mt-2 rounded-lg p-3" style={{ backgroundColor: 'rgba(8, 15, 26, 0.5)', border: '1px solid var(--hairline)' }}>
          {!leagueId && leagues && leagues.length > 0 && (
            <select
              value={selectedLeagueId}
              onChange={(e) => setSelectedLeagueId(e.target.value)}
              className="w-full text-xs mb-2 rounded-lg px-2.5 py-2 outline-none"
              style={{ backgroundColor: 'rgba(6, 11, 19, 0.55)', border: '1px solid var(--hairline)', color: 'white' }}
            >
              <option value="">No specific league</option>
              {leagues.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          )}

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, MAX_LENGTH))}
            placeholder="Jot anything down — a reminder, a reason, context for later..."
            rows={2}
            className="w-full text-xs rounded-lg px-2.5 py-2 outline-none resize-none"
            style={{ backgroundColor: 'rgba(6, 11, 19, 0.55)', border: '1px solid var(--hairline)', color: 'white' }}
          />
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px]" style={{ color: 'var(--t4)' }}>{body.length}/{MAX_LENGTH}</span>
            <button
              type="button"
              onClick={saveNote}
              disabled={saving || !body.trim()}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-40"
              style={{ backgroundColor: 'var(--signal)', color: 'white' }}
            >
              {saving ? 'Saving...' : 'Save note'}
            </button>
          </div>

          {error && <p className="text-xs mt-1.5" style={{ color: 'var(--crit)' }}>{error}</p>}

          {loading ? (
            <p className="text-xs mt-3" style={{ color: 'var(--t3)' }}>Loading...</p>
          ) : visibleNotes.length > 0 ? (
            <div className="mt-3 space-y-2">
              {visibleNotes.map((note) => (
                <div key={note.id} className="rounded-lg px-2.5 py-2 flex items-start justify-between gap-2" style={{ backgroundColor: 'rgba(6, 11, 19, 0.4)' }}>
                  <div>
                    <p className="text-xs" style={{ color: 'var(--t2)' }}>{note.body}</p>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--t4)' }}>
                      {!leagueId && note.leagueName ? `${note.leagueName} · ` : ''}
                      {new Date(note.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteNote(note.id)}
                    className="text-xs flex-shrink-0 hover:brightness-125"
                    style={{ color: 'var(--t4)' }}
                    aria-label="Delete note"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs mt-3" style={{ color: 'var(--t4)' }}>No notes yet.</p>
          )}
        </div>
      )}
    </div>
  )
}
