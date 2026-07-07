// T-138: app-level error logging. Same posture as lib/observability.ts —
// no Sentry/APM provisioned yet, so this is Postgres-backed
// (migration_error_log.sql) rather than a new external dependency.
// Distinct from observability.ts's api_call_log, which only covers
// external platform call failures — this is for our own code: uncaught
// React render crashes (app/global-error.tsx) and any route that opts in.

import { createAdminClient } from '@/lib/supabase'

// Best-effort — logging an error must never itself throw and mask the
// original failure, or take down a request that was otherwise fine.
// `stackOverride` exists for app/api/system/log-error/route.ts, which
// receives a client-side error's real stack as a plain string (it can't
// forward a live Error object across the request boundary) and would
// otherwise lose it to a fresh, useless server-side stack.
export async function logAppError(
  source: string,
  error: unknown,
  context?: Record<string, unknown>,
  stackOverride?: string | null
): Promise<void> {
  try {
    const admin = createAdminClient()
    const message = error instanceof Error ? error.message : String(error)
    const stack = stackOverride ?? (error instanceof Error ? error.stack ?? null : null)
    await admin.from('app_error_log').insert({ source, message, stack, context: context ?? null })
  } catch {
    // migration_error_log.sql not run yet, or a transient DB issue —
    // logging infra must never be why the real error goes unhandled.
  }
}
