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
      onConnected()
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to save Sleeper leagues.')
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <button onClick={onBack} className="text-zinc-500 hover:text-zinc-300 text-sm mb-5 flex items-center gap-1">
        ← Back
      </button>
      <h2 className="text-white font-semibold mb-1">Connect Sleeper</h2>
      <p className="text-zinc-500 text-sm mb-5">Enter your Sleeper username. No login required.</p>

      <form onSubmit={handleLookup}>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Sleeper username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-white text-black font-medium px-4 py-2.5 rounded-lg text-sm hover:bg-zinc-100 disabled:opacity-50 transition-colors"
          >
            {loading ? '...' : 'Find'}
          </button>
        </div>
      </form>

      {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

      {leagues.length > 0 && (
        <div className="mt-5">
          <p className="text-zinc-400 text-sm mb-3">Found {leagues.length} league{leagues.length !== 1 ? 's' : ''}:</p>
          <div className="space-y-2">
            {leagues.map((l) => (
              <div key={l.league_id} className="flex items-center justify-between bg-zinc-800 rounded-lg px-3 py-2.5">
                <span className="text-white text-sm">{l.name}</span>
                <span className="text-zinc-500 text-xs">{l.total_rosters} teams</span>
              </div>
            ))}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-4 w-full bg-white text-black font-semibold py-2.5 rounded-lg text-sm hover:bg-zinc-100 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Connecting...' : `Connect ${leagues.length} league${leagues.length !== 1 ? 's' : ''} →`}
          </button>
        </div>
      )}
    </div>
  )
}
