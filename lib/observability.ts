// T-84 / PRD 10.1: per-platform API observability + circuit breakers.
// Wired into the three platform fetch wrappers (lib/sleeper.ts's
// sleeperFetch, lib/espn.ts's espnFetch, lib/yahoo.ts's yahooFetch) and
// lib/claude.ts's generation calls — every external API call in the app
// funnels through one of those four, so instrumenting there covers
// everything without touching call sites individually.
//
// Postgres-backed rather than a real APM (Sentry/Datadog) — same
// reasoning as lib/rateLimit.ts and lib/usageLimits.ts: no such service is
// provisioned yet, traffic doesn't demand one, and this reuses existing
// infra instead of adding a new external dependency pre-launch.

import { createAdminClient } from '@/lib/supabase'

export type ObservedPlatform = 'sleeper' | 'espn' | 'yahoo' | 'claude'

const CIRCUIT_FAILURE_THRESHOLD = 5
const CIRCUIT_COOLDOWN_MS = 2 * 60 * 1000

export class CircuitOpenError extends Error {
  constructor(public readonly platform: ObservedPlatform) {
    super(`${platform} circuit breaker is open — too many recent failures, serving cache instead of hammering it further`)
    this.name = 'CircuitOpenError'
  }
}

// Throws CircuitOpenError if this platform has failed enough recently to
// be in cooldown. Any other failure (the breaker-state table itself being
// unreachable, migration not run yet) is swallowed — observability infra
// must never be why a real API call gets blocked.
export async function checkCircuitBreaker(platform: ObservedPlatform): Promise<void> {
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('circuit_breaker_state')
      .select('opened_until')
      .eq('platform', platform)
      .maybeSingle()
    if (data?.opened_until && new Date(data.opened_until).getTime() > Date.now()) {
      throw new CircuitOpenError(platform)
    }
  } catch (err) {
    if (err instanceof CircuitOpenError) throw err
  }
}

// Best-effort — logging a call, or updating the breaker's failure count,
// never throws back into the caller.
export async function recordApiCall(
  platform: ObservedPlatform,
  path: string,
  latencyMs: number,
  success: boolean,
  statusCode?: number
): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin
      .from('api_call_log')
      .insert({ platform, path, latency_ms: latencyMs, success, status_code: statusCode ?? null })

    if (success) {
      await admin
        .from('circuit_breaker_state')
        .upsert({ platform, consecutive_failures: 0, opened_until: null, updated_at: new Date().toISOString() }, { onConflict: 'platform' })
      return
    }

    const { data } = await admin
      .from('circuit_breaker_state')
      .select('consecutive_failures')
      .eq('platform', platform)
      .maybeSingle()
    const failures = (data?.consecutive_failures ?? 0) + 1
    const openedUntil = failures >= CIRCUIT_FAILURE_THRESHOLD ? new Date(Date.now() + CIRCUIT_COOLDOWN_MS).toISOString() : null
    await admin
      .from('circuit_breaker_state')
      .upsert({ platform, consecutive_failures: failures, opened_until: openedUntil, updated_at: new Date().toISOString() }, { onConflict: 'platform' })
  } catch {
    // Migration not run, or a transient DB issue — never let observability
    // itself take down the call it's watching.
  }
}
