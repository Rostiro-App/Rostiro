// T-05: Yahoo Fantasy Sports API client
// Official REST API, OAuth 2.0. Read-only — Yahoo has approved Rostiro for
// read access only (write access requires a separate, not-yet-granted
// app-registration tier). The write functions and XML builders below are
// currently unreachable dead code kept only for the Packet 02 removal pass;
// do not add new call sites for them.
// Attribution required: "Fantasy data provided by Yahoo Fantasy"

import { YahooAPIError } from '@/types'
import { createAdminClient } from '@/lib/supabase'
import { encrypt, decrypt } from '@/lib/encrypt'
import { checkCircuitBreaker, recordApiCall } from '@/lib/observability'

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
    // Yahoo's Fantasy Sports permission is a single app-level grant (Read
    // or Read/Write, chosen at app registration), not a combinable OAuth
    // scope list — requesting a level the app isn't registered for fails
    // with error=invalid_scope before ever showing the consent screen.
    // Rostiro's app is registered read-only today (write access was
    // requested but not granted), so fspt-w is rejected outright — this
    // was confirmed live: every real OAuth attempt was failing with
    // exactly that error until this was corrected to fspt-r.
    scope: 'fspt-r',
    state,
  })

  return `${YAHOO_AUTH_URL}?${params.toString()}`
}

// Yahoo returns the scope it actually granted in the token response — this
// can differ from what was requested (e.g. an app-registration change, or
// Yahoo silently downgrading). Never assume the requested scope was what
// was actually issued; validate the token is usable for read operations
// before persisting it, so a misconfiguration surfaces as a clear
// reconnect-required error instead of a token that silently can't do
// anything once used.
export function isReadCompatibleScope(scope: string): boolean {
  return scope.split(/\s+/).includes('fspt-r') || scope.split(/\s+/).includes('fspt-w')
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
    // Never surface Yahoo's raw error body — never confirmed not to
    // contain anything sensitive, and the status code plus our own code
    // is enough for callers to act on. If deeper diagnosis is ever needed,
    // log body server-side only, not in the thrown/user-facing error.
    throw new YahooAPIError(
      `Yahoo token exchange failed (HTTP ${res.status})`,
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

  if (!isReadCompatibleScope(data.scope)) {
    // Yahoo issued a token, but not one that can do what Rostiro needs —
    // a config error, not a transient failure. Fail loudly with a
    // reconnect-required code rather than persisting an unusable token.
    throw new YahooAPIError(
      'Yahoo granted a scope that does not support read access',
      'YAHOO_RECONNECT_REQUIRED',
      502
    )
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
    // A 400/401 here typically means the refresh token itself is dead
    // (revoked, expired past Yahoo's grace window) — unrecoverable without
    // the user reconnecting. Anything else (5xx, network-shaped) is
    // transient. Distinguish so callers don't treat a Yahoo outage as a
    // reason to force a reconnect prompt. Never include the raw response
    // body in the thrown error — see exchangeYahooCode's error handling.
    const code = res.status === 400 || res.status === 401
      ? 'YAHOO_RECONNECT_REQUIRED'
      : 'YAHOO_TOKEN_REFRESH_ERROR'
    throw new YahooAPIError(`Yahoo token refresh failed (HTTP ${res.status})`, code, res.status)
  }

  const data = await res.json() as {
    access_token: string
    refresh_token?: string
    expires_in: number
    scope: string
  }

  if (!isReadCompatibleScope(data.scope)) {
    throw new YahooAPIError(
      'Yahoo granted a scope that does not support read access',
      'YAHOO_RECONNECT_REQUIRED',
      502
    )
  }

  return {
    accessToken: data.access_token,
    // Yahoo may legally omit refresh_token on a refresh response, meaning
    // "the existing one is still valid" — NOT "there is no refresh token
    // anymore". Overwriting with an empty/undefined value here would
    // silently break every future refresh for this user. Fall back to the
    // refresh token that was actually used for this call.
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    scope: data.scope,
  }
}

// ─── Token retrieval ────────────────────────────────────────────────────────────
// T-64.2: the one helper every Yahoo read/write call needs — a guaranteed
// non-expired access token for a given user, refreshing and re-persisting if
// the stored one is stale. Draft Copilot's Yahoo support is the first real
// caller of this; lineup/waiver/trade writes should switch to it too.

const REFRESH_BUFFER_MS = 2 * 60 * 1000 // refresh if expiring within 2 minutes

// Serializes concurrent refreshes for the same user within this process.
// This is a best-effort, single-instance guard, not a distributed lock —
// on serverless (Vercel), two truly concurrent requests for the same user
// can still land on different function instances and each hold their own
// map, so this cannot prevent every possible race. It does prevent the
// easily-avoidable case (multiple concurrent calls within one warm
// instance all deciding to refresh at once), which was the realistic
// common case for this app's traffic shape.
const inFlightRefreshes = new Map<string, Promise<string>>()

export async function getValidYahooAccessToken(userId: string): Promise<string> {
  const admin = createAdminClient()

  const { data: row, error } = await admin
    .from('yahoo_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .single()

  if (error || !row) {
    throw new YahooAPIError('No Yahoo account connected', 'YAHOO_NOT_CONNECTED', 404)
  }

  const expiresAt = new Date(row.expires_at).getTime()
  if (expiresAt - Date.now() > REFRESH_BUFFER_MS) {
    return decrypt(row.access_token)
  }

  const existing = inFlightRefreshes.get(userId)
  if (existing) return existing

  const refreshPromise = (async () => {
    try {
      const refreshed = await refreshYahooTokens(decrypt(row.refresh_token))

      await admin
        .from('yahoo_tokens')
        .update({
          access_token: encrypt(refreshed.accessToken),
          refresh_token: encrypt(refreshed.refreshToken),
          expires_at: refreshed.expiresAt.toISOString(),
          scope: refreshed.scope,
        })
        .eq('user_id', userId)

      return refreshed.accessToken
    } finally {
      inFlightRefreshes.delete(userId)
    }
  })()

  inFlightRefreshes.set(userId, refreshPromise)
  return refreshPromise
}

// ─── Core API fetcher ─────────────────────────────────────────────────────────
// Always call this with a fresh access token. Token refresh is the caller's
// responsibility — see /api/auth/yahoo/refresh route.

// T-84: circuit-checked and latency-logged. 401 deliberately counts as
// "success" toward the breaker — an expired token is one user's problem
// (refreshed by the caller elsewhere), not a Yahoo outage; tripping the
// breaker over it would wrongly block every other Yahoo user's calls.
// A network error, 429, or unexpected server error is the real signal.
async function yahooFetch<T>(
  path: string,
  accessToken: string,
  options?: RequestInit
): Promise<T> {
  await checkCircuitBreaker('yahoo')
  const start = Date.now()
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
    await recordApiCall('yahoo', path, Date.now() - start, false)
    throw new YahooAPIError(`Network error on ${path}: ${String(err)}`, 'YAHOO_NETWORK_ERROR')
  }

  if (res.status === 401) {
    await recordApiCall('yahoo', path, Date.now() - start, true, 401)
    throw new YahooAPIError('Yahoo access token expired or invalid', 'YAHOO_TOKEN_EXPIRED', 401)
  }

  if (res.status === 429) {
    await recordApiCall('yahoo', path, Date.now() - start, false, 429)
    throw new YahooAPIError('Yahoo API rate limit exceeded', 'YAHOO_RATE_LIMIT', 429)
  }

  if (!res.ok) {
    await recordApiCall('yahoo', path, Date.now() - start, false, res.status)
    throw new YahooAPIError(
      `Yahoo API error ${res.status} on ${path}`,
      'YAHOO_HTTP_ERROR',
      res.status
    )
  }

  await recordApiCall('yahoo', path, Date.now() - start, true, res.status)
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

// Yahoo's draft/results resource only returns player_key (no name) — this
// batch-resolves names/positions/teams for a set of keys. Used by Draft
// Copilot's picks route to give the players_cache name/team fallback-match
// something to match against, since player_mappings is currently unseeded.
export async function getYahooPlayersByKeys(
  leagueKey: string,
  playerKeys: string[],
  accessToken: string
): Promise<unknown> {
  return yahooFetch(`/league/${leagueKey}/players;player_keys=${playerKeys.join(',')}`, accessToken)
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

// T-64.2: resolves the current season's numeric NFL game key so callers only
// ever need the user-visible numeric league ID (from their browser URL), not
// Yahoo's opaque league_key ("{game_key}.l.{league_id}"). Unverified against
// live Yahoo data — best-effort per Yahoo's documented "nfl" game-code alias.
export async function getYahooCurrentGameKey(accessToken: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = await yahooFetch<any>('/game/nfl', accessToken)
  const gameKey = raw?.fantasy_content?.game?.[0]?.game_key
  if (!gameKey) {
    throw new YahooAPIError('Could not resolve current NFL game key', 'YAHOO_GAME_KEY_ERROR')
  }
  return gameKey
}

// All teams in a league — needed to find "my team" for Draft Copilot's turn
// prediction. Deliberately does NOT reuse normalizeYahooLeague's
// teams.team[0] shortcut for that purpose (unverified ordering assumption);
// callers should filter on is_owned_by_current_login instead.
export async function getYahooLeagueTeams(
  leagueKey: string,
  accessToken: string
): Promise<unknown> {
  return yahooFetch(`/league/${leagueKey}/teams`, accessToken)
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

export { yahooLeagueUrl } from '@/lib/leagueLinks'

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

// Best-effort — unverified against a live Yahoo draft room this season.
export function yahooDraftUrl(leagueKey: string): string {
  const leagueId = leagueKey.split('.l.')[1]
  return `https://football.fantasysports.yahoo.com/f1/${leagueId}/draftclient`
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
