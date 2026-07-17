'use client'

// Packet 02, Workstream G: the Yahoo-specific connection states the
// generic per-league list in Settings can't represent on its own —
// reconnect-required, partial-sync failures, and the resync/reconnect/
// disconnect-all-Yahoo controls. Renders nothing when Yahoo has never
// been connected and has no leagues (that "not connected" state is
// already covered by the existing "+ Add" flow into /leagues/add).

import { useEffect, useState } from 'react'

interface YahooStatus {
  connected: boolean
  needsReconnect: boolean
  leagueCount: number
  failedCount: number
}

interface SyncResult {
  imported: number
  updated: number
  skippedForPlan: number
  failed: number
}

export default function YahooConnectionPanel({ onChanged }: { onChanged: () => void }) {
  const [status, setStatus] = useState<YahooStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false)

  async function loadStatus() {
    try {
      const res = await fetch('/api/leagues/yahoo')
      if (res.ok) setStatus(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])

  async function resync() {
    setSyncing(true)
    setSyncMessage(null)
    try {
      const res = await fetch('/api/leagues/yahoo', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        if (body.code === 'YAHOO_RECONNECT_REQUIRED') {
          setSyncMessage('Your Yahoo connection needs to be reconnected.')
        } else if (res.status === 502) {
          setSyncMessage('Yahoo is temporarily unavailable — try again shortly.')
        } else {
          setSyncMessage('Could not sync Yahoo leagues — try again.')
        }
      } else {
        const result: SyncResult = await res.json()
        if (result.imported + result.updated === 0 && result.failed === 0 && result.skippedForPlan === 0) {
          setSyncMessage('No current-season NFL leagues found on Yahoo.')
        } else {
          const parts: string[] = []
          if (result.imported > 0) parts.push(`${result.imported} imported`)
          if (result.updated > 0) parts.push(`${result.updated} resynced`)
          if (result.skippedForPlan > 0) parts.push(`${result.skippedForPlan} need a plan upgrade`)
          if (result.failed > 0) parts.push(`${result.failed} failed`)
          setSyncMessage(parts.join(', '))
        }
      }
    } catch {
      setSyncMessage('Could not reach Rostiro — try again.')
    } finally {
      setSyncing(false)
      await loadStatus()
      onChanged()
    }
  }

  async function disconnect() {
    await fetch('/api/leagues/yahoo', { method: 'DELETE' })
    setConfirmingDisconnect(false)
    await loadStatus()
    onChanged()
  }

  if (loading || !status) return null
  // Never connected and nothing imported — the existing "+ Add" flow into
  // /leagues/add already covers this; no extra panel needed.
  if (!status.connected && !status.needsReconnect && status.leagueCount === 0) return null

  return (
    <div className="rounded-lg p-3 mb-3" style={{ backgroundColor: 'rgba(96,1,210,0.08)', border: '1px solid rgba(96,1,210,0.3)' }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">Yahoo</span>
            {status.needsReconnect ? (
              <span className="text-xs" style={{ color: 'var(--crit)' }}>Reconnect required</span>
            ) : status.failedCount > 0 ? (
              <span className="text-xs" style={{ color: 'var(--crit)' }}>
                {status.leagueCount - status.failedCount} synced, {status.failedCount} failed
              </span>
            ) : (
              <span className="text-xs" style={{ color: 'var(--t2)' }}>
                {status.leagueCount} league{status.leagueCount === 1 ? '' : 's'} synced
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--t3)' }}>
            Read-only — Rostiro reads your Yahoo leagues to build recommendations; roster moves happen on Yahoo.
          </p>
          {syncMessage && (
            <p className="text-xs mt-1" style={{ color: 'var(--t2)' }}>{syncMessage}</p>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {status.needsReconnect ? (
            <a
              href="/api/auth/yahoo"
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg text-white"
              style={{ backgroundColor: '#6001D2' }}
            >
              Reconnect Yahoo
            </a>
          ) : (
            <button
              onClick={resync}
              disabled={syncing}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg text-white disabled:opacity-50"
              style={{ backgroundColor: '#6001D2' }}
            >
              {syncing ? 'Importing…' : 'Resync Yahoo'}
            </button>
          )}

          {confirmingDisconnect ? (
            <>
              <button
                onClick={disconnect}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-lg"
                style={{ backgroundColor: 'rgba(232,80,74,.13)', color: 'var(--crit)' }}
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmingDisconnect(false)}
                className="text-xs px-2.5 py-1.5 rounded-lg"
                style={{ color: 'var(--t2)' }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmingDisconnect(true)}
              className="text-xs px-2.5 py-1.5 rounded-lg"
              style={{ color: 'var(--t3)', border: '1px solid var(--hairline)' }}
            >
              Disconnect Yahoo
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
