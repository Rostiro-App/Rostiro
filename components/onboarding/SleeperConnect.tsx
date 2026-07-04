'use client'

import { useState } from 'react'

export default function SleeperConnect({
  onBack,
  onConnected,
}: {
  onBack: () => void
  onConnected: () => void
}) {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [leagues, setLeagues] = useState<{ league_id: string; name: string; total_rosters: number }[]>([])
  const [saving, setSaving] = useState(false)
  const [skippedForPlan, setSkippedForPlan] = useState(0)
  const [connectedCount, setConnectedCount] = useState(0)

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setLeagues([])

    const res = await fetch(`/api/leagues/sleeper/lookup?username=${encodeURIComponent(username)}`)
    const data = await res.json()

    setLoading(false)
    if (!res.ok) {
      setError(data.error ?? 'Could not find that Sleeper username.')
      return
    }

    setLeagues(data.leagues)
    if (data.leagues.length === 0) {
      setError('No active leagues found for that username.')
    }
  }

  async function handleSave() {
    setSaving(true)
    const res = await fetch('/api/leagues/sleeper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    })

    setSaving(false)
    if (res.ok) {
      const data: { connected: number; skippedForPlan: number } = await res.json()
      // T-103: Free is capped at 1 league — a username with several active
      // leagues can hit that cap in one save, and if the user was already at
      // the cap from a different platform, this batch can connect zero. Never
      // silently drop the rest; only interrupt the otherwise-instant flow
      // when something was actually skipped.
      if (data.skippedForPlan > 0) {
        setConnectedCount(data.connected)
        setSkippedForPlan(data.skippedForPlan)
      } else {
        onConnected()
      }
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to save Sleeper leagues.')
    }
  }

  return (
    <div className="rounded-xl p-6" style={{ backgroundColor: 'rgba(8, 15, 26, 0.6)', border: '1.5px solid var(--hairline)' }}>
      <button
        onClick={onBack}
        className="text-sm mb-5 flex items-center gap-1 transition-colors"
        style={{ color: 'var(--t2)' }}
      >
        ← Back
      </button>
      <h2 className="text-white font-semibold mb-1">Connect Sleeper</h2>
      <p className="text-sm mb-5" style={{ color: 'var(--t2)' }}>Enter your Sleeper username. No login required.</p>

      <form onSubmit={handleLookup}>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Sleeper username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="flex-1 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none"
            style={{
              backgroundColor: 'rgba(6, 11, 19, 0.55)',
              border: '1.5px solid var(--hairline)',
            }}
          />
          <button
            type="submit"
            disabled={loading}
            className="font-medium px-4 py-2.5 rounded-lg text-sm text-white disabled:opacity-50 transition-all hover:brightness-110"
            style={{ backgroundColor: 'var(--signal)' }}
          >
            {loading ? '...' : 'Find'}
          </button>
        </div>
      </form>

      {error && <p className="text-sm mt-3" style={{ color: 'var(--crit)' }}>{error}</p>}

      {leagues.length > 0 && (
        <div className="mt-5">
          <p className="text-sm mb-3" style={{ color: 'var(--t2)' }}>
            Found {leagues.length} league{leagues.length !== 1 ? 's' : ''}:
          </p>
          <div className="space-y-2">
            {leagues.map((l) => (
              <div
                key={l.league_id}
                className="flex items-center justify-between rounded-lg px-3 py-2.5"
                style={{ backgroundColor: 'rgba(6, 11, 19, 0.55)', border: '1px solid var(--hairline)' }}
              >
                <span className="text-white text-sm">{l.name}</span>
                <span className="text-xs" style={{ color: 'var(--t2)' }}>{l.total_rosters} teams</span>
              </div>
            ))}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-4 w-full font-semibold py-2.5 rounded-lg text-sm text-white disabled:opacity-50 transition-all hover:brightness-110"
            style={{ backgroundColor: 'var(--signal)' }}
          >
            {saving ? 'Connecting...' : `Connect ${leagues.length} league${leagues.length !== 1 ? 's' : ''} →`}
          </button>
        </div>
      )}

      {skippedForPlan > 0 && (
        <div className="mt-4 rounded-lg px-3 py-2.5" style={{ backgroundColor: 'rgba(75,163,245,0.08)', border: '1px solid rgba(75,163,245,0.3)' }}>
          <p className="text-sm" style={{ color: 'var(--t1)' }}>
            {connectedCount > 0
              ? `Connected ${connectedCount} league${connectedCount !== 1 ? 's' : ''} — Free plan is limited to 1. `
              : `You're already at your Free plan limit (1 league) — `}
            {skippedForPlan} other{skippedForPlan !== 1 ? 's were' : ' was'} not connected. Upgrade to Pro to add {skippedForPlan !== 1 ? 'them' : 'it'}.
          </p>
          <button
            onClick={onConnected}
            className="mt-2 text-sm font-medium underline"
            style={{ color: 'var(--signal)' }}
          >
            Continue →
          </button>
        </div>
      )}
    </div>
  )
}
