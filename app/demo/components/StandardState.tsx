'use client'
import { useMemo } from 'react'
import { demoHealth } from '../lib/demoHealth'
import { buildPulseFeed, type DemoPulseItem, type DemoPulsePriority, type DemoPulseType } from '../lib/pulseFeed'

// Mirrors the production Pulse palette (app/(dashboard)/pulse TYPE_CONFIG /
// PRIORITY_COLOR) so the demo cards read identically to real decisions.
const TYPE_LABEL: Record<DemoPulseType, { color: string; label: string }> = {
  injury_alert:      { color: 'var(--crit)',   label: 'INJURY' },
  lineup_decision:   { color: 'var(--signal)', label: 'START/SIT' },
  waiver_alert:      { color: 'var(--live)',   label: 'WAIVER' },
  trade_opportunity: { color: 'var(--signal)', label: 'TRADE' },
  opponent_intel:    { color: 'var(--t2)',     label: 'INTEL' },
}
const PRIORITY_COLOR: Record<DemoPulsePriority, string> = {
  critical: 'var(--crit)', important: 'var(--warn)', info: 'var(--signal)',
}
const PRIORITY_GLOW: Record<DemoPulsePriority, string> = {
  critical: '0 0 10px rgba(232,80,74,.8)', important: '0 0 10px rgba(245,166,35,.7)', info: '0 0 10px rgba(75,163,245,.6)',
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function PulseCard({ item, isFirst }: { item: DemoPulseItem; isFirst: boolean }) {
  const conf = TYPE_LABEL[item.type]
  return (
    <article className="glass card-hover relative rounded-xl cursor-pointer px-4 py-3 pl-[18px]">
      <span
        aria-hidden="true"
        className="absolute left-0 top-2.5 bottom-2.5 w-[2.5px] rounded-full"
        style={{ backgroundColor: PRIORITY_COLOR[item.priority], boxShadow: PRIORITY_GLOW[item.priority] }}
      />
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <p className="font-semibold leading-tight text-[13.5px]" style={{ color: 'var(--t1)' }}>{item.headline}</p>
          <p className="mono-data text-[10px] mt-1" style={{ color: 'var(--t3)' }}>
            {item.leagueName.toUpperCase()}{item.platform ? ` · ${item.platform.toUpperCase()}` : ''}
          </p>
        </div>
        <span
          className="mono-data text-[8.5px] tracking-[0.16em] px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ color: conf.color, backgroundColor: 'color-mix(in srgb, currentColor 12%, transparent)' }}
        >
          {conf.label}
        </span>
      </div>
      <p className="text-[12.5px] mt-2 leading-normal" style={{ color: 'var(--t2)', maxWidth: '60ch' }}>{item.reasoning}</p>
      <div className="flex items-center justify-between gap-2 mt-2.5 flex-wrap">
        <div className="flex items-center gap-1.5">
          {item.actionUrl && (
            <span className="mono-data text-[10.5px] px-2.5 py-1 rounded-[7px]" style={{ color: 'var(--signal)', border: '1px solid rgba(75,163,245,.35)' }}>Open ↗</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="mono-data text-[10.5px] px-2.5 py-1 rounded-[7px]" style={{ color: 'var(--live)', border: '1px solid rgba(67,192,119,.35)' }}>✓ Done</span>
          <span className="mono-data text-[10.5px] px-2.5 py-1 rounded-[7px]" style={{ color: 'var(--t2)', border: '1px solid var(--hairline)' }}>Snooze</span>
          <span className="mono-data text-[10.5px] px-2 py-1 rounded-[7px]" style={{ color: 'var(--t3)' }}>✕</span>
        </div>
      </div>
      {isFirst && null}
    </article>
  )
}

export function StandardState({ items: itemsProp, leagueCount = 1 }: { items?: DemoPulseItem[]; leagueCount?: number } = {}) {
  const hr = useMemo(() => demoHealth(), [])
  const items = useMemo(() => itemsProp ?? buildPulseFeed(hr), [hr, itemsProp])
  const estMinutes = items.length * 2

  return (
    <div className="max-w-2xl mx-auto px-5 md:px-6 pt-8 pb-10">
      <div className="mb-5">
        <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: 'var(--t1)' }}>
          {greeting()}, {hr.founder.handle.split(' ')[0]}.
        </h1>
        <p className="text-[13px] mt-0.5" style={{ color: 'var(--t2)' }}>
          <b style={{ color: 'var(--t1)', fontWeight: 600 }}>{items.length} {items.length === 1 ? 'decision' : 'decisions'}</b>
          {` across ${leagueCount} ${leagueCount === 1 ? 'league' : 'leagues'}`}
          {estMinutes > 0 && <> · Est. <b style={{ color: 'var(--t1)', fontWeight: 600 }}>{estMinutes} min</b></>}
        </p>
        <div className="mono-data mt-3.5 flex items-center gap-3 text-[10px] tracking-[0.1em]" style={{ color: 'var(--t3)' }}>
          <span>TODAY</span>
          <div className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(90,150,210,.12)' }}>
            <div className="h-full rounded-full" style={{ width: '0%', background: 'linear-gradient(90deg, var(--signal), #6FC7FF)', boxShadow: '0 0 10px rgba(75,163,245,.6)' }} />
          </div>
          <span>0 / {items.length}</span>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item, i) => (
          <PulseCard key={item.id} item={item} isFirst={i === 0} />
        ))}
      </div>
    </div>
  )
}
