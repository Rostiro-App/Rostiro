// T-69: Daily Pulse regeneration for every user with a connected league,
// so the feed is already fresh when someone opens the app (and so push
// notifications have something real to send once T-66 wires them up).
// Runs after the players cron (see vercel.json) so injury statuses and ADP
// are today's before items are built from them.

import { createAdminClient } from '@/lib/supabase'
import { buildPulseItemsForUser, syncPulseItems } from '@/lib/pulse'
import { computeUserPortfolioSnapshot, currentWeekStart } from '@/lib/portfolio'
import { NextResponse, type NextRequest } from 'next/server'
import { recordCronRun } from '@/lib/cronHeartbeat'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await recordCronRun('pulse')

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
  let portfolioSnapshotted = 0
  const weekStart = currentWeekStart()

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

    // T-86: Portfolio data plumbing — piggybacks on this same per-user loop
    // (already fetching rosters for Pulse generation) rather than a
    // separate cron. Best-effort like the other snapshot steps in this
    // codebase: a missing migration or one user's Sleeper call failing
    // never breaks Pulse generation for anyone.
    try {
      const snapshot = await computeUserPortfolioSnapshot(admin, userId)
      if (snapshot.health.length > 0) {
        const { error: healthError } = await admin.from('portfolio_health_snapshots').upsert(
          snapshot.health.map((h) => ({
            week_start: weekStart,
            user_id: userId,
            league_id: h.leagueId,
            health_score: h.healthScore,
            health_status: h.healthStatus,
            created_at: new Date().toISOString(),
          })),
          { onConflict: 'week_start,user_id,league_id' }
        )
        if (!healthError) portfolioSnapshotted += 1
      }
      if (snapshot.exposure.length > 0) {
        await admin.from('portfolio_exposure_snapshots').upsert(
          snapshot.exposure.map((e) => ({
            week_start: weekStart,
            user_id: userId,
            player_id: e.playerId,
            league_count: e.leagueCount,
            created_at: new Date().toISOString(),
          })),
          { onConflict: 'week_start,user_id,player_id' }
        )
      }
    } catch {
      // Missing migration or a transient failure — never break Pulse over it.
    }
  }

  if (persistenceMissing) {
    return NextResponse.json(
      { error: 'pulse_items persistence columns missing — run migration_os_shell.sql' },
      { status: 503 }
    )
  }

  return NextResponse.json({ users: userIds.length, usersSynced, itemsBuilt, portfolioSnapshotted })
}
