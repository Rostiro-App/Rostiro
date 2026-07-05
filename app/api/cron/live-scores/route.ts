// T-81 / PRD 10.2: the one process that's allowed to poll for live scores.
// Runs on a frequent schedule (see vercel.json) but cheaply no-ops unless
// there's actually a game in its live window right now — this is what "no
// polling storms" means in practice: even this single server-side job
// doesn't hit ESPN when there's nothing to check, let alone one call per
// client. Gated behind the live_scores feature flag (10.1).

import { createAdminClient } from '@/lib/supabase'
import { fetchLiveScores } from '@/lib/liveScores'
import { isFeatureEnabled } from '@/lib/featureFlags'
import { detectLineupLockUrgency, detectMissionComplete, detectTouchdownSwings, type ScoreDelta } from '@/lib/engagementTriggers'
import { pollAllLiveMatchupPoints } from '@/lib/liveMatchupPoints'
import { classifyDeltas } from '@/lib/liveEvents'
import { detectAndSendWindowRecaps, detectAndSendLiveUnlockPush } from '@/lib/windowRecap'
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

  // T-93: these two read already-persisted state (kickoff times, starters,
  // prior live_scores rows) rather than needing this poll's fresh ESPN
  // fetch, so they run even when no game is currently mid-window — that's
  // exactly when lineup-lock (pregame) and the last game's mission-complete
  // moment need to fire. Best-effort: a detection bug should never break
  // the score sync itself.
  await detectLineupLockUrgency(admin, todayEt).catch(() => {})
  await detectMissionComplete(admin, todayEt).catch(() => {})
  // T-111: same "reads already-persisted state" posture — a window recap
  // fires the moment a wave of games goes final, which is exactly when no
  // game is currently mid-window (the gap before the next wave kicks off).
  let windowRecapsSent = 0
  let liveUnlockPushesSent = 0
  try {
    windowRecapsSent = await detectAndSendWindowRecaps(admin)
  } catch {
    // Best-effort — never fails the score sync over this.
  }
  try {
    liveUnlockPushesSent = await detectAndSendLiveUnlockPush(admin)
  } catch {
    // Best-effort — never fails the score sync over this.
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
    // Captured before the upsert below overwrites them — this is the "prev"
    // half of the delta detectTouchdownSwings needs (10.2's own engineering
    // note: detection is a diff between this poll and the last one).
    const { data: prevRows } = await admin
      .from('live_scores')
      .select('game_id, home_score, away_score')
      .in('game_id', scores.map((s) => s.gameId))
    const prevByGameId = new Map(
      ((prevRows ?? []) as { game_id: string; home_score: number; away_score: number }[]).map((r) => [r.game_id, r])
    )
    const gameById = new Map(inWindow.map((g) => [g.game_id, g]))

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

    const deltas: ScoreDelta[] = scores.map((s) => {
      const game = gameById.get(s.gameId)!
      const prev = prevByGameId.get(s.gameId)
      return {
        gameId: s.gameId,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        prevHomeScore: prev?.home_score ?? 0,
        prevAwayScore: prev?.away_score ?? 0,
        newHomeScore: s.homeScore,
        newAwayScore: s.awayScore,
      }
    })
    await detectTouchdownSwings(admin, deltas).catch(() => {})
  }

  // T-111: LIVE tab's per-player point tracking — same inWindow gate as
  // everything above, best-effort so a classification bug never breaks the
  // score sync itself.
  let liveEventsRecorded = 0
  try {
    const pointDeltas = await pollAllLiveMatchupPoints(admin)
    const classified = await classifyDeltas(admin, pointDeltas)
    if (classified.length > 0) {
      await admin.from('live_events').insert(
        classified.map((c) => ({
          league_row_id: c.leagueRowId,
          platform: c.platform,
          player_id: c.playerId,
          event_type: c.eventType,
          delta: c.delta,
        }))
      )
      liveEventsRecorded = classified.length
    }
  } catch {
    // Best-effort — never fails the score sync over this.
  }

  return NextResponse.json({ synced: scores.length, gamesInWindow: inWindow.length, liveEventsRecorded, windowRecapsSent, liveUnlockPushesSent })
}
