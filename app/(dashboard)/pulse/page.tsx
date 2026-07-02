'use client'

import { useMode, type Mode } from '@/components/nav/AppShell'

// ─── Mock data (replaced by /api/pulse/sleeper in T-59) ──────────────────────

type PulseItemType = 'injury' | 'lineup' | 'waiver' | 'weather' | 'bye'
type Priority = 'critical' | 'high' | 'medium' | 'low'

interface MockPulseItem {
  id: string
  type: PulseItemType
  priority: Priority
  leagueName: string
  headline: string
  context: string
  stats: { label: string; value: string }[]
  primaryAction: string
  secondaryAction?: string
  ago: string
}

const MOCK_ITEMS: MockPulseItem[] = [
  {
    id: '1',
    type: 'injury',
    priority: 'critical',
    leagueName: 'Dynasty Kings',
    headline: 'Joe Burrow — Questionable (wrist)',
    context: 'Limited in practice all week. Josh Allen sits on your bench averaging 31.2 pts.',
    stats: [
      { label: 'Burrow proj', value: '14.8' },
      { label: 'Allen proj', value: '28.4' },
      { label: 'BAL vs QB', value: '#8 defense' },
      { label: 'BUF spread', value: 'Fav −7' },
    ],
    primaryAction: 'Start Allen',
    secondaryAction: 'Keep Burrow',
    ago: '2h ago',
  },
  {
    id: '2',
    type: 'lineup',
    priority: 'high',
    leagueName: 'The League',
    headline: 'Start/Sit: Jefferson or Chase?',
    context: 'Both are WR1 options this week. Chase has a wind concern — game in Chicago.',
    stats: [
      { label: 'Jefferson proj', value: '19.4' },
      { label: 'Chase proj', value: '17.1' },
      { label: 'CHI wind', value: '28mph' },
      { label: 'MIN spread', value: 'Fav −4.5' },
    ],
    primaryAction: 'Start Jefferson',
    secondaryAction: 'Start Chase',
    ago: '3h ago',
  },
  {
    id: '3',
    type: 'waiver',
    priority: 'medium',
    leagueName: 'Dynasty Kings',
    headline: 'Zach Moss cleared waivers',
    context: "Mixon's backup with genuine upside. Rostered in 68% of Sleeper leagues.",
    stats: [
      { label: 'Owned', value: '68%' },
      { label: 'Last week', value: '12 car · 56 yds' },
      { label: 'Proj', value: '9.2 pts' },
      { label: 'FAAB est', value: '$8–14' },
    ],
    primaryAction: 'Add Moss',
    secondaryAction: 'Skip',
    ago: '5h ago',
  },
  {
    id: '4',
    type: 'weather',
    priority: 'high',
    leagueName: 'The League',
    headline: 'Wind alert: BUF @ NE — 31mph',
    context: 'Passing game depressed. Stefon Diggs projected down 4.2 pts from baseline.',
    stats: [
      { label: 'Wind', value: '31mph' },
      { label: 'Temp', value: '28°F' },
      { label: 'O/U shift', value: '44.5 → 40.5' },
      { label: 'Diggs adj', value: '−4.2 pts' },
    ],
    primaryAction: 'Adjust lineup',
    ago: '1h ago',
  },
  {
    id: '5',
    type: 'bye',
    priority: 'low',
    leagueName: '2 leagues',
    headline: 'Davante Adams on bye — Week 7',
    context: 'Check the waiver wire for WR depth now — not Sunday morning.',
    stats: [
      { label: 'Week', value: '7 (GB bye)' },
      { label: 'Leagues', value: '2 affected' },
    ],
    primaryAction: 'Browse waivers',
    ago: '6h ago',
  },
]

// ─── Priority + type config ────────────────────────────────────────────────────

const PRIORITY_BORDER: Record<Priority, string> = {
  critical: '#E84040',
  high: '#F59E0B',
  medium: '#378ADD',
  low: '#3A5A7A',
}

const TYPE_CONFIG: Record<PulseItemType, { symbol: string; color: string; label: string }> = {
  injury:  { symbol: '⚠', color: '#E84040', label: 'INJURY' },
  lineup:  { symbol: '⚡', color: '#378ADD', label: 'START/SIT' },
  waiver:  { symbol: '↑', color: '#4CAF72', label: 'WAIVER' },
  weather: { symbol: '⛈', color: '#F59E0B', label: 'WEATHER' },
  bye:     { symbol: '○', color: '#5A7A9A', label: 'BYE' },
}

// ─── Pulse page ────────────────────────────────────────────────────────────────

export default function PulsePage() {
  const mode = useMode()

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-8 md:px-6 md:pt-8">

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-bold text-white tracking-tight">Pulse</h1>
          <span className="text-xs" style={{ color: '#3A5A7A' }}>Synced 2h ago</span>
        </div>
        <p className="text-sm mt-0.5" style={{ color: '#5A7A9A' }}>
          Wednesday, July 2 · 2 leagues · Sleeper
        </p>
      </div>

      {/* Mode label — only show in Savant so user knows what they're seeing */}
      {mode === 'focused' && (
        <div className="mb-4 flex items-center gap-2">
          <div className="h-px flex-1" style={{ backgroundColor: '#1A3048' }} />
          <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#3A5A7A' }}>
            5 items · Focused
          </span>
          <div className="h-px flex-1" style={{ backgroundColor: '#1A3048' }} />
        </div>
      )}

      {/* Feed */}
      <div className={mode === 'focused' ? 'space-y-2' : 'space-y-3'}>
        {MOCK_ITEMS.map((item) => (
          <PulseCard key={item.id} item={item} mode={mode} />
        ))}
      </div>

      {/* Footer note */}
      <p className="text-xs text-center mt-8" style={{ color: '#3A5A7A' }}>
        Live data from Sleeper · Connect Yahoo or ESPN for more leagues
      </p>
    </div>
  )
}

// ─── PulseCard — renders differently per mode ─────────────────────────────────

function PulseCard({ item, mode }: { item: MockPulseItem; mode: Mode }) {
  const border = PRIORITY_BORDER[item.priority]
  const typeConf = TYPE_CONFIG[item.type]

  if (mode === 'focused') return <FocusedCard item={item} border={border} typeConf={typeConf} />
  if (mode === 'savant')  return <SavantCard  item={item} border={border} typeConf={typeConf} />
  return                         <BalancedCard item={item} border={border} typeConf={typeConf} />
}

type CardProps = {
  item: MockPulseItem
  border: string
  typeConf: { symbol: string; color: string; label: string }
}

// Focused — one line, single action, no extra data
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
          <p className="text-xs truncate" style={{ color: '#3A5A7A' }}>
            {item.leagueName} · {item.ago}
          </p>
        </div>
      </div>
      <button
        className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap transition-all hover:brightness-110"
        style={{ backgroundColor: '#378ADD22', color: '#378ADD' }}
      >
        {item.primaryAction} →
      </button>
    </div>
  )
}

// Balanced — headline + context + key stats + two actions
function BalancedCard({ item, border, typeConf }: CardProps) {
  const topStats = item.stats.slice(0, 2)

  return (
    <div
      className="rounded-xl p-4"
      style={{ backgroundColor: '#0A1520', border: '1px solid #1A3048', borderLeft: `3px solid ${border}` }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-start gap-2.5">
          <span className="text-base mt-0.5 flex-shrink-0" style={{ color: typeConf.color }}>{typeConf.symbol}</span>
          <div>
            <p className="text-sm font-semibold text-white leading-tight">{item.headline}</p>
            <p className="text-xs mt-0.5" style={{ color: '#3A5A7A' }}>
              {item.leagueName} · {item.ago}
            </p>
          </div>
        </div>
        <span
          className="text-[10px] font-semibold tracking-widest uppercase px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ backgroundColor: `${typeConf.color}18`, color: typeConf.color }}
        >
          {typeConf.label}
        </span>
      </div>

      {/* Context */}
      <p className="text-sm mb-3 ml-7" style={{ color: '#8AAABB' }}>{item.context}</p>

      {/* Key stats */}
      {topStats.length > 0 && (
        <div className="flex gap-4 ml-7 mb-3">
          {topStats.map((s) => (
            <div key={s.label}>
              <p className="text-xs" style={{ color: '#3A5A7A' }}>{s.label}</p>
              <p className="text-sm font-semibold text-white">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 ml-7">
        <button
          className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:brightness-110 text-white"
          style={{ backgroundColor: '#378ADD' }}
        >
          {item.primaryAction} →
        </button>
        {item.secondaryAction && (
          <button
            className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
            style={{ backgroundColor: '#1A3048', color: '#8AAABB' }}
          >
            {item.secondaryAction}
          </button>
        )}
      </div>
    </div>
  )
}

// Savant — everything: full context, all stats grid, all actions
function SavantCard({ item, border, typeConf }: CardProps) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ backgroundColor: '#0A1520', border: '1px solid #1A3048', borderLeft: `3px solid ${border}` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-start gap-2.5">
          <span className="text-base mt-0.5 flex-shrink-0" style={{ color: typeConf.color }}>{typeConf.symbol}</span>
          <div>
            <p className="text-sm font-bold text-white leading-tight">{item.headline}</p>
            <p className="text-xs mt-0.5" style={{ color: '#3A5A7A' }}>{item.leagueName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className="text-[10px] font-semibold tracking-widest uppercase px-1.5 py-0.5 rounded"
            style={{ backgroundColor: `${typeConf.color}18`, color: typeConf.color }}
          >
            {typeConf.label}
          </span>
          <span className="text-xs" style={{ color: '#3A5A7A' }}>{item.ago}</span>
        </div>
      </div>

      {/* Context */}
      <p className="text-sm mt-2 ml-7" style={{ color: '#8AAABB' }}>{item.context}</p>

      {/* Full stats grid */}
      {item.stats.length > 0 && (
        <div
          className="ml-7 mt-3 grid gap-x-4 gap-y-2 p-3 rounded-lg"
          style={{
            gridTemplateColumns: `repeat(${Math.min(item.stats.length, 4)}, 1fr)`,
            backgroundColor: '#07111C',
            border: '1px solid #1A3048',
          }}
        >
          {item.stats.map((s) => (
            <div key={s.label}>
              <p className="text-[10px] uppercase tracking-widest" style={{ color: '#3A5A7A' }}>{s.label}</p>
              <p className="text-sm font-semibold text-white mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 ml-7 mt-3">
        <button
          className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:brightness-110 text-white"
          style={{ backgroundColor: '#378ADD' }}
        >
          {item.primaryAction} →
        </button>
        {item.secondaryAction && (
          <button
            className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
            style={{ backgroundColor: '#1A3048', color: '#8AAABB' }}
          >
            {item.secondaryAction}
          </button>
        )}
        <button
          className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all ml-auto"
          style={{ color: '#3A5A7A' }}
        >
          Full report →
        </button>
      </div>
    </div>
  )
}
