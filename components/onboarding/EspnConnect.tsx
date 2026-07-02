'use client'

import { useState } from 'react'

type GuideStep = 1 | 2 | 3 | 4

export default function EspnConnect({
  onBack,
  onConnected,
}: {
  onBack: () => void
  onConnected: () => void
}) {
  const [guideStep, setGuideStep] = useState<GuideStep>(1)
  const [leagueId, setLeagueId] = useState('')
  const [espnS2, setEspnS2] = useState('')
  const [swid, setSwid] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch('/api/leagues/espn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leagueId, espnS2, swid }),
    })

    setLoading(false)
    if (res.ok) {
      onConnected()
    } else {
      const data = await res.json()
      setError(data.error ?? 'Could not connect to that ESPN league. Double-check your cookies.')
    }
  }

  const steps: { step: GuideStep; title: string; instruction: string; detail: string }[] = [
    {
      step: 1,
      title: 'Open ESPN Fantasy in Chrome',
      instruction: 'Go to fantasy.espn.com and make sure you are logged in.',
      detail: 'You must use Chrome or Edge for this step — Safari DevTools shows cookies differently.',
    },
    {
      step: 2,
      title: 'Open DevTools',
      instruction: 'Press F12 (Windows) or Cmd+Option+I (Mac) to open Chrome DevTools.',
      detail: 'Or right-click anywhere on the page and select "Inspect."',
    },
    {
      step: 3,
      title: 'Find your cookies',
      instruction: 'Click the "Application" tab → expand "Cookies" in the left sidebar → click "https://www.espn.com".',
      detail: 'You\'ll see a table of cookies. You need the values for espn_s2 and SWID.',
    },
    {
      step: 4,
      title: 'Copy espn_s2 and SWID',
      instruction: 'Click on espn_s2 in the table, copy its full value. Then do the same for SWID.',
      detail: 'espn_s2 is a long string. SWID looks like {XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}. Copy both exactly.',
    },
  ]

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <button onClick={onBack} className="text-zinc-500 hover:text-zinc-300 text-sm mb-5 flex items-center gap-1">
        ← Back
      </button>
      <h2 className="text-white font-semibold mb-1">Connect ESPN</h2>
      <p className="text-zinc-500 text-sm mb-5">
        ESPN doesn't have an official API, so we use your browser cookies. This is read-only — Rostiro
        cannot make changes to your ESPN league.
      </p>

      {/* Step-by-step guide */}
      <div className="mb-5">
        <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide mb-3">
          Step {guideStep} of 4
        </p>
        <div className="flex gap-1.5 mb-4">
          {([1, 2, 3, 4] as GuideStep[]).map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s <= guideStep ? 'bg-white' : 'bg-zinc-700'
              }`}
            />
          ))}
        </div>

        {steps.filter((s) => s.step === guideStep).map(({ title, instruction, detail }) => (
          <div key={guideStep} className="bg-zinc-800 rounded-lg p-4">
            <p className="text-white font-medium text-sm mb-1">{title}</p>
            <p className="text-zinc-300 text-sm">{instruction}</p>
            <p className="text-zinc-500 text-xs mt-2">{detail}</p>
          </div>
        ))}

        <div className="flex gap-2 mt-3">
          {guideStep > 1 && (
            <button
              onClick={() => setGuideStep((s) => (s - 1) as GuideStep)}
              className="flex-1 border border-zinc-700 text-zinc-400 py-2 rounded-lg text-sm hover:text-white transition-colors"
            >
              Back
            </button>
          )}
          {guideStep < 4 ? (
            <button
              onClick={() => setGuideStep((s) => (s + 1) as GuideStep)}
              className="flex-1 bg-zinc-700 text-white py-2 rounded-lg text-sm hover:bg-zinc-600 transition-colors"
            >
              Next →
            </button>
          ) : null}
        </div>
      </div>

      {/* Credentials form — shown after completing guide */}
      {guideStep === 4 && (
        <form onSubmit={handleConnect} className="space-y-3 mt-2">
          <input
            type="text"
            placeholder="ESPN League ID (from your league URL)"
            value={leagueId}
            onChange={(e) => setLeagueId(e.target.value)}
            required
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
          />
          <textarea
            placeholder="espn_s2 value (long string)"
            value={espnS2}
            onChange={(e) => setEspnS2(e.target.value)}
            required
            rows={3}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 resize-none font-mono text-xs"
          />
          <input
            type="text"
            placeholder="SWID value  {XXXXXXXX-XXXX-...}"
            value={swid}
            onChange={(e) => setSwid(e.target.value)}
            required
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 font-mono text-xs"
          />

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black font-semibold py-2.5 rounded-lg text-sm hover:bg-zinc-100 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Connecting...' : 'Connect ESPN →'}
          </button>
        </form>
      )}
    </div>
  )
}
