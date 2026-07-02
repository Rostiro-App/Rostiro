// T-64.1: poll a live draft's picks. Client hits this on a 10-second
// interval (matching PRD 5.4's Sleeper poll cadence) — this is the only
// network round trip in the whole Copilot loop; everything else (best
// available, turn countdown, run/snipe detection) is computed client-side
// from the result, with no additional API calls per view.

import { createAdminClient } from '@/lib/supabase'
import { pollSleeperDraft } from '@/lib/sleeper'
import { NextResponse } from 'next/server'
import type { DraftPick, DraftSettings, NFLPosition } from '@/types'

interface CachedPlayer {
  player_id: string
  name: string
  position: string | null
  adp_sleeper: number | null
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()

  const { data: session, error: sessionError } = await admin
    .from('draft_sessions')
    .select('draft_id, settings_json')
    .eq('id', id)
    .single()

  if (sessionError || !session.draft_id) {
    return NextResponse.json({ error: sessionError?.message ?? 'Session not found' }, { status: 404 })
  }

  const settings = session.settings_json as DraftSettings

  let rawPicks
  try {
    rawPicks = await pollSleeperDraft(session.draft_id)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 502 })
  }

  const playerIds = rawPicks.map((p) => p.player_id).filter(Boolean)
  const { data: cached } = playerIds.length
    ? await admin
        .from('players_cache')
        .select('player_id, name, position, adp_sleeper')
        .eq('platform', 'sleeper')
        .in('player_id', playerIds)
    : { data: [] }

  const byId = new Map((cached ?? []).map((p) => [p.player_id, p as CachedPlayer]))

  const picks: DraftPick[] = rawPicks.map((raw) => {
    const c = byId.get(raw.player_id)
    const name = c?.name || `${raw.metadata?.first_name ?? ''} ${raw.metadata?.last_name ?? ''}`.trim()
    const position = (c?.position ?? raw.metadata?.position ?? 'BN') as NFLPosition
    const adpConsensus = c?.adp_sleeper ?? null

    return {
      pickNumber: raw.pick_no,
      round: raw.round,
      pickInRound: raw.draft_slot,
      playerId: raw.player_id,
      playerName: name,
      position,
      nflTeam: raw.metadata?.team ?? '',
      pickedByTeamId: String(raw.roster_id),
      isMyPick: settings.myRosterId !== null && String(raw.roster_id) === settings.myRosterId,
      adpConsensus,
      adpDelta: adpConsensus !== null ? raw.pick_no - adpConsensus : null,
    }
  })

  const myPicks = picks.filter((p) => p.isMyPick)

  await admin
    .from('draft_sessions')
    .update({ picks_json: picks, my_picks_json: myPicks })
    .eq('id', id)

  return NextResponse.json({
    picks,
    myPicks,
    currentPickNumber: picks.length + 1,
    settings,
  })
}
