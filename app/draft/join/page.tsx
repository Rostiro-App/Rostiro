'use client'

// T-64.1/T-64.2: entry point for Draft Copilot — join a live/mock draft
// (Sleeper or Yahoo), land on the live companion view.

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { DraftStrategy, Platform } from '@/types'
import { STRATEGY_LABELS, STRATEGY_DESCRIPTIONS } from '@/lib/draftBoard'

type SupportedPlatform = Extract<Platform, 'sleeper' | 'yahoo'>
const STRATEGIES: DraftStrategy[] = ['balanced', 'zero_rb', 'hero_rb', 'hero_wr']

interface ConnectedLeagueOption {
  id: string
  platform: string
  league_name: string
}

// Found via a real live draft (July 4, 2026), two real gaps in a row:
// 1. Pulse's own draft deadline reminder linked straight to Sleeper's
//    site instead of into Rostiro's Draft Copilot — the one surface built
//    specifically to track a live draft. Fixed by having that reminder
//    deep-link here with the draft ID pre-filled (lib/pulse.ts).
// 2. Founder's live reaction to the pre-fill: "why should I have to
//    re-enter that information if I already connected sleeper as a
//    league" — a fair question. A user's connected league already has
//    everything needed (league_id -> draft, team_id -> roster) to resolve
//    both the draft and their identity in it server-side, with zero
//    typing. That's the section below the platform toggle; the manual
//    form stays only for mock drafts and leagues not yet connected.
export default function JoinDraftPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const prefillPlatform = searchParams.get('platform')
  const [platform, setPlatform] = useState<SupportedPlatform>(
    prefillPlatform === 'yahoo' ? 'yahoo' : 'sleeper'
  )
  const [strategy, setStrategy] = useState<DraftStrategy>('balanced')

  const [draftId, setDraftId] = useState(searchParams.get('draftId') ?? '')
  const [username, setUsername] = useState('')
  const [yahooLeagueId, setYahooLeagueId] = useState(searchParams.get('yahooLeagueId') ?? '')
  const [manualSlot, setManualSlot] = useState('')
  const [needsManualSlot, setNeedsManualSlot] = useState(false)

  const [connectedLeagues, setConnectedLeagues] = useState<ConnectedLeagueOption[]>([])
  const [joiningLeagueId, setJoiningLeagueId] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorLink, setErrorLink] = useState<{ href: string; label: string } | null>(null)

  // Best-effort — an anonymous Draft Kit visitor (401) just sees the
  // manual form only, same as before this existed.
  useEffect(() => {
    let cancelled = false
    fetch('/api/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { leagues?: ConnectedLeagueOption[] } | null) => {
        if (!cancelled && data?.leagues) {
          setConnectedLeagues(data.leagues.filter((l) => l.platform === 'sleeper'))
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  async function submitJoin(body: Record<string, unknown>) {
    setLoading(true)
    setError(null)
    setErrorLink(null)
    try {
      const res = await fetch('/api/draft/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (res.status === 409 && data.error === 'needs_manual_slot') {
        setNeedsManualSlot(true)
        setLoading(false)
        return
      }
      if (res.status === 401 && data.error === 'sign_in_required') {
        setError("You'll need to sign in first.")
        setErrorLink({ href: '/login', label: 'Sign in →' })
        setLoading(false)
        return
      }
      if (res.status === 401 && data.error === 'yahoo_not_connected') {
        setError("Connect a Yahoo account first — you haven't linked one yet.")
        setErrorLink({ href: '/onboarding', label: 'Connect Yahoo →' })
        setLoading(false)
        return
      }
      if (!res.ok) throw new Error(data.error ?? 'Failed to join draft')

      router.push(`/draft/session/${data.sessionId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join draft')
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (platform === 'sleeper') {
      submitJoin({ platform: 'sleeper', draftId: draftId.trim(), username: username.trim(), strategy })
      return
    }
    const body: Record<string, unknown> = { platform: 'yahoo', yahooLeagueId: yahooLeagueId.trim(), strategy }
    if (needsManualSlot && manualSlot.trim()) {
      body.manualDraftPosition = Number(manualSlot.trim())
    }
    submitJoin(body)
  }

  function joinFromConnectedLeague(leagueId: string) {
    setJoiningLeagueId(leagueId)
    submitJoin({ platform: 'sleeper', connectedLeagueId: leagueId, strategy })
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-12 pb-8 md:px-6">
      <div className="mb-6 text-center">
        <span
          className="inline-block text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full mb-4"
          style={{ backgroundColor: 'var(--signal-dim)', color: 'var(--signal)' }}
        >
          Draft Copilot
        </span>
        <h1 className="text-2xl font-bold text-white tracking-tight">Join your live draft</h1>
        <p className="text-sm mt-2" style={{ color: 'var(--t2)' }}>
          Draft on {platform === 'sleeper' ? 'Sleeper' : 'Yahoo'} as normal. Rostiro tracks it live alongside you: always-current best available, a heads-up before your turn, and an alert the moment a run starts or your target gets sniped.
        </p>
      </div>

      <div className="flex gap-1.5 mb-4 justify-center">
        {(['sleeper', 'yahoo'] as const).map((p) => (
          <button
            key={p}
            onClick={() => {
              setPlatform(p)
              setNeedsManualSlot(false)
              setError(null)
            }}
            className="text-xs font-semibold px-4 py-1.5 rounded-lg transition-all"
            style={{
              backgroundColor: platform === p ? 'var(--signal)' : 'rgba(8, 15, 26, 0.6)',
              color: platform === p ? 'white' : 'var(--t2)',
              border: `1px solid ${platform === p ? 'var(--signal)' : 'var(--hairline)'}`,
            }}
          >
            {p === 'sleeper' ? 'Sleeper' : 'Yahoo'}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <p className="text-xs font-medium mb-1.5 text-center" style={{ color: 'var(--t2)' }}>Draft strategy</p>
        <div className="grid grid-cols-2 gap-1.5">
          {STRATEGIES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStrategy(s)}
              className="text-left px-3 py-2 rounded-lg transition-all"
              style={{
                backgroundColor: strategy === s ? 'var(--signal-dim)' : 'rgba(8, 15, 26, 0.6)',
                border: `1px solid ${strategy === s ? 'var(--signal)' : 'var(--hairline)'}`,
              }}
            >
              <p className="text-xs font-semibold" style={{ color: strategy === s ? 'var(--signal)' : 'white' }}>
                {STRATEGY_LABELS[s]}
              </p>
              <p className="text-[11px] mt-0.5 leading-tight" style={{ color: 'var(--t2)' }}>
                {STRATEGY_DESCRIPTIONS[s]}
              </p>
            </button>
          ))}
        </div>
        <p className="text-xs mt-2 text-center" style={{ color: 'var(--t3)' }}>
          You can change this mid-draft as things develop.
        </p>
      </div>

      {platform === 'sleeper' && connectedLeagues.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium mb-1.5 text-center" style={{ color: 'var(--t2)' }}>
            Join from a connected league
          </p>
          <div className="space-y-1.5">
            {connectedLeagues.map((league) => (
              <button
                key={league.id}
                type="button"
                onClick={() => joinFromConnectedLeague(league.id)}
                disabled={loading}
                className="w-full flex items-center justify-between text-left px-4 py-3 rounded-xl transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--signal-dim)', border: '1px solid rgba(75,163,245,.4)' }}
              >
                <span className="text-sm font-semibold text-white">{league.league_name}</span>
                <span className="text-xs font-semibold" style={{ color: 'var(--signal)' }}>
                  {loading && joiningLeagueId === league.id ? 'Joining...' : 'Join draft →'}
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-4">
            <div className="h-px flex-1" style={{ backgroundColor: 'var(--hairline)' }} />
            <span className="mono-data text-[9px] tracking-[0.12em]" style={{ color: 'var(--t3)' }}>
              OR ENTER MANUALLY
            </span>
            <div className="h-px flex-1" style={{ backgroundColor: 'var(--hairline)' }} />
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="rounded-xl p-5 space-y-4" style={{ backgroundColor: 'rgba(8, 15, 26, 0.6)', border: '1px solid var(--hairline)' }}>
        {platform === 'sleeper' ? (
          <>
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--t2)' }}>Sleeper draft ID</label>
              <input
                type="text"
                value={draftId}
                onChange={(e) => setDraftId(e.target.value)}
                placeholder="e.g. 1128176747251396608"
                required
                className="w-full text-sm px-3 py-2.5 rounded-lg outline-none"
                style={{ backgroundColor: 'rgba(6, 11, 19, 0.55)', border: '1px solid var(--hairline)', color: 'white' }}
              />
              <p className="text-xs mt-1" style={{ color: 'var(--t3)' }}>
                The number at the end of your Sleeper draft URL.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--t2)' }}>Your Sleeper username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. lordelightskin"
                required
                className="w-full text-sm px-3 py-2.5 rounded-lg outline-none"
                style={{ backgroundColor: 'rgba(6, 11, 19, 0.55)', border: '1px solid var(--hairline)', color: 'white' }}
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--t2)' }}>Yahoo league ID</label>
              <input
                type="text"
                value={yahooLeagueId}
                onChange={(e) => setYahooLeagueId(e.target.value)}
                placeholder="e.g. 729259"
                required
                className="w-full text-sm px-3 py-2.5 rounded-lg outline-none"
                style={{ backgroundColor: 'rgba(6, 11, 19, 0.55)', border: '1px solid var(--hairline)', color: 'white' }}
              />
              <p className="text-xs mt-1" style={{ color: 'var(--t3)' }}>
                The number in your Yahoo league URL: fantasy.football.yahoo.com/f1/<strong>{'{this number}'}</strong>. Requires a Yahoo account already connected to Rostiro.
              </p>
            </div>

            {needsManualSlot && (
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--t2)' }}>
                  Your draft slot / position number
                </label>
                <input
                  type="number"
                  min={1}
                  value={manualSlot}
                  onChange={(e) => setManualSlot(e.target.value)}
                  placeholder="e.g. 4"
                  required
                  className="w-full text-sm px-3 py-2.5 rounded-lg outline-none"
                  style={{ backgroundColor: 'rgba(6, 11, 19, 0.55)', border: '1px solid var(--hairline)', color: 'white' }}
                />
                <p className="text-xs mt-1" style={{ color: 'var(--t3)' }}>
                  Your draft hasn&apos;t started yet, so Rostiro can&apos;t auto-detect this. It&apos;s usually set by your commissioner ahead of time.
                </p>
              </div>
            )}
          </>
        )}

        {error && (
          <div>
            <p className="text-sm" style={{ color: 'var(--crit)' }}>{error}</p>
            {errorLink && (
              <a href={errorLink.href} className="text-sm font-semibold mt-1 inline-block" style={{ color: 'var(--signal)' }}>
                {errorLink.label}
              </a>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full text-sm font-semibold px-4 py-3 rounded-xl text-white transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--signal)' }}
        >
          {loading ? 'Joining...' : needsManualSlot ? 'Continue' : 'Join draft'}
        </button>
      </form>
    </div>
  )
}
