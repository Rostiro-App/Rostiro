'use client'

// T-138: Next.js's special catch-all for an uncaught error escaping the
// root layout — previously nothing was here, so a real crash showed
// Next's generic default error screen and left zero record anywhere.
// Must render its own <html>/<body> since it replaces the root layout
// entirely when it triggers.
//
// This is a Client Component (Next.js requires it), so it can't import
// lib/errorLog.ts directly — that pulls in lib/supabase.ts's
// createAdminClient, which depends on next/headers and is server-only.
// Posts to app/api/system/log-error/route.ts instead, same client/server
// split every other part of this app already uses.

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    fetch('/api/system/log-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'global-error-boundary',
        message: error.message,
        stack: error.stack ?? null,
        context: { digest: error.digest },
      }),
    }).catch(() => {
      // Logging the crash must never itself throw on top of an already-crashed page.
    })
  }, [error])

  return (
    <html lang="en">
      <body>
        <div
          className="min-h-screen flex items-center justify-center px-4"
          style={{ backgroundColor: '#0D1B2A', fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
        >
          <div className="w-full max-w-sm text-center">
            <p
              className="text-xs font-semibold tracking-[0.2em] uppercase mb-4"
              style={{ color: '#378ADD' }}
            >
              ROSTIRO
            </p>
            <h1 className="text-xl font-bold mb-2" style={{ color: '#D0E4F5' }}>
              Something went wrong
            </h1>
            <p className="text-sm mb-6" style={{ color: '#4A6580' }}>
              This has been logged. Try again, or come back in a moment.
            </p>
            <button
              onClick={reset}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:brightness-110"
              style={{ backgroundColor: '#378ADD', border: 'none', cursor: 'pointer' }}
            >
              Try again →
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
