// T-89 / Packet 03 P3-7: Player Intelligence Card (PRD 6.11) — ⌘K player
// search becomes decision intelligence. Cross-league availability,
// usage/depth chart, and context (news/opportunity-surge reasoning
// already computed by Pulse — this route never calls Claude itself, it
// only reads what's cached) for a single player, on demand.
//
// P3-7: canonical player ID is now the primary identity. Every existing
// caller (Draft Kit, Lineups, trades, ⌘K search — all Sleeper-only today)
// still passes a raw Sleeper player ID in the URL, unchanged — this route
// resolves that via lib/playerIntelligence.ts's compatibility lookup, so
// no caller needed to change. `availability[]` gains platform/freshness/
// actionCapability fields additively; existing fields (leagueId,
// leagueName, status, isStarter) are unchanged so the current
// PlayerIntelligenceCard keeps working exactly as before. The Card itself
// has NOT been updated to render the new fields — see the P3-7
// completion report.

import { createSSRClient, createAdminClient } from '@/lib/supabase'
import { resolvePlayerIdentityForRoute, computePlayerIntelligence } from '@/lib/playerIntelligence'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const identity = await resolvePlayerIdentityForRoute(admin, playerId)

  // players_cache lookup for display fields: canonical players may have
  // any combination of espn_id/sleeper_id/yahoo_id — prefer whichever
  // platform this specific request's identity actually names; legacy
  // (unresolved) callers keep querying by their own raw platform+ID,
  // exactly as before.
  let cachePlatform = identity.sourcePlatform ?? 'sleeper'
  let cachePlayerId = identity.sourcePlayerId ?? playerId
  if (identity.canonicalPlayerId) {
    const { data: mapping } = await admin
      .from('player_mappings')
      .select('sleeper_id, espn_id, yahoo_id')
      .eq('id', identity.canonicalPlayerId)
      .maybeSingle()
    if (mapping?.sleeper_id) { cachePlatform = 'sleeper'; cachePlayerId = mapping.sleeper_id }
    else if (mapping?.espn_id) { cachePlatform = 'espn'; cachePlayerId = mapping.espn_id }
    else if (mapping?.yahoo_id) { cachePlatform = 'yahoo'; cachePlayerId = mapping.yahoo_id }
  }

  const { data: playerRow, error: playerError } = await supabase
    .from('players_cache')
    .select('player_id, name, position, nfl_team, injury_status, adp_sleeper, depth_chart_order, depth_chart_position')
    .eq('platform', cachePlatform)
    .eq('player_id', cachePlayerId)
    .maybeSingle()
  if (playerError) return NextResponse.json({ error: playerError.message }, { status: 500 })
  if (!playerRow) return NextResponse.json({ error: 'Player not found' }, { status: 404 })

  const intelligence = await computePlayerIntelligence(admin, user.id, identity)

  const { data: usageRow } = await supabase
    .from('player_usage_snapshots')
    .select('season, week, offense_snaps, offense_pct, defense_snaps, defense_pct')
    .eq('player_id', cachePlayerId)
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
    .eq('player_id', cachePlayerId)
    .eq('platform', cachePlatform)
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
      canonicalPlayerId: identity.canonicalPlayerId,
      name: playerRow.name,
      position: playerRow.position,
      nflTeam: playerRow.nfl_team,
      injuryStatus: playerRow.injury_status,
      adpSleeper: playerRow.adp_sleeper,
      depthChartOrder: playerRow.depth_chart_order,
      depthChartPosition: playerRow.depth_chart_position,
    },
    availability: intelligence.leagues.map((l) => ({
      leagueId: l.connectedLeagueId,
      leagueName: l.leagueName,
      status: l.status,
      isStarter: l.isStarter,
      platform: l.platform,
      freshness: l.freshness,
      actionCapability: l.actionCapability,
    })),
    usage: usageRow ?? null,
    context,
  })
}
