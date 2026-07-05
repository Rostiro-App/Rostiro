// T-64.1/T-64.2: Draft Copilot — join a live/mock draft. Sleeper (no auth,
// anonymous rows) and Yahoo (requires sign-in + a connected Yahoo account —
// no anonymous path since Yahoo's draft data is behind OAuth) are both
// handled here. See docs/plans/wise-crunching-wreath.md for the full design
// (in particular: why Yahoo's draft-slot resolution can fail pre-draft and
// needs a manual fallback, and the cross-platform player-ID issue solved in
// the picks route).

import { createSSRClient, createAdminClient } from '@/lib/supabase'
import { getSleeperDraft, getSleeperDrafts, getSleeperLeague, getSleeperRosters, getSleeperUser } from '@/lib/sleeper'
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
import type { DraftSettings, DraftStrategy, ScoringSettings } from '@/types'

const StrategyField = z.enum(['balanced', 'zero_rb', 'hero_rb', 'hero_wr']).default('balanced')

// Not z.discriminatedUnion: Zod throws "Duplicate discriminator value" at
// parse time if two branches share a discriminant value (verified directly
// against the real Zod version in this project before relying on it) —
// and two Sleeper join paths (manual draftId+username vs. an already-
// connected league) both need platform: 'sleeper'. A plain z.union tries
// each branch in order instead, which is exactly what's needed here.
const Body = z.union([
  z.object({
    platform: z.literal('sleeper'),
    draftId: z.string().min(1),
    username: z.string().min(1),
    strategy: StrategyField,
  }),
  // Found via a real live draft (July 4, 2026): a user who's already
  // connected a Sleeper league to Rostiro shouldn't have to re-type a
  // draft ID and username Rostiro already knows — both are resolvable
  // directly from the connected league. Zero manual entry.
  z.object({
    platform: z.literal('sleeper'),
    connectedLeagueId: z.string().min(1),
    strategy: StrategyField,
  }),
  z.object({
    platform: z.literal('yahoo'),
    yahooLeagueId: z.string().min(1),
    manualDraftPosition: z.number().int().positive().optional(),
    strategy: StrategyField,
  }),
])

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = Body.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (parsed.data.platform === 'sleeper' && 'connectedLeagueId' in parsed.data) {
    return joinSleeperDraftFromConnectedLeague(parsed.data)
  }
  if (parsed.data.platform === 'sleeper') {
    return joinSleeperDraft(parsed.data)
  }
  return joinYahooDraft(parsed.data)
}

async function joinSleeperDraftFromConnectedLeague(data: { connectedLeagueId: string; strategy: DraftStrategy }) {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'sign_in_required' }, { status: 401 })
  }

  // RLS-scoped select — this can only ever return a league belonging to
  // the authenticated caller, never someone else's.
  const { data: connectedLeague, error: leagueError } = await supabase
    .from('connected_leagues')
    .select('league_id, team_id')
    .eq('id', data.connectedLeagueId)
    .eq('platform', 'sleeper')
    .maybeSingle()

  if (leagueError || !connectedLeague) {
    return NextResponse.json({ error: 'Connected league not found' }, { status: 404 })
  }
  if (!connectedLeague.team_id) {
    return NextResponse.json({ error: 'This league has no roster assigned yet' }, { status: 404 })
  }

  try {
    const draftList = await getSleeperDrafts(connectedLeague.league_id)
    // Prefer a draft actually in progress, then one not yet started, then
    // whatever's most recent — a league can carry multiple drafts across
    // seasons/re-drafts.
    const draftSummary =
      draftList.find((d) => d.status === 'drafting') ??
      draftList.find((d) => d.status === 'pre_draft') ??
      draftList[0]
    if (!draftSummary) {
      return NextResponse.json({ error: 'No draft found for this league' }, { status: 404 })
    }

    // Verified live (July 4, 2026): Sleeper's list endpoint
    // (/league/{id}/drafts) never includes slot_to_roster_id, only the
    // single-draft endpoint does — a real API inconsistency, not a
    // pre-draft-vs-started difference. The list is only good for picking
    // which draft_id is relevant; this second call gets the full object.
    const draft = await getSleeperDraft(draftSummary.draft_id)

    const [league, rosters] = await Promise.all([
      getSleeperLeague(connectedLeague.league_id),
      getSleeperRosters(connectedLeague.league_id),
    ])

    const myRoster = rosters.find((r) => String(r.roster_id) === connectedLeague.team_id)
    if (!myRoster) {
      return NextResponse.json({ error: 'Could not find your roster in this league' }, { status: 404 })
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
      strategy: data.strategy,
    }

    return insertSession({ userId: user.id, platform: 'sleeper', draftId: draft.draft_id, settings })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function joinSleeperDraft(data: { draftId: string; username: string; strategy: DraftStrategy }) {
  const { draftId, username, strategy } = data

  try {
    const draft = await getSleeperDraft(draftId)
    const sleeperUser = await getSleeperUser(username)

    let settings: DraftSettings

    if (draft.league_id) {
      // Real league draft — resolve identity via the actual roster.
      const [league, rosters] = await Promise.all([
        getSleeperLeague(draft.league_id),
        getSleeperRosters(draft.league_id),
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

      settings = {
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
        strategy,
      }
    } else {
      // Mock draft — confirmed live (no league behind it): league_id is
      // null, there's no roster to look up, and picks report roster_id:
      // null. draft_order maps the user directly to a slot instead, and
      // that same slot number (as a string) is what the picks route matches
      // against each pick's draft_slot for isMyPick.
      const mySlot = draft.draft_order?.[sleeperUser.user_id]
      if (mySlot === undefined) {
        return NextResponse.json(
          { error: `Could not find "${username}" in this mock draft` },
          { status: 404 }
        )
      }

      settings = {
        platform: 'sleeper',
        leagueId: null,
        draftId: draft.draft_id,
        teamCount: draft.settings.teams,
        myDraftPosition: mySlot,
        myRosterId: String(mySlot),
        totalRounds: draft.settings.rounds,
        scoringSettings: scoringSettingsFromMockType(draft.metadata?.scoring_type),
        rosterSlots: rosterSlotsFromDraftSettings(draft.settings),
        isSnakeDraft: draft.type === 'snake',
        strategy,
      }
    }

    const supabase = await createSSRClient()
    const { data: { user } } = await supabase.auth.getUser()

    return insertSession({ userId: user?.id ?? null, platform: 'sleeper', draftId: draft.draft_id, settings })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Mock drafts have no real league to normalize scoring/roster settings from
// (normalizeSleeperLeague expects one) — build them directly from the
// draft's own settings/metadata instead, confirmed against a live mock draft.
function rosterSlotsFromDraftSettings(settings: {
  rounds: number
  slots_qb: number
  slots_rb: number
  slots_wr: number
  slots_te: number
  slots_flex: number
  slots_k: number
  slots_def: number
  slots_bn?: number
}): string[] {
  const starters = [
    ...Array(settings.slots_qb).fill('QB'),
    ...Array(settings.slots_rb).fill('RB'),
    ...Array(settings.slots_wr).fill('WR'),
    ...Array(settings.slots_te).fill('TE'),
    ...Array(settings.slots_flex).fill('FLEX'),
    ...Array(settings.slots_k).fill('K'),
    ...Array(settings.slots_def).fill('DEF'),
  ]
  // Mock draft settings don't include slots_bn — bench is whatever's left
  // of the total rounds after starters.
  const benchCount = settings.slots_bn ?? Math.max(0, settings.rounds - starters.length)
  return [...starters, ...Array(benchCount).fill('BN')]
}

function scoringSettingsFromMockType(scoringType: 'std' | 'ppr' | 'half_ppr' | undefined): ScoringSettings {
  const ppr = scoringType === 'ppr' ? 1 : scoringType === 'half_ppr' ? 0.5 : 0
  return {
    ppr,
    tePremium: 0,
    qbTouchdownPoints: 4,
    passingYardsPerPoint: 1 / 25,
    rushingYardsPerPoint: 1 / 10,
    receivingYardsPerPoint: 1 / 10,
    isSuperFlex: false,
    isHalfPpr: ppr === 0.5,
    rushTouchdownPoints: 6,
    receivingTouchdownPoints: 6,
    fumbleLostPoints: -2,
    interceptionThrownPoints: -2,
  }
}

async function joinYahooDraft(data: {
  yahooLeagueId: string
  manualDraftPosition?: number
  strategy: DraftStrategy
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
      strategy: data.strategy,
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
