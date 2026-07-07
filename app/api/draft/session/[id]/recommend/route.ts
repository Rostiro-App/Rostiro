// T-64.1: pre-fetch endpoint. Client calls this when picksUntilMyTurn is low
// (~2-3 picks away), never during the live clock — see PRD 6.3.1. Candidates
// are the deterministic best-available-by-need list the client already
// computed locally (lib/draftBoard.ts computeBestAvailable) from data it
// already has cached; this route's only job is the Claude call.

import { generateDraftPickRecommendations, type DraftPickRecommendation } from '@/lib/claude'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { isFreePlan } from '@/lib/usageLimits'
import { createAdminClient, createSSRClient } from '@/lib/supabase'
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
        formatWeight: z.number(),
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

  // PRD Section 9: "Limited Draft Copilot" (Free) vs "Full Draft Copilot
  // (pre-fetched reasoning)" (Pro) — this route stayed deliberately
  // unauthenticated for the no-signup Draft Kit (T-76, PRD 6.3), so a
  // logged-out caller here is never plan-gated (there's no plan to check,
  // and the Draft Kit is a top-of-funnel trial experience, not a metered
  // one). A real in-app draft session (app/draft/session/[id]/page.tsx)
  // calls this exact same route with a real cookie session, so a
  // best-effort auth check here is what actually distinguishes the two —
  // an authenticated Free-plan user gets the real, deterministic candidate
  // order without Claude's written reasoning; the pre-fetched explanation
  // text itself is the Pro-exclusive depth.
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isFree = user ? await isFreePlan(admin, user.id).catch(() => false) : false

  if (isFree) {
    const recommendations: DraftPickRecommendation[] = parsed.data.candidates.map((c) => ({
      playerId: c.playerId,
      reasoning: c.isNeeded
        ? `ADP ${Math.round(c.adp)} — fills an open roster need. Upgrade to Pro for Copilot's full pre-fetched reasoning.`
        : `ADP ${Math.round(c.adp)} — best remaining value. Upgrade to Pro for Copilot's full pre-fetched reasoning.`,
    }))
    return NextResponse.json({ recommendations })
  }

  try {
    const recommendations = await generateDraftPickRecommendations(parsed.data)
    return NextResponse.json({ recommendations })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
