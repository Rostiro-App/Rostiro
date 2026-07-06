'use client'

// T-126: light Profile page — the personal/identity hub, deliberately
// separate from Settings (which stays granular config: Mode, Connected
// leagues, Product tour, Data & privacy, Danger zone). Profile holds name,
// plan/billing, and the one explicit, clearly-labeled Log Out control the
// founder found genuinely missing from the front end — the only other
// sign-out entry points are an unlabeled icon in the desktop dock
// (components/nav/Sidebar.tsx) and a labeled item buried in mobile's More
// sheet (components/nav/BottomNav.tsx), neither of which read as "log out"
// in practice.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { browserClient } from '@/lib/supabase-browser'

interface ProfileData {
  email: string
  fullName: string | null
  plan: string
  createdAt: string
}

const PLAN_LABEL: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  commissioner: 'Founder',
}

export default function ProfilePage() {
  const [data, setData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [savingName, setSavingName] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/settings')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((d: ProfileData) => {
        if (cancelled) return
        setData(d)
        setName(d.fullName ?? '')
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your profile.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function saveName() {
    const trimmed = name.trim()
    setSavingName(true)
    try {
      const { error: updateError } = await browserClient.auth.updateUser({ data: { full_name: trimmed } })
      if (updateError) throw updateError
      setData((d) => (d ? { ...d, fullName: trimmed || null } : d))
      setEditingName(false)
    } catch {
      setError('Could not update your name — try again.')
      setTimeout(() => setError(null), 4000)
    } finally {
      setSavingName(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-8 md:px-6 md:pt-8">
        <div className="h-8 w-40 rounded animate-pulse" style={{ backgroundColor: 'var(--hairline)' }} />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-8 md:px-6 md:pt-8">
        <p className="text-sm" style={{ color: 'var(--crit)' }}>{error ?? 'Could not load your profile.'}</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-8 md:px-6 md:pt-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">Profile</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--t2)' }}>
          Your identity, plan, and billing. For leagues, mode, and data controls, see{' '}
          <Link href="/settings" style={{ color: 'var(--signal)' }}>Settings</Link>.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: 'rgba(226,75,74,0.12)', border: '1px solid rgba(226,75,74,0.35)', color: '#E24B4A' }}>
          {error}
        </div>
      )}

      <div className="space-y-4">
        <Section title="Identity">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--t3)' }}>Name</p>
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={40}
                    autoFocus
                    className="flex-1 text-sm rounded-lg px-3 py-2 focus:outline-none"
                    style={{ backgroundColor: 'rgba(8, 15, 26, 0.6)', border: '1.5px solid var(--hairline)', color: 'white' }}
                  />
                  <button
                    onClick={saveName}
                    disabled={savingName}
                    className="text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-60"
                    style={{ backgroundColor: 'var(--signal)', color: 'white' }}
                  >
                    {savingName ? 'Saving…' : 'Save'}
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-white">{data.fullName || 'Not set'}</p>
                  <button
                    onClick={() => setEditingName(true)}
                    className="text-xs font-medium"
                    style={{ color: 'var(--signal)' }}
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--t3)' }}>Email</p>
              <p className="text-sm text-white">{data.email}</p>
            </div>
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--t3)' }}>Member since</p>
              <p className="text-sm" style={{ color: 'var(--t2)' }}>
                {new Date(data.createdAt).toLocaleDateString([], { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        </Section>

        <Section title="Plan & billing">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white">{PLAN_LABEL[data.plan] ?? data.plan}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--t3)' }}>
                {data.plan === 'commissioner'
                  ? 'Founding 500 lifetime member'
                  : data.plan === 'free'
                    ? 'Upgrade for unlimited leagues and full Pulse depth.'
                    : 'Active subscription.'}
              </p>
            </div>
            <span
              className="text-[10px] font-bold tracking-wider px-2 py-1 rounded flex-shrink-0"
              style={
                data.plan === 'commissioner'
                  ? { backgroundColor: '#F5C842', color: '#0D0800' }
                  : { backgroundColor: 'var(--signal-dim)', color: 'var(--signal)' }
              }
            >
              {(PLAN_LABEL[data.plan] ?? data.plan).toUpperCase()}
            </span>
          </div>
          <p className="text-xs mt-3" style={{ color: 'var(--t4)' }}>
            Billing management arrives with Stripe checkout (T-85) — nothing to manage yet on the Free plan.
          </p>
        </Section>

        <Section title="Session">
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="w-full text-sm font-semibold py-3 rounded-xl transition-all hover:brightness-110"
              style={{ backgroundColor: 'rgba(226,75,74,0.12)', border: '1px solid rgba(226,75,74,0.35)', color: '#E8504A' }}
            >
              Log out
            </button>
          </form>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--glass-solid)', border: '1px solid var(--hairline)' }}>
      <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: 'var(--t3)' }}>
        {title}
      </p>
      {children}
    </div>
  )
}
