// Launch security hardening (Codex Packet 01 correction pass) — real
// concurrency verification for public.increment_rate_limit.
//
// WHY THIS EXISTS: the SQL Editor runs one statement at a time in a single
// session, so it cannot prove atomicity under genuine concurrent load — two
// browser tabs' worth of simultaneous requests is exactly the race
// increment_rate_limit's single atomic INSERT ... ON CONFLICT ... RETURNING
// statement is supposed to prevent (see migration_launch_security.sql's
// header — the original select-then-upsert implementation this replaced
// had a real TOCTOU race). This script fires N genuinely concurrent RPC
// calls from Node and checks that with p_limit = 1, EXACTLY ONE of them
// comes back allowed = true. If more than one does, the function is not
// atomic and the fix regressed.
//
// STAGING ONLY. This intentionally does NOT read the app's normal
// NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from .env.local —
// those point at production. It reads separate STAGING_SUPABASE_URL /
// STAGING_SUPABASE_SERVICE_ROLE_KEY env vars instead, and hard-refuses to
// run if the URL matches the known production project ref, so pointing
// this at prod by mistake fails loudly instead of silently.
//
// HOW LAWRENCE RUNS THIS:
//   1. This currently has no staging Supabase project (confirmed 2026-07-16
//      — production is the only environment). Create one first (a free-tier
//      Supabase project is enough) and apply supabase/schema.sql,
//      supabase/migration_launch_security.sql, and every other
//      supabase/migration_*.sql file to it, in the same order they were
//      applied to production (see supabase/migration_launch_security.sql's
//      history, or just apply schema.sql then every migration_*.sql
//      alphabetically-by-date-in-filename-header).
//   2. Set two env vars pointing at that STAGING project (never production):
//        export STAGING_SUPABASE_URL="https://<staging-ref>.supabase.co"
//        export STAGING_SUPABASE_SERVICE_ROLE_KEY="<staging service_role key>"
//      (Supabase Dashboard → staging project → Settings → API.)
//   3. From the repo root: node supabase/verify_rate_limit_concurrency.mjs
//   4. Read the printed summary. Exit code 0 = PASS, non-zero = FAIL — the
//      script's own stdout says exactly what failed and why.
//   5. The script cleans up its own rate_limit_events row when it finishes,
//      pass or fail, so nothing lingers in the staging project.

import { createClient } from '@supabase/supabase-js'

const PRODUCTION_PROJECT_REF = 'zdvjgtyzfmbxhzhjuwbm' // Rostiro's real project — refuse to target this

const CONCURRENT_CALLS = 20
const RATE_KEY = 'verify-concurrency-test'
const LIMIT = 1

function fail(message) {
  console.error(`FAIL: ${message}`)
  process.exit(1)
}

const url = process.env.STAGING_SUPABASE_URL
const serviceRoleKey = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  fail(
    'STAGING_SUPABASE_URL and STAGING_SUPABASE_SERVICE_ROLE_KEY must both be set. ' +
      'See this file\'s header comment for setup steps. Refusing to run against no target rather than guessing.'
  )
}

if (url.includes(PRODUCTION_PROJECT_REF)) {
  fail(
    `STAGING_SUPABASE_URL points at the production project (${PRODUCTION_PROJECT_REF}). ` +
      'This script fires 20 concurrent writes for a test — refusing to run against production.'
  )
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function cleanup() {
  await supabase.from('rate_limit_events').delete().eq('rate_key', RATE_KEY)
}

async function main() {
  console.log(`Target: ${url}`)
  console.log(`Firing ${CONCURRENT_CALLS} concurrent increment_rate_limit calls, rate_key='${RATE_KEY}', limit=${LIMIT}...`)

  const windowStart = new Date(Math.floor(Date.now() / 60000) * 60000).toISOString()

  const results = await Promise.all(
    Array.from({ length: CONCURRENT_CALLS }, () =>
      supabase.rpc('increment_rate_limit', {
        p_rate_key: RATE_KEY,
        p_window_start: windowStart,
        p_limit: LIMIT,
      })
    )
  )

  const errors = results.filter((r) => r.error)
  if (errors.length > 0) {
    await cleanup()
    fail(`${errors.length}/${CONCURRENT_CALLS} calls errored instead of returning a result: ${errors[0].error.message}`)
  }

  const allowedCount = results.filter((r) => r.data?.[0]?.allowed === true).length

  await cleanup()

  if (allowedCount !== 1) {
    fail(
      `Expected exactly 1 of ${CONCURRENT_CALLS} concurrent calls to be allowed (limit=${LIMIT}), got ${allowedCount}. ` +
        'This means increment_rate_limit is not atomic under real concurrency — two+ requests read the same pre-increment count before either wrote back, the exact TOCTOU race this function was built to close.'
    )
  }

  console.log(`PASS: exactly 1 of ${CONCURRENT_CALLS} concurrent calls was allowed, as expected for limit=${LIMIT}.`)
  process.exit(0)
}

main().catch((err) => {
  cleanup().finally(() => fail(err instanceof Error ? err.message : String(err)))
})
