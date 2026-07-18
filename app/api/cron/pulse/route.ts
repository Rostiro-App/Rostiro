// T-69: Daily Pulse regeneration for every user with a connected league,
// so the feed is already fresh when someone opens the app (and so push
// notifications have something real to send once T-66 wires them up).
// Runs after the players cron (see vercel.json) so injury statuses and ADP
// are today's before items are built from them.

import { createAdminClient } from '@/lib/supabase'
import { buildPulseItemsForUser, syncPulseItems } from '@/lib/pulse'
import { currentWeekStart } from '@/lib/portfolio'
import { computeUserCrossPlatformPortfolio } from '@/lib/crossPlatformPortfolioSync'
import { NextResponse, type NextRequest } from 'next/server'
import { recordCronRun } from '@/lib/cronHeartbeat'
import { isAuthorizedCronRequest } from '@/lib/cronAuth'

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await recordCronRun('pulse')

  const admin = createAdminClient()

  // P3-8 (correction, 2026-07-18): buildPulseItemsForUser now merges real
  // cross-platform (ESPN) Pulse items via lib/crossPlatformPulse.ts
  // alongside the existing Sleeper-only generation — an ESPN-only user
  // does get real Pulse items today, not just a Portfolio snapshot. This
  // user list is not scoped to `platform = 'sleeper'` because both Pulse
  // and Portfolio are cross-platform now.
  const { data, error } = await admin.from('connected_leagues').select('user_id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const userIds = [...new Set((data ?? []).map((r) => r.user_id as string))]

  let usersSynced = 0
  let itemsBuilt = 0
  let persistenceMissing = false
  let portfolioSnapshotted = 0
  // P3-6B: supabase/migration_portfolio_schema_version.sql was applied to
  // production 2026-07-17 (P3-10) — schema_version/player_id_space exist
  // today. This flag and its '42703'/'PGRST204' checks below are kept as a
  // defense-in-depth safety net (e.g. a future environment where the
  // migration genuinely hasn't run yet), not because the columns are
  // currently missing — if they were, writing schema_version/
  // player_id_space would error, and this flag skips ALL Portfolio
  // snapshot writes for the rest of that run rather than guessing.
  let schemaVersionColumnsMissing = false
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
      // One user's league failing shouldn't stop the run for everyone
      // else — and, per P3-6B, must NOT prevent that SAME user's
      // Portfolio snapshot below from running (they're independent
      // computations over independent data; a Sleeper Pulse hiccup for
      // one user says nothing about whether their ESPN Portfolio data is
      // fine). No `continue` here — falls through to the Portfolio block.
    }

    // T-86 / P3-6B: real cross-platform Portfolio snapshot — exposure
    // deduplicated by canonical player ID, health computed via the same
    // computeLeagueHealth every other cross-platform path uses. Failure
    // isolation for individual leagues already happens INSIDE
    // computeUserCrossPlatformPortfolio (lib/crossPlatformPortfolioSync.ts)
    // — this try/catch only guards the whole-user call (e.g. a DB hiccup
    // fetching connected_leagues itself).
    if (schemaVersionColumnsMissing) continue

    try {
      const portfolio = await computeUserCrossPlatformPortfolio(userId)
      if (portfolio.health.length > 0) {
        const { error: healthError } = await admin.from('portfolio_health_snapshots').upsert(
          portfolio.health.map((h) => ({
            week_start: weekStart,
            user_id: userId,
            league_id: h.connectedLeagueId,
            health_score: h.result.health.score,
            health_status: h.result.health.status,
            schema_version: 2,
            created_at: new Date().toISOString(),
          })),
          { onConflict: 'week_start,user_id,league_id' }
        )
        if (healthError) {
          if (healthError.code === '42703' || healthError.code === 'PGRST204') {
            schemaVersionColumnsMissing = true
            continue
          }
        } else {
          portfolioSnapshotted += 1
        }
      }
      // Only resolved (canonical-ID) exposure is written to the
      // historical snapshot table — unresolved players stay visible live
      // via the coverage/exposure API response, but this table's
      // player_id_space enum (applied to production 2026-07-17, P3-10)
      // only distinguishes sleeper_raw/canonical, and writing an
      // unresolved `platform:sourceId` string here would need a third
      // space that column doesn't define. Not silently dropped from the
      // PRODUCT — only from this specific historical trend table.
      if (portfolio.exposure.resolved.length > 0) {
        const { error: exposureError } = await admin.from('portfolio_exposure_snapshots').upsert(
          portfolio.exposure.resolved.map((e) => ({
            week_start: weekStart,
            user_id: userId,
            player_id: e.canonicalPlayerId,
            league_count: e.exposureCount,
            schema_version: 2,
            player_id_space: 'canonical',
            created_at: new Date().toISOString(),
          })),
          { onConflict: 'week_start,user_id,player_id' }
        )
        if (exposureError && (exposureError.code === '42703' || exposureError.code === 'PGRST204')) {
          schemaVersionColumnsMissing = true
        }
      }
    } catch {
      // A transient failure for one user's Portfolio computation — never
      // break Pulse over it, and never break the next user's Portfolio
      // snapshot either.
    }
  }

  if (persistenceMissing) {
    return NextResponse.json(
      { error: 'pulse_items persistence columns missing — run migration_os_shell.sql' },
      { status: 503 }
    )
  }

  return NextResponse.json({
    users: userIds.length,
    usersSynced,
    itemsBuilt,
    portfolioSnapshotted,
    portfolioSchemaVersionColumnsMissing: schemaVersionColumnsMissing,
  })
}
