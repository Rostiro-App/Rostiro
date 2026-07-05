// T-89: Player Intelligence Card (PRD 6.11) — ⌘K player search becomes
// decision intelligence. Cross-league availability, usage/depth chart, and
// context (news/opportunity-surge reasoning already computed by Pulse —
// this route never calls Claude itself, it only reads what's cached) for
// a single player, on demand.

import { createSSRClient } from '@/lib/supabase'
import { getSleeperRosters } from '@/lib/sleeper'
import { NextResponse, type NextRequest } from 'next/server'

interface LeagueRow {
  id: string
  league_id: string
  league_name: string
  team_id: string | null
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: playerRow, error: playerError } = await supabase
    .from('players_cache')
    .select('player_id, name, position, nfl_team, injury_status, adp_sleeper, depth_chart_order, depth_chart_position')
    .eq('platform', 'sleeper')
    .eq('player_id', playerId)
    .maybeSingle()
  if (playerError) return NextResponse.json({ error: playerError.message }, { status: 500 })
  if (!playerRow) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

  const { data: leagues, error: leaguesError } = await supabase
    .from('connected_leagues')
    .select('id, league_id, league_name, team_id')
    .eq('user_id', user.id)
    .eq('platform', 'sleeper')
  if (leaguesError) return NextResponse.json({ error: leaguesError.message }, { status: 500 })

  const leagueRows = (leagues ?? []) as LeagueRow[]
  const availability = await Promise.all(
    leagueRows.map(async (league) => {
      try {
        const rosters = await getSleeperRosters(league.league_id)
        const owner = rosters.find((r) => Array.isArray(r.players) && r.players.includes(playerId))
        if (!owner) return { leagueId: league.id, leagueName: league.league_name, status: 'free_agent' as const, isStarter: false }

        const isMine = String(owner.roster_id) === league.team_id
        const isStarter = Array.isArray(owner.starters) && owner.starters.includes(playerId)
        return {
          leagueId: league.id,
          leagueName: league.league_name,
          status: isMine ? ('mine' as const) : ('rostered_elsewhere' as const),
          isStarter: isMine && isStarter,
        }
      } catch {
        return null
      }
    })
  )

  const { data: usageRow } = await supabase
    .from('player_usage_snapshots')
    .select('season, week, offense_snaps, offense_pct, defense_snaps, defense_pct')
    .eq('player_id', playerId)
    .order('season', { ascending: false })
    .order('week', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Context: most recent reasoning Pulse has already generated for this
  // player (lib/pulse.ts) — never generated fresh here, so opening this
  // card is always a zero-Claude-cost read.
  const { data: contextRow } = await supabase
    .from('player_context_cache')
    .select('kind, source_id, reasoning, created_at')
    .eq('player_id', playerId)
    .eq('platform', 'sleeper')
    .not('reasoning', 'eq', '')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let context: { reasoning: string; kind: string; headline: string | null; link: string | null } | null = null
  if (contextRow) {
    let headline: string | null = null
    let link: string | null = null
    if (contextRow.kind === 'news') {
      const { data: newsRow } = await supabase
        .from('news_items')
        .select('headline, link')
        .eq('id', contextRow.source_id)
        .maybeSingle()
      headline = newsRow?.headline ?? null
      link = newsRow?.link ?? null
    }
    context = { reasoning: contextRow.reasoning, kind: contextRow.kind, headline, link }
  }

  return NextResponse.json({
    player: {
      playerId: playerRow.player_id,
      name: playerRow.name,
      position: playerRow.position,
      nflTeam: playerRow.nfl_team,
      injuryStatus: playerRow.injury_status,
      adpSleeper: playerRow.adp_sleeper,
      depthChartOrder: playerRow.depth_chart_order,
      depthChartPosition: playerRow.depth_chart_position,
    },
    availability: availability.filter((a): a is NonNullable<typeof a> => a !== null),
    usage: usageRow ?? null,
    context,
  })
}
