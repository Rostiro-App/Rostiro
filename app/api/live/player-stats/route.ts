// T-111: on-demand real box-score stats for a single player, sourced
// directly from Sleeper's stats endpoint (lib/sleeper.ts's
// getSleeperWeekStats) — not the fantasy-points-only totals already shown
// on the live roster card. Fetched per click, not folded into
// /api/live/status's 15s poll, since the underlying payload is ~2MB for a
// full week.

import { createSSRClient, createAdminClient } from '@/lib/supabase'
import { getSleeperWeekStats, SEASON } from '@/lib/sleeper'
import { currentNflWeek } from '@/lib/liveMatchupPoints'
import { NextResponse, type NextRequest } from 'next/server'

interface StatLine {
  label: string
  value: number
}

function summarize(stats: Record<string, number>): StatLine[] {
  const lines: StatLine[] = []
  const has = (k: string) => typeof stats[k] === 'number'

  if (has('pass_att')) {
    lines.push({ label: 'PASS YD', value: stats.pass_yd ?? 0 })
    lines.push({ label: 'PASS TD', value: stats.pass_td ?? 0 })
    lines.push({ label: 'INT', value: stats.pass_int ?? 0 })
    lines.push({ label: 'CMP/ATT', value: stats.pass_cmp ?? 0 })
  }
  if (has('rush_att')) {
    lines.push({ label: 'RUSH YD', value: stats.rush_yd ?? 0 })
    lines.push({ label: 'RUSH TD', value: stats.rush_td ?? 0 })
    lines.push({ label: 'CARRIES', value: stats.rush_att ?? 0 })
  }
  if (has('rec') || has('rec_tgt')) {
    lines.push({ label: 'REC', value: stats.rec ?? 0 })
    lines.push({ label: 'REC YD', value: stats.rec_yd ?? 0 })
    lines.push({ label: 'REC TD', value: stats.rec_td ?? 0 })
    lines.push({ label: 'TARGETS', value: stats.rec_tgt ?? 0 })
  }
  if (has('fum_lost') && stats.fum_lost > 0) {
    lines.push({ label: 'FUM LOST', value: stats.fum_lost })
  }
  return lines
}

export async function GET(request: NextRequest) {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const playerId = request.nextUrl.searchParams.get('playerId')
  if (!playerId) return NextResponse.json({ error: 'playerId is required' }, { status: 400 })

  const admin = createAdminClient()
  const week = await currentNflWeek(admin)
  if (week === null) return NextResponse.json({ week: null, stats: [] })

  const statsById = await getSleeperWeekStats(SEASON, week).catch(() => new Map<string, Record<string, number>>())
  const raw = statsById.get(playerId)

  return NextResponse.json({ week, stats: raw ? summarize(raw) : [] })
}
