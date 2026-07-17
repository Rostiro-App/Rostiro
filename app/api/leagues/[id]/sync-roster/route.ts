// Packet 03, P3-5: user-triggered roster snapshot sync.
//
// Ownership security: uses createSSRClient() (RLS-scoped) for BOTH the
// auth check and the connected_leagues lookup — the same pattern already
// established in app/api/draft/session/route.ts and
// app/api/leagues/[id]/route.ts. The select can only ever return a league
// belonging to the authenticated caller (RLS policy "Users can manage own
// leagues": auth.uid() = user_id) — a non-owner's request gets a 404, not
// a 200 with someone else's roster. Only AFTER ownership is proven this
// way does syncRosterSnapshot's service-role (admin client) work begin.

import { NextResponse } from 'next/server'
import { createSSRClient } from '@/lib/supabase'
import { getIntelligenceAdapter } from '@/lib/platforms'
import { syncRosterSnapshot } from '@/lib/rosterSnapshotSync'
import type { Platform } from '@/types'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // RLS-scoped select — this can only ever return a league belonging to
  // the authenticated caller, never someone else's. Ownership is proven
  // HERE, before any service-role access happens below.
  const { data: league, error } = await supabase
    .from('connected_leagues')
    .select('id, platform, league_id, team_id')
    .eq('id', id)
    .maybeSingle()

  if (error || !league) return NextResponse.json({ error: 'Connected league not found' }, { status: 404 })
  if (!league.team_id) return NextResponse.json({ error: 'This league has no team assigned yet — cannot sync an owned roster' }, { status: 400 })

  const platform = league.platform as Platform
  const adapter = getIntelligenceAdapter(platform)
  if (!adapter) {
    const action = platform === 'yahoo' ? 'approval_pending' : 'unsupported'
    return NextResponse.json({
      outcome: { action, reason: `No roster-sync adapter available for platform '${platform}'`, snapshot: null, hadPreviousSnapshot: false },
      freshness: action,
      lastSnapshotAt: null,
    })
  }

  const context = {
    connectedLeagueId: league.id,
    userId: user.id,
    platform,
    externalLeagueId: league.league_id,
    externalTeamId: league.team_id,
  }

  const result = await syncRosterSnapshot(context, adapter)
  return NextResponse.json(result)
}
