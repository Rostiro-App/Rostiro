'use client'

// T-64.1: entry point for Draft Copilot — join a live/mock Sleeper draft by
// draft ID + username, land on the live companion view.

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function JoinDraftPage() {
  const router = useRouter()
  const [draftId, setDraftId] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/draft/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId: draftId.trim(), username: username.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to join draft')
      router.push(`/draft/session/${data.sessionId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join draft')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-12 pb-8 md:px-6">
      <div className="mb-6 text-center">
        <span
          className="inline-block text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full mb-4"
          style={{ backgroundColor: '#378ADD18', color: '#378ADD' }}
        >
          Draft Copilot
        </span>
        <h1 className="text-2xl font-bold text-white tracking-tight">Join your live draft</h1>
        <p className="text-sm mt-2" style={{ color: '#5A7A9A' }}>
          Draft on Sleeper as normal. Rostiro tracks it live alongside you: always-current best available, a heads-up before your turn, and an alert the moment a run starts or your target gets sniped.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl p-5 space-y-4" style={{ backgroundColor: '#0A1520', border: '1px solid #1A3048' }}>
        <div>
          <label className="text-xs font-medium block mb-1.5" style={{ color: '#5A7A9A' }}>Sleeper draft ID</label>
          <input
            type="text"
            value={draftId}
            onChange={(e) => setDraftId(e.target.value)}
            placeholder="e.g. 1128176747251396608"
            required
            className="w-full text-sm px-3 py-2.5 rounded-lg outline-none"
            style={{ backgroundColor: '#07111C', border: '1px solid #1A3048', color: 'white' }}
          />
          <p className="text-xs mt-1" style={{ color: '#3A5A7A' }}>
            The number at the end of your Sleeper draft URL.
          </p>
        </div>

        <div>
          <label className="text-xs font-medium block mb-1.5" style={{ color: '#5A7A9A' }}>Your Sleeper username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. lordelightskin"
            required
            className="w-full text-sm px-3 py-2.5 rounded-lg outline-none"
            style={{ backgroundColor: '#07111C', border: '1px solid #1A3048', color: 'white' }}
          />
        </div>

        {error && (
          <p className="text-sm" style={{ color: '#E84040' }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full text-sm font-semibold px-4 py-3 rounded-xl text-white transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#378ADD' }}
        >
          {loading ? 'Joining...' : 'Join draft'}
        </button>
      </form>
    </div>
  )
}
