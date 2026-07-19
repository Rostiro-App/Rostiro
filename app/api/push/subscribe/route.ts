// Web SDK integration (PRD 6.6): the server is the single authority for a
// browser's real push subscription. lib/pushSubscription.ts (the client sync
// owner) calls this whenever OneSignal confirms a real, opted-in subscription
// or when a device opts out / signs out.
//
// P3.5-4C correction pass (Codex review): the push lifecycle used to be
// one-way — a POST-only register with users.push_enabled flipped separately
// by a client PATCH, so the client and server could disagree. Now:
//   - POST derives users.push_enabled from a *successfully persisted* real
//     subscription (never a client preference toggle);
//   - DELETE unregisters one device and re-derives push_enabled from whether
//     any device remains;
//   - a non-2xx response never leaves the user in an "enabled" state, because
//     every database error short-circuits to 500 before push_enabled is set.

import { createSSRClient, createAdminClient } from '@/lib/supabase'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

// OneSignal subscription ids are UUIDs (~36 chars); cap well above that but
// low enough to reject junk without storing unbounded input.
const MAX_SUBSCRIPTION_ID = 255
const Body = z.object({
  subscriptionId: z.string().min(1).max(MAX_SUBSCRIPTION_ID),
})

export async function POST(request: NextRequest) {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'subscriptionId is required' }, { status: 400 })
  }
  const subscriptionId = parsed.data.subscriptionId

  const admin = createAdminClient()

  // Cross-account safety: a single browser subscription must belong to exactly
  // one Rostiro user. If this id is currently registered to a *different* user
  // (account switch on the same browser), take ownership away from them first,
  // and drop their kill switch if they no longer have any device. Never touch
  // the current user's own other devices.
  const { data: otherOwners, error: findErr } = await admin
    .from('push_subscriptions')
    .select('user_id')
    .eq('onesignal_player_id', subscriptionId)
    .neq('user_id', user.id)
  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 })

  if (otherOwners && otherOwners.length > 0) {
    const { error: reassignErr } = await admin
      .from('push_subscriptions')
      .delete()
      .eq('onesignal_player_id', subscriptionId)
      .neq('user_id', user.id)
    if (reassignErr) return NextResponse.json({ error: reassignErr.message }, { status: 500 })

    const affectedUserIds = [...new Set(otherOwners.map((r) => r.user_id as string))]
    for (const otherId of affectedUserIds) {
      const { count, error: countErr } = await admin
        .from('push_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', otherId)
      if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 })
      if ((count ?? 0) === 0) {
        const { error: downgradeErr } = await admin
          .from('users')
          .update({ push_enabled: false })
          .eq('id', otherId)
        if (downgradeErr) return NextResponse.json({ error: downgradeErr.message }, { status: 500 })
      }
    }
  }

  const { error: upsertErr } = await admin.from('push_subscriptions').upsert(
    { user_id: user.id, onesignal_player_id: subscriptionId },
    { onConflict: 'user_id,onesignal_player_id' }
  )
  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 })

  // push_enabled becomes true only here, only after the subscription row is
  // confirmed persisted — the kill switch can never say "on" without a real
  // subscription behind it.
  const { error: enableErr } = await admin
    .from('users')
    .update({ push_enabled: true })
    .eq('id', user.id)
  if (enableErr) return NextResponse.json({ error: enableErr.message }, { status: 500 })

  return NextResponse.json({ subscribed: true })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'subscriptionId is required' }, { status: 400 })
  }
  const subscriptionId = parsed.data.subscriptionId

  const admin = createAdminClient()

  // Remove only THIS device for THIS user — a user's other subscribed devices
  // (and every other user) are untouched.
  const { error: deleteErr } = await admin
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('onesignal_player_id', subscriptionId)
  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 })

  // Re-derive the kill switch: enabled iff at least one device remains.
  const { count, error: countErr } = await admin
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 })
  const remaining = count ?? 0

  const { error: updateErr } = await admin
    .from('users')
    .update({ push_enabled: remaining > 0 })
    .eq('id', user.id)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ subscribed: remaining > 0, remaining })
}
