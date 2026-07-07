'use client'

// T-130: password reset, step 1 of 2 — request the email.
// T-135: routed through our own API rather than calling
// browserClient.auth.resetPasswordForEmail() directly — that call always
// fires Supabase's own unbranded recovery email. The server route generates
// the same recovery link via admin.generateLink and sends it through Resend
// with Rostiro's own branded template instead (lib/resend.ts). The link
// still points at /api/auth/callback (the same code-exchange route
// magic link/OAuth already use), landing the user on /reset-password with a
// real session already established, ready to set a new password.

import { useState } from 'react'
import Link from 'next/link'
import AmbientStateSweep from '@/components/AmbientStateSweep'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()

    setLoading(false)
    // Same message whether or not the email exists — don't let this form
    // become a way to probe which emails have Rostiro accounts.
    if (!res.ok) {
      setMessage({ type: 'error', text: data.error ?? 'Something went wrong.' })
    } else {
      setMessage({ type: 'success', text: data.message })
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
          <h1 className="text-2xl font-bold text-white tracking-tight">Reset your password</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--t2)' }}>
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        <div className="rounded-xl p-6" style={{ backgroundColor: 'rgba(8, 15, 26, 0.6)', border: '1.5px solid var(--hairline)' }}>
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none"
              style={{ backgroundColor: 'rgba(6, 11, 19, 0.55)', border: '1.5px solid var(--hairline)' }}
            />

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
              {loading ? 'Sending...' : 'Send reset link →'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm mt-4" style={{ color: 'var(--t3)' }}>
          <Link href="/login" style={{ color: 'var(--t2)' }}>
            Back to sign in
          </Link>
        </p>

      </div>
    </div>
  )
}
