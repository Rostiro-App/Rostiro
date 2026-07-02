// T-59: Pulse — real Sleeper data. Replaces the mock feed on /pulse.
//
// Scope for v1: injury_alert and waiver_alert only — the two signals we can
// back with real data (players_cache, populated daily by the Draft Kit cron).
// No weather/Vegas/lineup_decision here yet — those need data sources we
// don't have wired up, and the PRD rule is explicit: don't show a number you
// can't back up. Computed live on each request, not persisted to
// pulse_items yet — dismiss/cron scheduling is a fast follow once this shape
// is validated.

import { createSSRClient } from '@/lib/supabase'
import { getSleeperRosters } from '@/lib/sleeper'
import { NextResponse } from 'next/server'
import type { AffectedLeague, PulseItem, PulsePriority } from '@/types'

interface CachedPlayer {
  player_id: string
  name: string
  position: string | null
  injury_status: string | null
  adp_sleeper: number | null
}

export async function GET() {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: leagues, error: leaguesError } = await supabase
    .from('connected_leagues')
    .select('id, league_id, league_name, team_id')
    .eq('user_id', user.id)
    .eq('platform', 'sleeper')

  if (leaguesError) {
    return NextResponse.json({ error: leaguesError.message }, { status: 500 })
  }

  if (!leagues || leagues.length === 0) {
    return NextResponse.json({ items: [], leagueCount: 0 })
  }

  const items: PulseItem[] = []

  for (const league of leagues) {
    try {
      const leagueItems = await buildLeagueItems(supabase, user.id, league)
      items.push(...leagueItems)
    } catch {
      // One league failing (Sleeper down, league deleted, etc.) shouldn't
      // blank the whole Pulse feed for the user's other leagues.
      continue
    }
  }

  const PRIORITY_RANK: Record<PulsePriority, number> = { critical: 0, important: 1, info: 2 }
  items.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])

  return NextResponse.json({ items, leagueCount: leagues.length })
}

async function buildLeagueItems(
  supabase: Awaited<ReturnType<typeof createSSRClient>>,
  userId: string,
  league: { id: string; league_id: string; league_name: string; team_id: string | null }
): Promise<PulseItem[]> {
  const rosters = await getSleeperRosters(league.league_id)
  const myRoster = rosters.find((r) => String(r.roster_id) === league.team_id)
  if (!myRoster) return []

  const affectedLeague: AffectedLeague = {
    leagueId: league.id,
    leagueName: league.league_name,
    platform: 'sleeper',
  }
  const deepLink = `https://sleeper.com/leagues/${league.league_id}`

  const items: PulseItem[] = []

  // ─── Injuries on my roster ───────────────────────────────────────────────
  const myPlayerIds = Array.isArray(myRoster.players) ? myRoster.players : []
  const starterIds = new Set(Array.isArray(myRoster.starters) ? myRoster.starters : [])

  if (myPlayerIds.length > 0) {
    const { data: myPlayers } = await supabase
      .from('players_cache')
      .select('player_id, name, position, injury_status, adp_sleeper')
      .eq('platform', 'sleeper')
      .in('player_id', myPlayerIds)

    for (const p of (myPlayers ?? []) as CachedPlayer[]) {
      if (!p.injury_status) continue

      const isStarter = starterIds.has(p.player_id)
      const priority = injuryPriority(p.injury_status, isStarter)
      if (!priority) continue

      items.push({
        id: `injury-${league.id}-${p.player_id}`,
        userId,
        type: 'injury_alert',
        priority,
        headline: `${p.name} — ${formatInjuryStatus(p.injury_status)}`,
        reasoning: isStarter
          ? `${p.name} is in your starting lineup and listed as ${formatInjuryStatus(p.injury_status).toLowerCase()}. Check for a bench replacement before kickoff.`
          : `${p.name} is on your bench and listed as ${formatInjuryStatus(p.injury_status).toLowerCase()}.`,
        affectedLeagues: [affectedLeague],
        deadline: null,
        actionUrl: deepLink,
        platform: 'sleeper',
        isDismissed: false,
        createdAt: new Date().toISOString(),
      })
    }
  }

  // ─── Waiver opportunity ──────────────────────────────────────────────────
  const rosteredIds = new Set(rosters.flatMap((r) => (Array.isArray(r.players) ? r.players : [])))

  const { data: topAvailable } = await supabase
    .from('players_cache')
    .select('player_id, name, position, injury_status, adp_sleeper')
    .eq('platform', 'sleeper')
    .not('adp_sleeper', 'is', null)
    .order('adp_sleeper', { ascending: true })
    .limit(200)

  const bestWaiver = ((topAvailable ?? []) as CachedPlayer[]).find(
    (p) => !rosteredIds.has(p.player_id)
  )

  if (bestWaiver) {
    items.push({
      id: `waiver-${league.id}-${bestWaiver.player_id}`,
      userId,
      type: 'waiver_alert',
      priority: bestWaiver.adp_sleeper! < 100 ? 'important' : 'info',
      headline: `${bestWaiver.name} is unrostered`,
      reasoning: `${bestWaiver.name} (${bestWaiver.position}) has an ADP of ${Math.round(bestWaiver.adp_sleeper!)} and isn't on any roster in this league yet.`,
      affectedLeagues: [affectedLeague],
      deadline: null,
      actionUrl: deepLink,
      platform: 'sleeper',
      isDismissed: false,
      createdAt: new Date().toISOString(),
    })
  }

  return items
}

function injuryPriority(status: string, isStarter: boolean): PulsePriority | null {
  const s = status.toLowerCase()
  if (s === 'out' || s === 'ir') return isStarter ? 'critical' : 'important'
  if (s === 'doubtful') return isStarter ? 'important' : 'info'
  if (s === 'questionable') return isStarter ? 'important' : 'info'
  return null
}

function formatInjuryStatus(status: string): string {
  const s = status.toLowerCase()
  if (s === 'ir') return 'IR'
  return s.charAt(0).toUpperCase() + s.slice(1)
}
