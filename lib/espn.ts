// T-06: ESPN Fantasy API client
// Unofficial v3 endpoints. Read only — no write API exists.
// espn_s2 + SWID cookies required for private leagues (enforced since Aug 2025).
// All calls go through EspnAPIError — never crash the app on ESPN failure.

import { EspnAPIError } from '@/types'
import { checkCircuitBreaker, recordApiCall } from '@/lib/observability'

const ESPN_API_BASE = 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl'
const SEASON = 2026

interface EspnCredentials {
  espnS2: string
  swid: string
}

// ─── Core fetcher ──────────────────────────────────────────────────────────────

// T-84: circuit-checked and latency-logged. 401/403/404 deliberately count
// as "success" toward the breaker — those mean one user's credentials are
// bad or one resource doesn't exist, not that ESPN itself is down, and
// tripping the breaker over a single user's expired cookies would wrongly
// block every other ESPN user's real, healthy calls. Only a network
// error, a 429, or an unexpected server error signals an actual outage.
async function espnFetch<T>(
  path: string,
  credentials: EspnCredentials,
  params?: Record<string, string>
): Promise<T> {
  await checkCircuitBreaker('espn')
  const start = Date.now()
  const url = new URL(`${ESPN_API_BASE}${path}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }

  let res: Response
  try {
    res = await fetch(url.toString(), {
      headers: {
        Cookie: `espn_s2=${credentials.espnS2}; SWID=${credentials.swid}`,
        'X-Fantasy-Filter': JSON.stringify({}),
      },
      next: { revalidate: 0 },
    })
  } catch (err) {
    await recordApiCall('espn', path, Date.now() - start, false)
    throw new EspnAPIError(`Network error fetching ${path}: ${String(err)}`, 'ESPN_NETWORK_ERROR')
  }

  if (res.status === 401 || res.status === 403) {
    await recordApiCall('espn', path, Date.now() - start, true, res.status)
    throw new EspnAPIError(
      'ESPN credentials are invalid or expired. Please re-enter your espn_s2 and SWID cookies.',
      'ESPN_AUTH_ERROR',
      res.status
    )
  }

  if (res.status === 404) {
    await recordApiCall('espn', path, Date.now() - start, true, 404)
    throw new EspnAPIError(
      `ESPN league or resource not found: ${path}`,
      'ESPN_NOT_FOUND',
      404
    )
  }

  if (res.status === 429) {
    await recordApiCall('espn', path, Date.now() - start, false, 429)
    throw new EspnAPIError('ESPN API rate limit exceeded', 'ESPN_RATE_LIMIT', 429)
  }

  if (!res.ok) {
    await recordApiCall('espn', path, Date.now() - start, false, res.status)
    throw new EspnAPIError(
      `ESPN API error ${res.status} on ${path}`,
      'ESPN_HTTP_ERROR',
      res.status
    )
  }

  await recordApiCall('espn', path, Date.now() - start, true, res.status)
  return res.json() as Promise<T>
}

function leagueUrl(leagueId: string): string {
  return `/seasons/${SEASON}/segments/0/leagues/${leagueId}`
}

// ─── Validation ────────────────────────────────────────────────────────────────
// Test credentials by fetching league settings. Returns true if valid.

export async function validateEspnCredentials(
  leagueId: string,
  credentials: EspnCredentials
): Promise<{ valid: boolean; leagueName?: string; error?: string }> {
  try {
    const data = await espnFetch<{ settings?: { name?: string } }>(
      leagueUrl(leagueId),
      credentials,
      { view: 'mSettings' }
    )
    return { valid: true, leagueName: data.settings?.name }
  } catch (err) {
    if (err instanceof EspnAPIError && err.code === 'ESPN_AUTH_ERROR') {
      return { valid: false, error: 'Invalid or expired ESPN cookies' }
    }
    return { valid: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ─── Read operations ───────────────────────────────────────────────────────────

export async function getEspnLeagueSettings(
  leagueId: string,
  credentials: EspnCredentials
): Promise<unknown> {
  return espnFetch(leagueUrl(leagueId), credentials, { view: 'mSettings' })
}

export async function getEspnRosters(
  leagueId: string,
  credentials: EspnCredentials
): Promise<unknown> {
  return espnFetch(leagueUrl(leagueId), credentials, { view: 'mRoster' })
}

export async function getEspnMatchup(
  leagueId: string,
  credentials: EspnCredentials,
  week?: number
): Promise<unknown> {
  const params: Record<string, string> = { view: 'mMatchup' }
  if (week) params['scoringPeriodId'] = String(week)
  return espnFetch(leagueUrl(leagueId), credentials, params)
}

// T-111: LIVE tab's per-player live points. Confirmed shape against real
// (not projected) box scores from a real league — a player stat entry
// carries multiple statSourceId values (0 = actual, 1 = projection); only
// statSourceId 0 for the requested week is real. appliedTotal there is
// ESPN's own already-scored fantasy point total for that player, that week
// — no separate math needed, unlike Sleeper's search_rank-style proxies.
export interface EspnLivePlayerPoints {
  playerId: string
  points: number
}

export interface EspnLiveMatchup {
  teamId: number
  playerPoints: EspnLivePlayerPoints[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractEspnPlayerPoints(entries: any[], week: number): EspnLivePlayerPoints[] {
  const points: EspnLivePlayerPoints[] = []
  for (const entry of entries ?? []) {
    const player = entry?.playerPoolEntry?.player
    if (!player?.id) continue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actual = (player.stats ?? []).find((s: any) => s.statSourceId === 0 && s.scoringPeriodId === week)
    if (!actual) continue
    points.push({ playerId: String(player.id), points: actual.appliedTotal ?? 0 })
  }
  return points
}

export async function getEspnLivePoints(
  leagueId: string,
  credentials: EspnCredentials,
  week: number
): Promise<EspnLiveMatchup[]> {
  const data = await espnFetch<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schedule?: Array<{ matchupPeriodId?: number; home?: any; away?: any }>
  }>(leagueUrl(leagueId), credentials, { view: 'mBoxscore', scoringPeriodId: String(week) })

  // Found live (verified against a real league's real 2025 season): mBoxscore
  // returns every matchup period for the whole season regardless of
  // scoringPeriodId, which only narrows the per-player stat entries — not
  // filtering to this week's matchups here would process ~20x the real
  // data and could return duplicate team entries.
  const results: EspnLiveMatchup[] = []
  for (const matchup of data.schedule ?? []) {
    if (matchup.matchupPeriodId !== week) continue
    for (const side of [matchup.home, matchup.away]) {
      if (!side) continue
      const entries = side.rosterForCurrentScoringPeriod?.entries ?? []
      results.push({ teamId: side.teamId, playerPoints: extractEspnPlayerPoints(entries, week) })
    }
  }
  return results
}

export async function getEspnWaivers(
  leagueId: string,
  credentials: EspnCredentials,
  _position?: string
): Promise<unknown> {
  const filter: Record<string, unknown> = {
    players: {
      filterSlotIds: { value: [0, 1, 2, 3, 4, 5, 6, 23] },
      filterStatus: { value: ['FREEAGENT', 'WAIVERS'] },
      limit: 50,
      sortPercOwned: { sortAsc: false, sortPriority: 1 },
    },
  }
  return espnFetch(leagueUrl(leagueId), credentials, {
    view: 'kona_player_info',
    'X-Fantasy-Filter': JSON.stringify(filter),
  })
}

// ─── Draft sync (mDraftDetail) ─────────────────────────────────────────────────
// STATUS: UNVERIFIED during live drafts. This endpoint is ESPN's internal
// draft room data source. Test during a live mock draft before relying on it.
// If picks array does not populate during an active draft → fall back to
// manual pick entry (T-30).

export async function getEspnDraftDetail(
  leagueId: string,
  credentials: EspnCredentials
): Promise<EspnDraftDetailResponse | null> {
  try {
    return await espnFetch<EspnDraftDetailResponse>(
      leagueUrl(leagueId),
      credentials,
      { view: 'mDraftDetail' }
    )
  } catch (err) {
    // Non-fatal — caller falls back to manual entry
    console.warn('[ESPN] mDraftDetail fetch failed:', err instanceof Error ? err.message : err)
    return null
  }
}

export interface EspnDraftDetailResponse {
  draftDetail?: {
    drafted: boolean
    inProgress: boolean
    picks?: Array<{
      id: number
      lineupSlotId: number
      memberId: string
      overallPickNumber: number
      playerId: number
      roundId: number
      roundPickNumber: number
      teamId: number
    }>
  }
}

// ─── Projections (T-88) ────────────────────────────────────────────────────────
// STATUS: VERIFIED LIVE July 3, 2026. ESPN's own stat entries carry
// statSourceId 0 (actual) vs 1 (projected), scoringPeriodId 0 (season total)
// vs a week number — already scored to the specific league's scoring
// settings, since it comes back in the context of that leagueId. Confirmed
// against a free agent with zero rostered status: both a current-week and a
// full-season 2026 projection were present. No separate projections
// provider is needed for ESPN leagues (see PRD 5.7).

interface EspnPlayerStatLine {
  statSourceId: 0 | 1
  scoringPeriodId: number
  seasonId: number
  appliedTotal: number
}

export interface EspnPlayerProjection {
  weekProjection: number | null
  seasonProjection: number | null
  seasonActualToDate: number | null
}

export function getEspnPlayerProjection(
  stats: EspnPlayerStatLine[] | undefined,
  season: number,
  currentWeek: number
): EspnPlayerProjection {
  const forSeason = (stats ?? []).filter((s) => s.seasonId === season)
  const weekProjection = forSeason.find((s) => s.statSourceId === 1 && s.scoringPeriodId === currentWeek)
  const seasonProjection = forSeason.find((s) => s.statSourceId === 1 && s.scoringPeriodId === 0)
  const seasonActual = forSeason.find((s) => s.statSourceId === 0 && s.scoringPeriodId === 0)

  return {
    weekProjection: weekProjection?.appliedTotal ?? null,
    seasonProjection: seasonProjection?.appliedTotal ?? null,
    seasonActualToDate: seasonActual?.appliedTotal ?? null,
  }
}

// ─── Deep-link helpers ─────────────────────────────────────────────────────────
// Never say "Go to ESPN." Use these exact button labels per PRD.

export { espnLeagueUrl } from '@/lib/leagueLinks'

export function espnLineupUrl(leagueId: string, teamId: string): string {
  return `https://fantasy.espn.com/football/team?leagueId=${leagueId}&teamId=${teamId}`
}

export function espnWaiverUrl(leagueId: string): string {
  return `https://fantasy.espn.com/football/players/add?leagueId=${leagueId}`
}

export function espnTradeUrl(leagueId: string): string {
  return `https://fantasy.espn.com/football/trade?leagueId=${leagueId}`
}

// Button labels (use these verbatim in UI components)
export const ESPN_BUTTON_LABELS = {
  lineup: 'Set lineup on ESPN →',
  waiver: 'Claim on ESPN →',
  trade: 'Propose trade on ESPN →',
} as const
