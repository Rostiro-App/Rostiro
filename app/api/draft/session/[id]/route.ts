// T-64.1: fetch or update a draft session's settings/queue.
// No auth check — anonymous Draft Kit sessions are readable/writable by
// whoever holds the session ID (same trust model as the rest of Draft Kit:
// no account, no sensitive data, just a shareable in-progress draft).

import { createAdminClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { z } from 'zod'

// queue_json doesn't exist on draft_sessions in every environment yet (it's
// an additive column pending a manual migration — see PR history). Select
// the guaranteed columns first so a missing queue_json never takes down the
// whole session load; queue just comes back empty until the column lands.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('draft_sessions')
    .select('id, draft_id, status, settings_json')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  const { data: queueRow } = await admin
    .from('draft_sessions')
    .select('queue_json')
    .eq('id', id)
    .single()

  return NextResponse.json({ session: { ...data, queue_json: queueRow?.queue_json ?? [] } })
}

// Both fields optional — the queue and the strategy are switched
// independently from different parts of the live board UI.
const PatchBody = z.object({
  queue: z.array(z.string()).optional(),
  // Must match DraftStrategy (types/index.ts) exactly.
  strategy: z.enum(['balanced', 'zero_rb', 'zero_wr', 'hero_rb', 'hero_wr', 'robust_rb', 'late_qb', 'te_premium']).optional(),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const parsed = PatchBody.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const admin = createAdminClient()

  if (parsed.data.queue !== undefined) {
    const { error } = await admin
      .from('draft_sessions')
      .update({ queue_json: parsed.data.queue })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // strategy lives inside settings_json, not its own column — read, merge, write back.
  if (parsed.data.strategy !== undefined) {
    const { data: current, error: readError } = await admin
      .from('draft_sessions')
      .select('settings_json')
      .eq('id', id)
      .single()
    if (readError) return NextResponse.json({ error: readError.message }, { status: 500 })

    const { error: writeError } = await admin
      .from('draft_sessions')
      .update({ settings_json: { ...current.settings_json, strategy: parsed.data.strategy } })
      .eq('id', id)
    if (writeError) return NextResponse.json({ error: writeError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
