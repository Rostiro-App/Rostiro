'use client'

// T-106 / PRD 7.1: the Interrupt layer — "one persistent interrupt slot at
// a time," visible on every authenticated page (mounted once in AppShell),
// not just Pulse. Only two trigger types route here today: touchdown_swing
// (P1, auto-dismiss) and lineup_lock (P0, persists until manually
// dismissed). mission_complete deliberately stays in the ordinary Pulse
// queue — 6.12 itself calls it a settled summary card, not an interrupt.
//
// Renders only items[0] — a second queued interrupt waits its turn rather
// than stacking, which is the whole point of this component existing.

import { useEffect, useRef, useState } from 'react'
import type { PulseItem, PulseItemType, PulsePriority } from '@/types'
import { logTelemetryEvent } from '@/lib/telemetry'
import { InterruptCardView } from '@/components/interrupt/InterruptCardView'

const POLL_MS = 30_000
const AUTO_DISMISS_MS = 7_000

const PRIORITY_COLOR: Record<PulsePriority, string> = {
  critical: 'var(--crit)',
  important: 'var(--warn)',
  info: 'var(--signal)',
}

const TYPE_LABEL: Partial<Record<PulseItemType, string>> = {
  touchdown_swing: 'TOUCHDOWN',
  lineup_lock: 'LINEUP LOCK',
}

export default function InterruptStack() {
  const [items, setItems] = useState<PulseItem[]>([])
  const [leaving, setLeaving] = useState(false)
  const autoDismissRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    async function poll() {
      try {
        const res = await fetch('/api/pulse/interrupts')
        if (!res.ok) return
        const data: { items: PulseItem[] } = await res.json()
        if (!cancelled) setItems(data.items)
      } catch {
        // Ambient — a failed poll just leaves the stack as it was.
      }
    }
    poll()
    const t = setInterval(poll, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])

  const current = items[0] ?? null

  useEffect(() => {
    if (autoDismissRef.current) {
      window.clearTimeout(autoDismissRef.current)
      autoDismissRef.current = null
    }
    setLeaving(false)
    if (!current) return
    // T-100: "P0 alert action rate" (7.1) — shown is the denominator;
    // a critical interrupt never auto-dismisses, so any interrupt_action
    // logged for one is always a real user response, never a timeout.
    logTelemetryEvent('interrupt_shown', { type: current.type, priority: current.priority })
    if (current.priority === 'critical') return
    autoDismissRef.current = window.setTimeout(() => dismiss(current.id, 'auto'), AUTO_DISMISS_MS)
    return () => {
      if (autoDismissRef.current) window.clearTimeout(autoDismissRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id])

  function dismiss(id: string, trigger: 'manual' | 'auto' = 'manual') {
    const item = items.find((i) => i.id === id)
    if (item) logTelemetryEvent('interrupt_action', { type: item.type, priority: item.priority, action: 'dismiss', trigger })
    setLeaving(true)
    window.setTimeout(() => {
      setItems((prev) => prev.filter((i) => i.id !== id))
      setLeaving(false)
    }, 340)
    fetch(`/api/pulse/items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dismiss' }),
    }).catch(() => {})
  }

  // T-144: same PATCH action the persistent Action-layer queue already
  // used (app/api/pulse/items/[id]/route.ts) — a critical interrupt like
  // lineup_lock persists until acted on, so unlike dismiss (gone for good)
  // this brings it back in 24h via /api/pulse/interrupts' own read-time
  // revival check, rather than losing it entirely.
  function snooze(id: string) {
    const item = items.find((i) => i.id === id)
    if (item) logTelemetryEvent('interrupt_action', { type: item.type, priority: item.priority, action: 'snooze', trigger: 'manual' })
    setLeaving(true)
    window.setTimeout(() => {
      setItems((prev) => prev.filter((i) => i.id !== id))
      setLeaving(false)
    }, 340)
    fetch(`/api/pulse/items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'snooze' }),
    }).catch(() => {})
  }

  if (!current) return null

  const color = PRIORITY_COLOR[current.priority]
  const typeLabel = TYPE_LABEL[current.type] ?? current.type.toUpperCase()

  return (
    <InterruptCardView
      key={current.id}
      typeLabel={typeLabel}
      headline={current.headline}
      reasoning={current.reasoning}
      metrics={current.metrics}
      color={color}
      priority={current.priority}
      leaving={leaving}
      onSnooze={() => snooze(current.id)}
      onDismiss={() => dismiss(current.id)}
    />
  )
}
