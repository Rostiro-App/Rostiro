// T-64.1: pre-fetch endpoint. Client calls this when picksUntilMyTurn is low
// (~2-3 picks away), never during the live clock — see PRD 6.3.1. Candidates
// are the deterministic best-available-by-need list the client already
// computed locally (lib/draftBoard.ts computeBestAvailable) from data it
// already has cached; this route's only job is the Claude call.

import { generateDraftPickRecommendations } from '@/lib/claude'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const Body = z.object({
  round: z.number().int().positive(),
  pickNumber: z.number().int().positive(),
  strategy: z.enum(['balanced', 'zero_rb', 'hero_rb', 'hero_wr']).default('balanced'),
  rosterSoFar: z.array(z.object({ name: z.string(), position: z.string() })),
  candidates: z
    .array(
      z.object({
        playerId: z.string(),
        name: z.string(),
        position: z.string(),
        adp: z.number(),
      })
    )
    .min(1)
    .max(8),
})

export async function POST(request: Request) {
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
