// T-64.1/T-64.2: Draft Copilot — join a live/mock draft. Sleeper (no auth,
// anonymous rows) and Yahoo (requires sign-in + a connected Yahoo account —
// no anonymous path since Yahoo's draft data is behind OAuth) are both
// handled here. See docs/plans/wise-crunching-wreath.md for the full design
// (in particular: why Yahoo's draft-slot resolution can fail pre-draft and
// needs a manual fallback, and the cross-platform player-ID issue solved in
// the picks route).

import { createSSRClient, createAdminClient } from '@/lib/supabase'
import { getSleeperDraft, getSleeperLeague, getSleeperRosters, getSleeperUser } from '@/lib/sleeper'
import {
  getValidYahooAccessToken,
  getYahooCurrentGameKey,
  getYahooLeague,
  getYahooLeagueTeams,
  getYahooDraftResults,
} from '@/lib/yahoo'
import { normalizeSleeperLeague, normalizeYahooLeague, normalizeYahooDraftResults } from '@/lib/normalize'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { YahooAPIError } from '@/types'
import type { DraftSettings } from '@/types'

const Body = z.discriminatedUnion('platform', [
  z.object({
    platform: z.literal('sleeper'),
    draftId: z.string().min(1),
    username: z.string().min(1),
  }),
  z.object({
    platform: z.literal('yahoo'),
    yahooLeagueId: z.string().min(1),
    manualDraftPosition: z.number().int().positive().optional(),
  }),
])

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = Body.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (parsed.data.platform === 'sleeper') {
    return joinSleeperDraft(parsed.data)
  }
  return joinYahooDraft(parsed.data)
}

async function joinSleeperDraft(data: { draftId: string; username: string }) {
  const { draftId, username } = data

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

    return insertSession({ userId: user?.id ?? null, platform: 'sleeper', draftId: draft.draft_id, settings })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function joinYahooDraft(data: {
  yahooLeagueId: string
  manualDraftPosition?: number
}) {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'sign_in_required' }, { status: 401 })
  }

  let accessToken: string
  try {
    accessToken = await getValidYahooAccessToken(user.id)
  } catch (err) {
    if (err instanceof YahooAPIError && err.code === 'YAHOO_NOT_CONNECTED') {
      return NextResponse.json({ error: 'yahoo_not_connected' }, { status: 401 })
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  try {
    const gameKey = await getYahooCurrentGameKey(accessToken)
    const leagueKey = `${gameKey}.l.${data.yahooLeagueId}`

    const [leagueRaw, teamsRaw, draftResultsRaw] = (await Promise.all([
      getYahooLeague(leagueKey, accessToken),
      getYahooLeagueTeams(leagueKey, accessToken),
      getYahooDraftResults(leagueKey, accessToken),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ])) as any[]

    const teams = teamsRaw?.fantasy_content?.league?.[1]?.teams ?? {}
    const teamCount = Number(teams.count ?? 0)
    let myTeamKey: string | null = null
    for (let i = 0; i < teamCount; i++) {
      const team = teams[String(i)]?.team?.[0]
      const isMine = Array.isArray(team)
        ? team.some((t) => t?.is_owned_by_current_login === 1)
        : team?.is_owned_by_current_login === 1
      if (isMine) {
        const teamKeyEntry = Array.isArray(team) ? team.find((t) => t?.team_key) : team
        myTeamKey = teamKeyEntry?.team_key ?? null
        break
      }
    }

    if (!myTeamKey) {
      return NextResponse.json(
        { error: `Could not find your team in Yahoo league ${data.yahooLeagueId}` },
        { status: 404 }
      )
    }

    const normalized = normalizeYahooLeague(leagueRaw)
    const draftResults = normalizeYahooDraftResults(draftResultsRaw)

    let myDraftPosition: number
    if (data.manualDraftPosition !== undefined) {
      myDraftPosition = data.manualDraftPosition
    } else {
      const myFirstPick = draftResults.find((r) => r.teamKey === myTeamKey && r.round === 1)
      if (!myFirstPick) {
        return NextResponse.json({ error: 'needs_manual_slot' }, { status: 409 })
      }
      myDraftPosition = myFirstPick.pickNumber
    }

    const settings: DraftSettings = {
      platform: 'yahoo',
      leagueId: leagueKey,
      draftId: leagueKey,
      teamCount: normalized.teamCount,
      myDraftPosition,
      myRosterId: myTeamKey,
      totalRounds: normalized.rosterSlots.length || 16,
      scoringSettings: normalized.scoringSettings,
      rosterSlots: normalized.rosterSlots,
      isSnakeDraft: true, // Yahoo doesn't expose draft type here; snake is the default for redraft leagues
    }

    return insertSession({ userId: user.id, platform: 'yahoo', draftId: leagueKey, settings })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function insertSession(args: {
  userId: string | null
  platform: 'sleeper' | 'yahoo'
  draftId: string
  settings: DraftSettings
}) {
  const admin = createAdminClient()
  const { data: session, error } = await admin
    .from('draft_sessions')
    .insert({
      user_id: args.userId,
      platform: args.platform,
      draft_id: args.draftId,
      status: 'active',
      settings_json: args.settings,
      picks_json: [],
      my_picks_json: [],
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sessionId: session.id, settings: args.settings })
}
