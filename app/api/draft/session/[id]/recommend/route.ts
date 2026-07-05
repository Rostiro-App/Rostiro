// T-64.1: pre-fetch endpoint. Client calls this when picksUntilMyTurn is low
// (~2-3 picks away), never during the live clock — see PRD 6.3.1. Candidates
// are the deterministic best-available-by-need list the client already
// computed locally (lib/draftBoard.ts computeBestAvailable) from data it
// already has cached; this route's only job is the Claude call.

import { generateDraftPickRecommendations } from '@/lib/claude'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { createAdminClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const Body = z.object({
  round: z.number().int().positive(),
  pickNumber: z.number().int().positive(),
  // Must match DraftStrategy (types/index.ts) exactly.
  strategy: z
    .enum(['balanced', 'zero_rb', 'zero_wr', 'hero_rb', 'hero_wr', 'robust_rb', 'late_qb', 'te_premium'])
    .default('balanced'),
  rosterSoFar: z.array(z.object({ name: z.string(), position: z.string() })),
  candidates: z
    .array(
      z.object({
        playerId: z.string(),
        name: z.string(),
        position: z.string(),
        adp: z.number(),
        isNeeded: z.boolean(),
        strategyWeight: z.number(),
      })
    )
    .min(1)
    .max(8),
  mode: z.enum(['focused', 'balanced', 'savant']).default('balanced'),
})

// T-76: this route is deliberately unauthenticated (Draft Kit, no signup,
// PRD 6.3) and calls Claude on every request — no per-user usage quota
// exists to fall back on the way authenticated AI routes have, so an
// IP-keyed limit is the only thing preventing it from being a completely
// open cost vector. 20 calls/min/IP comfortably covers a real draft
// (~1 call every few picks) while blocking a scripted loop.
const RATE_LIMIT = 20
const RATE_WINDOW_SECONDS = 60

export async function POST(request: Request) {
  const admin = createAdminClient()
  const ip = getClientIp(request)
  const { allowed } = await checkRateLimit(admin, `draft-recommend:${ip}`, RATE_LIMIT, RATE_WINDOW_SECONDS)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests — slow down and try again shortly.' }, { status: 429 })
  }

  const body = await request.json()
  const parsed = Body.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  try {
    const recommendations = await generateDraftPickRecommendations(parsed.data)
    return NextResponse.json({ recommendations })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
