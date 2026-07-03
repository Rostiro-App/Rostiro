'use client'

// T-67 → OS redesign: the system bar is now glass over the ambient ground,
// set entirely in mono — it reads as instrument chrome, not a header. Live
// behavior unchanged: polls /api/system/status once a minute, the 1-second
// ticker renders "SYNCED XS AGO" and the countdown from data it already
// has, and a failed poll degrades to last-known state rather than blanking.
// The sync dot pings on a loop: visible evidence the OS is monitoring.

import { useEffect, useRef, useState } from 'react'
import { type Mode, ModeButton, ModeSwitcher } from './AppShell'
import type { LeagueHealthStatus, SystemStatus } from '@/types'

const POLL_INTERVAL_MS = 60_000

const DOT_COLOR: Record<LeagueHealthStatus, string> = {
  healthy: 'var(--live)',
  monitor: 'var(--warn)',
  action: 'var(--crit)',
  unknown: 'transparent',
}
const DOT_GLOW: Record<LeagueHealthStatus, string> = {
  healthy: '0 0 7px rgba(67,192,119,.7)',
  monitor: '0 0 7px rgba(245,166,35,.7)',
  action: '0 0 7px rgba(232,80,74,.7)',
  unknown: 'none',
}

export default function SystemBar({
  mode,
  onModeChange,
}: {
  mode: Mode
  onModeChange: (m: Mode) => void
}) {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [syncing, setSyncing] = useState(true)
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const failCount = useRef(0)

  useEffect(() => {
    let cancelled = false

    async function poll() {
      setSyncing(true)
      try {
        const res = await fetch('/api/system/status')
        if (!res.ok) throw new Error('status failed')
        const data: SystemStatus = await res.json()
        if (cancelled) return
        setStatus(data)
        setLastSyncAt(Date.now())
        failCount.current = 0
      } catch {
        // The bar degrades to whatever it last knew — a failed poll never
        // blanks ambient state, it just gets stale (and says so).
        failCount.current++
      } finally {
        if (!cancelled) setSyncing(false)
      }
    }

    poll()
    const interval = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  // 1-second ticker for the sync label and countdown.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1_000)
    return () => clearInterval(t)
  }, [])

  const syncLabel = syncing && lastSyncAt === null
    ? 'SYNCING…'
    : lastSyncAt !== null
      ? formatSyncAge(now - lastSyncAt)
      : 'OFFLINE'

  const deadline = status?.nextDeadline ?? null
  const deadlineMs = deadline ? new Date(deadline.at).getTime() - now : null

  return (
    <>
      <div
        className="glass-bar mono-data flex items-center gap-3 md:gap-5 px-3 md:px-4 flex-shrink-0 relative z-20"
        style={{ borderBottom: '1px solid var(--hairline)', height: '42px', fontSize: '11px' }}
      >
        {/* Wordmark — desktop only (mobile keeps every pixel for state) */}
        <span className="hidden md:flex items-baseline gap-1.5 flex-shrink-0">
          <span className="font-bold tracking-[0.18em] text-[11.5px]" style={{ color: 'var(--t1)' }}>
            ROSTIRO
          </span>
          <span
            className="text-[8.5px] font-bold tracking-[0.14em] px-1 rounded"
            style={{
              color: 'var(--signal)',
              border: '1px solid rgba(75,163,245,0.45)',
              textShadow: '0 0 12px rgba(75,163,245,0.65)',
            }}
          >
            OS
          </span>
        </span>

        {/* Sync state — the ping is the heartbeat */}
        <span className="flex items-center gap-2 flex-shrink-0" style={{ color: 'var(--t2)' }}>
          <span
            className="ping-dot w-1.5 h-1.5 rounded-full"
            style={{
              color: syncing ? 'var(--signal)' : 'var(--live)',
              backgroundColor: syncing ? 'var(--signal)' : 'var(--live)',
              boxShadow: syncing ? '0 0 8px rgba(75,163,245,.8)' : '0 0 8px rgba(67,192,119,.8)',
            }}
          />
          {/* Re-keyed on each successful poll so the label ticks exactly
              when the data is actually fresh, not every second. */}
          <span key={lastSyncAt ?? 0} className="hidden sm:inline value-tick">{syncLabel}</span>
        </span>

        {/* League health dots */}
        {status && status.leagues.length > 0 && (
          <span className="flex items-center gap-2.5">
            <span className="hidden md:inline text-[9px] tracking-[0.14em]" style={{ color: 'var(--t3)' }}>
              LEAGUES
            </span>
            {status.leagues.map((l, i) => (
              <span key={l.id} className="relative group">
                <span
                  className={l.health.status === 'healthy' || l.health.status === 'monitor' ? 'breathe block w-2 h-2 rounded-full cursor-default' : 'block w-2 h-2 rounded-full cursor-default'}
                  style={{
                    backgroundColor: DOT_COLOR[l.health.status],
                    boxShadow: DOT_GLOW[l.health.status],
                    border: l.health.status === 'unknown' ? '1px solid var(--t3)' : 'none',
                    animationDelay: `${i * 1.4}s`,
                  }}
                />
                <span
                  className="glass-heavy hidden group-hover:block absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10.5px] px-2.5 py-1.5 rounded-lg z-50"
                  style={{ color: 'var(--t1)' }}
                >
                  {l.name} ·{' '}
                  <b style={{ color: 'var(--signal)', fontWeight: 600 }}>
                    {l.health.score !== null ? l.health.score : '—'}
                  </b>
                </span>
              </span>
            ))}
          </span>
        )}

        <span className="flex-1" />

        {/* Deadline countdown */}
        {deadline && deadlineMs !== null && deadlineMs > 0 && (
          <span className="flex items-baseline gap-2 flex-shrink-0">
            <span
              className="text-[9px] tracking-[0.14em] uppercase truncate max-w-28 md:max-w-none"
              style={{ color: 'var(--warn)' }}
            >
              {deadline.label} · {deadline.leagueName}
            </span>
            <span
              className="text-xs"
              style={{ color: 'var(--t1)', textShadow: '0 0 14px rgba(245,166,35,0.25)' }}
            >
              {formatCountdown(deadlineMs)}
            </span>
          </span>
        )}

        {/* Mode chip */}
        <ModeButton mode={mode} onClick={() => setSwitcherOpen(true)} />

        {/* ⌘K affordance */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('rostiro:open-command-palette'))}
          className="hidden md:flex items-center gap-1.5 text-[10.5px] px-2.5 py-1 rounded-lg transition-all hover:shadow-[0_0_14px_rgba(75,163,245,0.18)]"
          style={{ color: 'var(--t2)', border: '1px solid var(--hairline)' }}
        >
          Command
          <kbd
            className="text-[9.5px] px-1 rounded"
            style={{
              border: '1px solid var(--hairline)',
              borderBottomWidth: '2px',
              color: 'var(--t3)',
            }}
          >
            ⌘K
          </kbd>
        </button>
      </div>

      {switcherOpen && (
        <ModeSwitcher
          current={mode}
          onSelect={(m) => {
            onModeChange(m)
            setSwitcherOpen(false)
          }}
          onClose={() => setSwitcherOpen(false)}
        />
      )}
    </>
  )
}

function formatSyncAge(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000))
  if (sec < 60) return `SYNCED ${sec}S AGO`
  const min = Math.floor(sec / 60)
  if (min < 60) return `SYNCED ${min}M AGO`
  return `SYNCED ${Math.floor(min / 60)}H AGO`
}

function formatCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const days = Math.floor(totalSec / 86_400)
  const h = Math.floor((totalSec % 86_400) / 3_600)
  const m = Math.floor((totalSec % 3_600) / 60)
  const s = totalSec % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (days > 0) return `${days}D ${pad(h)}:${pad(m)}:${pad(s)}`
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}
