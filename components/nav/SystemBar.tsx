'use client'

// T-67: the OS Shell system bar (PRD 6.7 W1). Persistent ambient state on
// every authenticated screen: live sync ticker, per-league health dots,
// next-deadline countdown, mode chip, ⌘K affordance. Polls
// /api/system/status once a minute; the 1-second ticker in between renders
// "Synced Xs ago" and the countdown from data it already has — no extra
// requests. Desktop shows everything; mobile condenses to
// sync + dots + countdown + mode (⌘K becomes a FAB in T-70).

import { useEffect, useRef, useState } from 'react'
import { type Mode, ModeButton, ModeSwitcher } from './AppShell'
import type { LeagueHealthStatus, SystemStatus } from '@/types'

const POLL_INTERVAL_MS = 60_000

const DOT_COLOR: Record<LeagueHealthStatus, string> = {
  healthy: '#4CAF72',
  monitor: '#F59E0B',
  action: '#E84040',
  unknown: '#3A5A7A',
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
    ? 'Syncing…'
    : lastSyncAt !== null
      ? formatSyncAge(now - lastSyncAt)
      : 'Offline'

  const deadline = status?.nextDeadline ?? null
  const deadlineMs = deadline ? new Date(deadline.at).getTime() - now : null

  return (
    <>
      <div
        className="flex items-center gap-3 md:gap-5 px-3 md:px-4 flex-shrink-0"
        style={{
          backgroundColor: '#0A1520',
          borderBottom: '1px solid #1A3048',
          height: '40px',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {/* Wordmark — desktop only (mobile keeps every pixel for state) */}
        <span className="hidden md:flex items-baseline flex-shrink-0">
          <span className="text-white font-bold tracking-[0.15em] text-xs">ROSTIRO</span>
          <span
            className="ml-1.5 text-[9px] font-bold tracking-[0.1em] px-1 rounded"
            style={{ color: '#378ADD', border: '1px solid #378ADD66' }}
          >
            OS
          </span>
        </span>

        {/* Sync state */}
        <span className="flex items-center gap-1.5 text-xs flex-shrink-0" style={{ color: '#5A7A9A' }}>
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor: syncing ? '#378ADD' : '#4CAF72',
              boxShadow: syncing ? '0 0 5px #378ADD' : '0 0 5px #4CAF7280',
            }}
          />
          <span className="hidden sm:inline">{syncLabel}</span>
        </span>

        {/* League health dots */}
        {status && status.leagues.length > 0 && (
          <span className="flex items-center gap-2">
            <span
              className="hidden md:inline text-[10px] font-semibold tracking-[0.12em] uppercase"
              style={{ color: '#3A5A7A' }}
            >
              Leagues
            </span>
            {status.leagues.map((l) => (
              <span key={l.id} className="relative group">
                <span
                  className="block w-2 h-2 rounded-full cursor-default"
                  style={{ backgroundColor: DOT_COLOR[l.health.status] }}
                />
                <span
                  className="hidden group-hover:block absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] px-2.5 py-1.5 rounded-lg z-50"
                  style={{
                    backgroundColor: '#071019',
                    border: '1px solid #1A3048',
                    color: 'white',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  }}
                >
                  {l.name} · {l.health.score !== null ? l.health.score : '—'}
                </span>
              </span>
            ))}
          </span>
        )}

        <span className="flex-1" />

        {/* Deadline countdown */}
        {deadline && deadlineMs !== null && deadlineMs > 0 && (
          <span className="flex items-center gap-2 text-xs flex-shrink-0">
            <span
              className="text-[10px] font-bold tracking-[0.1em] uppercase truncate max-w-28 md:max-w-none"
              style={{ color: '#F59E0B' }}
            >
              {deadline.label} · {deadline.leagueName}
            </span>
            <span className="font-mono text-xs text-white">{formatCountdown(deadlineMs)}</span>
          </span>
        )}

        {/* Mode chip */}
        <ModeButton mode={mode} onClick={() => setSwitcherOpen(true)} />

        {/* ⌘K affordance — palette itself lands in T-70; this dispatches the
            event it will listen for so the wiring is already in place. */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('rostiro:open-command-palette'))}
          className="hidden md:flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg transition-all"
          style={{ color: '#5A7A9A', border: '1px solid #1A3048', backgroundColor: '#0D1B2A' }}
        >
          Command
          <kbd
            className="font-mono text-[10px] px-1 rounded"
            style={{ backgroundColor: '#0A1520', border: '1px solid #1A3048', color: '#3A5A7A' }}
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
  if (sec < 60) return `Synced ${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `Synced ${min}m ago`
  return `Synced ${Math.floor(min / 60)}h ago`
}

function formatCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const days = Math.floor(totalSec / 86_400)
  const h = Math.floor((totalSec % 86_400) / 3_600)
  const m = Math.floor((totalSec % 3_600) / 60)
  const s = totalSec % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  if (days > 0) return `${days}d ${pad(h)}:${pad(m)}:${pad(s)}`
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}
