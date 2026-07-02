// T-64.1: fetch or update a draft session's settings/queue.
// No auth check — anonymous Draft Kit sessions are readable/writable by
// whoever holds the session ID (same trust model as the rest of Draft Kit:
// no account, no sensitive data, just a shareable in-progress draft).

import { createAdminClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { z } from 'zod'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('draft_sessions')
    .select('id, draft_id, status, settings_json, queue_json')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ session: data })
}

const PatchBody = z.object({
  queue: z.array(z.string()),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const parsed = PatchBody.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'queue must be an array of player IDs' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('draft_sessions')
    .update({ queue_json: parsed.data.queue })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
