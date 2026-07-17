'use client'

// Packet 02 correction pass: a successful OAuth callback used to redirect
// straight to "?yahoo=connected" — but a stored token isn't a completed
// connection. This component now owns the actual "connected" moment: when
// it mounts with startImporting=true (the parent detected "?yahoo=
// importing" from the callback redirect), it shows a visible importing
// state, calls the Yahoo sync itself, and only calls onConnected() once
// that call actually returns successfully.

import { useEffect, useState } from 'react'

export default function YahooConnect({
  onBack,
  onConnected,
  startImporting = false,
}: {
  onBack: () => void
  onConnected: () => void
  startImporting?: boolean
}) {
  const [importing, setImporting] = useState(startImporting)
  const [importError, setImportError] = useState<string | null>(null)

  useEffect(() => {
    if (!startImporting) return
    let cancelled = false

    ;(async () => {
      try {
        const res = await fetch('/api/leagues/yahoo', { method: 'POST' })
        if (cancelled) return
        if (res.ok) {
          onConnected()
          return
        }
        const body = await res.json().catch(() => ({}))
        setImportError(
          body.code === 'YAHOO_RECONNECT_REQUIRED'
            ? 'Yahoo needs to be reconnected — try again.'
            : 'Yahoo is connected, but importing your leagues failed — you can retry from Settings.'
        )
        setImporting(false)
      } catch {
        if (!cancelled) {
          setImportError('Could not reach Rostiro to import your leagues — you can retry from Settings.')
          setImporting(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
    // Runs once, driven only by the initial startImporting prop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleConnect() {
    // returnTo tells the callback which real flow to send the user back
    // to — validated server-side against an explicit allowlist
    // (lib/yahooReturnTo.ts) before ever being trusted as a redirect
    // target, so this can't be turned into an open redirect.
    window.location.href = `/api/auth/yahoo?returnTo=${encodeURIComponent(window.location.pathname)}`
  }

  if (importing) {
    return (
      <div
        className="rounded-xl p-6 text-center"
        style={{ backgroundColor: 'rgba(8, 15, 26, 0.6)', border: '1.5px solid var(--hairline)' }}
      >
        <p className="text-white font-semibold mb-1">Importing your Yahoo leagues…</p>
        <p className="text-sm" style={{ color: 'var(--t2)' }}>This only takes a moment.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl p-6" style={{ backgroundColor: 'rgba(8, 15, 26, 0.6)', border: '1.5px solid var(--hairline)' }}>
      <button
        onClick={onBack}
        className="text-sm mb-5 flex items-center gap-1"
        style={{ color: 'var(--t2)' }}
      >
        ← Back
      </button>
      <h2 className="text-white font-semibold mb-1">Connect Yahoo</h2>
      <p className="text-sm mb-5" style={{ color: 'var(--t2)' }}>
        You&apos;ll be redirected to Yahoo to authorize Rostiro with read-only access. Rostiro reads your
        leagues, rosters, and matchups to build recommendations — you make the actual move on Yahoo,
        one tap away.
      </p>

      <div className="rounded-lg p-4 mb-5" style={{ backgroundColor: 'rgba(6, 11, 19, 0.55)', border: '1px solid var(--hairline)' }}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(75,163,245,.35)' }}>
          What Rostiro can do
        </p>
        <ul className="space-y-1.5">
          {[
            'Read your leagues, rosters, and matchups',
            'Build lineup, waiver, and trade recommendations',
            'Link straight to Yahoo to make the move',
          ].map((item) => (
            <li key={item} className="text-sm flex items-start gap-2" style={{ color: 'var(--t2)' }}>
              <span className="mt-0.5" style={{ color: 'var(--live)' }}>✓</span>
              {item}
            </li>
          ))}
        </ul>
        <p className="text-xs mt-3" style={{ color: 'var(--t3)' }}>
          Fantasy data provided by Yahoo Fantasy.
        </p>
      </div>

      {importError && (
        <p className="text-sm mb-3" style={{ color: 'var(--crit)' }}>{importError}</p>
      )}

      <button
        onClick={handleConnect}
        className="w-full font-semibold py-2.5 rounded-lg text-sm text-white transition-all hover:brightness-110"
        style={{ backgroundColor: '#6001D2' }}
      >
        Connect with Yahoo →
      </button>
    </div>
  )
}
