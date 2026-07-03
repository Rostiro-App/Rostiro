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
      detail: 'You must use Chrome or Edge — Safari DevTools shows cookies differently.',
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
      instruction: 'Click the "Application" tab → expand "Cookies" → click "https://www.espn.com".',
      detail: 'You\'ll see a table. You need espn_s2 and SWID.',
    },
    {
      step: 4,
      title: 'Copy espn_s2 and SWID',
      instruction: 'Click espn_s2 in the table, copy its full value. Then do the same for SWID.',
      detail: 'espn_s2 is a long string. SWID looks like {XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}.',
    },
  ]

  return (
    <div className="rounded-xl p-6" style={{ backgroundColor: 'rgba(8, 15, 26, 0.6)', border: '1.5px solid var(--hairline)' }}>
      <button
        onClick={onBack}
        className="text-sm mb-5 flex items-center gap-1"
        style={{ color: 'var(--t2)' }}
      >
        ← Back
      </button>
      <h2 className="text-white font-semibold mb-1">Unlock ESPN</h2>
      <p className="text-sm mb-5" style={{ color: 'var(--t2)' }}>
        ESPN doesn&apos;t have an official API — we use your browser cookies. Takes 2 minutes. Read-only.
      </p>

      {/* Progress bar */}
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'rgba(75,163,245,.35)' }}>
          Step {guideStep} of 4
        </p>
        <div className="flex gap-1.5 mb-4">
          {([1, 2, 3, 4] as GuideStep[]).map((s) => (
            <div
              key={s}
              className="h-0.5 flex-1 rounded-full transition-colors"
              style={{ backgroundColor: s <= guideStep ? 'var(--signal)' : 'var(--hairline)' }}
            />
          ))}
        </div>

        {steps.filter((s) => s.step === guideStep).map(({ title, instruction, detail }) => (
          <div key={guideStep} className="rounded-lg p-4" style={{ backgroundColor: 'rgba(6, 11, 19, 0.55)', border: '1px solid var(--hairline)' }}>
            <p className="text-white font-medium text-sm mb-1">{title}</p>
            <p className="text-sm" style={{ color: 'var(--t2)' }}>{instruction}</p>
            <p className="text-xs mt-2" style={{ color: 'var(--t2)' }}>{detail}</p>
          </div>
        ))}

        <div className="flex gap-2 mt-3">
          {guideStep > 1 && (
            <button
              onClick={() => setGuideStep((s) => (s - 1) as GuideStep)}
              className="flex-1 py-2 rounded-lg text-sm transition-colors"
              style={{ border: '1px solid var(--hairline)', color: 'var(--t2)' }}
            >
              Back
            </button>
          )}
          {guideStep < 4 && (
            <button
              onClick={() => setGuideStep((s) => (s + 1) as GuideStep)}
              className="flex-1 py-2 rounded-lg text-sm text-white transition-all hover:brightness-110"
              style={{ backgroundColor: 'var(--hairline)' }}
            >
              Next →
            </button>
          )}
        </div>
      </div>

      {/* Credentials form — shown on step 4 */}
      {guideStep === 4 && (
        <form onSubmit={handleConnect} className="space-y-3 mt-2">
          <input
            type="text"
            placeholder="ESPN League ID (from your league URL)"
            value={leagueId}
            onChange={(e) => setLeagueId(e.target.value)}
            required
            className="w-full rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none"
            style={{ backgroundColor: 'rgba(6, 11, 19, 0.55)', border: '1.5px solid var(--hairline)' }}
          />
          <textarea
            placeholder="espn_s2 value (long string)"
            value={espnS2}
            onChange={(e) => setEspnS2(e.target.value)}
            required
            rows={3}
            className="w-full rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none resize-none font-mono"
            style={{ backgroundColor: 'rgba(6, 11, 19, 0.55)', border: '1.5px solid var(--hairline)', fontSize: '11px' }}
          />
          <input
            type="text"
            placeholder="SWID  {XXXXXXXX-XXXX-...}"
            value={swid}
            onChange={(e) => setSwid(e.target.value)}
            required
            className="w-full rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none font-mono"
            style={{ backgroundColor: 'rgba(6, 11, 19, 0.55)', border: '1.5px solid var(--hairline)', fontSize: '11px' }}
          />

          {error && <p className="text-sm" style={{ color: 'var(--crit)' }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full font-semibold py-2.5 rounded-lg text-sm text-white disabled:opacity-50 transition-all hover:brightness-110"
            style={{ backgroundColor: 'var(--signal)' }}
          >
            {loading ? 'Connecting...' : 'Unlock ESPN →'}
          </button>
        </form>
      )}
    </div>
  )
}
