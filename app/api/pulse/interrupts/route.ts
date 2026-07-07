// T-106 / PRD 7.1: the Interrupt layer — transient, "one persistent
// interrupt slot at a time," rendered by components/InterruptStack.tsx on
// every authenticated page (not just Pulse). Distinct from /api/pulse/sleeper,
// which serves the persistent Action-layer decision queue. Ordered so a P0
// (critical, e.g. lineup-lock) always pre-empts a P1 (touchdown swing) if
// both are somehow open at once — the stack only ever renders items[0].

import { createSSRClient } from '@/lib/supabase'
import { rowToPulseItem, type PulseItemRow } from '@/lib/pulse'
import { NextResponse } from 'next/server'

const PRIORITY_RANK: Record<string, number> = { critical: 0, important: 1, info: 2 }

export async function GET() {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const nowIso = new Date().toISOString()

  // T-144: a snoozed interrupt (PATCH /api/pulse/items/[id] with
  // action: 'snooze', same endpoint the persistent Action-layer queue
  // already used — no new column, no new table) wakes back up here once
  // snoozed_until has passed, same as it always has for the ordinary
  // queue's own read path.
  const { data, error } = await supabase
    .from('pulse_items')
    .select('id, user_id, type, priority, headline, reasoning, affected_leagues_json, deadline, action_url, platform, status, snoozed_until, created_at')
    .eq('user_id', user.id)
    .eq('layer', 'interrupt')
    .or(`status.eq.open,and(status.eq.snoozed,snoozed_until.lte.${nowIso})`)
    .order('created_at', { ascending: true })

  if (error) {
    // 42703 = the layer column doesn't exist yet (migration_interrupt_layer.sql
    // not run) — degrade to an empty stack rather than a broken page; nothing
    // downstream depends on this succeeding.
    if (error.code === '42703' || error.code === 'PGRST204') return NextResponse.json({ items: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const items = ((data ?? []) as (PulseItemRow & { snoozed_until: string | null })[])
    // A woken snoozed item reads as 'open' again — the row itself keeps its
    // real history (status stays 'snoozed' in the DB until the user acts on
    // it again), this is a read-time presentation only.
    .map((row) => rowToPulseItem(row.status === 'snoozed' ? { ...row, status: 'open' } : row))
    .sort((a, b) => (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2))

  return NextResponse.json({ items })
}
