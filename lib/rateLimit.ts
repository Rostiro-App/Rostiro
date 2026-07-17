// T-76: fixed-window rate limiting for unauthenticated routes — the Draft
// Kit surfaces (no signup, PRD 6.3) have no per-user quota to lean on the
// way authenticated AI calls do (lib/usageLimits.ts), so an IP-keyed limit
// here is the only thing standing between the public Claude-calling
// endpoint and an open cost/abuse vector.
//
// Launch security hardening (Codex Packet 01): the original select-then-
// upsert implementation had two real problems. First, it wasn't
// concurrency-safe — two requests could both read count=N before either
// wrote N+1, letting both through when only one should have passed
// (classic TOCTOU race). Second, it failed OPEN on any database error,
// which for a cost-bearing public Claude-calling route meant a transient
// DB hiccup silently became unlimited access. Both are fixed by routing
// through public.increment_rate_limit (migration_launch_security.sql), a
// single atomic SECURITY DEFINER function — the increment-and-decide
// happens as one statement, and any RPC failure now returns
// `allowed: false, reason: 'service_unavailable'` instead of granting
// access. Callers that need to distinguish "you hit the limit" (429) from
// "we couldn't verify, failing safe" (503) can read `reason`; existing
// callers that only destructure `allowed` get the safer behavior for free.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  reason?: 'rate_limited' | 'service_unavailable'
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

  const { data, error } = await admin.rpc('increment_rate_limit', {
    p_rate_key: key,
    p_window_start: windowStart,
    p_limit: limit,
  })

  // Fail CLOSED, not open — an RPC failure (migration not run, transient
  // DB issue) must never be interpreted as "unlimited allowance" for a
  // cost-bearing route. This is the corrected shared default; there is no
  // route-specific opt-out today, per the explicit instruction not to make
  // fail-open the default anywhere.
  if (error || !data || data.length === 0) {
    return { allowed: false, remaining: 0, reason: 'service_unavailable' }
  }

  const row = data[0] as { allowed: boolean; remaining: number }
  return {
    allowed: row.allowed,
    remaining: row.remaining,
    reason: row.allowed ? undefined : 'rate_limited',
  }
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
