// T-108: Film Room recap — real Sleeper matchup data for the most recently
// completed week. Sleeper-only for now (same scope limit as every other
// per-league feature this session) — ESPN/Yahoo have matchup fetch stubs
// already (lib/espn.ts, lib/yahoo.ts) but their raw response shapes are
// complex enough that parsing them without a real example to verify
// against risks a silent bug, so they're deliberately not attempted here.

import { createSSRClient, createAdminClient } from '@/lib/supabase'
import { getSleeperMatchups, computeFilmRoomResult } from '@/lib/sleeper'
import { NextResponse } from 'next/server'

interface FilmRoomLeagueResult {
  leagueId: string
  leagueName: string
  myScore: number
  opponentScore: number
  won: boolean | null
}

export async function GET() {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: leagues } = await supabase
    .from('connected_leagues')
    .select('id, league_id, league_name, team_id')
    .eq('user_id', user.id)
    .eq('platform', 'sleeper')

  const rows = leagues ?? []
  if (rows.length === 0) return NextResponse.json({ results: [] })

  // DEMO MODE — local testing only (.env.local, git-ignored, never
  // deployed). No connected league anywhere has a real completed week yet
  // (every one is pre-season/pre-draft) — this is the only way to see the
  // real card render against something other than an empty state today.
  if (process.env.DEMO_MODE === 'true') {
    const results: FilmRoomLeagueResult[] = rows.map((l) => ({
      leagueId: l.id,
      leagueName: l.league_name,
      myScore: 132.4,
      opponentScore: 118.6,
      won: true,
    }))
    return NextResponse.json({ results })
  }

  const admin = createAdminClient()
  const week = await mostRecentCompletedWeek(admin)
  if (week === null) return NextResponse.json({ results: [] })

  const results: FilmRoomLeagueResult[] = []
  for (const league of rows) {
    if (!league.team_id) continue
    try {
      const matchups = await getSleeperMatchups(league.league_id, week)
      const result = computeFilmRoomResult(matchups, Number(league.team_id))
      if (!result) continue
      results.push({
        leagueId: league.id,
        leagueName: league.league_name,
        myScore: result.myScore,
        opponentScore: result.opponentScore,
        won: result.won,
      })
    } catch {
      // One league's Sleeper call failing shouldn't blank the others.
      continue
    }
  }

  return NextResponse.json({ results })
}

// Highest week where every scheduled game's live window (kickoff + 4h) has
// already passed — cheap, MVP-level "is this week actually over" check,
// consistent with 6.10's own don't-over-engineer-ties framing.
async function mostRecentCompletedWeek(admin: ReturnType<typeof createAdminClient>): Promise<number | null> {
  const { data } = await admin.from('nfl_schedule').select('week, kickoff_at')
  const rows = (data ?? []) as { week: number; kickoff_at: string }[]
  if (rows.length === 0) return null

  const GAME_DURATION_MS = 4 * 60 * 60 * 1000
  const now = Date.now()
  const kickoffsByWeek = new Map<number, number[]>()
  for (const row of rows) {
    const list = kickoffsByWeek.get(row.week) ?? []
    list.push(new Date(row.kickoff_at).getTime())
    kickoffsByWeek.set(row.week, list)
  }

  let latestCompleted: number | null = null
  for (const [week, kickoffs] of kickoffsByWeek) {
    const allFinished = kickoffs.every((k) => k + GAME_DURATION_MS < now)
    if (allFinished && (latestCompleted === null || week > latestCompleted)) {
      latestCompleted = week
    }
  }
  return latestCompleted
}
