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

  const { data, error } = await supabase
    .from('pulse_items')
    .select('id, user_id, type, priority, headline, reasoning, affected_leagues_json, deadline, action_url, platform, status, created_at')
    .eq('user_id', user.id)
    .eq('layer', 'interrupt')
    .eq('status', 'open')
    .order('created_at', { ascending: true })

  if (error) {
    // 42703 = the layer column doesn't exist yet (migration_interrupt_layer.sql
    // not run) — degrade to an empty stack rather than a broken page; nothing
    // downstream depends on this succeeding.
    if (error.code === '42703') return NextResponse.json({ items: [] })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const items = ((data ?? []) as PulseItemRow[])
    .map(rowToPulseItem)
    .sort((a, b) => (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2))

  return NextResponse.json({ items })
}
