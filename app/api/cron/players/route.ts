// T-64: Daily player pool sync — caches Sleeper ADP into players_cache so the
// Draft Kit never calls Sleeper directly on a user request. Triggered by
// Vercel Cron (see vercel.json). Sleeper's /players/nfl payload is ~5MB —
// fetch at most once/day.

import { createAdminClient } from '@/lib/supabase'
import { getSleeperPlayers, SEASON } from '@/lib/sleeper'
import { fetchPlayerUsageSnapshots } from '@/lib/nflverseUsage'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const players = await getSleeperPlayers()
    const admin = createAdminClient()

    const rows = players.map((p) => ({
      player_id: p.playerId,
      platform: 'sleeper' as const,
      name: p.name,
      first_name: p.firstName,
      last_name: p.lastName,
      position: p.position,
      nfl_team: p.nflTeam,
      injury_status: p.injuryStatus,
      adp_sleeper: p.adpSleeper,
      depth_chart_order: p.depthChartOrder,
      depth_chart_position: p.depthChartPosition,
      last_updated: new Date().toISOString(),
    }))

    // Supabase upsert caps at 1000 rows per call — chunk it.
    const CHUNK_SIZE = 1000
    let synced = 0
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE)
      const { error } = await admin
        .from('players_cache')
        .upsert(chunk, { onConflict: 'player_id,platform' })
      if (error) throw new Error(error.message)
      synced += chunk.length
    }

    // T-69: daily ADP snapshot — top of the board only. Powers the "ADP
    // movers" Pulse card once a week of history exists; cheap to collect
    // now, impossible to backfill later. Best-effort: snapshot failure (e.g.
    // migration_os_shell.sql not run yet) never fails the player sync.
    const today = new Date().toISOString().slice(0, 10)
    const snapshotRows = rows
      .filter((r) => r.adp_sleeper !== null)
      .sort((a, b) => a.adp_sleeper! - b.adp_sleeper!)
      .slice(0, 300)
      .map((r) => ({
        snapshot_date: today,
        player_id: r.player_id,
        platform: 'sleeper' as const,
        adp: r.adp_sleeper!,
      }))
    let snapshotted = 0
    if (snapshotRows.length > 0) {
      const { error: snapError } = await admin
        .from('adp_snapshots')
        .upsert(snapshotRows, { onConflict: 'snapshot_date,player_id,platform' })
      if (!snapError) snapshotted = snapshotRows.length
    }

    // T-73: daily injury snapshot — every player carrying a tag today.
    // Powers "designation changed" news in-season. Best-effort like ADP:
    // a missing table (migration_experience.sql not run) never fails the
    // player sync.
    const injuryRows = rows
      .filter((r) => r.injury_status !== null && r.injury_status !== '')
      .map((r) => ({
        snapshot_date: today,
        player_id: r.player_id,
        platform: 'sleeper' as const,
        injury_status: r.injury_status as string,
      }))
    let injuriesSnapshotted = 0
    if (injuryRows.length > 0) {
      const { error: injError } = await admin
        .from('injury_snapshots')
        .upsert(injuryRows, { onConflict: 'snapshot_date,player_id,platform' })
      if (!injError) injuriesSnapshotted = injuryRows.length
    }

    // T-87: weekly snap-count/usage ingestion. Best-effort like the two
    // snapshot steps above — nflverse won't publish a file for the current
    // season until real games start (~preseason week 1), and a missing
    // migration shouldn't fail the player sync either.
    let usageSynced = 0
    try {
      const usageRows = await fetchPlayerUsageSnapshots(SEASON, players)
      if (usageRows.length > 0) {
        const CHUNK = 1000
        for (let i = 0; i < usageRows.length; i += CHUNK) {
          const chunk = usageRows.slice(i, i + CHUNK).map((r) => ({
            season: r.season,
            week: r.week,
            player_id: r.playerId,
            position: r.position,
            team: r.team,
            opponent: r.opponent,
            offense_snaps: r.offenseSnaps,
            offense_pct: r.offensePct,
            defense_snaps: r.defenseSnaps,
            defense_pct: r.defensePct,
            st_snaps: r.stSnaps,
            st_pct: r.stPct,
            updated_at: new Date().toISOString(),
          }))
          const { error: usageError } = await admin
            .from('player_usage_snapshots')
            .upsert(chunk, { onConflict: 'season,week,player_id' })
          if (usageError) break
          usageSynced += chunk.length
        }
      }
    } catch {
      // Network/parse failure on nflverse's side — never fail the player sync over it.
    }

    return NextResponse.json({ synced, snapshotted, injuriesSnapshotted, usageSynced, source: 'sleeper' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
