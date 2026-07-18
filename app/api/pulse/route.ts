// Packet 03, P3-8B: the platform-neutral Pulse endpoint. Generation lives
// in lib/pulse.ts (shared with /api/cron/pulse and the legacy
// /api/pulse/sleeper alias, which now just re-exports this file's GET —
// see that route's own comment); this route builds fresh items, syncs
// them into pulse_items by fingerprint, then serves the DB state — so
// done/dismissed/snoozed survive every refresh instead of resurrecting.
//
// "sleeper" in the old route's name was already misleading before this
// commit (buildPulseItemsForUser has generated real ESPN items since
// P3-8) — this route is the one new code and the UI should call going
// forward. /api/pulse/sleeper remains only as a temporary compatibility
// alias for any caller not yet migrated.
//
// Graceful degradation: until migration_os_shell.sql is run, the pulse
// persistence columns don't exist. syncPulseItems detects that and this
// route falls back to serving the built items live (persistent: false),
// the exact pre-T-69 behavior.

import { createAdminClient, createSSRClient } from '@/lib/supabase'
import {
  buildPulseItemsForUser,
  builtToPulseItem,
  rowToPulseItem,
  syncPulseItems,
  type BuiltPulseItem,
  type PulseItemRow,
  type PulseLeagueCoverageEntry,
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

  // P3-8B: coverage is returned even when there's nothing else to show —
  // an unavailable/stale ESPN league must not look identical to "no
  // leagues connected" or "nothing needs attention."
  const coverage: PulseLeagueCoverageEntry[] = built.coverage

  if (built.leagueCount === 0) {
    return NextResponse.json({
      items: [], leagueCount: 0, doneToday: 0, estMinutes: 0, firstName, persistent: false, coverage,
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
      // layer='action', not "has a fingerprint" — mission_complete is a real
      // Action-layer card (T-93/6.12 calls it "a calm summary card," not an
      // interrupt) but is deliberately inserted with NO fingerprint (see
      // engagementTriggers.ts's insertPulseItem comment: a fingerprint would
      // let this rebuild's stale-cleanup silently delete it). Filtering on
      // fingerprint instead of layer meant mission_complete could never
      // appear here at all — found while verifying the Game Day engagement
      // scenarios actually surface where the PRD says they should.
      admin
        .from('pulse_items')
        .select('id, user_id, type, priority, headline, reasoning, affected_leagues_json, deadline, action_url, platform, status, created_at')
        .eq('user_id', user.id)
        .eq('status', 'open')
        .eq('layer', 'action'),
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
    coverage,
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
