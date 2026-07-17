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
import { normalizeYahooLeague, extractYahooLeagueKeys, extractYahooOwnedTeam, extractYahooSettings } from '@/lib/normalize'
import { toNormalizedYahooLeague } from '@/lib/platforms/yahoo'
import { canConnectNewLeague } from '@/lib/usageLimits'
import { YahooAPIError } from '@/types'
import { NextResponse } from 'next/server'

interface SyncFailure {
  leagueKey: string
  error: string
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
      const ownedTeam = extractYahooOwnedTeam(rawTeams)
      if (ownedTeam) {
        league.myTeamId = ownedTeam.teamKey
        league.myTeamName = ownedTeam.teamName
      }

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

      // Best-effort: if this league was never successfully synced before,
      // there's no row to mark — that's fine, no stale "error" status
      // should appear for a league that was never actually connected.
      // league_id alone (no season filter) is safe here: Yahoo's
      // league_key already encodes the season via its game_key prefix, so
      // the same league_key never legitimately spans two seasons' rows.
      await admin
        .from('connected_leagues')
        .update({ sync_status: 'error', sync_error: message })
        .eq('user_id', user.id)
        .eq('platform', 'yahoo')
        .eq('league_id', leagueKey)
    }
  }

  return NextResponse.json({ imported, updated, skippedForPlan, failed: failures.length, leagues, failures })
}

// Workstream G's recommended disconnect behavior: delete the stored Yahoo
// token row and every active Yahoo connected_leagues row for this user,
// leave Sleeper/ESPN untouched, never call a broader account-deletion
// path. Confirmation is a client-side UX concern (Workstream G), not
// enforced here.
export async function DELETE() {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const [leaguesResult, tokenResult] = await Promise.all([
    admin.from('connected_leagues').delete().eq('user_id', user.id).eq('platform', 'yahoo'),
    admin.from('yahoo_tokens').delete().eq('user_id', user.id),
  ])

  if (leaguesResult.error || tokenResult.error) {
    return NextResponse.json({ error: 'Could not fully disconnect Yahoo — try again' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
