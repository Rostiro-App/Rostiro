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

export type LiveEventType = 'touchdown' | 'reception' | 'yardage' | 'negative'

export interface ClassifiedLiveEvent extends PlayerPointDelta {
  eventType: LiveEventType
  delta: number
}

// A touchdown-magnitude delta is at least the smallest of the league's real
// TD values, minus a little slack — a poll can catch a TD plus a couple of
// extra yards in the same jump, which should still read as "touchdown," not
// get bucketed as merely "big yardage."
const TD_SLACK = 0.75

export function classifyPointDelta(delta: number, scoring: ScoringSettings): LiveEventType | null {
  if (delta === 0) return null
  if (delta < 0) return 'negative'

  const tdThreshold = Math.min(scoring.rushTouchdownPoints, scoring.receivingTouchdownPoints, scoring.qbTouchdownPoints) - TD_SLACK
  if (delta >= tdThreshold) return 'touchdown'

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

  const scoringByLeague = new Map<string, ScoringSettings | null>()
  const classified: ClassifiedLiveEvent[] = []

  for (const d of deltas) {
    if (!scoringByLeague.has(d.leagueRowId)) {
      scoringByLeague.set(d.leagueRowId, await fetchLeagueScoring(admin, d.leagueRowId))
    }
    const scoring = scoringByLeague.get(d.leagueRowId)
    if (!scoring) continue

    const delta = d.newPoints - d.prevPoints
    const eventType = classifyPointDelta(delta, scoring)
    if (!eventType) continue

    classified.push({ ...d, eventType, delta })
  }

  return classified
}
