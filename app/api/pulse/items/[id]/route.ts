// T-69: act on a Pulse item — done / dismiss / snooze. Uses the SSR client
// so RLS ("Users can manage own pulse items") enforces ownership; no manual
// user_id check needed beyond requiring a session.

import { createSSRClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const Body = z.object({
  action: z.enum(['done', 'dismiss', 'snooze']),
})

const SNOOZE_HOURS = 24

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'action must be done, dismiss, or snooze' }, { status: 400 })
  }

  const now = new Date()
  const update =
    parsed.data.action === 'done'
      ? { status: 'done', completed_at: now.toISOString() }
      : parsed.data.action === 'dismiss'
        ? { status: 'dismissed', is_dismissed: true }
        : {
            status: 'snoozed',
            snoozed_until: new Date(now.getTime() + SNOOZE_HOURS * 60 * 60 * 1000).toISOString(),
          }

  const { data, error } = await supabase
    .from('pulse_items')
    .update(update)
    .eq('id', id)
    .select('id, status')
    .maybeSingle()

  if (error) {
    // 42703 = the persistence columns don't exist yet (migration not run).
    // PGRST204 is PostgREST's real code for this on a live Supabase project
    // (verified directly) — kept alongside 42703 for a direct-SQL path.
    if (error.code === '42703' || error.code === 'PGRST204') {
      return NextResponse.json(
        { error: 'Pulse persistence not enabled yet — run migration_os_shell.sql' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  return NextResponse.json({ id: data.id, status: data.status })
}
