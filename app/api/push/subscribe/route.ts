// Web SDK integration (PRD 6.6): stores the OneSignal subscription id for
// the current browser against the current user, so the send pipeline
// (lib/onesignal.ts) knows who to push to. Called from OneSignalInit.tsx
// whenever the subscription id becomes available or changes.

import { createSSRClient, createAdminClient } from '@/lib/supabase'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

const Body = z.object({
  subscriptionId: z.string().min(1),
})

export async function POST(request: NextRequest) {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = Body.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'subscriptionId is required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      onesignal_player_id: parsed.data.subscriptionId,
    },
    { onConflict: 'user_id,onesignal_player_id' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ subscribed: true })
}
