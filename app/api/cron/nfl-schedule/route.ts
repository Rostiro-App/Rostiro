// T-79 prerequisite: daily NFL schedule sync — caches nflverse's games.csv
// into nfl_schedule so Rostiro States (lib/rostiroState.ts) never fetches a
// 7500-line CSV from GitHub on a user request. Triggered by Vercel Cron (see
// vercel.json). Also picks up in-season flex-scheduling changes, which shift
// weekly.

import { createAdminClient } from '@/lib/supabase'
import { fetchNflSchedule } from '@/lib/nflSchedule'
import { NextResponse, type NextRequest } from 'next/server'
import { recordCronRun } from '@/lib/cronHeartbeat'
import { isAuthorizedCronRequest } from '@/lib/cronAuth'

const CURRENT_SEASON = 2026

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await recordCronRun('nfl-schedule')

  try {
    const games = await fetchNflSchedule(CURRENT_SEASON)
    const admin = createAdminClient()

    const rows = games.map((g) => ({
      game_id: g.gameId,
      season: g.season,
      game_type: g.gameType,
      week: g.week,
      game_date: g.gameDate,
      game_time_et: g.gameTimeEt,
      home_team: g.homeTeam,
      away_team: g.awayTeam,
      last_synced_at: new Date().toISOString(),
    }))

    const { error } = await admin
      .from('nfl_schedule')
      .upsert(rows, { onConflict: 'game_id' })
    if (error) throw new Error(error.message)

    return NextResponse.json({ synced: rows.length, season: CURRENT_SEASON })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
