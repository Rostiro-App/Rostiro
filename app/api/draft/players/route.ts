// T-64: Draft Kit player list — deliberately no auth. Draft Kit is the free
// acquisition funnel and must work before signup. Reads the daily cache
// (players_cache) via the admin client, never hits Sleeper directly.

import { createAdminClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import type { ADPPlayer, NFLPosition } from '@/types'

// Supabase/PostgREST caps a single response at its project max_rows setting
// (1000 by default) regardless of an explicit .limit() — paginate with
// .range() to pull the full cache.
const PAGE_SIZE = 1000

async function fetchAllCachedPlayers(admin: ReturnType<typeof createAdminClient>) {
  const rows: Array<{
    player_id: string
    name: string
    position: string | null
    nfl_team: string | null
    adp_sleeper: number | null
    injury_status: string | null
    last_updated: string
  }> = []

  for (let page = 0; ; page++) {
    const { data, error } = await admin
      .from('players_cache')
      .select('player_id, name, position, nfl_team, adp_sleeper, injury_status, last_updated')
      .eq('platform', 'sleeper')
      .not('adp_sleeper', 'is', null)
      .order('adp_sleeper', { ascending: true })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break

    rows.push(...data)
    if (data.length < PAGE_SIZE) break
  }

  return rows
}

export async function GET() {
  const admin = createAdminClient()

  let data: Awaited<ReturnType<typeof fetchAllCachedPlayers>>
  try {
    data = await fetchAllCachedPlayers(admin)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const players: ADPPlayer[] = data.map((p, i) => ({
    playerId: p.player_id,
    name: p.name,
    position: p.position as NFLPosition,
    nflTeam: p.nfl_team ?? '',
    adpConsensus: p.adp_sleeper as number, // non-null — filtered by .not('adp_sleeper', 'is', null)
    adpEspn: null,
    adpYahoo: null,
    adpSleeper: p.adp_sleeper as number,
    // Dense, tie-free overall rank — see the ADPPlayer.overallRank comment
    // (types/index.ts) for why this exists instead of just showing
    // adp_sleeper directly. Same sorted order the query already produced,
    // just reindexed.
    overallRank: i + 1,
    tier: Math.floor(i / 12) + 1, // 12 picks per tier — one per roster in a standard league
    injuryStatus: (p.injury_status as ADPPlayer['injuryStatus']) ?? null,
    lastUpdated: p.last_updated,
  }))

  return NextResponse.json({ players, count: players.length })
}
