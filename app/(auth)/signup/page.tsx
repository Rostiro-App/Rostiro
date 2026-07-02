'use client'

import { useState } from 'react'
import { browserClient } from '@/lib/supabase-browser'
import Link from 'next/link'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const { error } = await browserClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback?next=/onboarding`,
      },
    })

    setLoading(false)
    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({
        type: 'success',
        text: 'Check your email to confirm — then your 7-day Starter trial begins automatically.',
      })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#0D1B2A' }}>
      <div className="w-full max-w-sm">

        <div className="mb-8 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-3" style={{ color: '#378ADD' }}>
            ROSTIRO
          </p>
          <h1 className="text-2xl font-bold text-white tracking-tight">Create your account</h1>
          <p className="text-sm mt-1" style={{ color: '#5A7A9A' }}>
            Your Rostiro OS is ready. Let&apos;s connect it.
          </p>
        </div>

        <div className="rounded-xl p-6" style={{ backgroundColor: '#0A1520', border: '1.5px solid #1A3048' }}>
          <p className="text-xs mb-5" style={{ color: '#5A7A9A' }}>
            Free to start · 7-day Starter trial included · No card required
          </p>

          <form onSubmit={handleSignup}>
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
              <input
                type="password"
                placeholder="Password (min 8 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none"
                style={{ backgroundColor: '#07111C', border: '1.5px solid #1A3048' }}
              />
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
              {loading ? 'Creating account...' : 'Create free account →'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm mt-4" style={{ color: '#3A5A7A' }}>
          Already have an account?{' '}
          <Link href="/login" className="transition-colors" style={{ color: '#5A7A9A' }}>
            Sign in
          </Link>
        </p>

      </div>
    </div>
  )
}
