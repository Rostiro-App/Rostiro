// T-06: ESPN Fantasy API client
// Unofficial v3 endpoints. Read only — no write API exists.
// espn_s2 + SWID cookies required for private leagues (enforced since Aug 2025).
// All calls go through EspnAPIError — never crash the app on ESPN failure.

import { EspnAPIError } from '@/types'

const ESPN_API_BASE = 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl'
const SEASON = 2026

interface EspnCredentials {
  espnS2: string
  swid: string
}

// ─── Core fetcher ──────────────────────────────────────────────────────────────

async function espnFetch<T>(
  path: string,
  credentials: EspnCredentials,
  params?: Record<string, string>
): Promise<T> {
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
    throw new EspnAPIError(`Network error fetching ${path}: ${String(err)}`, 'ESPN_NETWORK_ERROR')
  }

  if (res.status === 401 || res.status === 403) {
    throw new EspnAPIError(
      'ESPN credentials are invalid or expired. Please re-enter your espn_s2 and SWID cookies.',
      'ESPN_AUTH_ERROR',
      res.status
    )
  }

  if (res.status === 404) {
    throw new EspnAPIError(
      `ESPN league or resource not found: ${path}`,
      'ESPN_NOT_FOUND',
      404
    )
  }

  if (res.status === 429) {
    throw new EspnAPIError('ESPN API rate limit exceeded', 'ESPN_RATE_LIMIT', 429)
  }

  if (!res.ok) {
    throw new EspnAPIError(
      `ESPN API error ${res.status} on ${path}`,
      'ESPN_HTTP_ERROR',
      res.status
    )
  }

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

// ─── Deep-link helpers ─────────────────────────────────────────────────────────
// Never say "Go to ESPN." Use these exact button labels per PRD.

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
