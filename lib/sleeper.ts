// T-04: Sleeper API client
// Public REST API — no auth required. Username lookup only.
// Rate limit: stay under 1,000 req/min. 10-second polling = 6 req/min.

import { SleeperAPIError } from '@/types'
import { checkCircuitBreaker, recordApiCall } from '@/lib/observability'

const BASE_URL = 'https://api.sleeper.app/v1'
export const SEASON = 2026
const SPORT = 'nfl'

// T-84: circuit-checked and latency-logged — every Sleeper call in the app
// funnels through this one function, so instrumenting here covers all of
// them. A tripped breaker throws immediately, before ever touching the
// network, so callers fall back to their own cached data instead of
// piling more requests onto an already-erroring Sleeper.
async function sleeperFetch<T>(path: string): Promise<T> {
  await checkCircuitBreaker('sleeper')
  const start = Date.now()
  const url = `${BASE_URL}${path}`
  let res: Response

  try {
    res = await fetch(url, { next: { revalidate: 0 } })
  } catch (err) {
    await recordApiCall('sleeper', path, Date.now() - start, false)
    throw new SleeperAPIError(`Network error fetching ${path}: ${String(err)}`, 'SLEEPER_NETWORK_ERROR')
  }

  if (res.status === 404) {
    await recordApiCall('sleeper', path, Date.now() - start, false, 404)
    throw new SleeperAPIError(`Sleeper resource not found: ${path}`, 'SLEEPER_NOT_FOUND', 404)
  }

  if (!res.ok) {
    await recordApiCall('sleeper', path, Date.now() - start, false, res.status)
    throw new SleeperAPIError(
      `Sleeper API error ${res.status} on ${path}`,
      'SLEEPER_HTTP_ERROR',
      res.status
    )
  }

  await recordApiCall('sleeper', path, Date.now() - start, true, res.status)
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
    // T-108: total FAAB budget for the league — verified live against a
    // real 2026 league (waiver_budget: 100).
    waiver_budget?: number
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
    // T-108: FAAB already spent by this roster — verified live (0 on a
    // pre-draft league, as expected).
    waiver_budget_used?: number
  }
}

interface SleeperDraftPick {
  round: number
  draft_slot: number
  pick_no: number
  player_id: string
  picked_by: string
  // Mock drafts (no real league behind them) always report roster_id: null —
  // draft_slot is the only reliable "who picked this" identifier for them.
  roster_id: number | null
  metadata: {
    first_name: string
    last_name: string
    position: string
    team: string
  }
}

interface SleeperDraft {
  draft_id: string
  // Mock drafts (started from sleeper.com/mockdraft, not tied to a real
  // league) always report league_id: null — confirmed against a live mock
  // draft. Real league drafts have the actual league_id.
  league_id: string | null
  status: 'pre_draft' | 'drafting' | 'complete' | 'paused'
  type: 'snake' | 'auction' | 'linear'
  // Unix ms of the scheduled draft start; null when the commissioner hasn't
  // scheduled it. Used by /api/system/status for the deadline countdown.
  start_time?: number | null
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
    // Confirmed absent on a live mock draft's settings object — bench count
    // there is implied as rounds minus the sum of starter slots above.
    slots_bn?: number
  }
  slot_to_roster_id: Record<string, number>
  // Only present on mock drafts — maps the creating/joined user's ID
  // directly to their draft slot, since there's no real roster to resolve it
  // from. Confirmed live: { "<user_id>": <slot> }.
  draft_order?: Record<string, number>
  metadata?: {
    scoring_type?: 'std' | 'ppr' | 'half_ppr'
  }
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

// T-108: two rosters sharing the same matchup_id are opponents that week.
// matchup_id is null for a roster on a bye (no opponent) — confirmed shape
// from Sleeper's own docs; verified live against a real 2026 league (empty
// array pre-season, as expected — no games played yet).
export interface SleeperMatchup {
  roster_id: number
  matchup_id: number | null
  points: number
  // T-111: confirmed present live on the real matchups endpoint (July 2026) —
  // players_points is a per-player-id fantasy point map for the week,
  // starters_points is the same values positionally ordered to match
  // `starters`. Both null/empty pre-season; this is what LIVE reads to show
  // "how many points does this player have right now."
  players_points?: Record<string, number>
  starters_points?: number[]
}

export async function getSleeperMatchups(leagueId: string, week: number): Promise<SleeperMatchup[]> {
  return sleeperFetch<SleeperMatchup[]>(`/league/${leagueId}/matchups/${week}`)
}

export interface FilmRoomResult {
  myScore: number
  opponentScore: number
  opponentRosterId: number
  // 6.10/T-108 MVP scope: win/loss by userScore > opponentScore, nothing
  // fancier — a tie (rare, only possible in some scoring formats) reports
  // won: null rather than guessing a framing for it.
  won: boolean | null
}

// Pure — takes the week's matchup rows, returns this roster's result or
// null if it wasn't part of a matchup that week (bye, or week not played).
export function computeFilmRoomResult(matchups: SleeperMatchup[], myRosterId: number): FilmRoomResult | null {
  const mine = matchups.find((m) => m.roster_id === myRosterId)
  if (!mine || mine.matchup_id === null) return null

  const opponent = matchups.find((m) => m.roster_id !== myRosterId && m.matchup_id === mine.matchup_id)
  if (!opponent) return null

  return {
    myScore: mine.points,
    opponentScore: opponent.points,
    opponentRosterId: opponent.roster_id,
    won: mine.points === opponent.points ? null : mine.points > opponent.points,
  }
}

export async function getSleeperDrafts(leagueId: string): Promise<SleeperDraft[]> {
  return sleeperFetch<SleeperDraft[]>(`/league/${leagueId}/drafts`)
}

// Fetch a single draft directly by ID — used to join a live/mock draft when
// the caller only has a draft_id (e.g. pasted from a Sleeper draft URL),
// not the league_id.
export async function getSleeperDraft(draftId: string): Promise<SleeperDraft> {
  return sleeperFetch<SleeperDraft>(`/draft/${draftId}`)
}

// Fetch a league directly by ID (as opposed to getSleeperLeagues, which
// lists a user's leagues for a season). Used to pull scoring settings and
// roster slots when joining a draft from just a draft_id.
export async function getSleeperLeague(leagueId: string): Promise<SleeperLeague> {
  return sleeperFetch<SleeperLeague>(`/league/${leagueId}`)
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

// ─── Player pool (for Draft Kit ADP cache) ────────────────────────────────────
// Sleeper has no dedicated ADP endpoint. search_rank on the full player object
// is Sleeper's internal ranking and the accepted proxy for ADP among indie devs.
// This payload is ~5MB — Sleeper's docs say fetch at most once/day. Only ever
// call this from the daily cron, never from a user-facing request.

const FANTASY_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DEF'])

interface SleeperPlayerRaw {
  player_id: string
  first_name: string | null
  last_name: string | null
  full_name: string | null
  position: string | null
  team: string | null
  status: string | null
  injury_status: string | null
  search_rank: number | null
  // T-87: NFL's official "Game Statistics and Information System" ID —
  // confirmed present on Sleeper's real payload (e.g. Todd Gurley:
  // "00-0032241"). This is the join key back to nflverse's snap-count data,
  // which has no Sleeper ID of its own (see lib/nflverseUsage.ts).
  gsis_id: string | null
  // T-110: real NFL depth chart position/order — confirmed present on
  // Sleeper's payload live (e.g. SF: McCaffrey order 1, Guerendo order 5).
  // This is what turns "starter goes down" into a deterministic "who
  // benefits" lookup instead of guesswork — see lib/opportunitySurge.ts.
  depth_chart_order: number | null
  depth_chart_position: string | null
}

export interface SleeperCachePlayer {
  playerId: string
  name: string
  firstName: string | null
  lastName: string | null
  position: string
  nflTeam: string | null
  injuryStatus: string | null
  // T-110: nullable now — a depth-charted-but-unranked player (e.g. a real
  // QB2/RB3 handcuff) is included below even with no meaningful ADP, so it
  // can still be name-resolved for opportunity-surge lookups. Draft Kit
  // already filters `.not('adp_sleeper', 'is', null)` server-side, so this
  // never leaks an unranked player into ADP-facing UI.
  adpSleeper: number | null
  gsisId: string | null
  depthChartOrder: number | null
  depthChartPosition: string | null
}

export async function getSleeperPlayers(): Promise<SleeperCachePlayer[]> {
  const raw = await sleeperFetch<Record<string, SleeperPlayerRaw>>('/players/nfl')

  return Object.values(raw)
    .filter(
      (p): p is SleeperPlayerRaw & { position: string } =>
        p.position !== null &&
        FANTASY_POSITIONS.has(p.position) &&
        // T-110: found live (July 5, 2026) that 123 real depth-charted
        // fantasy players — including handcuff-relevant names like a
        // backup QB and rostered-bench RBs — carry Sleeper's "unranked"
        // sentinel (search_rank: 9999999) and were silently excluded from
        // players_cache entirely by the old ranked-only filter. Keep any
        // player who's either meaningfully ranked OR on a real depth
        // chart — the two populations Rostiro actually needs.
        ((typeof p.search_rank === 'number' && p.search_rank < 9999999) ||
          (p.depth_chart_order !== null && p.team !== null))
    )
    .map((p) => ({
      playerId: p.player_id,
      name: p.full_name || `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || p.team || p.player_id,
      firstName: p.first_name,
      lastName: p.last_name,
      position: p.position,
      nflTeam: p.team,
      injuryStatus: p.injury_status,
      adpSleeper: typeof p.search_rank === 'number' && p.search_rank < 9999999 ? p.search_rank : null,
      gsisId: p.gsis_id,
      depthChartOrder: p.depth_chart_order,
      depthChartPosition: p.depth_chart_position,
    }))
    .sort((a, b) => (a.adpSleeper ?? Infinity) - (b.adpSleeper ?? Infinity))
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
