// T-78: account deletion. public.users.id references auth.users(id) on
// delete cascade, and every user-scoped table (connected_leagues,
// yahoo_tokens, espn_credentials, pulse_items, ai_queries,
// push_subscriptions, engagement_log, usage_counters) references
// public.users(id) on delete cascade — so deleting the auth.users row via
// the admin API is the single correct operation; there is no separate
// per-table cleanup to do or forget.
//
// Requires the literal string "DELETE" in the body as a server-side backstop
// to the UI's own confirmation step — this is irreversible, so a stray
// re-submitted request or client bug shouldn't be able to trigger it silently.

import { createAdminClient, createSSRClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const Body = z.object({ confirm: z.literal('DELETE') })

export async function POST(request: Request) {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Type DELETE to confirm account deletion' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
