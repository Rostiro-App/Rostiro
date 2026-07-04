// T-81 / PRD 10.2: the one process that's allowed to poll for live scores.
// Runs on a frequent schedule (see vercel.json) but cheaply no-ops unless
// there's actually a game in its live window right now — this is what "no
// polling storms" means in practice: even this single server-side job
// doesn't hit ESPN when there's nothing to check, let alone one call per
// client. Gated behind the live_scores feature flag (10.1).

import { createAdminClient } from '@/lib/supabase'
import { fetchLiveScores } from '@/lib/liveScores'
import { isFeatureEnabled } from '@/lib/featureFlags'
import { NextResponse, type NextRequest } from 'next/server'

const GAME_DURATION_HOURS = 4 // matches lib/rostiroState.ts's window

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!(await isFeatureEnabled('live_scores'))) {
    return NextResponse.json({ skipped: 'live_scores flag disabled' })
  }

  const admin = createAdminClient()
  const now = new Date()
  const todayEt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(now) // YYYY-MM-DD

  const { data: todaysGames, error } = await admin
    .from('nfl_schedule')
    .select('game_id, home_team, away_team, kickoff_at')
    .eq('game_date', todayEt)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!todaysGames || todaysGames.length === 0) {
    return NextResponse.json({ skipped: 'no games scheduled today' })
  }

  // Cheap early-exit: only fetch if at least one of today's games is within
  // its live window right now (kickoff <= now <= kickoff + 4h). Otherwise
  // this cron run costs one Supabase query and nothing else — no ESPN call.
  const inWindow = todaysGames.filter((g) => {
    const kickoff = new Date(g.kickoff_at).getTime()
    return now.getTime() >= kickoff && now.getTime() <= kickoff + GAME_DURATION_HOURS * 60 * 60 * 1000
  })
  if (inWindow.length === 0) {
    return NextResponse.json({ skipped: 'no game currently in its live window', gamesToday: todaysGames.length })
  }

  const scores = await fetchLiveScores(
    inWindow.map((g) => ({ gameId: g.game_id, homeTeam: g.home_team, awayTeam: g.away_team }))
  )

  if (scores.length > 0) {
    const { error: upsertError } = await admin.from('live_scores').upsert(
      scores.map((s) => ({
        game_id: s.gameId,
        home_score: s.homeScore,
        away_score: s.awayScore,
        period: s.period,
        display_clock: s.displayClock,
        status_state: s.statusState,
        last_synced_at: new Date().toISOString(),
      })),
      { onConflict: 'game_id' }
    )
    if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  return NextResponse.json({ synced: scores.length, gamesInWindow: inWindow.length })
}
