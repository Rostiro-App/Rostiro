// T-67: /api/system/status — the one endpoint behind the OS Shell system
// bar (PRD 6.7 W1). Returns everything the bar's ambient state needs in a
// single call: per-league health scores (computed by lib/healthScore.ts,
// deterministic), and the nearest hard deadline across all leagues. Polled
// by the client on an interval; "Synced Xs ago" is the time since the last
// successful poll, which is honestly when this data was last fresh.
//
// Deadline detection, July 2026 reality: it's the offseason, so the real
// deadline in every league is the scheduled draft (Sleeper exposes
// start_time on the draft object). In-season waiver cutoffs are a T-69
// follow-up — Sleeper's waiver_day_of_week semantics need live verification
// against a real in-season league before we show a countdown to it.

import { createSSRClient } from '@/lib/supabase'
import { getSleeperDrafts, getSleeperRosters } from '@/lib/sleeper'
import { computeLeagueHealth, type HealthPlayer } from '@/lib/healthScore'
import { getRostiroState } from '@/lib/rostiroState'
import { toNflverseTeamCode } from '@/lib/liveScores'
import { isFeatureEnabled } from '@/lib/featureFlags'
import { NextResponse } from 'next/server'
import type { LeagueHealth, LiveGameScore, RelevantPlayer, SystemDeadline, SystemStatus, SystemStatusLeague } from '@/types'

interface LeagueRow {
  id: string
  platform: 'espn' | 'yahoo' | 'sleeper'
  league_id: string
  league_name: string
  team_id: string | null
}

interface CacheRow {
  player_id: string
  name: string
  adp_sleeper: number | null
  injury_status: string | null
  nfl_team: string | null
}

interface ScheduleRow {
  game_id: string
  home_team: string
  away_team: string
  kickoff_at: string
}

interface LiveScoreRow {
  game_id: string
  home_score: number
  away_score: number
  period: number
  display_clock: string
  status_state: 'pre' | 'in' | 'post'
}

const UNKNOWN_HEALTH: LeagueHealth = {
  score: null,
  status: 'unknown',
  factors: [],
  topFlag: null,
}

export async function GET() {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: leagues, error } = await supabase
    .from('connected_leagues')
    .select('id, platform, league_id, league_name, team_id')
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (leagues ?? []) as LeagueRow[]

  // One free-agent pool query serves every league: top of the ADP board,
  // filtered per league against that league's rostered IDs.
  const { data: topPlayers } = await supabase
    .from('players_cache')
    .select('player_id, name, adp_sleeper, injury_status')
    .eq('platform', 'sleeper')
    .not('adp_sleeper', 'is', null)
    .order('adp_sleeper', { ascending: true })
    .limit(200)
  const topPool = (topPlayers ?? []) as CacheRow[]

  const deadlines: SystemDeadline[] = []
  // Per T-79's docstring: only Sleeper's draft status is wired for now, so
  // non-Sleeper leagues simply don't contribute a flag here (not "false" —
  // just absent, same honest-degradation posture as UNKNOWN_HEALTH).
  const draftIncompleteFlags: boolean[] = []
  // T-90: every rostered player id across the user's Sleeper leagues, so
  // live-score roster-relevance can be computed after this loop without a
  // second round of roster fetches.
  const myRosteredPlayerIds: string[] = []
  // UX Behavior Spec Gap #1: which league(s) each rostered player belongs
  // to, so the live-score surfaces can name "Hurts, Barkley (2 leagues)"
  // instead of collapsing relevance down to a bare boolean.
  const playerLeagueNames = new Map<string, Set<string>>()

  // T-93 (6.12 lineup-lock countdown): today's kickoff time per team,
  // computed once up front rather than per-league, so the System Bar can
  // show the calm->warm->urgent ramp toward whichever starter kicks off
  // first. Separate from the live-scores block's own schedule fetch below —
  // that one's gated behind the live_scores flag and this isn't (the
  // countdown itself doesn't reveal scores, so it stays ungated).
  const todayEtForDeadline = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())
  const { data: todaysGamesForDeadline } = await supabase
    .from('nfl_schedule')
    .select('home_team, away_team, kickoff_at')
    .eq('game_date', todayEtForDeadline)
  const kickoffByTeam = new Map<string, number>()
  for (const g of (todaysGamesForDeadline ?? []) as { home_team: string; away_team: string; kickoff_at: string }[]) {
    const k = new Date(g.kickoff_at).getTime()
    kickoffByTeam.set(g.home_team, k)
    kickoffByTeam.set(g.away_team, k)
  }

  const results = await Promise.allSettled(
    rows.map(async (league): Promise<SystemStatusLeague> => {
      // Health + deadlines are Sleeper-only until Yahoo/ESPN league sync is
      // live end-to-end; other platforms still appear in the bar as unknown.
      if (league.platform !== 'sleeper') {
        return { id: league.id, name: league.league_name, platform: league.platform, health: UNKNOWN_HEALTH }
      }

      const [rosters, drafts] = await Promise.all([
        getSleeperRosters(league.league_id),
        getSleeperDrafts(league.league_id).catch(() => []),
      ])

      // Nearest scheduled-but-not-finished draft in this league.
      const now = Date.now()
      for (const draft of drafts) {
        if (draft.status === 'pre_draft' && draft.start_time && draft.start_time > now) {
          deadlines.push({
            kind: 'draft',
            label: 'Draft',
            leagueName: league.league_name,
            at: new Date(draft.start_time).toISOString(),
          })
        }
      }
      draftIncompleteFlags.push(drafts.some((d) => d.status !== 'complete'))

      const myRoster = rosters.find((r) => String(r.roster_id) === league.team_id)
      if (!myRoster) {
        return { id: league.id, name: league.league_name, platform: 'sleeper', health: UNKNOWN_HEALTH }
      }

      const allRosteredIds = new Set(rosters.flatMap((r) => r.players ?? []))
      const myIds = myRoster.players ?? []
      myRosteredPlayerIds.push(...myIds)
      for (const id of myIds) {
        const leagueNames = playerLeagueNames.get(id) ?? new Set<string>()
        leagueNames.add(league.league_name)
        playerLeagueNames.set(id, leagueNames)
      }

      // Enrich my roster from the cache in one query.
      const { data: myRows } = await supabase
        .from('players_cache')
        .select('player_id, name, adp_sleeper, injury_status, nfl_team')
        .eq('platform', 'sleeper')
        .in('player_id', myIds.length > 0 ? myIds : ['__none__'])
      const cacheById = new Map(((myRows ?? []) as CacheRow[]).map((r) => [r.player_id, r]))

      const myPlayers: HealthPlayer[] = myIds.map((id) => ({
        playerId: id,
        adp: cacheById.get(id)?.adp_sleeper ?? null,
        injuryStatus: cacheById.get(id)?.injury_status ?? null,
      }))

      // T-93 (6.12 lineup-lock countdown): earliest kickoff among this
      // league's starters, only surfaced as a deadline when a starter slot
      // is questionable/doubtful/empty — a clean lineup isn't urgent.
      const starterIds = (myRoster.starters ?? []).filter((id) => id !== '0')
      const hasEmptyStarterSlot = (myRoster.starters?.length ?? 0) > starterIds.length
      const hasFlaggedStarter = starterIds.some((id) => {
        const status = cacheById.get(id)?.injury_status?.toLowerCase()
        return status === 'questionable' || status === 'doubtful'
      })
      if (hasEmptyStarterSlot || hasFlaggedStarter) {
        const starterKickoffs = starterIds
          .map((id) => cacheById.get(id)?.nfl_team)
          .filter((team): team is string => !!team)
          .map((team) => kickoffByTeam.get(team))
          .filter((k): k is number => k !== undefined)
        if (starterKickoffs.length > 0) {
          const earliestKickoff = Math.min(...starterKickoffs)
          if (earliestKickoff > now) {
            deadlines.push({
              kind: 'lineup_lock',
              label: 'Lineup Lock',
              leagueName: league.league_name,
              at: new Date(earliestKickoff).toISOString(),
            })
          }
        }
      }

      const bestFreeAgent = topPool.find((p) => !allRosteredIds.has(p.player_id)) ?? null

      const health = computeLeagueHealth({
        myPlayers,
        starterIds: myRoster.starters ?? [],
        bestFreeAgentAdp: bestFreeAgent?.adp_sleeper ?? null,
        bestFreeAgentName: bestFreeAgent?.name ?? null,
      })

      return { id: league.id, name: league.league_name, platform: 'sleeper', health }
    })
  )

  const statusLeagues: SystemStatusLeague[] = results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { id: rows[i].id, name: rows[i].league_name, platform: rows[i].platform, health: UNKNOWN_HEALTH }
  )

  deadlines.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())

  // Degrades to 'standard' rather than failing the whole request if the
  // nfl_schedule read errors — the System Bar should never blank out over a
  // pulse-mark color, per 10.1's "serve last-cached/best-guess, never a
  // blank screen" resilience rule.
  const rostiroState = await getRostiroState(supabase, draftIncompleteFlags).catch(() => 'standard' as const)

  // T-90: live scores, gated behind the same flag as the T-81 cron — an
  // instant kill switch that also stops this route from doing the extra
  // queries below when the feature is off (PRD 10.1).
  let liveScores: LiveGameScore[] = []
  let scoresGated = false
  if (await isFeatureEnabled('live_scores').catch(() => false)) {
    const todayEt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())
    const { data: todaysGames } = await supabase
      .from('nfl_schedule')
      .select('game_id, home_team, away_team, kickoff_at')
      .eq('game_date', todayEt)
    const schedule = (todaysGames ?? []) as ScheduleRow[]

    if (schedule.length > 0) {
      const { data: scoreRows } = await supabase
        .from('live_scores')
        .select('game_id, home_score, away_score, period, display_clock, status_state')
        .in('game_id', schedule.map((g) => g.game_id))
      const scoresByGameId = new Map(((scoreRows ?? []) as LiveScoreRow[]).map((r) => [r.game_id, r]))

      const uniquePlayerIds = [...new Set(myRosteredPlayerIds)]
      const { data: myPlayerRows } = uniquePlayerIds.length > 0
        ? await supabase
            .from('players_cache')
            .select('player_id, name, nfl_team')
            .eq('platform', 'sleeper')
            .in('player_id', uniquePlayerIds)
        : { data: [] as { player_id: string; name: string; nfl_team: string | null }[] }

      const relevantTeams = new Set<string>()
      // UX Behavior Spec Gap #1: team -> the specific players (and their
      // leagues) that made it relevant, not just a yes/no.
      const playersByTeam = new Map<string, RelevantPlayer[]>()
      for (const row of myPlayerRows ?? []) {
        if (!row.nfl_team) continue
        const team = toNflverseTeamCode(row.nfl_team)
        relevantTeams.add(team)
        const list = playersByTeam.get(team) ?? []
        list.push({ name: row.name, leagueNames: [...(playerLeagueNames.get(row.player_id) ?? [])] })
        playersByTeam.set(team, list)
      }

      // DEMO MODE — local testing only (DEMO_MODE is set in .env.local,
      // which is git-ignored and never deployed). Real roster relevance
      // above only covers Sleeper leagues; this account's real league is
      // ESPN, which isn't wired up yet. This purely *adds* teams (and
      // illustrative players) so the Game Day demo slate shows up in
      // Pulse/System Bar without touching the real computation or
      // affecting any account without the flag.
      if (process.env.DEMO_MODE === 'true') {
        const DEMO_PLAYERS: Record<string, RelevantPlayer[]> = {
          TEN: [{ name: 'Derrick Henry', leagueNames: ['Demo League'] }],
          PHI: [
            { name: 'Jalen Hurts', leagueNames: ['Demo League'] },
            { name: 'Saquon Barkley', leagueNames: ['Demo League 2'] },
          ],
          DAL: [{ name: 'Cowboys D/ST', leagueNames: ['Demo League'] }],
        }
        for (const team of (process.env.DEMO_ROSTER_TEAMS ?? 'TEN,PHI,DAL').split(',')) {
          const trimmed = team.trim()
          relevantTeams.add(trimmed)
          if (!playersByTeam.has(trimmed) && DEMO_PLAYERS[trimmed]) {
            playersByTeam.set(trimmed, DEMO_PLAYERS[trimmed])
          }
        }
      }

      liveScores = schedule.map((g) => {
        const score = scoresByGameId.get(g.game_id)
        return {
          gameId: g.game_id,
          homeTeam: g.home_team,
          awayTeam: g.away_team,
          homeScore: score?.home_score ?? 0,
          awayScore: score?.away_score ?? 0,
          period: score?.period ?? 0,
          displayClock: score?.display_clock ?? '',
          statusState: score?.status_state ?? 'pre',
          kickoffAt: g.kickoff_at,
          rosterRelevant: relevantTeams.has(g.home_team) || relevantTeams.has(g.away_team),
          relevantPlayers: [...(playersByTeam.get(g.home_team) ?? []), ...(playersByTeam.get(g.away_team) ?? [])],
        }
      })

      const { data: profile } = await supabase.from('users').select('plan').eq('id', user.id).maybeSingle()
      scoresGated = (profile?.plan ?? 'free') === 'free'
    }
  }

  const status: SystemStatus = {
    syncedAt: new Date().toISOString(),
    leagues: statusLeagues,
    nextDeadline: deadlines[0] ?? null,
    rostiroState,
    liveScores,
    scoresGated,
  }

  return NextResponse.json(status)
}
