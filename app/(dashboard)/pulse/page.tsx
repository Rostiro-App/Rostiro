'use client'

// T-69: Pulse is now persistent and actionable. The feed comes from
// pulse_items (synced by fingerprint server-side), the header frames the day
// as a work queue ("N decisions · est X min"), and every card can be marked
// done, snoozed, or dismissed — state that survives refreshes and the daily
// cron. Until migration_os_shell.sql is run the API reports
// persistent: false and the action buttons stay hidden (live-only mode,
// identical to pre-T-69 behavior).

import { useEffect, useState } from 'react'
import { useMode, type Mode } from '@/components/nav/AppShell'
import type { PulseItem, PulseItemType, PulsePriority } from '@/types'

// ─── Priority + type config ────────────────────────────────────────────────────

const PRIORITY_BORDER: Record<PulsePriority, string> = {
  critical: '#E84040',
  important: '#F59E0B',
  info: '#378ADD',
}

const TYPE_CONFIG: Record<PulseItemType, { symbol: string; color: string; label: string }> = {
  injury_alert:      { symbol: '⚠', color: '#E84040', label: 'INJURY' },
  lineup_decision:   { symbol: '⚡', color: '#378ADD', label: 'START/SIT' },
  waiver_alert:      { symbol: '↑', color: '#4CAF72', label: 'WAIVER' },
  weather_alert:     { symbol: '⛈', color: '#F59E0B', label: 'WEATHER' },
  trade_opportunity: { symbol: '⇄', color: '#378ADD', label: 'TRADE' },
  opponent_intel:    { symbol: '◎', color: '#8AAABB', label: 'INTEL' },
  deadline_reminder: { symbol: '◷', color: '#F59E0B', label: 'DEADLINE' },
  exposure_flag:     { symbol: '▲', color: '#E84040', label: 'EXPOSURE' },
}

type PulseAction = 'done' | 'dismiss' | 'snooze'

interface PulseResponse {
  items: PulseItem[]
  leagueCount: number
  doneToday: number
  estMinutes: number
  firstName: string | null
  persistent: boolean
}

// ─── Pulse page ────────────────────────────────────────────────────────────────

export default function PulsePage() {
  const mode = useMode()
  const [items, setItems] = useState<PulseItem[]>([])
  const [leagueCount, setLeagueCount] = useState(0)
  const [doneToday, setDoneToday] = useState(0)
  const [estMinutes, setEstMinutes] = useState(0)
  const [firstName, setFirstName] = useState<string | null>(null)
  const [persistent, setPersistent] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch('/api/pulse/sleeper')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load Pulse')
        return res.json()
      })
      .then((data: PulseResponse) => {
        if (cancelled) return
        setItems(data.items)
        setLeagueCount(data.leagueCount)
        setDoneToday(data.doneToday)
        setEstMinutes(data.estMinutes)
        setFirstName(data.firstName)
        setPersistent(data.persistent)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function handleAction(item: PulseItem, action: PulseAction) {
    // Optimistic: the card leaves the queue immediately; on failure it
    // comes back with the error surfaced.
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    if (action === 'done') setDoneToday((n) => n + 1)

    try {
      const res = await fetch(`/api/pulse/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setItems((prev) => [item, ...prev])
      if (action === 'done') setDoneToday((n) => Math.max(0, n - 1))
      setError('Could not update that item — try again.')
      setTimeout(() => setError(null), 4000)
    }
  }

  const totalToday = items.length + doneToday

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-8 md:px-6 md:pt-8">

      {/* Morning header — the day framed as a finite work queue */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">
          {greeting()}{firstName ? `, ${firstName}` : ''}.
        </h1>
        <p className="text-sm mt-0.5" style={{ color: '#5A7A9A' }}>
          {leagueCount === 0
            ? 'No leagues connected yet'
            : items.length === 0
              ? `All clear across ${leagueCount} ${leagueCount === 1 ? 'league' : 'leagues'}`
              : `${items.length} ${items.length === 1 ? 'decision' : 'decisions'} across ${leagueCount} ${leagueCount === 1 ? 'league' : 'leagues'}${estMinutes > 0 ? ` · Est. ${estMinutes} min` : ''}`}
        </p>

        {persistent && totalToday > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold tracking-wider" style={{ color: '#3A5A7A' }}>
                TODAY&apos;S PROGRESS
              </span>
              <span className="text-[11px]" style={{ color: '#5A7A9A', fontVariantNumeric: 'tabular-nums' }}>
                {doneToday} / {totalToday}
              </span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: '#1A3048' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.round((doneToday / totalToday) * 100)}%`,
                  backgroundColor: doneToday === totalToday ? '#4CAF72' : '#378ADD',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Mode label — only show in Focused so user knows what they're seeing */}
      {mode === 'focused' && items.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <div className="h-px flex-1" style={{ backgroundColor: '#1A3048' }} />
          <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#3A5A7A' }}>
            {items.length} items · Focused
          </span>
          <div className="h-px flex-1" style={{ backgroundColor: '#1A3048' }} />
        </div>
      )}

      {/* Body */}
      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} />}
      {!loading && !error && leagueCount === 0 && <NoLeaguesState />}
      {!loading && !error && leagueCount > 0 && items.length === 0 && (
        <AllClearState doneToday={doneToday} />
      )}
      {!loading && items.length > 0 && (
        <div className={mode === 'focused' ? 'space-y-2' : 'space-y-3'}>
          {items.map((item) => (
            <PulseCard
              key={item.id}
              item={item}
              mode={mode}
              onAction={persistent ? handleAction : null}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

// ─── PulseCard — renders differently per mode ─────────────────────────────────

type ActionHandler = ((item: PulseItem, action: PulseAction) => void) | null

function PulseCard({ item, mode, onAction }: { item: PulseItem; mode: Mode; onAction: ActionHandler }) {
  const border = PRIORITY_BORDER[item.priority]
  const typeConf = TYPE_CONFIG[item.type]

  if (mode === 'focused') return <FocusedCard item={item} border={border} typeConf={typeConf} onAction={onAction} />
  if (mode === 'savant')  return <SavantCard  item={item} border={border} typeConf={typeConf} onAction={onAction} />
  return                         <BalancedCard item={item} border={border} typeConf={typeConf} onAction={onAction} />
}

type CardProps = {
  item: PulseItem
  border: string
  typeConf: { symbol: string; color: string; label: string }
  onAction: ActionHandler
}

function leagueLabel(item: PulseItem): string {
  if (item.affectedLeagues.length === 1) return item.affectedLeagues[0].leagueName
  return `${item.affectedLeagues.length} leagues`
}

// Done / Snooze / Dismiss — hidden entirely in live-only mode (onAction null)
function ActionRow({ item, onAction }: { item: PulseItem; onAction: ActionHandler }) {
  if (!onAction) return null
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => onAction(item, 'done')}
        className="text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all hover:brightness-110"
        style={{ backgroundColor: '#4CAF7222', color: '#4CAF72' }}
      >
        ✓ Done
      </button>
      <button
        onClick={() => onAction(item, 'snooze')}
        className="text-xs px-2.5 py-1.5 rounded-lg transition-all hover:brightness-110"
        style={{ backgroundColor: '#0F2235', color: '#5A7A9A', border: '1px solid #1A3048' }}
      >
        Snooze
      </button>
      <button
        onClick={() => onAction(item, 'dismiss')}
        className="text-xs px-2.5 py-1.5 rounded-lg transition-all hover:brightness-110"
        style={{ backgroundColor: 'transparent', color: '#3A5A7A' }}
      >
        ✕
      </button>
    </div>
  )
}

// Focused — one line, no extra data
function FocusedCard({ item, border, typeConf, onAction }: CardProps) {
  return (
    <div
      className="px-4 py-3 rounded-xl"
      style={{ backgroundColor: '#0A1520', border: '1px solid #1A3048', borderLeft: `3px solid ${border}` }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-base flex-shrink-0" style={{ color: typeConf.color }}>{typeConf.symbol}</span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{item.headline}</p>
            <p className="text-xs truncate" style={{ color: '#3A5A7A' }}>{leagueLabel(item)}</p>
          </div>
        </div>
        {item.actionUrl && (
          <a
            href={item.actionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap transition-all hover:brightness-110"
            style={{ backgroundColor: '#378ADD22', color: '#378ADD' }}
          >
            View →
          </a>
        )}
      </div>
      {onAction && (
        <div className="mt-2 ml-7">
          <ActionRow item={item} onAction={onAction} />
        </div>
      )}
    </div>
  )
}

// Balanced — headline + reasoning + action
function BalancedCard({ item, border, typeConf, onAction }: CardProps) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ backgroundColor: '#0A1520', border: '1px solid #1A3048', borderLeft: `3px solid ${border}` }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-start gap-2.5">
          <span className="text-base mt-0.5 flex-shrink-0" style={{ color: typeConf.color }}>{typeConf.symbol}</span>
          <div>
            <p className="text-sm font-semibold text-white leading-tight">{item.headline}</p>
            <p className="text-xs mt-0.5" style={{ color: '#3A5A7A' }}>{leagueLabel(item)}</p>
          </div>
        </div>
        <span
          className="text-[10px] font-semibold tracking-widest uppercase px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ backgroundColor: `${typeConf.color}18`, color: typeConf.color }}
        >
          {typeConf.label}
        </span>
      </div>

      <p className="text-sm mb-3 ml-7" style={{ color: '#8AAABB' }}>{item.reasoning}</p>

      <div className="ml-7 flex items-center justify-between gap-2 flex-wrap">
        {item.actionUrl ? (
          <a
            href={item.actionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:brightness-110 text-white"
            style={{ backgroundColor: '#378ADD' }}
          >
            Open in Sleeper →
          </a>
        ) : <span />}
        <ActionRow item={item} onAction={onAction} />
      </div>
    </div>
  )
}

// Savant — everything visible, no hidden data
function SavantCard({ item, border, typeConf, onAction }: CardProps) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ backgroundColor: '#0A1520', border: '1px solid #1A3048', borderLeft: `3px solid ${border}` }}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-start gap-2.5">
          <span className="text-base mt-0.5 flex-shrink-0" style={{ color: typeConf.color }}>{typeConf.symbol}</span>
          <div>
            <p className="text-sm font-bold text-white leading-tight">{item.headline}</p>
            <p className="text-xs mt-0.5" style={{ color: '#3A5A7A' }}>{leagueLabel(item)}</p>
          </div>
        </div>
        <span
          className="text-[10px] font-semibold tracking-widest uppercase px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ backgroundColor: `${typeConf.color}18`, color: typeConf.color }}
        >
          {typeConf.label}
        </span>
      </div>

      <p className="text-sm mt-2 ml-7" style={{ color: '#8AAABB' }}>{item.reasoning}</p>

      <div className="ml-7 mt-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          {item.actionUrl && (
            <a
              href={item.actionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:brightness-110 text-white"
              style={{ backgroundColor: '#378ADD' }}
            >
              Open in Sleeper →
            </a>
          )}
          <span className="text-xs" style={{ color: '#3A5A7A' }}>
            {item.deadline
              ? `Deadline ${new Date(item.deadline).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
              : new Date(item.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </span>
        </div>
        <ActionRow item={item} onAction={onAction} />
      </div>
    </div>
  )
}

// ─── States ────────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-16 rounded-xl animate-pulse"
          style={{ backgroundColor: '#0A1520', border: '1px solid #1A3048' }}
        />
      ))}
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl p-6 text-center mb-3" style={{ backgroundColor: '#0A1520', border: '1px solid #1A3048' }}>
      <p className="text-sm" style={{ color: '#E84040' }}>{message}</p>
    </div>
  )
}

function NoLeaguesState() {
  return (
    <div className="rounded-xl p-6 text-center" style={{ backgroundColor: '#0A1520', border: '1px solid #1A3048' }}>
      <p className="text-sm font-medium text-white">Connect a league to activate Pulse.</p>
      <p className="text-sm mt-1" style={{ color: '#5A7A9A' }}>
        Once a Sleeper league is connected, Rostiro checks it every time you open this page.
      </p>
    </div>
  )
}

function AllClearState({ doneToday }: { doneToday: number }) {
  return (
    <div className="rounded-xl p-6 text-center" style={{ backgroundColor: '#0A1520', border: '1px solid #1A3048' }}>
      <p className="text-sm font-medium text-white">
        {doneToday > 0 ? `Queue cleared — ${doneToday} handled today.` : 'Nothing needs you right now.'}
      </p>
      <p className="text-sm mt-1" style={{ color: '#5A7A9A' }}>
        {doneToday > 0
          ? 'New intelligence lands here as soon as something changes.'
          : 'No injuries on your rosters and no standout waiver adds. Check back later.'}
      </p>
    </div>
  )
}
