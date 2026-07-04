// T-76: fixed-window rate limiting for unauthenticated routes — the Draft
// Kit surfaces (no signup, PRD 6.3) have no per-user quota to lean on the
// way authenticated AI calls do (lib/usageLimits.ts), so an IP-keyed limit
// here is the only thing standing between the public Claude-calling
// endpoint and an open cost/abuse vector.
//
// Postgres-backed (public.rate_limit_events, migration_rate_limit.sql)
// rather than in-memory — a serverless function's memory doesn't persist
// across invocations, so an in-process counter would silently do nothing
// on Vercel. Same upsert-and-check pattern as usage_counters; acceptable
// at current traffic, revisit with Upstash/Vercel KV if this route's
// volume ever makes per-request Postgres round trips a real cost.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
}

function currentWindowStart(windowSeconds: number): string {
  const ms = windowSeconds * 1000
  return new Date(Math.floor(Date.now() / ms) * ms).toISOString()
}

export async function checkRateLimit(
  admin: SupabaseClient,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const windowStart = currentWindowStart(windowSeconds)

  const { data: existing } = await admin
    .from('rate_limit_events')
    .select('count')
    .eq('rate_key', key)
    .eq('window_start', windowStart)
    .maybeSingle()

  const current = existing?.count ?? 0
  if (current >= limit) {
    return { allowed: false, remaining: 0 }
  }

  const { error } = await admin.from('rate_limit_events').upsert(
    { rate_key: key, window_start: windowStart, count: current + 1 },
    { onConflict: 'rate_key,window_start' }
  )
  // Fail open: if the rate-limit table itself errors (migration not run
  // yet, transient issue), don't take down the route it's protecting —
  // same tradeoff the rest of the codebase makes for missing migrations.
  if (error) return { allowed: true, remaining: limit - (current + 1) }

  return { allowed: true, remaining: limit - (current + 1) }
}

// Best-effort client IP for Vercel/proxied requests. Not spoof-proof
// (a client can forge x-forwarded-for), but this is abuse-deterrence for
// an unauthenticated cost vector, not an auth boundary — good enough to
// stop casual scripting without adding a new dependency.
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}
