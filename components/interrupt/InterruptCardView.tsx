'use client'
import type { PulsePriority, InterruptMetricRow } from '@/types'

export function InterruptCardView({
  typeLabel, headline, reasoning, color, priority,
  onSnooze, onDismiss, leaving, contained, metrics,
}: {
  typeLabel: string
  headline: string
  reasoning: string
  color: string
  priority: PulsePriority
  onSnooze?: () => void
  onDismiss?: () => void
  leaving?: boolean
  contained?: boolean
  metrics?: InterruptMetricRow[]
}) {
  const pos = contained ? 'absolute' : 'fixed'
  const width = contained ? 'min(420px, calc(100% - 24px))' : 'min(360px, calc(100vw - 24px))'
  return (
    <div
      className={`glass-heavy rounded-xl px-4 py-3 ${leaving ? 'card-leave' : 'panel-enter'}`}
      style={{ position: pos, top: '52px', left: '50%', transform: 'translateX(-50%)', width, zIndex: 40,
        borderLeft: `2.5px solid ${color}`, boxShadow: `0 12px 32px rgba(0,0,0,.35), 0 0 20px ${color}22` }}
      role={priority === 'critical' ? 'alert' : 'status'}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="mono-data text-[9px] tracking-[0.16em]" style={{ color }}>{typeLabel}</span>
        {priority === 'critical' && (
          <div className="flex items-center gap-2.5 -mt-0.5">
            <button onClick={onSnooze} aria-label="Snooze for 24 hours" className="text-[10px] font-semibold tracking-wide uppercase hover:brightness-125" style={{ color: 'var(--t3)' }}>Snooze</button>
            <button onClick={onDismiss} aria-label="Dismiss" className="text-[13px] leading-none" style={{ color: 'var(--t3)' }}>✕</button>
          </div>
        )}
      </div>
      <p className="text-[13px] font-semibold mt-1" style={{ color: 'var(--t1)' }}>{headline}</p>
      {metrics && metrics.length > 0 ? (
        <div className="mt-2.5">
          <div className="flex items-end gap-5">
            {metrics.map((m, i) => (
              <span key={i} className="mono-data text-[26px] font-bold leading-none" style={{ color: m.deltaPositive === false ? 'var(--crit)' : 'var(--live)' }}>
                <span aria-hidden="true">{m.deltaPositive === false ? '▼' : '▲'} </span><span>{m.value}</span>
              </span>
            ))}
          </div>
          <div className="mono-data text-[8.5px] tracking-[0.16em] mt-2 pt-2" style={{ color: 'var(--t3)', borderTop: '1px solid var(--hairline)' }}>
            {metrics.length} OF YOUR {metrics.length === 1 ? 'LEAGUE' : 'LEAGUES'}
          </div>
          <div className="mt-1.5 space-y-1">
            {metrics.map((m, i) => (
              <div key={i} className="flex items-center justify-between text-[12px]">
                <span style={{ color: 'var(--t1)' }}>{m.leagueName}</span>
                <span className="mono-data" style={{ color: 'var(--t2)' }}><span>{m.label}</span> · {m.value}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        reasoning ? <p className="text-[12px] mt-1 leading-snug" style={{ color: 'var(--t2)' }}>{reasoning}</p> : null
      )}
    </div>
  )
}
