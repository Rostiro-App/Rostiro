// T-64.1/T-64.2: poll a live draft's picks. Client hits this on an interval —
// this is the only network round trip in the whole Copilot loop; everything
// else (best available, turn countdown, run/snipe detection) is computed
// client-side from the result, with no additional API calls per view.
//
// Yahoo's player IDs live in a different namespace than players_cache (which
// only has Sleeper platform='sleeper' rows). Without resolving Yahoo's
// player_key to a Sleeper-space playerId, the client's best-available filter
// would silently never remove drafted players — see
// docs/plans/wise-crunching-wreath.md for the full reasoning. Resolution
// chain: player_mappings.yahoo_id (currently unseeded, so this will rarely
// hit today) -> name+team match against players_cache -> raw Yahoo player_key
// as a last resort (bounded degradation: only that one player misses
// filtering/ADP, not the whole draft).

import { createAdminClient } from '@/lib/supabase'
import { pollSleeperDraft } from '@/lib/sleeper'
import { getValidYahooAccessToken, getYahooDraftResults, getYahooPlayersByKeys } from '@/lib/yahoo'
import { normalizeYahooDraftResults, normalizeYahooPlayers } from '@/lib/normalize'
import { NextResponse } from 'next/server'
import type { DraftPick, DraftSettings, NFLPosition } from '@/types'

interface CachedPlayer {
  player_id: string
  name: string
  position: string | null
  nfl_team: string | null
  adp_sleeper: number | null
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()

  const { data: session, error: sessionError } = await admin
    .from('draft_sessions')
    .select('draft_id, settings_json, user_id')
    .eq('id', id)
    .single()

  if (sessionError || !session.draft_id) {
    return NextResponse.json({ error: sessionError?.message ?? 'Session not found' }, { status: 404 })
  }

  const settings = session.settings_json as DraftSettings

  let picks: DraftPick[]
  try {
    picks = settings.platform === 'yahoo'
      ? await buildYahooPicks(admin, session.draft_id, session.user_id, settings)
      : await buildSleeperPicks(admin, session.draft_id, settings)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 502 })
  }

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

async function buildSleeperPicks(
  admin: ReturnType<typeof createAdminClient>,
  draftId: string,
  settings: DraftSettings
): Promise<DraftPick[]> {
  const rawPicks = await pollSleeperDraft(draftId)

  const playerIds = rawPicks.map((p) => p.player_id).filter(Boolean)
  const { data: cached } = playerIds.length
    ? await admin
        .from('players_cache')
        .select('player_id, name, position, nfl_team, adp_sleeper')
        .eq('platform', 'sleeper')
        .in('player_id', playerIds)
    : { data: [] }

  const byId = new Map((cached ?? []).map((p) => [p.player_id, p as CachedPlayer]))

  return rawPicks.map((raw) => {
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
}

async function buildYahooPicks(
  admin: ReturnType<typeof createAdminClient>,
  leagueKey: string,
  userId: string | null,
  settings: DraftSettings
): Promise<DraftPick[]> {
  if (!userId) throw new Error('Yahoo draft sessions require an owning user')

  const accessToken = await getValidYahooAccessToken(userId)
  const draftResultsRaw = await getYahooDraftResults(leagueKey, accessToken)
  const results = normalizeYahooDraftResults(draftResultsRaw)

  const playerKeys = results.map((r) => r.playerKey).filter((k): k is string => k !== null)
  const yahooIds = playerKeys.map((k) => k.split('.p.')[1]).filter(Boolean)

  // Tier 1: player_mappings (currently unseeded — will rarely hit, see file header)
  const { data: mappings } = yahooIds.length
    ? await admin.from('player_mappings').select('yahoo_id, sleeper_id, name, nfl_team').in('yahoo_id', yahooIds)
    : { data: [] }
  const mappingByYahooId = new Map((mappings ?? []).map((m) => [m.yahoo_id, m]))

  // Tier 2: fetch names from Yahoo, then name+team match against players_cache
  const unmapped = yahooIds.filter((yid) => !mappingByYahooId.has(yid))
  const unmappedKeys = playerKeys.filter((k) => unmapped.includes(k.split('.p.')[1]))

  const yahooPlayerInfo = unmappedKeys.length
    ? normalizeYahooPlayers(await getYahooPlayersByKeys(leagueKey, unmappedKeys, accessToken))
    : []
  const yahooInfoByKey = new Map(yahooPlayerInfo.map((p) => [p.playerKey, p]))

  const namesToMatch = yahooPlayerInfo.map((p) => p.name).filter(Boolean)
  const { data: nameMatches } = namesToMatch.length
    ? await admin
        .from('players_cache')
        .select('player_id, name, position, nfl_team, adp_sleeper')
        .eq('platform', 'sleeper')
        .in('name', namesToMatch)
    : { data: [] }
  const cachedByName = new Map((nameMatches ?? []).map((p) => [p.name, p as CachedPlayer]))

  return results.map((r) => {
    if (!r.playerKey) {
      return blankPick(r, settings)
    }

    const yahooId = r.playerKey.split('.p.')[1]
    const mapping = mappingByYahooId.get(yahooId)

    let cached: CachedPlayer | undefined
    let fallbackName: string | undefined
    let fallbackTeam: string | undefined
    let fallbackPosition: string | undefined

    if (mapping?.sleeper_id) {
      cached = { player_id: mapping.sleeper_id, name: mapping.name, position: null, nfl_team: mapping.nfl_team, adp_sleeper: null }
    } else {
      const info = yahooInfoByKey.get(r.playerKey)
      fallbackName = info?.name
      fallbackTeam = info?.team
      fallbackPosition = info?.position
      if (fallbackName) cached = cachedByName.get(fallbackName)
    }

    const resolvedId = cached?.player_id ?? r.playerKey
    const name = cached?.name ?? fallbackName ?? r.playerKey
    const position = (cached?.position ?? fallbackPosition ?? 'BN') as NFLPosition
    const nflTeam = cached?.nfl_team ?? fallbackTeam ?? ''
    const adpConsensus = cached?.adp_sleeper ?? null

    return {
      pickNumber: r.pickNumber,
      round: r.round,
      pickInRound: pickInRoundFor(r.pickNumber, r.round, settings.teamCount),
      playerId: resolvedId,
      playerName: name,
      position,
      nflTeam,
      pickedByTeamId: r.teamKey,
      isMyPick: settings.myRosterId !== null && r.teamKey === settings.myRosterId,
      adpConsensus,
      adpDelta: adpConsensus !== null ? r.pickNumber - adpConsensus : null,
    }
  })
}

function blankPick(
  r: { pickNumber: number; round: number; teamKey: string },
  settings: DraftSettings
): DraftPick {
  return {
    pickNumber: r.pickNumber,
    round: r.round,
    pickInRound: pickInRoundFor(r.pickNumber, r.round, settings.teamCount),
    playerId: '',
    playerName: 'Unknown',
    position: 'BN',
    nflTeam: '',
    pickedByTeamId: r.teamKey,
    isMyPick: settings.myRosterId !== null && r.teamKey === settings.myRosterId,
    adpConsensus: null,
    adpDelta: null,
  }
}

// Yahoo doesn't return a draft_slot field the way Sleeper does — derive it
// from the pick number, round, and snake-draft ordering.
function pickInRoundFor(pickNumber: number, round: number, teamCount: number): number {
  const positionInRound = pickNumber - (round - 1) * teamCount
  return round % 2 === 1 ? positionInRound : teamCount - positionInRound + 1
}
