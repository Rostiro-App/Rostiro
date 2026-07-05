// T-111: LIVE tab's window recap — detects "a wave of today's games just
// wrapped" from real kickoff proximity, never a hardcoded 1pm/4pm clock.
// Works identically for a Thursday-only day, a full Sunday multi-window
// slate, or a Christmas/Black-Friday triple-header, since it's driven
// entirely by nfl_schedule's real kickoff times for today.

import { getSleeperRosters, getSleeperMatchups } from '@/lib/sleeper'
import { generateWindowRecap } from '@/lib/claude'
import { currentNflWeek } from '@/lib/liveMatchupPoints'
import { createAdminClient } from '@/lib/supabase'

type AdminClient = ReturnType<typeof createAdminClient>

interface ScheduleGame {
  game_id: string
  home_team: string
  away_team: string
  kickoff_at: string
}

interface KickoffCluster {
  gameIds: string[]
  teams: Set<string>
  earliestKickoff: number
}

// Chained proximity, not a fixed span from the cluster's start — games
// 45 minutes apart chain into the same wave even if the wave as a whole
// spans longer (a real Sunday early window: 1:00, 1:00, 1:05, 1:25 kickoffs
// are all "the early window" despite a 25-minute total spread).
const CLUSTER_GAP_MS = 45 * 60 * 1000

function clusterKickoffs(games: ScheduleGame[]): KickoffCluster[] {
  const sorted = [...games].sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime())
  const clusters: KickoffCluster[] = []
  let lastKickoff: number | null = null

  for (const g of sorted) {
    const t = new Date(g.kickoff_at).getTime()
    const current = clusters[clusters.length - 1]
    if (current && lastKickoff !== null && t - lastKickoff <= CLUSTER_GAP_MS) {
      current.gameIds.push(g.game_id)
      current.teams.add(g.home_team)
      current.teams.add(g.away_team)
    } else {
      clusters.push({ gameIds: [g.game_id], teams: new Set([g.home_team, g.away_team]), earliestKickoff: t })
    }
    lastKickoff = t
  }
  return clusters
}

interface SleeperLeagueRow {
  id: string
  user_id: string
  league_id: string
  league_name: string
  team_id: string
}

export async function detectAndSendWindowRecaps(admin: AdminClient): Promise<number> {
  const todayEt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())
  const { data: todaysGames } = await admin
    .from('nfl_schedule')
    .select('game_id, home_team, away_team, kickoff_at')
    .eq('game_date', todayEt)
  const games = (todaysGames ?? []) as ScheduleGame[]
  if (games.length === 0) return 0

  const clusters = clusterKickoffs(games)

  const { data: statusRows } = await admin.from('live_scores').select('game_id, status_state').in('game_id', games.map((g) => g.game_id))
  const statusByGameId = new Map(((statusRows ?? []) as { game_id: string; status_state: string }[]).map((r) => [r.game_id, r.status_state]))

  const completeClusters = clusters.filter((c) => c.gameIds.length > 0 && c.gameIds.every((id) => statusByGameId.get(id) === 'post'))
  if (completeClusters.length === 0) return 0

  const hasLaterIncompleteWindow = clusters.some(
    (c) => !completeClusters.includes(c) && !c.gameIds.every((id) => statusByGameId.get(id) === 'post')
  )

  const { data: leagues } = await admin
    .from('connected_leagues')
    .select('id, user_id, league_id, league_name, team_id')
    .eq('platform', 'sleeper')
    .not('team_id', 'is', null)
  const leagueRows = (leagues ?? []) as SleeperLeagueRow[]
  if (leagueRows.length === 0) return 0

  const leaguesByUser = new Map<string, SleeperLeagueRow[]>()
  for (const l of leagueRows) leaguesByUser.set(l.user_id, [...(leaguesByUser.get(l.user_id) ?? []), l])

  const week = await currentNflWeek(admin)
  if (week === null) return 0

  let sent = 0
  for (const [userId, userLeagues] of leaguesByUser) {
    for (const cluster of completeClusters) {
      const windowKey = `${todayEt}:${[...cluster.teams].sort().join(',')}`
      const { error: claimError } = await admin.from('window_recap_log').insert({ user_id: userId, window_key: windowKey })
      if (claimError) continue // 23505 (unique violation) = already recapped this exact window — silent skip, same posture as engagement_log

      const relevantLeagues: { league: SleeperLeagueRow; myScore: number; opponentScore: number }[] = []
      for (const league of userLeagues) {
        const rosters = await getSleeperRosters(league.league_id).catch(() => [])
        const myRoster = rosters.find((r) => String(r.roster_id) === league.team_id)
        if (!myRoster?.players?.length) continue

        const { data: cached } = await admin
          .from('players_cache')
          .select('player_id, nfl_team')
          .eq('platform', 'sleeper')
          .in('player_id', myRoster.players)
        const myTeams = new Set(((cached ?? []) as { nfl_team: string | null }[]).map((p) => p.nfl_team).filter(Boolean))
        const isRelevant = [...cluster.teams].some((t) => myTeams.has(t))
        if (!isRelevant) continue

        const matchups = await getSleeperMatchups(league.league_id, week).catch(() => [])
        const mine = matchups.find((m) => String(m.roster_id) === league.team_id)
        if (!mine || mine.matchup_id === null) continue
        const opponent = matchups.find((m) => String(m.roster_id) !== league.team_id && m.matchup_id === mine.matchup_id)
        relevantLeagues.push({ league, myScore: mine.points, opponentScore: opponent?.points ?? 0 })
      }

      if (relevantLeagues.length === 0) continue

      const { data: events } = await admin
        .from('live_events')
        .select('player_id, event_type, delta')
        .in('league_row_id', relevantLeagues.map((r) => r.league.id))
        .in('event_type', ['touchdown', 'negative'])
        .order('created_at', { ascending: false })
        .limit(5)
      const eventRows = (events ?? []) as { player_id: string; event_type: 'touchdown' | 'reception' | 'yardage' | 'negative'; delta: number }[]
      const playerIds = eventRows.map((e) => e.player_id)
      const { data: playerRows } = playerIds.length
        ? await admin.from('players_cache').select('player_id, name').eq('platform', 'sleeper').in('player_id', playerIds)
        : { data: [] }
      const nameById = new Map(((playerRows ?? []) as { player_id: string; name: string }[]).map((p) => [p.player_id, p.name]))

      const reasoning = await generateWindowRecap({
        leagueResults: relevantLeagues.map((r) => ({ leagueName: r.league.league_name, myScore: r.myScore, opponentScore: r.opponentScore })),
        playerHighlights: eventRows.map((e) => ({ name: nameById.get(e.player_id) ?? 'A player', eventType: e.event_type, points: e.delta })),
        hasMoreWindowsToday: hasLaterIncompleteWindow,
        mode: 'balanced',
      }).catch(() => 'Your window is complete — check LIVE for the full breakdown.')

      await admin.from('pulse_items').insert({
        user_id: userId,
        type: 'window_recap',
        priority: 'info',
        headline: 'Your window wrapped',
        reasoning,
        affected_leagues_json: relevantLeagues.map((r) => ({ leagueId: r.league.id, leagueName: r.league.league_name, platform: 'sleeper' })),
        platform: 'sleeper',
        layer: 'action',
        status: 'open',
      })
      sent++
    }
  }

  return sent
}
