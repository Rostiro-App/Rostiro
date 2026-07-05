// T-111: LIVE tab's per-player live points — fetch, diff, cache. Same
// "only when a game is actually live right now" gate the live_scores cron
// already established (10.2) — this rides the same cron pass, not a
// separate polling loop.
//
// Diffing is the whole point of the cache: a poll's raw points are useless
// on their own for "what just happened" — only the delta from the last
// poll tells you a touchdown happened versus just re-reading the same
// score. Same principle as detectTouchdownSwings's team-level diff,
// applied at player granularity.

import { getSleeperMatchups } from '@/lib/sleeper'
import { getEspnLivePoints } from '@/lib/espn'
import { decrypt } from '@/lib/encrypt'
import { createAdminClient } from '@/lib/supabase'

type AdminClient = ReturnType<typeof createAdminClient>

export interface PlayerPointDelta {
  leagueRowId: string
  platform: 'sleeper' | 'espn'
  playerId: string
  prevPoints: number
  newPoints: number
}

interface ConnectedLeagueRow {
  id: string
  platform: 'sleeper' | 'espn' | 'yahoo'
  league_id: string
  team_id: string | null
  user_id: string
}

// The week whose games span "today" — not the most recently *completed*
// week (that's Film Room's own, different question), the currently active
// one, in progress or not yet kicked off.
export async function currentNflWeek(admin: AdminClient): Promise<number | null> {
  const todayEt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())
  const { data } = await admin.from('nfl_schedule').select('week').eq('game_date', todayEt).limit(1)
  if (data && data.length > 0) return data[0].week as number

  // No game today (e.g. a Wednesday) — fall back to whichever week is
  // nearest in time, so the cache still tracks the right week between
  // games rather than going stale.
  const { data: nearest } = await admin
    .from('nfl_schedule')
    .select('week, kickoff_at')
    .order('kickoff_at', { ascending: true })
  const rows = (nearest ?? []) as { week: number; kickoff_at: string }[]
  const now = Date.now()
  const upcoming = rows.find((r) => new Date(r.kickoff_at).getTime() >= now)
  return upcoming?.week ?? rows[rows.length - 1]?.week ?? null
}

async function pollSleeperLeague(admin: AdminClient, league: ConnectedLeagueRow, week: number): Promise<PlayerPointDelta[]> {
  const matchups = await getSleeperMatchups(league.league_id, week).catch(() => [])
  const deltas: PlayerPointDelta[] = []

  for (const m of matchups) {
    const newPoints = m.players_points ?? {}
    const { data: cached } = await admin
      .from('live_matchup_points')
      .select('players_points')
      .eq('league_id', league.league_id)
      .eq('platform', 'sleeper')
      .eq('week', week)
      .eq('roster_id', String(m.roster_id))
      .maybeSingle()
    const prevPoints: Record<string, number> = cached?.players_points ?? {}

    for (const [playerId, points] of Object.entries(newPoints)) {
      const prev = prevPoints[playerId] ?? 0
      if (points !== prev) {
        deltas.push({ leagueRowId: league.id, platform: 'sleeper', playerId, prevPoints: prev, newPoints: points as number })
      }
    }

    await admin.from('live_matchup_points').upsert(
      { league_id: league.league_id, platform: 'sleeper', week, roster_id: String(m.roster_id), players_points: newPoints, updated_at: new Date().toISOString() },
      { onConflict: 'league_id,platform,week,roster_id' }
    )
  }

  return deltas
}

async function pollEspnLeague(admin: AdminClient, league: ConnectedLeagueRow, week: number): Promise<PlayerPointDelta[]> {
  const { data: creds } = await admin.from('espn_credentials').select('espn_s2, swid').eq('user_id', league.user_id).maybeSingle()
  if (!creds) return []
  const credentials = { espnS2: decrypt(creds.espn_s2), swid: decrypt(creds.swid) }

  const matchups = await getEspnLivePoints(league.league_id, credentials, week).catch(() => [])
  const deltas: PlayerPointDelta[] = []

  for (const m of matchups) {
    const newPoints: Record<string, number> = {}
    for (const p of m.playerPoints) newPoints[p.playerId] = p.points

    const { data: cached } = await admin
      .from('live_matchup_points')
      .select('players_points')
      .eq('league_id', league.league_id)
      .eq('platform', 'espn')
      .eq('week', week)
      .eq('roster_id', String(m.teamId))
      .maybeSingle()
    const prevPoints: Record<string, number> = cached?.players_points ?? {}

    for (const [playerId, points] of Object.entries(newPoints)) {
      const prev = prevPoints[playerId] ?? 0
      if (points !== prev) {
        deltas.push({ leagueRowId: league.id, platform: 'espn', playerId, prevPoints: prev, newPoints: points })
      }
    }

    await admin.from('live_matchup_points').upsert(
      { league_id: league.league_id, platform: 'espn', week, roster_id: String(m.teamId), players_points: newPoints, updated_at: new Date().toISOString() },
      { onConflict: 'league_id,platform,week,roster_id' }
    )
  }

  return deltas
}

export async function pollAllLiveMatchupPoints(admin: AdminClient): Promise<PlayerPointDelta[]> {
  const week = await currentNflWeek(admin)
  if (week === null) return []

  const { data: leagues } = await admin.from('connected_leagues').select('id, platform, league_id, team_id, user_id').in('platform', ['sleeper', 'espn'])
  const rows = (leagues ?? []) as ConnectedLeagueRow[]

  const results = await Promise.allSettled(
    rows.map((league) => (league.platform === 'sleeper' ? pollSleeperLeague(admin, league, week) : pollEspnLeague(admin, league, week)))
  )
  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
}
