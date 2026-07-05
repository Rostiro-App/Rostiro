// T-111: LIVE tab's one data endpoint — cross-league merged live roster,
// matchup scores, the player-updates digest, recent classified events (for
// the client's own animation triggers), and the latest window recap if one
// hasn't been seen yet. Polled by app/(dashboard)/live/page.tsx.

import { createAdminClient, createSSRClient } from '@/lib/supabase'
import { buildLiveRoster } from '@/lib/liveRoster'
import { buildUpdatesDigest } from '@/lib/liveUpdatesDigest'
import { computeLiveWindow } from '@/lib/liveWindow'
import { NextResponse } from 'next/server'

// Long enough to survive realistic click-to-check latency (switch to the
// sim panel, fire a scenario, switch back, wait for the next poll) — a
// 60s window meant a real, correctly-classified event routinely vanished
// before anyone saw it, which read as "the scenario doesn't work" when the
// backend had actually done its job. The one-time touchdown takeover still
// can't double-fire (shownEventKeys.current on the client dedupes by
// player+timestamp), so widening this doesn't risk replaying an old play.
const RECENT_EVENTS_WINDOW_MS = 10 * 60_000

export async function GET() {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { liveRoster, matchups } = await buildLiveRoster(admin, user.id).catch(() => ({ liveRoster: [], matchups: [] }))
  const livePlayerIds = new Set(liveRoster.map((p) => p.playerId))

  // Whether the tab is "open" is a day-wide window for this user's own
  // rostered games (pregame ramp through GAME_DURATION_HOURS after the
  // last of them) — not "is a player literally live this instant." That
  // second, moment-to-moment signal only decides what's inside the open
  // tab (an empty "Live now" between two of a user's own windows is a
  // real, correct state — not locked).
  const liveWindow = await computeLiveWindow(admin, user.id).catch(() => ({ isOpen: false, windowEndsAt: null, nextKickoff: null }))

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
    unlocked: liveWindow.isOpen,
    windowEndsAt: liveWindow.windowEndsAt,
    nextKickoff: liveWindow.nextKickoff,
    liveRoster,
    matchups,
    updates,
    recentEvents: recentEventRows ?? [],
    windowRecap: recapRows?.[0] ?? null,
  })
}
