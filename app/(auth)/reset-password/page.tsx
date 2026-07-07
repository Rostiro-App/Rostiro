'use client'

// T-130: password reset, step 2 of 2. Only reachable with a real session
// already established by /api/auth/callback exchanging the recovery link's
// code — if someone lands here directly with no session (stale tab, direct
// URL guess), there's nothing to reset yet, so show that instead of a form
// that would just fail on submit.

import { useEffect, useState } from 'react'
import { browserClient } from '@/lib/supabase-browser'
import Link from 'next/link'
import AmbientStateSweep from '@/components/AmbientStateSweep'

export default function ResetPasswordPage() {
  const [checkingSession, setCheckingSession] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  useEffect(() => {
    browserClient.auth.getSession().then(({ data: { session } }) => {
      setHasSession(session !== null)
      setCheckingSession(false)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: "Passwords don't match." })
      return
    }

    setLoading(true)
    const { error } = await browserClient.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setMessage({ type: 'error', text: error.message })
      return
    }

    window.location.href = '/pulse'
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--void)', position: 'relative' }}>
      <AmbientStateSweep />
      <div className="w-full max-w-sm" style={{ position: 'relative', zIndex: 1 }}>

        <div className="mb-8 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-3" style={{ color: 'var(--signal)' }}>
            ROSTIRO
          </p>
          <h1 className="text-2xl font-bold text-white tracking-tight">Set a new password</h1>
        </div>

        <div className="rounded-xl p-6" style={{ backgroundColor: 'rgba(8, 15, 26, 0.6)', border: '1.5px solid var(--hairline)' }}>
          {checkingSession ? (
            <p className="text-sm" style={{ color: 'var(--t2)' }}>Checking your reset link...</p>
          ) : !hasSession ? (
            <div>
              <p className="text-sm" style={{ color: 'var(--crit)' }}>
                This reset link is invalid or has expired.
              </p>
              <Link
                href="/forgot-password"
                className="mt-4 inline-block w-full text-center font-semibold py-2.5 rounded-lg text-sm text-white transition-all hover:brightness-110"
                style={{ backgroundColor: 'var(--signal)' }}
              >
                Request a new link →
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="space-y-3">
                <input
                  type="password"
                  placeholder="New password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none"
                  style={{ backgroundColor: 'rgba(6, 11, 19, 0.55)', border: '1.5px solid var(--hairline)' }}
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none"
                  style={{ backgroundColor: 'rgba(6, 11, 19, 0.55)', border: '1.5px solid var(--hairline)' }}
                />
              </div>

              {message && (
                <p
                  className="mt-3 text-sm"
                  style={{ color: message.type === 'error' ? 'var(--crit)' : 'var(--live)' }}
                >
                  {message.text}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-4 w-full font-semibold py-2.5 rounded-lg text-sm text-white disabled:opacity-50 transition-all hover:brightness-110"
                style={{ backgroundColor: 'var(--signal)' }}
              >
                {loading ? 'Saving...' : 'Save new password →'}
              </button>
            </form>
          )}
        </div>

      </div>
    </div>
  )
}
