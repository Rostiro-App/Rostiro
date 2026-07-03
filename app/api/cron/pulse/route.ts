// T-69: Daily Pulse regeneration for every user with a connected league,
// so the feed is already fresh when someone opens the app (and so push
// notifications have something real to send once T-66 wires them up).
// Runs after the players cron (see vercel.json) so injury statuses and ADP
// are today's before items are built from them.

import { createAdminClient } from '@/lib/supabase'
import { buildPulseItemsForUser, syncPulseItems } from '@/lib/pulse'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('connected_leagues')
    .select('user_id')
    .eq('platform', 'sleeper')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const userIds = [...new Set((data ?? []).map((r) => r.user_id as string))]

  let usersSynced = 0
  let itemsBuilt = 0
  let persistenceMissing = false

  for (const userId of userIds) {
    try {
      const built = await buildPulseItemsForUser(admin, userId)
      const persisted = await syncPulseItems(admin, userId, built.items)
      if (!persisted) {
        // Columns missing for one user means they're missing for all —
        // stop early rather than hammering Sleeper for nothing.
        persistenceMissing = true
        break
      }
      usersSynced += 1
      itemsBuilt += built.items.length
    } catch {
      // One user's league failing shouldn't stop the run for everyone else.
      continue
    }
  }

  if (persistenceMissing) {
    return NextResponse.json(
      { error: 'pulse_items persistence columns missing — run migration_os_shell.sql' },
      { status: 503 }
    )
  }

  return NextResponse.json({ users: userIds.length, usersSynced, itemsBuilt })
}
