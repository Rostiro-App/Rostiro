'use client'

import { useState } from 'react'
import { browserClient } from '@/lib/supabase-browser'
import Link from 'next/link'
import AmbientStateSweep from '@/components/AmbientStateSweep'

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
        text: 'Check your email to confirm, then your 7-day Starter trial begins automatically.',
      })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--void)', position: 'relative' }}>
      <AmbientStateSweep />
      <div className="w-full max-w-sm" style={{ position: 'relative', zIndex: 1 }}>

        <div className="mb-8 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-3" style={{ color: 'var(--signal)' }}>
            ROSTIRO
          </p>
          <h1 className="text-2xl font-bold text-white tracking-tight">Create your account</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--t2)' }}>
            Your Rostiro OS is ready. Let&apos;s connect it.
          </p>
        </div>

        <div className="rounded-xl p-6" style={{ backgroundColor: 'rgba(8, 15, 26, 0.6)', border: '1.5px solid var(--hairline)' }}>
          <p className="text-xs mb-5" style={{ color: 'var(--t2)' }}>
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
                style={{ backgroundColor: 'rgba(6, 11, 19, 0.55)', border: '1.5px solid var(--hairline)' }}
              />
              <input
                type="password"
                placeholder="Password (min 8 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
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
              {loading ? 'Creating account...' : 'Create free account →'}
            </button>

            <p className="text-xs mt-3 text-center leading-relaxed" style={{ color: 'var(--t4)' }}>
              By creating an account, you agree to Rostiro&apos;s{' '}
              <Link href="/terms" className="underline" style={{ color: 'var(--t3)' }}>Terms of Service</Link>
              {' '}and{' '}
              <Link href="/privacy" className="underline" style={{ color: 'var(--t3)' }}>Privacy Policy</Link>.
            </p>
          </form>
        </div>

        <p className="text-center text-sm mt-4" style={{ color: 'var(--t3)' }}>
          Already have an account?{' '}
          <Link href="/login" className="transition-colors" style={{ color: 'var(--t2)' }}>
            Sign in
          </Link>
        </p>

      </div>
    </div>
  )
}
