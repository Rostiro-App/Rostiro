'use client'

// T-59: Real Sleeper data via /api/pulse/sleeper. ESPN and Yahoo join once
// T-10/T-09 (credential end-to-end tests) pass — see T-61/T-62.

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

// ─── Pulse page ────────────────────────────────────────────────────────────────

export default function PulsePage() {
  const mode = useMode()
  const [items, setItems] = useState<PulseItem[]>([])
  const [leagueCount, setLeagueCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch('/api/pulse/sleeper')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load Pulse')
        return res.json()
      })
      .then((data: { items: PulseItem[]; leagueCount: number }) => {
        if (cancelled) return
        setItems(data.items)
        setLeagueCount(data.leagueCount)
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

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-8 md:px-6 md:pt-8">

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-bold text-white tracking-tight">Pulse</h1>
        </div>
        <p className="text-sm mt-0.5" style={{ color: '#5A7A9A' }}>
          {leagueCount > 0
            ? `${leagueCount} ${leagueCount === 1 ? 'league' : 'leagues'} · Sleeper`
            : 'No leagues connected yet'}
        </p>
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
      {!loading && !error && leagueCount > 0 && items.length === 0 && <AllClearState />}
      {!loading && !error && items.length > 0 && (
        <div className={mode === 'focused' ? 'space-y-2' : 'space-y-3'}>
          {items.map((item) => (
            <PulseCard key={item.id} item={item} mode={mode} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── PulseCard — renders differently per mode ─────────────────────────────────

function PulseCard({ item, mode }: { item: PulseItem; mode: Mode }) {
  const border = PRIORITY_BORDER[item.priority]
  const typeConf = TYPE_CONFIG[item.type]

  if (mode === 'focused') return <FocusedCard item={item} border={border} typeConf={typeConf} />
  if (mode === 'savant')  return <SavantCard  item={item} border={border} typeConf={typeConf} />
  return                         <BalancedCard item={item} border={border} typeConf={typeConf} />
}

type CardProps = {
  item: PulseItem
  border: string
  typeConf: { symbol: string; color: string; label: string }
}

function leagueLabel(item: PulseItem): string {
  if (item.affectedLeagues.length === 1) return item.affectedLeagues[0].leagueName
  return `${item.affectedLeagues.length} leagues`
}

// Focused — one line, no extra data
function FocusedCard({ item, border, typeConf }: CardProps) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl"
      style={{ backgroundColor: '#0A1520', border: '1px solid #1A3048', borderLeft: `3px solid ${border}` }}
    >
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
  )
}

// Balanced — headline + reasoning + action
function BalancedCard({ item, border, typeConf }: CardProps) {
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

      {item.actionUrl && (
        <div className="ml-7">
          <a
            href={item.actionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:brightness-110 text-white"
            style={{ backgroundColor: '#378ADD' }}
          >
            Open in Sleeper →
          </a>
        </div>
      )}
    </div>
  )
}

// Savant — everything visible, no hidden data
function SavantCard({ item, border, typeConf }: CardProps) {
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

      <div className="ml-7 mt-3 flex items-center gap-3">
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
          {new Date(item.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </span>
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
    <div className="rounded-xl p-6 text-center" style={{ backgroundColor: '#0A1520', border: '1px solid #1A3048' }}>
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

function AllClearState() {
  return (
    <div className="rounded-xl p-6 text-center" style={{ backgroundColor: '#0A1520', border: '1px solid #1A3048' }}>
      <p className="text-sm font-medium text-white">Nothing needs you right now.</p>
      <p className="text-sm mt-1" style={{ color: '#5A7A9A' }}>
        No injuries on your rosters and no standout waiver adds. Check back later.
      </p>
    </div>
  )
}
