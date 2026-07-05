// T-111 follow-up: the LIVE tab's own open/closed window — distinct from
// the system-wide Game Day state (lib/rostiroState.ts), which is
// day-wide ("some game is happening") and not specific to any one user.
// This is per-user: does *this* user have a rostered player (Sleeper,
// starter or bench — matching buildLiveRoster's own inclusion rule) in
// any of today's games, and if so, treat the whole day's slate as one
// continuous window (pregame ramp before the earliest of their games
// through GAME_DURATION_HOURS after the latest) rather than flipping
// open/closed every time a single game goes to halftime or finishes
// between windows. Reuses rostiroState's exact ramp/duration constants
// so a user's personal window and the system-wide one feel like the same
// clock, not two independently-tuned ones.
//
// Deliberately not limited to Sunday — Thursday Night, international
// games, Black Friday, Christmas, and Monday Night Football all produce
// their own one-day group here the same way, as long as the user has a
// rostered player in it.

import { getSleeperRosters } from '@/lib/sleeper'
import { PREGAME_RAMP_HOURS, GAME_DURATION_HOURS } from '@/lib/rostiroState'
import type { SupabaseClient } from '@supabase/supabase-js'

// Same SupabaseClient type lib/pulse.ts already uses for this exact dual
// situation — this needs to run from both /api/live/status (admin
// client) and /api/system/status (session-scoped SSR client, same
// tables, no privileged access needed), so it accepts either rather than
// forcing one call site to construct a client it otherwise wouldn't need.

export interface NextKickoff {
  kickoffAt: string
  homeTeam: string
  awayTeam: string
  label: string
}

export interface LiveWindowStatus {
  isOpen: boolean
  windowEndsAt: string | null
  nextKickoff: NextKickoff | null
}

const ET_TZ = 'America/New_York'

function dayLabel(kickoffAt: Date): string {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: ET_TZ, weekday: 'long' }).format(kickoffAt)
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: ET_TZ, hour: 'numeric', hour12: false }).format(kickoffAt)) % 24
  if (weekday === 'Thursday') return 'Thursday Night Football'
  if (weekday === 'Monday') return 'Monday Night Football'
  if (weekday === 'Sunday' && hour >= 19) return 'Sunday Night Football'
  if (weekday === 'Sunday') return 'kickoff'
  return `${weekday}'s game`
}

export async function computeLiveWindow(admin: SupabaseClient, userId: string): Promise<LiveWindowStatus> {
  const { data: leagues } = await admin
    .from('connected_leagues')
    .select('league_id, team_id')
    .eq('user_id', userId)
    .eq('platform', 'sleeper')
  const sleeperLeagues = ((leagues ?? []) as { league_id: string; team_id: string | null }[]).filter((l) => l.team_id !== null)
  if (sleeperLeagues.length === 0) return { isOpen: false, windowEndsAt: null, nextKickoff: null }

  const teamSet = new Set<string>()
  for (const league of sleeperLeagues) {
    const rosters = await getSleeperRosters(league.league_id).catch(() => [])
    const myRoster = rosters.find((r) => String(r.roster_id) === league.team_id)
    const playerIds: string[] = myRoster?.players ?? []
    if (playerIds.length === 0) continue
    const { data: cached } = await admin
      .from('players_cache')
      .select('nfl_team')
      .eq('platform', 'sleeper')
      .in('player_id', playerIds)
      .not('nfl_team', 'is', null)
    for (const row of (cached ?? []) as { nfl_team: string }[]) teamSet.add(row.nfl_team)
  }
  if (teamSet.size === 0) return { isOpen: false, windowEndsAt: null, nextKickoff: null }

  const now = new Date()
  // A rolling week, not strictly "today" — a Thursday-night rostered game
  // and the following Monday-night one both need their own countdown from
  // any point in between, not just from midnight of their own calendar day.
  const rangeStart = new Intl.DateTimeFormat('en-CA', { timeZone: ET_TZ }).format(new Date(now.getTime() - 24 * 60 * 60 * 1000))
  const rangeEnd = new Intl.DateTimeFormat('en-CA', { timeZone: ET_TZ }).format(new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000))

  const { data: games } = await admin
    .from('nfl_schedule')
    .select('kickoff_at, home_team, away_team, game_date')
    .gte('game_date', rangeStart)
    .lte('game_date', rangeEnd)

  const relevant = ((games ?? []) as { kickoff_at: string; home_team: string; away_team: string; game_date: string }[])
    .filter((g) => teamSet.has(g.home_team) || teamSet.has(g.away_team))
    .map((g) => ({ ...g, kickoffAt: new Date(g.kickoff_at) }))
    .sort((a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime())

  if (relevant.length === 0) return { isOpen: false, windowEndsAt: null, nextKickoff: null }

  const groups = new Map<string, Date[]>()
  for (const g of relevant) {
    const list = groups.get(g.game_date) ?? []
    list.push(g.kickoffAt)
    groups.set(g.game_date, list)
  }

  for (const kickoffs of groups.values()) {
    const earliest = Math.min(...kickoffs.map((k) => k.getTime()))
    const latest = Math.max(...kickoffs.map((k) => k.getTime()))
    const windowStart = earliest - PREGAME_RAMP_HOURS * 60 * 60 * 1000
    const windowEnd = latest + GAME_DURATION_HOURS * 60 * 60 * 1000
    if (now.getTime() >= windowStart && now.getTime() <= windowEnd) {
      return { isOpen: true, windowEndsAt: new Date(windowEnd).toISOString(), nextKickoff: null }
    }
  }

  const upcoming = relevant.find((g) => g.kickoffAt.getTime() > now.getTime())
  return {
    isOpen: false,
    windowEndsAt: null,
    nextKickoff: upcoming
      ? { kickoffAt: upcoming.kickoffAt.toISOString(), homeTeam: upcoming.home_team, awayTeam: upcoming.away_team, label: dayLabel(upcoming.kickoffAt) }
      : null,
  }
}
