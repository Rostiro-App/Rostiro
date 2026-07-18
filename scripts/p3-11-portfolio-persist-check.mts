/**
 * P3-11: verifies the REAL Portfolio persistence pathway — the exact same
 * write logic app/api/cron/pulse/route.ts uses — for the real current
 * week, for the real smoke-test user. This is legitimate real product
 * data (a real first weekly snapshot), not a throwaway test artifact.
 */
import { createAdminClient } from '../lib/supabase'
import { currentWeekStart } from '../lib/portfolio'
import { computeUserCrossPlatformPortfolio } from '../lib/crossPlatformPortfolioSync'

// P3-11 correction: a hardcoded production user UUID here was a real
// finding from the independent audit — replaced with a required env var so
// this script can never accidentally run against the wrong (or a
// no-longer-consented) real user, and so no real user UUID lives in
// version control.
function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} environment variable is required — refusing to run against a hardcoded/guessed user id.`)
  return value
}
const USER_ID = requiredEnv('SMOKE_TEST_USER_ID')

async function main() {
  const admin = createAdminClient()
  const weekStart = currentWeekStart()
  const portfolio = await computeUserCrossPlatformPortfolio(USER_ID)

  console.log('week_start:', weekStart)

  if (portfolio.health.length > 0) {
    const { error } = await admin.from('portfolio_health_snapshots').upsert(
      portfolio.health.map((h) => ({
        week_start: weekStart,
        user_id: USER_ID,
        league_id: h.connectedLeagueId,
        health_score: h.result.health.score,
        health_status: h.result.health.status,
        schema_version: 2,
        created_at: new Date().toISOString(),
      })),
      { onConflict: 'week_start,user_id,league_id' }
    )
    console.log('health upsert error:', error)
  }

  if (portfolio.exposure.resolved.length > 0) {
    const { error } = await admin.from('portfolio_exposure_snapshots').upsert(
      portfolio.exposure.resolved.map((e) => ({
        week_start: weekStart,
        user_id: USER_ID,
        player_id: e.canonicalPlayerId,
        league_count: e.exposureCount,
        schema_version: 2,
        player_id_space: 'canonical',
        created_at: new Date().toISOString(),
      })),
      { onConflict: 'week_start,user_id,player_id' }
    )
    console.log('exposure upsert error:', error)
  }

  console.log('health rows written:', portfolio.health.length)
  console.log('exposure rows written:', portfolio.exposure.resolved.length)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
