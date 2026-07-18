/**
 * Packet 03, P3-11: real production smoke test. Calls the SAME library
 * functions the real API routes call (createAdminClient, service-role —
 * bypasses the HTTP/auth layer since driving a real browser session as
 * the real user wasn't available this pass; route-level auth/ownership
 * behavior is separately covered by the existing automated route tests,
 * not re-verified live here).
 *
 * Read-only against every provider: readOwnedRoster/readMatchup/
 * readAvailablePlayers/readDraftMetadata are the only ESPN/Sleeper calls
 * made, and none of them are write operations — no roster, lineup,
 * waiver, or league-setting change is possible through this script.
 *
 * Usage: npx tsx --env-file=.env.local scripts/p3-11-smoke-test.mts
 */
import { createAdminClient } from '../lib/supabase'
import { syncRosterSnapshot } from '../lib/rosterSnapshotSync'
import { getIntelligenceAdapter } from '../lib/platforms'
import { computeUserCrossPlatformPortfolio } from '../lib/crossPlatformPortfolioSync'
import { buildPulseItemsForUser } from '../lib/pulse'
import { resolvePlayerIdentityForRoute, computePlayerIntelligence } from '../lib/playerIntelligence'
import type { Platform } from '../types'

const USER_ID = 'e91917fe-3e92-478c-bca7-2c22e5413d89'

function section(title: string) {
  console.log(`\n${'='.repeat(70)}\n${title}\n${'='.repeat(70)}`)
}

async function main() {
  const admin = createAdminClient()

  section('1. Connected leagues for this user')
  const { data: leagues } = await admin
    .from('connected_leagues')
    .select('id, platform, league_id, league_name, team_id')
    .eq('user_id', USER_ID)
  console.log(leagues)

  section('2. Roster snapshot sync — Sleeper + ESPN (read-only against both providers)')
  for (const league of (leagues ?? []) as Array<{ id: string; platform: Platform; league_id: string; league_name: string; team_id: string | null }>) {
    const adapter = getIntelligenceAdapter(league.platform)
    if (!adapter || !league.team_id) {
      console.log(`  [${league.platform}] ${league.league_name}: SKIPPED (no adapter or no team_id)`)
      continue
    }
    const context = { connectedLeagueId: league.id, userId: USER_ID, platform: league.platform, externalLeagueId: league.league_id, externalTeamId: league.team_id }
    const result = await syncRosterSnapshot(context, adapter)
    console.log(`  [${league.platform}] ${league.league_name}: outcome=${result.outcome.action} reason="${result.outcome.reason}" freshness=${result.freshness} playersInSnapshot=${result.outcome.snapshot?.players.length ?? 'n/a'}`)
    if (result.outcome.snapshot) {
      const resolved = result.outcome.snapshot.players.filter((p) => p.canonicalPlayerId).length
      console.log(`    canonical-resolved players: ${resolved}/${result.outcome.snapshot.players.length}`)
    }
  }

  section('3. Cross-platform player resolution — a known cross-platform canonical mapping')
  const { data: crossPlatformSample } = await admin
    .from('player_mappings')
    .select('id, name, nfl_team, espn_id, sleeper_id')
    .not('espn_id', 'is', null)
    .not('sleeper_id', 'is', null)
    .limit(1)
    .maybeSingle()
  console.log('  Sample cross-platform mapping:', crossPlatformSample)

  section('4. Cross-platform Portfolio (exposure + health + coverage)')
  const portfolio = await computeUserCrossPlatformPortfolio(USER_ID)
  console.log('  coverage:', portfolio.coverage)
  console.log('  health:', portfolio.health.map((h) => ({ league: h.leagueName, platform: h.platform, score: h.result.health.score, adpSource: h.result.adpSource, factorCoverage: h.result.factorCoverage })))
  console.log('  exposure resolved count:', portfolio.exposure.resolved.length, 'unresolved count:', portfolio.exposure.unresolved.length)

  section('5. Player Intelligence — compatibility Sleeper ID + canonical route')
  if (crossPlatformSample?.sleeper_id) {
    const identity = await resolvePlayerIdentityForRoute(admin, crossPlatformSample.sleeper_id)
    console.log('  resolved identity from raw Sleeper ID:', identity)
    const intel = await computePlayerIntelligence(admin, USER_ID, identity)
    console.log('  per-league states:', intel.leagues)
  } else {
    console.log('  SKIPPED — no cross-platform sample mapping found')
  }

  section('6. Pulse — coverage + platform attribution')
  const pulse = await buildPulseItemsForUser(admin, USER_ID)
  console.log('  leagueCount:', pulse.leagueCount)
  console.log('  coverage:', pulse.coverage)
  console.log('  items (platform/type/fingerprint):', pulse.items.map((i) => ({ type: i.type, fingerprint: i.fingerprint, platform: i.affectedLeagues[0]?.platform })))

  section('7. ESPN draft status (honesty check — is this league genuinely undrafted?)')
  const espnLeague = (leagues ?? []).find((l) => l.platform === 'espn')
  if (espnLeague) {
    const espnAdapter = getIntelligenceAdapter('espn')
    const context = { connectedLeagueId: espnLeague.id, userId: USER_ID, platform: 'espn' as const, externalLeagueId: espnLeague.league_id, externalTeamId: espnLeague.team_id! }
    const draft = await espnAdapter?.readDraftMetadata?.(context)
    console.log('  ESPN draft status:', draft?.data, 'warnings:', draft?.warnings)
  }

  console.log('\nSmoke test complete.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
