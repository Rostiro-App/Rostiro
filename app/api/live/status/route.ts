// T-111: LIVE tab's one data endpoint — cross-league merged live roster,
// matchup scores, the player-updates digest, recent classified events (for
// the client's own animation triggers), and the latest window recap if one
// hasn't been seen yet. Polled by app/(dashboard)/live/page.tsx.

import { createAdminClient, createSSRClient } from '@/lib/supabase'
import { buildLiveRoster } from '@/lib/liveRoster'
import { buildUpdatesDigest } from '@/lib/liveUpdatesDigest'
import { NextResponse } from 'next/server'

const RECENT_EVENTS_WINDOW_MS = 60_000

export async function GET() {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { liveRoster, matchups } = await buildLiveRoster(admin, user.id).catch(() => ({ liveRoster: [], matchups: [] }))
  const livePlayerIds = new Set(liveRoster.map((p) => p.playerId))

  const updates = await buildUpdatesDigest(admin, user.id, livePlayerIds).catch(() => [])

  const { data: leagueRows } = await admin.from('connected_leagues').select('id').eq('user_id', user.id).eq('platform', 'sleeper')
  const leagueRowIds = (leagueRows ?? []).map((r: { id: string }) => r.id)

  const since = new Date(Date.now() - RECENT_EVENTS_WINDOW_MS).toISOString()
  const { data: recentEventRows } = leagueRowIds.length
    ? await admin
        .from('live_events')
        .select('player_id, event_type, delta, created_at')
        .in('league_row_id', leagueRowIds)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
    : { data: [] }

  const { data: recapRows } = await admin
    .from('pulse_items')
    .select('id, headline, reasoning, created_at')
    .eq('user_id', user.id)
    .eq('type', 'window_recap')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1)

  return NextResponse.json({
    unlocked: liveRoster.length > 0,
    liveRoster,
    matchups,
    updates,
    recentEvents: recentEventRows ?? [],
    windowRecap: recapRows?.[0] ?? null,
  })
}
