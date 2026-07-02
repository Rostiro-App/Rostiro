'use client'

import { useState } from 'react'
import { browserClient } from '@/lib/supabase-browser'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authMode, setAuthMode] = useState<'password' | 'magic'>('password')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const { error } = await browserClient.auth.signInWithPassword({ email, password })

    if (error) {
      setMessage({ type: 'error', text: error.message })
      setLoading(false)
      return
    }

    window.location.href = '/pulse'
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const { error } = await browserClient.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback?next=/pulse`,
      },
    })

    setLoading(false)
    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'Check your email for a login link.' })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#0D1B2A' }}>
      <div className="w-full max-w-sm">

        <div className="mb-8 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-3" style={{ color: '#378ADD' }}>
            ROSTIRO
          </p>
          <h1 className="text-2xl font-bold text-white tracking-tight">Welcome back</h1>
          <p className="text-sm mt-1" style={{ color: '#5A7A9A' }}>Run Every League.</p>
        </div>

        <div className="rounded-xl p-6" style={{ backgroundColor: '#0A1520', border: '1.5px solid #1A3048' }}>

          {/* Mode toggle */}
          <div
            className="flex gap-1 mb-6 p-1 rounded-lg"
            style={{ backgroundColor: '#07111C' }}
          >
            {(['password', 'magic'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setAuthMode(m)}
                className="flex-1 py-2 text-sm rounded-md font-medium transition-all"
                style={{
                  backgroundColor: authMode === m ? '#1A3048' : 'transparent',
                  color: authMode === m ? '#C8DCF0' : '#3A5A7A',
                }}
              >
                {m === 'password' ? 'Password' : 'Magic Link'}
              </button>
            ))}
          </div>

          <form onSubmit={authMode === 'password' ? handlePasswordLogin : handleMagicLink}>
            <div className="space-y-3">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none"
                style={{ backgroundColor: '#07111C', border: '1.5px solid #1A3048' }}
              />
              {authMode === 'password' && (
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none"
                  style={{ backgroundColor: '#07111C', border: '1.5px solid #1A3048' }}
                />
              )}
            </div>

            {message && (
              <p
                className="mt-3 text-sm"
                style={{ color: message.type === 'error' ? '#E84040' : '#4CAF72' }}
              >
                {message.text}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full font-semibold py-2.5 rounded-lg text-sm text-white disabled:opacity-50 transition-all hover:brightness-110"
              style={{ backgroundColor: '#378ADD' }}
            >
              {loading ? 'Loading...' : authMode === 'password' ? 'Sign in →' : 'Send link →'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm mt-4" style={{ color: '#3A5A7A' }}>
          No account?{' '}
          <Link href="/signup" style={{ color: '#5A7A9A' }}>
            Create one free
          </Link>
        </p>

      </div>
    </div>
  )
}
