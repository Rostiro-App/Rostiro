// T-05: Yahoo Fantasy Sports API client
// Official REST API, OAuth 2.0. Full read + write.
// Lead platform for all write-back features (lineup, waiver, trade).
// Attribution required: "Fantasy data provided by Yahoo Fantasy"

import { YahooAPIError } from '@/types'

const YAHOO_API_BASE = 'https://fantasysports.yahooapis.com/fantasy/v2'
const YAHOO_AUTH_URL = 'https://api.login.yahoo.com/oauth2/request_auth'
const YAHOO_TOKEN_URL = 'https://api.login.yahoo.com/oauth2/get_token'
const SEASON = 2026
const SPORT_CODE = 'nfl'

// ─── OAuth helpers ─────────────────────────────────────────────────────────────

export function getYahooAuthUrl(state: string): string {
  const clientId = process.env.YAHOO_CLIENT_ID
  const redirectUri = process.env.YAHOO_REDIRECT_URI

  if (!clientId) throw new YahooAPIError('YAHOO_CLIENT_ID is not configured', 'YAHOO_CONFIG_ERROR')
  if (!redirectUri) throw new YahooAPIError('YAHOO_REDIRECT_URI is not configured', 'YAHOO_CONFIG_ERROR')

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'fspt-r fspt-w',
    state,
  })

  return `${YAHOO_AUTH_URL}?${params.toString()}`
}

export interface YahooTokens {
  accessToken: string
  refreshToken: string
  expiresAt: Date
  scope: string
}

export async function exchangeYahooCode(code: string): Promise<YahooTokens> {
  const clientId = process.env.YAHOO_CLIENT_ID
  const clientSecret = process.env.YAHOO_CLIENT_SECRET
  const redirectUri = process.env.YAHOO_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    throw new YahooAPIError('Yahoo OAuth credentials not configured', 'YAHOO_CONFIG_ERROR')
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const res = await fetch(YAHOO_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new YahooAPIError(
      `Yahoo token exchange failed: ${body}`,
      'YAHOO_TOKEN_EXCHANGE_ERROR',
      res.status
    )
  }

  const data = await res.json() as {
    access_token: string
    refresh_token: string
    expires_in: number
    token_type: string
    scope: string
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    scope: data.scope,
  }
}

export async function refreshYahooTokens(refreshToken: string): Promise<YahooTokens> {
  const clientId = process.env.YAHOO_CLIENT_ID
  const clientSecret = process.env.YAHOO_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new YahooAPIError('Yahoo OAuth credentials not configured', 'YAHOO_CONFIG_ERROR')
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const res = await fetch(YAHOO_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      redirect_uri: process.env.YAHOO_REDIRECT_URI ?? '',
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new YahooAPIError(
      `Yahoo token refresh failed: ${body}`,
      'YAHOO_TOKEN_REFRESH_ERROR',
      res.status
    )
  }

  const data = await res.json() as {
    access_token: string
    refresh_token: string
    expires_in: number
    scope: string
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    scope: data.scope,
  }
}

// ─── Core API fetcher ─────────────────────────────────────────────────────────
// Always call this with a fresh access token. Token refresh is the caller's
// responsibility — see /api/auth/yahoo/refresh route.

async function yahooFetch<T>(
  path: string,
  accessToken: string,
  options?: RequestInit
): Promise<T> {
  const url = `${YAHOO_API_BASE}${path}?format=json`

  let res: Response
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })
  } catch (err) {
    throw new YahooAPIError(`Network error on ${path}: ${String(err)}`, 'YAHOO_NETWORK_ERROR')
  }

  if (res.status === 401) {
    throw new YahooAPIError('Yahoo access token expired or invalid', 'YAHOO_TOKEN_EXPIRED', 401)
  }

  if (res.status === 429) {
    throw new YahooAPIError('Yahoo API rate limit exceeded', 'YAHOO_RATE_LIMIT', 429)
  }

  if (!res.ok) {
    throw new YahooAPIError(
      `Yahoo API error ${res.status} on ${path}`,
      'YAHOO_HTTP_ERROR',
      res.status
    )
  }

  return res.json() as Promise<T>
}

// ─── Read operations ───────────────────────────────────────────────────────────

export async function getYahooLeagues(accessToken: string): Promise<unknown> {
  return yahooFetch(
    `/users;use_login=1/games;game_codes=${SPORT_CODE},${SPORT_CODE}${SEASON}/leagues`,
    accessToken
  )
}

export async function getYahooLeague(leagueKey: string, accessToken: string): Promise<unknown> {
  return yahooFetch(
    `/league/${leagueKey};out=settings,standings,scoreboard`,
    accessToken
  )
}

export async function getYahooRoster(
  teamKey: string,
  accessToken: string,
  week?: number
): Promise<unknown> {
  const weekParam = week ? `;week=${week}` : ''
  return yahooFetch(`/team/${teamKey}/roster${weekParam}`, accessToken)
}

export async function getYahooMatchup(
  leagueKey: string,
  week: number,
  accessToken: string
): Promise<unknown> {
  return yahooFetch(`/league/${leagueKey}/scoreboard;week=${week}`, accessToken)
}

export async function getYahooWaiverPlayers(
  leagueKey: string,
  accessToken: string,
  position?: string
): Promise<unknown> {
  const posFilter = position ? `;position=${position}` : ''
  return yahooFetch(
    `/league/${leagueKey}/players;status=A;sort=AR;count=25${posFilter}`,
    accessToken
  )
}

export async function getYahooDraftResults(
  leagueKey: string,
  accessToken: string
): Promise<unknown> {
  return yahooFetch(`/league/${leagueKey}/draft/results`, accessToken)
}

// ─── Write operations ──────────────────────────────────────────────────────────
// All writes are wrapped in try/catch. On failure, callers must show error
// AND provide a deep-link fallback. Never silently fail a write.

export async function submitYahooLineup(
  teamKey: string,
  starterPlayerKeys: string[],
  accessToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const body = buildLineupXml(teamKey, starterPlayerKeys)
    await yahooFetch(`/team/${teamKey}/roster`, accessToken, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/xml' },
      body,
    })
    return { success: true }
  } catch (err) {
    const message = err instanceof YahooAPIError ? err.message : 'Unknown error submitting lineup'
    return { success: false, error: message }
  }
}

export async function submitYahooWaiverClaim(
  leagueKey: string,
  teamKey: string,
  addPlayerKey: string,
  dropPlayerKey: string | null,
  faabBid: number,
  accessToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const body = buildWaiverXml(leagueKey, teamKey, addPlayerKey, dropPlayerKey, faabBid)
    await yahooFetch(`/league/${leagueKey}/transactions`, accessToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' },
      body,
    })
    return { success: true }
  } catch (err) {
    const message = err instanceof YahooAPIError ? err.message : 'Unknown error submitting waiver claim'
    return { success: false, error: message }
  }
}

export async function proposeYahooTrade(
  leagueKey: string,
  senderTeamKey: string,
  recipientTeamKey: string,
  senderPlayerKeys: string[],
  recipientPlayerKeys: string[],
  note: string,
  accessToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const body = buildTradeXml(
      leagueKey,
      senderTeamKey,
      recipientTeamKey,
      senderPlayerKeys,
      recipientPlayerKeys,
      note
    )
    await yahooFetch(`/league/${leagueKey}/transactions`, accessToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/xml' },
      body,
    })
    return { success: true }
  } catch (err) {
    const message = err instanceof YahooAPIError ? err.message : 'Unknown error proposing trade'
    return { success: false, error: message }
  }
}

// ─── Deep-link helpers ─────────────────────────────────────────────────────────

export function yahooLineupUrl(leagueKey: string, teamKey: string): string {
  const leagueId = leagueKey.split('.l.')[1]
  const teamId = teamKey.split('.t.')[1]
  return `https://football.fantasysports.yahoo.com/f1/${leagueId}/team/${teamId}/editroster`
}

export function yahooWaiverUrl(leagueKey: string): string {
  const leagueId = leagueKey.split('.l.')[1]
  return `https://football.fantasysports.yahoo.com/f1/${leagueId}/addplayer`
}

export function yahooTradeUrl(leagueKey: string): string {
  const leagueId = leagueKey.split('.l.')[1]
  return `https://football.fantasysports.yahoo.com/f1/${leagueId}/trade`
}

// ─── XML builders ─────────────────────────────────────────────────────────────

function buildLineupXml(teamKey: string, starterPlayerKeys: string[]): string {
  const players = starterPlayerKeys
    .map(
      (key) => `
        <player>
          <player_key>${key}</player_key>
          <position>BN</position>
        </player>`
    )
    .join('')

  return `<?xml version="1.0"?>
<fantasy_content>
  <roster>
    <coverage_type>week</coverage_type>
    <players>${players}
    </players>
  </roster>
</fantasy_content>`
}

function buildWaiverXml(
  leagueKey: string,
  teamKey: string,
  addPlayerKey: string,
  dropPlayerKey: string | null,
  faabBid: number
): string {
  const dropXml = dropPlayerKey
    ? `<player>
          <player_key>${dropPlayerKey}</player_key>
          <transaction_data>
            <type>drop</type>
            <source_team_key>${teamKey}</source_team_key>
          </transaction_data>
        </player>`
    : ''

  return `<?xml version="1.0"?>
<fantasy_content>
  <transaction>
    <type>add/drop</type>
    <faab_bid>${faabBid}</faab_bid>
    <players>
      <player>
        <player_key>${addPlayerKey}</player_key>
        <transaction_data>
          <type>add</type>
          <destination_team_key>${teamKey}</destination_team_key>
        </transaction_data>
      </player>
      ${dropXml}
    </players>
  </transaction>
</fantasy_content>`
}

function buildTradeXml(
  leagueKey: string,
  senderTeamKey: string,
  recipientTeamKey: string,
  senderPlayerKeys: string[],
  recipientPlayerKeys: string[],
  note: string
): string {
  const senderPlayers = senderPlayerKeys
    .map(
      (key) => `
        <player>
          <player_key>${key}</player_key>
          <transaction_data>
            <type>trade</type>
            <source_team_key>${senderTeamKey}</source_team_key>
            <destination_team_key>${recipientTeamKey}</destination_team_key>
          </transaction_data>
        </player>`
    )
    .join('')

  const recipientPlayers = recipientPlayerKeys
    .map(
      (key) => `
        <player>
          <player_key>${key}</player_key>
          <transaction_data>
            <type>trade</type>
            <source_team_key>${recipientTeamKey}</source_team_key>
            <destination_team_key>${senderTeamKey}</destination_team_key>
          </transaction_data>
        </player>`
    )
    .join('')

  return `<?xml version="1.0"?>
<fantasy_content>
  <transaction>
    <type>pending_trade</type>
    <trader_team_key>${senderTeamKey}</trader_team_key>
    <tradee_team_key>${recipientTeamKey}</tradee_team_key>
    <trade_note>${note}</trade_note>
    <players>${senderPlayers}${recipientPlayers}
    </players>
  </transaction>
</fantasy_content>`
}
