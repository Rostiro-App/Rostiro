// T-69: Pulse — persistent and actionable. Generation lives in lib/pulse.ts
// (shared with /api/cron/pulse); this route builds fresh items, syncs them
// into pulse_items by fingerprint, then serves the DB state — so done/
// dismissed/snoozed survive every refresh instead of resurrecting.
//
// Graceful degradation: until migration_os_shell.sql is run, the pulse
// persistence columns don't exist. syncPulseItems detects that and this
// route falls back to serving the built items live (persistent: false), the
// exact pre-T-69 behavior.

import { createAdminClient, createSSRClient } from '@/lib/supabase'
import {
  buildPulseItemsForUser,
  builtToPulseItem,
  rowToPulseItem,
  syncPulseItems,
  type BuiltPulseItem,
  type PulseItemRow,
} from '@/lib/pulse'
import { NextResponse } from 'next/server'
import type { PulseItem, PulsePriority } from '@/types'

// Honest per-item effort estimate for the morning header — a decision takes
// a couple of minutes, an FYI takes a glance.
const EST_MINUTES: Record<PulsePriority, number> = { critical: 3, important: 2, info: 1 }

export async function GET() {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const fullName = typeof meta.full_name === 'string' ? meta.full_name : null
  const firstName = fullName ? fullName.split(' ')[0] : null

  let built
  try {
    built = await buildPulseItemsForUser(supabase, user.id)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to build Pulse'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  if (built.leagueCount === 0) {
    return NextResponse.json({
      items: [], leagueCount: 0, doneToday: 0, estMinutes: 0, firstName, persistent: false,
    })
  }

  const admin = createAdminClient()
  const persistent = await syncSafely(admin, user.id, built.items)

  let items: PulseItem[]
  let doneToday = 0

  if (persistent) {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const [{ data: openRows }, { count }] = await Promise.all([
      admin
        .from('pulse_items')
        .select('id, user_id, type, priority, headline, reasoning, affected_leagues_json, deadline, action_url, platform, status, created_at')
        .eq('user_id', user.id)
        .eq('status', 'open')
        .not('fingerprint', 'is', null),
      admin
        .from('pulse_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'done')
        .gte('completed_at', startOfToday.toISOString()),
    ])

    items = ((openRows ?? []) as PulseItemRow[]).map(rowToPulseItem)
    const PRIORITY_RANK: Record<PulsePriority, number> = { critical: 0, important: 1, info: 2 }
    items.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
    doneToday = count ?? 0
  } else {
    items = built.items.map((b) => builtToPulseItem(b, user.id))
  }

  const estMinutes = items.reduce((sum, item) => sum + EST_MINUTES[item.priority], 0)

  return NextResponse.json({
    items,
    leagueCount: built.leagueCount,
    doneToday,
    estMinutes,
    firstName,
    persistent,
  })
}

async function syncSafely(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  items: BuiltPulseItem[]
): Promise<boolean> {
  try {
    return await syncPulseItems(admin, userId, items)
  } catch {
    return false
  }
}
