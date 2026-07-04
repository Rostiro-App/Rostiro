'use client'

// T-71: real Settings page — account, mode (written through the same
// setGlobalMode path the system bar uses), connected leagues with
// disconnect, and notification prefs (UI ready ahead of push, T-66).
// Disconnect uses a two-step inline confirm instead of a browser dialog.

import { useEffect, useState } from 'react'
import { setGlobalMode, useMode, type Mode } from '@/components/nav/AppShell'

interface SettingsData {
  email: string
  plan: string
  pushEnabled: boolean
  mode: Mode | null
  createdAt: string
  leagues: Array<{ id: string; platform: string; league_name: string }>
}

const PLAN_LABEL: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  commissioner: 'Commissioner',
}

const PLATFORM_LABEL: Record<string, string> = {
  sleeper: 'SLEEPER',
  yahoo: 'YAHOO',
  espn: 'ESPN',
}

const MODES: Array<{ id: Mode; label: string; tagline: string }> = [
  { id: 'focused', label: 'Focused', tagline: 'Just tell me what to do.' },
  { id: 'balanced', label: 'Balanced', tagline: 'Context + decisions.' },
  { id: 'savant', label: 'Savant', tagline: 'Show me everything.' },
]

export default function SettingsPage() {
  const mode = useMode()
  const [data, setData] = useState<SettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/settings')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load settings')
        return res.json()
      })
      .then((d: SettingsData) => {
        if (!cancelled) setData(d)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function togglePush() {
    if (!data) return
    const next = !data.pushEnabled
    setData({ ...data, pushEnabled: next })
    fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pushEnabled: next }),
    }).catch(() => setData((d) => (d ? { ...d, pushEnabled: !next } : d)))
  }

  async function disconnect(leagueId: string) {
    if (!data) return
    const prev = data.leagues
    setData({ ...data, leagues: prev.filter((l) => l.id !== leagueId) })
    setConfirmingId(null)
    try {
      const res = await fetch(`/api/leagues/${leagueId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
    } catch {
      setData((d) => (d ? { ...d, leagues: prev } : d))
      setError('Could not disconnect that league — try again.')
      setTimeout(() => setError(null), 4000)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-8 md:px-6 md:pt-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--t2)' }}>
          Account, mode, leagues, notifications
        </p>
      </div>

      {error && (
        <p className="text-sm mb-4" style={{ color: 'var(--crit)' }}>{error}</p>
      )}

      {loading && <Skeleton />}

      {!loading && data && (
        <div className="space-y-4">
          {/* ─── Account ─────────────────────────────────────────────── */}
          <Section title="Account">
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm text-white">{data.email}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--t3)' }}>
                  Member since {new Date(data.createdAt).toLocaleDateString([], { month: 'long', year: 'numeric' })}
                </p>
              </div>
              <span
                className="text-[10px] font-bold tracking-wider px-2 py-1 rounded"
                style={{ backgroundColor: 'var(--signal-dim)', color: 'var(--signal)' }}
              >
                {(PLAN_LABEL[data.plan] ?? data.plan).toUpperCase()}
              </span>
            </div>
          </Section>

          {/* ─── Mode ────────────────────────────────────────────────── */}
          <Section
            title="Mode"
            subtitle={
              data.mode === null
                ? 'Saved on this device. Cross-device sync activates once the database migration runs.'
                : 'Follows you across devices.'
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {MODES.map((m) => {
                const isActive = m.id === mode
                return (
                  <button
                    key={m.id}
                    onClick={() => setGlobalMode(m.id)}
                    className="text-left rounded-xl px-3.5 py-3 transition-all"
                    style={{
                      backgroundColor: isActive ? 'var(--signal-dim)' : 'rgba(8, 15, 26, 0.6)',
                      border: `1.5px solid ${isActive ? 'var(--signal)' : 'var(--hairline)'}`,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">{m.label}</span>
                      {isActive && (
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--signal)' }} />
                      )}
                    </div>
                    <span className="text-xs" style={{ color: 'var(--t2)' }}>{m.tagline}</span>
                  </button>
                )
              })}
            </div>
          </Section>

          {/* ─── Connected leagues ───────────────────────────────────── */}
          <Section title="Connected leagues">
            {data.leagues.length === 0 ? (
              <div className="flex items-center justify-between py-1">
                <p className="text-sm" style={{ color: 'var(--t2)' }}>No leagues connected.</p>
                <a
                  href="/leagues/add"
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
                  style={{ backgroundColor: 'var(--cta)' }}
                >
                  Connect →
                </a>
              </div>
            ) : (
              <div className="space-y-1">
                {/* T-109: previously the only way to add a league at all was
                    /onboarding — a returning user with leagues already
                    connected had no path back to it anywhere in the app. */}
                <div className="flex justify-end pb-1">
                  <a
                    href="/leagues/add"
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={{ color: 'var(--signal)', border: '1px solid rgba(75,163,245,.4)' }}
                  >
                    + Add another
                  </a>
                </div>
                {data.leagues.map((league) => (
                  <div key={league.id} className="flex items-center justify-between gap-3 py-1.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="text-[10px] font-semibold px-1.5 rounded flex-shrink-0"
                        style={{ color: 'var(--t2)', border: '1px solid var(--hairline)' }}
                      >
                        {PLATFORM_LABEL[league.platform] ?? league.platform.toUpperCase()}
                      </span>
                      <span className="text-sm text-white truncate">{league.league_name}</span>
                    </div>
                    {confirmingId === league.id ? (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => disconnect(league.id)}
                          className="text-xs font-semibold px-2.5 py-1.5 rounded-lg"
                          style={{ backgroundColor: 'rgba(232,80,74,.13)', color: 'var(--crit)' }}
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmingId(null)}
                          className="text-xs px-2.5 py-1.5 rounded-lg"
                          style={{ color: 'var(--t2)' }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmingId(league.id)}
                        className="text-xs px-2.5 py-1.5 rounded-lg flex-shrink-0 transition-all"
                        style={{ color: 'var(--t3)', border: '1px solid var(--hairline)' }}
                      >
                        Disconnect
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* ─── Notifications ───────────────────────────────────────── */}
          <Section
            title="Notifications"
            subtitle="Push delivery ships soon — this switch controls whether you're included when it does."
          >
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm text-white">Push notifications</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--t3)' }}>
                  Critical Pulse items: injuries to starters, deadlines inside 48h.
                </p>
              </div>
              <button
                role="switch"
                aria-checked={data.pushEnabled}
                onClick={togglePush}
                className="relative rounded-full transition-all flex-shrink-0"
                style={{
                  width: 40,
                  height: 22,
                  backgroundColor: data.pushEnabled ? 'var(--cta)' : 'var(--hairline)',
                }}
              >
                <span
                  className="absolute top-[3px] rounded-full transition-all"
                  style={{
                    width: 16,
                    height: 16,
                    left: data.pushEnabled ? 21 : 3,
                    backgroundColor: data.pushEnabled ? '#FFFFFF' : 'var(--t2)',
                  }}
                />
              </button>
            </div>
          </Section>
        </div>
      )}
    </div>
  )
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--glass-solid)', border: '1px solid var(--hairline)' }}>
      <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: 'var(--t3)' }}>
        {title}
      </p>
      {subtitle && (
        <p className="text-xs mb-3" style={{ color: 'var(--t2)' }}>{subtitle}</p>
      )}
      {!subtitle && <div className="mb-2" />}
      {children}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-xl h-24 animate-pulse"
          style={{ backgroundColor: 'var(--glass-solid)', border: '1px solid var(--hairline)' }}
        />
      ))}
    </div>
  )
}
