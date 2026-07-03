// T-64: Daily player pool sync — caches Sleeper ADP into players_cache so the
// Draft Kit never calls Sleeper directly on a user request. Triggered by
// Vercel Cron (see vercel.json). Sleeper's /players/nfl payload is ~5MB —
// fetch at most once/day.

import { createAdminClient } from '@/lib/supabase'
import { getSleeperPlayers } from '@/lib/sleeper'
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

    return NextResponse.json({ synced, snapshotted, source: 'sleeper' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
