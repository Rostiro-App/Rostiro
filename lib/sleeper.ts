// T-04: Sleeper API client
// Public REST API — no auth required. Username lookup only.
// Rate limit: stay under 1,000 req/min. 10-second polling = 6 req/min.

import { SleeperAPIError, type League, type Roster, type DraftPick, type Platform } from '@/types'

const BASE_URL = 'https://api.sleeper.app/v1'
const SEASON = 2026
const SPORT = 'nfl'

async function sleeperFetch<T>(path: string): Promise<T> {
  const url = `${BASE_URL}${path}`
  let res: Response

  try {
    res = await fetch(url, { next: { revalidate: 0 } })
  } catch (err) {
    throw new SleeperAPIError(`Network error fetching ${path}: ${String(err)}`, 'SLEEPER_NETWORK_ERROR')
  }

  if (res.status === 404) {
    throw new SleeperAPIError(`Sleeper resource not found: ${path}`, 'SLEEPER_NOT_FOUND', 404)
  }

  if (!res.ok) {
    throw new SleeperAPIError(
      `Sleeper API error ${res.status} on ${path}`,
      'SLEEPER_HTTP_ERROR',
      res.status
    )
  }

  return res.json() as Promise<T>
}

// ─── Types (raw Sleeper API shapes) ───────────────────────────────────────────

interface SleeperUser {
  user_id: string
  username: string
  display_name: string
  avatar: string | null
}

interface SleeperLeague {
  league_id: string
  name: string
  season: string
  total_rosters: number
  status: string
  settings: {
    rec: number
    bonus_rec_te: number
    pass_td: number
  }
  roster_positions: string[]
}

interface SleeperRoster {
  roster_id: number
  owner_id: string
  league_id: string
  players: string[]
  starters: string[]
  settings: {
    wins: number
    losses: number
    ties: number
    fpts: number
    fpts_against: number
  }
}

interface SleeperDraftPick {
  round: number
  draft_slot: number
  pick_no: number
  player_id: string
  picked_by: string
  roster_id: number
  metadata: {
    first_name: string
    last_name: string
    position: string
    team: string
  }
}

interface SleeperDraft {
  draft_id: string
  league_id: string
  status: 'pre_draft' | 'drafting' | 'complete' | 'paused'
  type: 'snake' | 'auction' | 'linear'
  settings: {
    teams: number
    rounds: number
    pick_timer: number
    slots_wr: number
    slots_rb: number
    slots_qb: number
    slots_te: number
    slots_flex: number
    slots_k: number
    slots_def: number
    slots_bn: number
  }
  slot_to_roster_id: Record<string, number>
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getSleeperUser(username: string): Promise<SleeperUser> {
  const user = await sleeperFetch<SleeperUser | null>(`/user/${encodeURIComponent(username)}`)
  if (!user) {
    throw new SleeperAPIError(`Sleeper user not found: ${username}`, 'SLEEPER_USER_NOT_FOUND', 404)
  }
  return user
}

export async function getSleeperLeagues(userId: string): Promise<SleeperLeague[]> {
  return sleeperFetch<SleeperLeague[]>(`/user/${userId}/leagues/${SPORT}/${SEASON}`)
}

export async function getSleeperRosters(leagueId: string): Promise<SleeperRoster[]> {
  return sleeperFetch<SleeperRoster[]>(`/league/${leagueId}/rosters`)
}

export async function getSleeperMatchups(leagueId: string, week: number): Promise<unknown[]> {
  return sleeperFetch<unknown[]>(`/league/${leagueId}/matchups/${week}`)
}

export async function getSleeperDrafts(leagueId: string): Promise<SleeperDraft[]> {
  return sleeperFetch<SleeperDraft[]>(`/league/${leagueId}/drafts`)
}

export async function getSleeperDraftPicks(draftId: string): Promise<SleeperDraftPick[]> {
  return sleeperFetch<SleeperDraftPick[]>(`/draft/${draftId}/picks`)
}

// Used for live draft polling — returns all picks made so far.
// Caller diffs against previous poll to detect new picks.
export async function pollSleeperDraft(draftId: string): Promise<SleeperDraftPick[]> {
  return getSleeperDraftPicks(draftId)
}

// ─── Normalized output (for normalize.ts) ─────────────────────────────────────

export interface SleeperLeagueRaw {
  league: SleeperLeague
  myRoster: SleeperRoster
  allRosters: SleeperRoster[]
  userId: string
}

export async function fetchSleeperLeagueData(
  username: string,
  leagueId: string
): Promise<SleeperLeagueRaw> {
  const user = await getSleeperUser(username)
  const leagues = await getSleeperLeagues(user.user_id)
  const league = leagues.find((l) => l.league_id === leagueId)

  if (!league) {
    throw new SleeperAPIError(
      `League ${leagueId} not found for user ${username}`,
      'SLEEPER_LEAGUE_NOT_FOUND',
      404
    )
  }

  const allRosters = await getSleeperRosters(leagueId)
  const myRoster = allRosters.find((r) => r.owner_id === user.user_id)

  if (!myRoster) {
    throw new SleeperAPIError(
      `Could not find roster for user ${user.user_id} in league ${leagueId}`,
      'SLEEPER_ROSTER_NOT_FOUND',
      404
    )
  }

  return { league, myRoster, allRosters, userId: user.user_id }
}

// Fetch all leagues for a Sleeper username
export async function fetchAllSleeperLeagues(username: string): Promise<SleeperLeagueRaw[]> {
  const user = await getSleeperUser(username)
  const leagues = await getSleeperLeagues(user.user_id)

  const results = await Promise.allSettled(
    leagues.map(async (league) => {
      const allRosters = await getSleeperRosters(league.league_id)
      const myRoster = allRosters.find((r) => r.owner_id === user.user_id)
      if (!myRoster) return null
      return { league, myRoster, allRosters, userId: user.user_id }
    })
  )

  return results
    .filter(
      (r): r is PromiseFulfilledResult<SleeperLeagueRaw> =>
        r.status === 'fulfilled' && r.value !== null
    )
    .map((r) => r.value)
}
