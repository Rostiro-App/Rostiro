// T-100 (PRD 7.1): Console/Pulse engagement telemetry — raw event
// ingestion only, no aggregation/dashboard here (that's a later, separate
// analysis step against telemetry_events directly). Best-effort: a
// migration-not-run or transient DB error degrades to a silent no-op
// rather than surfacing an error to whatever feature called this.

import { createSSRClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const Body = z.object({
  eventType: z.enum([
    'game_day_session_open',
    'game_day_session_close',
    'interrupt_shown',
    'interrupt_action',
    'pulse_item_action',
  ]),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export async function POST(request: Request) {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 })

  await supabase.from('telemetry_events').insert({
    user_id: user.id,
    event_type: parsed.data.eventType,
    metadata: parsed.data.metadata ?? {},
  })

  // Always 200 — a dropped event (migration not run, transient error)
  // should never read as a real failure to the calling feature.
  return NextResponse.json({ ok: true })
}
