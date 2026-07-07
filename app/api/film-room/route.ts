// T-108: Film Room recap — real Sleeper matchup data for the most recently
// completed week. Sleeper-only for now (same scope limit as every other
// per-league feature this session) — ESPN/Yahoo have matchup fetch stubs
// already (lib/espn.ts, lib/yahoo.ts) but their raw response shapes are
// complex enough that parsing them without a real example to verify
// against risks a silent bug, so they're deliberately not attempted here.

import { createSSRClient, createAdminClient } from '@/lib/supabase'
import { getSleeperMatchups, computeFilmRoomResult, getSleeperRosters, SEASON } from '@/lib/sleeper'
import { computeTopUsageSignal, type RosterUsageRow, type UsageSignal } from '@/lib/filmRoomSignals'
import { generateFilmRoomRecap } from '@/lib/claude'
import { isFreePlan } from '@/lib/usageLimits'
import { getForcedState } from '@/lib/simTime'
import { NextResponse, type NextRequest } from 'next/server'
import type { Mode } from '@/components/nav/AppShell'

interface FilmRoomLeagueResult {
  leagueId: string
  leagueName: string
  myScore: number
  opponentScore: number
  won: boolean | null
  usageSignal: UsageSignal | null
  recap: string | null
  // T-101 gating pass: true for a Free-plan user whose recap was
  // deliberately skipped (not attempted and failed) — lets the client
  // show an upgrade nudge instead of just silently having no recap.
  recapGated: boolean
}

const VALID_MODES: Mode[] = ['focused', 'balanced', 'savant']

export async function GET(request: NextRequest) {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const modeParam = request.nextUrl.searchParams.get('mode')
  const mode: Mode = VALID_MODES.includes(modeParam as Mode) ? (modeParam as Mode) : 'balanced'

  // PRD Section 9: "full Film Room recap" is listed as Pro's state depth —
  // the real score/won-loss/usage signal below are all deterministic and
  // stay free for everyone; only the Claude-narrated recap paragraph is
  // gated. Fail open (never Claude) on a metering error, same posture as
  // every other plan check in this codebase.
  const admin = createAdminClient()
  const free = await isFreePlan(admin, user.id).catch(() => false)

  const { data: leagues } = await supabase
    .from('connected_leagues')
    .select('id, league_id, league_name, team_id')
    .eq('user_id', user.id)
    .eq('platform', 'sleeper')

  const rows = leagues ?? []
  if (rows.length === 0) return NextResponse.json({ results: [] })

  // DEMO MODE — local-only env var, or the Dev-only Simulation Suite's
  // Scenario 4 (Monday Night Film Room) forcing this exact state. Both
  // exist for the identical reason: no connected league anywhere has a
  // real completed week yet (every one is pre-season/pre-draft) — this is
  // the only way to see the real card render against something other than
  // an empty state today.
  const simulatingFilmRoom = (await getForcedState().catch(() => null)) === 'film_room'
  if (process.env.DEMO_MODE === 'true' || simulatingFilmRoom) {
    const demoSignal: UsageSignal = { playerId: 'demo', name: 'Backup RB', position: 'RB', direction: 'buy_low', deltaPct: 22 }
    const results: FilmRoomLeagueResult[] = await Promise.all(
      rows.map(async (l) => {
        let recap: string | null = null
        if (!free) {
          try {
            recap = await generateFilmRoomRecap({
              leagueName: l.league_name,
              won: true,
              myScore: 132.4,
              opponentScore: 118.6,
              usageSignal: demoSignal,
              mode,
            })
          } catch {
            // Recap is additive — a Claude failure shouldn't blank the score card.
          }
        }
        return {
          leagueId: l.id,
          leagueName: l.league_name,
          myScore: 132.4,
          opponentScore: 118.6,
          won: true,
          usageSignal: demoSignal,
          recap,
          recapGated: free,
        }
      })
    )
    return NextResponse.json({ results })
  }

  const week = await mostRecentCompletedWeek(admin)
  if (week === null) return NextResponse.json({ results: [] })

  const results: FilmRoomLeagueResult[] = []
  for (const league of rows) {
    if (!league.team_id) continue
    try {
      const matchups = await getSleeperMatchups(league.league_id, week)
      const result = computeFilmRoomResult(matchups, Number(league.team_id))
      if (!result) continue

      const usageSignal = await computeLeagueUsageSignal(admin, league.league_id, Number(league.team_id), week)

      let recap: string | null = null
      if (!free) {
        try {
          recap = await generateFilmRoomRecap({
            leagueName: league.league_name,
            won: result.won,
            myScore: result.myScore,
            opponentScore: result.opponentScore,
            usageSignal,
            mode,
          })
        } catch {
          // Recap is additive — a Claude failure shouldn't blank the score card.
        }
      }

      results.push({
        leagueId: league.id,
        leagueName: league.league_name,
        myScore: result.myScore,
        opponentScore: result.opponentScore,
        won: result.won,
        usageSignal,
        recap,
        recapGated: free,
      })
    } catch {
      // One league's Sleeper call failing shouldn't blank the others.
      continue
    }
  }

  return NextResponse.json({ results })
}

// T-95: roster's week-over-week usage swing (T-87's player_usage_snapshots).
// Best-effort — a missing migration or a preseason week with no snap data
// yet just means no signal this week, never a broken Film Room card.
async function computeLeagueUsageSignal(
  admin: ReturnType<typeof createAdminClient>,
  leagueId: string,
  rosterId: number,
  week: number
): Promise<UsageSignal | null> {
  try {
    const rosters = await getSleeperRosters(leagueId)
    const myRoster = rosters.find((r) => r.roster_id === rosterId)
    if (!myRoster || myRoster.players.length === 0) return null

    const [currentRes, previousRes, namesRes] = await Promise.all([
      admin
        .from('player_usage_snapshots')
        .select('player_id, position, offense_pct')
        .eq('season', SEASON)
        .eq('week', week)
        .in('player_id', myRoster.players),
      admin
        .from('player_usage_snapshots')
        .select('player_id, offense_pct')
        .eq('season', SEASON)
        .eq('week', week - 1)
        .in('player_id', myRoster.players),
      admin
        .from('players_cache')
        .select('player_id, name')
        .eq('platform', 'sleeper')
        .in('player_id', myRoster.players),
    ])
    if (currentRes.error || previousRes.error) return null

    const previousByPlayer = new Map((previousRes.data ?? []).map((r) => [r.player_id, r.offense_pct as number | null]))
    const nameByPlayer = new Map((namesRes.data ?? []).map((r) => [r.player_id, r.name as string]))

    const usageRows: RosterUsageRow[] = (currentRes.data ?? []).map((r) => ({
      playerId: r.player_id,
      name: nameByPlayer.get(r.player_id) ?? r.player_id,
      position: r.position,
      currentPct: r.offense_pct,
      previousPct: previousByPlayer.get(r.player_id) ?? null,
    }))

    return computeTopUsageSignal(usageRows)
  } catch {
    return null
  }
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
