// T-64.1: Draft Copilot — join a live/mock Sleeper draft.
//
// No auth required — Draft Kit is the no-account acquisition funnel, and
// draft_sessions already supports anonymous rows (user_id nullable). Writes
// go through the admin client since there's no anonymous INSERT policy on
// this table (only an anonymous SELECT policy).

import { createSSRClient, createAdminClient } from '@/lib/supabase'
import { getSleeperDraft, getSleeperLeague, getSleeperRosters, getSleeperUser } from '@/lib/sleeper'
import { normalizeSleeperLeague } from '@/lib/normalize'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { DraftSettings } from '@/types'

const Body = z.object({
  draftId: z.string().min(1),
  username: z.string().min(1),
})

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = Body.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'draftId and username are required' }, { status: 400 })
  }
  const { draftId, username } = parsed.data

  try {
    const draft = await getSleeperDraft(draftId)
    const [league, rosters, sleeperUser] = await Promise.all([
      getSleeperLeague(draft.league_id),
      getSleeperRosters(draft.league_id),
      getSleeperUser(username),
    ])

    const myRoster = rosters.find((r) => r.owner_id === sleeperUser.user_id)
    if (!myRoster) {
      return NextResponse.json(
        { error: `Could not find "${username}" in this draft's league` },
        { status: 404 }
      )
    }

    const mySlot = Object.entries(draft.slot_to_roster_id).find(
      ([, rosterId]) => rosterId === myRoster.roster_id
    )?.[0]
    if (!mySlot) {
      return NextResponse.json({ error: 'Could not resolve draft position for this roster' }, { status: 500 })
    }

    const normalized = normalizeSleeperLeague(league, myRoster.roster_id)

    const settings: DraftSettings = {
      platform: 'sleeper',
      leagueId: draft.league_id,
      draftId: draft.draft_id,
      teamCount: draft.settings.teams,
      myDraftPosition: Number(mySlot),
      myRosterId: String(myRoster.roster_id),
      totalRounds: draft.settings.rounds,
      scoringSettings: normalized.scoringSettings,
      rosterSlots: normalized.rosterSlots,
      isSnakeDraft: draft.type === 'snake',
    }

    const supabase = await createSSRClient()
    const { data: { user } } = await supabase.auth.getUser()

    const admin = createAdminClient()
    const { data: session, error } = await admin
      .from('draft_sessions')
      .insert({
        user_id: user?.id ?? null,
        platform: 'sleeper',
        draft_id: draft.draft_id,
        status: draft.status === 'complete' ? 'complete' : 'active',
        settings_json: settings,
        picks_json: [],
        my_picks_json: [],
      })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ sessionId: session.id, settings })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
