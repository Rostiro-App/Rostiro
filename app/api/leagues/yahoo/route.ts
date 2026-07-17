// Packet 02, Workstream C: authenticated, idempotent Yahoo league import/
// resync + disconnect. Follows the same pattern as app/api/leagues/
// sleeper/route.ts and app/api/leagues/espn/route.ts (auth check, per-
// league canConnectNewLeague, upsert on the (user_id, platform, league_id,
// season) uniqueness invariant already enforced by schema.sql).
//
// UNVERIFIED: the league-collection and owned-team parsing this route
// depends on (lib/normalize.ts's extractYahooLeagueKeys,
// extractYahooOwnedTeam, parseYahooDraftInfo, parseYahooWaiverSettings)
// have not been run against a real, live-authorized Yahoo response — no
// Yahoo account has completed OAuth successfully yet (Yahoo has not
// approved read access for this app as of this packet). See the Packet 02
// completion report for exactly what remains blocked pending that
// approval.

import { createSSRClient, createAdminClient } from '@/lib/supabase'
import { getValidYahooAccessToken, getYahooLeagues, getYahooLeague, getYahooLeagueTeams } from '@/lib/yahoo'
import { normalizeYahooLeague, extractYahooLeagueKeys, extractYahooOwnedTeam, extractYahooSettings, SEASON } from '@/lib/normalize'
import { toNormalizedYahooLeague } from '@/lib/platforms/yahoo'
import { canConnectNewLeague } from '@/lib/usageLimits'
import { YahooAPIError } from '@/types'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

interface SyncFailure {
  leagueKey: string
  error: string
}

// Packet 02 correction pass: a first-time failure (a league that has
// never once synced successfully) previously produced no persisted row
// at all — the failure only existed in that one API response, then
// vanished on reload. This preserves it either way: if a row already
// exists, only its sync_status/sync_error are touched (never clobbering
// real league_name/scoring/roster data with a placeholder); if no row
// exists yet, a minimal placeholder is inserted so "partially synced, N
// failed" (Workstream G) stays visible after a reload.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function persistLeagueFailure(admin: SupabaseClient<any, any, any>, userId: string, leagueKey: string, message: string) {
  const { data: existing } = await admin
    .from('connected_leagues')
    .select('id')
    .eq('user_id', userId)
    .eq('platform', 'yahoo')
    .eq('league_id', leagueKey)
    .maybeSingle()

  if (existing) {
    await admin
      .from('connected_leagues')
      .update({ sync_status: 'error', sync_error: message })
      .eq('id', existing.id)
  } else {
    await admin.from('connected_leagues').upsert({
      user_id: userId,
      platform: 'yahoo',
      league_id: leagueKey,
      league_name: '(Yahoo sync failed)',
      season: SEASON,
      sync_status: 'error',
      sync_error: message,
    }, { onConflict: 'user_id,platform,league_id,season' })
  }
}

// Workstream G: the one real signal every connection-state UI decision
// needs — whether a token exists, whether it still works (a lazy refresh
// attempt is cheap: getValidYahooAccessToken only calls Yahoo at all when
// the stored token is actually near expiry, otherwise it's a single DB
// read), and the imported-league/failure counts already persisted by the
// POST handler above. Deliberately read-only and side-effect-free beyond
// the refresh getValidYahooAccessToken may already perform as part of its
// normal contract.
export async function GET() {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  let connected = true
  let needsReconnect = false
  try {
    await getValidYahooAccessToken(user.id)
  } catch (err) {
    if (err instanceof YahooAPIError && err.code === 'YAHOO_NOT_CONNECTED') {
      connected = false
    } else if (err instanceof YahooAPIError && err.code === 'YAHOO_RECONNECT_REQUIRED') {
      needsReconnect = true
    } else {
      // A transient Yahoo/network error shouldn't be reported as "not
      // connected" or "needs reconnect" — those are both actionable,
      // durable states; a blip is neither.
      return NextResponse.json({ error: 'Could not check Yahoo connection status' }, { status: 502 })
    }
  }

  const { data: leagues } = await admin
    .from('connected_leagues')
    .select('id, league_name, team_name, sync_status, sync_error, last_synced_at')
    .eq('user_id', user.id)
    .eq('platform', 'yahoo')

  const leagueRows = leagues ?? []
  const failedCount = leagueRows.filter((l) => l.sync_status === 'error').length
  // Most recent successful sync across all Yahoo leagues — a failed
  // league's row has last_synced_at null (persistLeagueFailure never sets
  // it), so this only ever reflects a real completed sync, never a
  // failed-attempt timestamp.
  const lastSyncedAt = leagueRows.reduce<string | null>((latest, l) => {
    if (!l.last_synced_at) return latest
    if (!latest || l.last_synced_at > latest) return l.last_synced_at
    return latest
  }, null)

  return NextResponse.json({
    connected,
    needsReconnect,
    leagueCount: leagueRows.length,
    failedCount,
    lastSyncedAt,
    leagues: leagueRows,
  })
}

export async function POST() {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  let accessToken: string
  try {
    accessToken = await getValidYahooAccessToken(user.id)
  } catch (err) {
    if (err instanceof YahooAPIError && err.code === 'YAHOO_NOT_CONNECTED') {
      return NextResponse.json({ error: 'No Yahoo account connected' }, { status: 404 })
    }
    if (err instanceof YahooAPIError && err.code === 'YAHOO_RECONNECT_REQUIRED') {
      return NextResponse.json(
        { error: 'Yahoo connection needs to be reconnected', code: 'YAHOO_RECONNECT_REQUIRED' },
        { status: 409 }
      )
    }
    // Never surface the underlying error's raw message here — it may be a
    // Yahoo network/HTTP error whose text isn't guaranteed credential-free
    // at this call depth. A flat message is enough for the client to know
    // to retry.
    return NextResponse.json({ error: 'Could not verify Yahoo connection' }, { status: 502 })
  }

  let leagueKeys: string[]
  try {
    const rawLeagues = await getYahooLeagues(accessToken)
    leagueKeys = extractYahooLeagueKeys(rawLeagues)
  } catch {
    return NextResponse.json({ error: 'Could not fetch Yahoo leagues' }, { status: 502 })
  }

  if (leagueKeys.length === 0) {
    return NextResponse.json({ imported: 0, updated: 0, skippedForPlan: 0, failed: 0, leagues: [], failures: [] })
  }

  let imported = 0
  let updated = 0
  let skippedForPlan = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leagues: any[] = []
  const failures: SyncFailure[] = []

  // Sequential, not Promise.allSettled — Yahoo's own rate limit
  // (yahooFetch's 429 handling) makes a controlled one-at-a-time import
  // safer than a burst of N concurrent league fetches, and a single
  // league's failure must not affect any other league's success either
  // way (Workstream C's explicit requirement), which sequential + its own
  // try/catch per iteration already guarantees.
  for (const leagueKey of leagueKeys) {
    try {
      const [rawLeague, rawTeams] = await Promise.all([
        getYahooLeague(leagueKey, accessToken),
        getYahooLeagueTeams(leagueKey, accessToken),
      ])

      const league = normalizeYahooLeague(rawLeague)

      if (!league.leagueId) {
        const message = 'Yahoo returned no usable league key for this league'
        failures.push({ leagueKey, error: message })
        await persistLeagueFailure(admin, user.id, leagueKey, message)
        continue
      }
      if (!league.leagueName || !league.leagueName.trim()) {
        const message = 'Yahoo returned no usable league name for this league'
        failures.push({ leagueKey, error: message })
        await persistLeagueFailure(admin, user.id, leagueKey, message)
        continue
      }

      // Never fall back to normalizeYahooLeague's own team-index-0 default
      // (documented there as an unverified ordering assumption) when
      // extractYahooOwnedTeam can't confidently identify the caller's own
      // team — that risks silently saving a DIFFERENT manager's team as
      // if it were the caller's.
      const ownedTeam = extractYahooOwnedTeam(rawTeams)
      if (!ownedTeam || !ownedTeam.teamKey) {
        const message = 'Could not confidently identify the team you own in this league'
        failures.push({ leagueKey, error: message })
        await persistLeagueFailure(admin, user.id, leagueKey, message)
        continue
      }
      league.myTeamId = ownedTeam.teamKey
      league.myTeamName = ownedTeam.teamName

      const settings = extractYahooSettings(rawLeague)
      const normalized = toNormalizedYahooLeague(league, settings)

      const capCheck = await canConnectNewLeague(admin, user.id, 'yahoo', normalized.leagueId, normalized.season)
      if (!capCheck.allowed) {
        skippedForPlan++
        continue
      }

      const { data: existing } = await admin
        .from('connected_leagues')
        .select('id')
        .eq('user_id', user.id)
        .eq('platform', 'yahoo')
        .eq('league_id', normalized.leagueId)
        .eq('season', normalized.season)
        .maybeSingle()

      const { data, error } = await admin
        .from('connected_leagues')
        .upsert({
          user_id: user.id,
          platform: 'yahoo',
          league_id: normalized.leagueId,
          league_name: normalized.leagueName,
          season: normalized.season,
          scoring_settings_json: normalized.scoringSettings,
          roster_slots_json: normalized.rosterSlots,
          team_id: normalized.myTeamId,
          team_name: normalized.myTeamName,
          last_synced_at: normalized.lastSyncedAt,
          sync_status: 'ok',
          sync_error: null,
        }, { onConflict: 'user_id,platform,league_id,season' })
        .select()
        .single()

      if (error || !data) {
        failures.push({ leagueKey, error: 'Could not save this league' })
        continue
      }

      leagues.push(data)
      if (existing) updated++
      else imported++
    } catch (err) {
      // Never include raw Yahoo response bodies or credentials in the
      // failure detail returned to the client or persisted to sync_error —
      // YahooAPIError's message is already sanitized (see lib/yahoo.ts).
      const message = err instanceof YahooAPIError ? err.message : 'Could not sync this league'
      failures.push({ leagueKey, error: message })
      await persistLeagueFailure(admin, user.id, leagueKey, message)
    }
  }

  return NextResponse.json({ imported, updated, skippedForPlan, failed: failures.length, leagues, failures })
}

// Workstream G's recommended disconnect behavior: delete the stored Yahoo
// token row and every active Yahoo connected_leagues row for this user,
// leave Sleeper/ESPN untouched, never call a broader account-deletion
// path. Confirmation is a client-side UX concern (Workstream G), not
// enforced here.
//
// Packet 02 correction pass: ordered, not parallel — the credential
// (yahoo_tokens) is revoked FIRST. If the subsequent leagues delete then
// fails, the worse-case outcome is orphaned connected_leagues rows with
// no live token (safe: nothing can resync them, and disconnect can just
// be retried to clean them up). Doing it the other way around — leagues
// first — would leave a live, still-usable token connected to zero
// visible leagues if the token delete then failed, which a future resync
// could silently repopulate even though the user asked to disconnect.
export async function DELETE() {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const tokenResult = await admin.from('yahoo_tokens').delete().eq('user_id', user.id)
  if (tokenResult.error) {
    return NextResponse.json({ error: 'Could not disconnect Yahoo — try again' }, { status: 500 })
  }

  const leaguesResult = await admin.from('connected_leagues').delete().eq('user_id', user.id).eq('platform', 'yahoo')
  if (leaguesResult.error) {
    // The credential is already revoked (the security-critical part
    // succeeded) — but this must still be reported as a failure, not
    // silently swallowed, so the caller knows to retry and clear the
    // now-orphaned league rows.
    return NextResponse.json({ error: 'Yahoo access was revoked, but some league data could not be removed — try disconnecting again' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
