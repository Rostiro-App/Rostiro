// T-111: classifies a live point delta as touchdown/reception/yardage/
// negative, using the league's real scoring settings — never a guessed
// universal constant. Same honesty precedent as detectTouchdownSwings:
// this is a magnitude/sign classification, not a play-by-play read, since
// no platform gives Rostiro real play-by-play. A delta spanning more than
// one real play between polls (a poll caught a whole series, not one snap)
// classifies as whichever band its total magnitude best matches — usually
// right, occasionally a blowout series reads as "touchdown" when it was a
// touchdown plus some yardage, which is the correct read anyway.

import { getSleeperLeague } from '@/lib/sleeper'
import { getEspnLeagueSettings } from '@/lib/espn'
import { normalizeSleeperLeague, normalizeEspnLeague } from '@/lib/normalize'
import { decrypt } from '@/lib/encrypt'
import { createAdminClient } from '@/lib/supabase'
import type { PlayerPointDelta } from '@/lib/liveMatchupPoints'
import type { ScoringSettings } from '@/types'

type AdminClient = ReturnType<typeof createAdminClient>

export type LiveEventType = 'touchdown' | 'big_play' | 'reception' | 'yardage' | 'negative'

export interface ClassifiedLiveEvent extends PlayerPointDelta {
  eventType: LiveEventType
  delta: number
}

// A touchdown-magnitude delta is at least the smallest of the league's real
// TD values, minus a little slack — a poll can catch a TD plus a couple of
// extra yards in the same jump, which should still read as "touchdown," not
// get bucketed as merely "big yardage."
const TD_SLACK = 0.75

// A single-poll jump this large without reaching TD magnitude is a real
// chunk play (e.g. a 35+ yard catch in PPR: 1 + 3.5 = 4.5) — founder-
// flagged that these deserve the same takeover treatment as a TD, with
// honest "BIG PLAY" copy instead of pretending magnitude alone proves a
// score. In points, not yards, so it scales with the league's own
// yards-per-point settings like everything else here.
const BIG_PLAY_MIN_POINTS = 3.5

export function classifyPointDelta(delta: number, scoring: ScoringSettings, position?: string | null): LiveEventType | null {
  if (delta === 0) return null
  if (delta < 0) return 'negative'

  // Position-aware TD threshold: only a QB's delta is measured against the
  // (usually lower, e.g. 4pt) passing-TD value. Without this, a 4-pt-pass-TD
  // league dragged the threshold to ~3.25 for EVERYONE, so a WR's +4.5
  // chunk play got overclaimed as "TOUCHDOWN" — the exact dishonesty the
  // big_play tier exists to avoid. Unknown position keeps the conservative
  // (lowest) threshold rather than risking calling a real QB TD a big play.
  const tdThreshold =
    position && position !== 'QB'
      ? Math.min(scoring.rushTouchdownPoints, scoring.receivingTouchdownPoints) - TD_SLACK
      : Math.min(scoring.rushTouchdownPoints, scoring.receivingTouchdownPoints, scoring.qbTouchdownPoints) - TD_SLACK
  if (delta >= tdThreshold) return 'touchdown'
  if (delta >= BIG_PLAY_MIN_POINTS) return 'big_play'

  if (scoring.ppr > 0 && Math.abs(delta - scoring.ppr) < 0.25) return 'reception'

  return 'yardage'
}

// Fetched fresh rather than trusted from connected_leagues.scoring_settings_json —
// found while building this that column is stale for the one real Sleeper
// league (captured before this session's normalizeSleeperLeague fix) and
// null entirely for the one real ESPN league (never populated at connect
// time). A live event misclassified off stale scoring is worse than one
// extra API call per league per classification pass.
async function fetchLeagueScoring(
  admin: AdminClient,
  leagueRowId: string
): Promise<ScoringSettings | null> {
  const { data: league } = await admin
    .from('connected_leagues')
    .select('platform, league_id, user_id, team_id')
    .eq('id', leagueRowId)
    .maybeSingle()
  if (!league) return null

  try {
    if (league.platform === 'sleeper') {
      const raw = await getSleeperLeague(league.league_id)
      return normalizeSleeperLeague({ league: raw }, Number(league.team_id ?? 0)).scoringSettings
    }
    if (league.platform === 'espn') {
      const { data: creds } = await admin.from('espn_credentials').select('espn_s2, swid').eq('user_id', league.user_id).maybeSingle()
      if (!creds) return null
      const credentials = { espnS2: decrypt(creds.espn_s2), swid: decrypt(creds.swid) }
      const raw = await getEspnLeagueSettings(league.league_id, credentials)
      return normalizeEspnLeague(raw).scoringSettings
    }
  } catch {
    return null
  }
  return null
}

export async function classifyDeltas(admin: AdminClient, deltas: PlayerPointDelta[]): Promise<ClassifiedLiveEvent[]> {
  if (deltas.length === 0) return []

  // Positions in one batched lookup — needed for the position-aware TD
  // threshold above (a 4-pt passing TD league must not lower the bar for
  // non-QBs).
  const playerIds = [...new Set(deltas.map((d) => d.playerId))]
  const { data: positionRows } = await admin
    .from('players_cache')
    .select('player_id, platform, position')
    .in('player_id', playerIds)
  const positionByKey = new Map(
    ((positionRows ?? []) as { player_id: string; platform: string; position: string | null }[]).map((p) => [`${p.platform}:${p.player_id}`, p.position])
  )

  const scoringByLeague = new Map<string, ScoringSettings | null>()
  const classified: ClassifiedLiveEvent[] = []

  for (const d of deltas) {
    if (!scoringByLeague.has(d.leagueRowId)) {
      scoringByLeague.set(d.leagueRowId, await fetchLeagueScoring(admin, d.leagueRowId))
    }
    const scoring = scoringByLeague.get(d.leagueRowId)
    if (!scoring) continue

    const delta = d.newPoints - d.prevPoints
    const eventType = classifyPointDelta(delta, scoring, positionByKey.get(`${d.platform}:${d.playerId}`) ?? null)
    if (!eventType) continue

    classified.push({ ...d, eventType, delta })
  }

  return classified
}
