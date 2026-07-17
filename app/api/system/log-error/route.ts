// T-138: the one bridge between client-side errors and lib/errorLog.ts.
// app/global-error.tsx is a Client Component and can't import logAppError
// directly — that pulls in lib/supabase.ts's createAdminClient, which
// depends on next/headers and is server-only. Deliberately unauthenticated
// (an error boundary firing usually means something's already broken;
// requiring a valid session here would drop errors from exactly the users
// most likely to be logged out or mid-crash) and best-effort — this must
// never itself throw back at an already-crashing client.
//
// Launch security hardening (Codex Packet 01): this route had no rate limit
// and no practical bound on the arbitrary `context` object's serialized
// size — an unauthenticated, unlimited write path into Supabase is a real
// storage/cost abuse vector regardless of how narrow the Zod string caps
// look. Bounds below (IP rate limit, body size, context size, context key
// count) are all named constants so the tradeoffs are explicit and easy to
// revisit, not implicit magic numbers.

import { logAppError } from '@/lib/errorLog'
import { createAdminClient } from '@/lib/supabase'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const RATE_LIMIT = 10
const RATE_WINDOW_SECONDS = 600 // 10 accepted reports per IP per 10 minutes

const MAX_BODY_BYTES = 16 * 1024 // 16 KB
const MAX_CONTEXT_BYTES = 8 * 1024 // 8 KB
const MAX_CONTEXT_KEYS = 25

const Body = z.object({
  source: z.string().min(1).max(100),
  message: z.string().min(1).max(2000),
  stack: z.string().max(5000).nullable().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
})

export async function POST(request: Request) {
  // Reject clearly oversized bodies before ever parsing them, when the
  // client sent a Content-Length header (not spoof-proof, but a cheap
  // first line of defense that avoids buffering a huge body at all).
  const contentLength = request.headers.get('content-length')
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false }, { status: 413 })
  }

  const admin = createAdminClient()
  const ip = getClientIp(request)
  const { allowed, reason } = await checkRateLimit(admin, `log-error:${ip}`, RATE_LIMIT, RATE_WINDOW_SECONDS)
  if (!allowed) {
    // This is a best-effort diagnostic surface, not a route anything
    // depends on succeeding, so the body stays flat ({ ok: false }, no
    // detail) either way — but the status code still distinguishes a real
    // rate limit (429) from the limiter itself being unavailable (503),
    // since that's meaningful to anything monitoring this endpoint even if
    // it's meaningless to the crashing client that triggered the call.
    return NextResponse.json({ ok: false }, { status: reason === 'service_unavailable' ? 503 : 429 })
  }

  const raw = await request.text().catch(() => null)
  // `.length` counts UTF-16 code units, not bytes — a body full of
  // multibyte characters (emoji, non-Latin scripts) can be well under
  // MAX_BODY_BYTES by .length while its actual UTF-8 encoding, and thus
  // Supabase storage cost, exceeds it. Measure real bytes instead.
  if (raw === null || new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false }, { status: raw === null ? 400 : 413 })
  }

  const parsed = Body.safeParse(safeJsonParse(raw))
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 })

  if (parsed.data.context) {
    const keys = Object.keys(parsed.data.context)
    if (keys.length > MAX_CONTEXT_KEYS) {
      return NextResponse.json({ ok: false }, { status: 413 })
    }
    const contextBytes = new TextEncoder().encode(JSON.stringify(parsed.data.context)).length
    if (contextBytes > MAX_CONTEXT_BYTES) {
      return NextResponse.json({ ok: false }, { status: 413 })
    }
  }

  try {
    await logAppError(parsed.data.source, new Error(parsed.data.message), parsed.data.context, parsed.data.stack)
  } catch {
    // Logging failure must stay invisible to an already-crashing client —
    // no unbounded retry, no recursive logging of the logging failure.
  }

  return NextResponse.json({ ok: true })
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
