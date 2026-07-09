'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AmbientStateSweep from '@/components/AmbientStateSweep'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  // T-72: clears the boot-sequence's "already played this tab session"
  // flag whenever the login page is reached — including a sign-out that
  // lands back here — so a real repeat login in the same tab still plays
  // the boot animation, not just a brand-new tab.
  useEffect(() => {
    window.sessionStorage.removeItem('rostiro:booted')
  }, [])

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json().catch(() => ({ error: 'Something went wrong. Try again.' }))

    if (!res.ok) {
      setMessage({ type: 'error', text: data.error ?? 'Something went wrong. Try again.' })
      setLoading(false)
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
          <h1 className="text-2xl font-bold text-white tracking-tight">Welcome back</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--t2)' }}>Run Every League.</p>
        </div>

        <div className="rounded-xl p-6" style={{ backgroundColor: 'rgba(8, 15, 26, 0.6)', border: '1.5px solid var(--hairline)' }}>

          <form onSubmit={handlePasswordLogin}>
            <div className="space-y-3">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none"
                style={{ backgroundColor: 'rgba(6, 11, 19, 0.55)', border: '1.5px solid var(--hairline)' }}
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none"
                style={{ backgroundColor: 'rgba(6, 11, 19, 0.55)', border: '1.5px solid var(--hairline)' }}
              />
            </div>

            <p className="mt-2 text-right">
              <Link href="/forgot-password" className="text-xs" style={{ color: 'var(--t3)' }}>
                Forgot password?
              </Link>
            </p>

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
              {loading ? 'Loading...' : 'Sign in →'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm mt-4" style={{ color: 'var(--t3)' }}>
          No account?{' '}
          <Link href="/signup" style={{ color: 'var(--t2)' }}>
            Create one free
          </Link>
        </p>

      </div>
    </div>
  )
}
