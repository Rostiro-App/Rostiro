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
//
// Cancels any active Stripe subscription (Pro plan only — Starter/Founding
// 500 are one-time charges with nothing recurring to stop) before deleting
// the account. Without this, a deleted Pro user's row disappears but Stripe
// keeps billing the still-active subscription with no account left to
// manage or cancel it from.

import { createAdminClient, createSSRClient } from '@/lib/supabase'
import { getStripeClient } from '@/lib/stripe'
import { sendAccountDeletedEmail } from '@/lib/resend'
import { logAppError } from '@/lib/errorLog'
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

  const { data: userRow } = await admin
    .from('users')
    .select('stripe_subscription_id')
    .eq('id', user.id)
    .maybeSingle()

  if (userRow?.stripe_subscription_id) {
    try {
      await getStripeClient().subscriptions.cancel(userRow.stripe_subscription_id)
    } catch (err) {
      // Don't block account deletion on a Stripe hiccup (subscription
      // already canceled, transient API error) — but a genuine failure
      // here means Stripe will keep billing an account that's about to
      // stop existing, so this must be logged and looked at, not silently
      // swallowed the way the confirmation-email failure below is.
      await logAppError('settings/delete-account', err, {
        userId: user.id,
        stripeSubscriptionId: userRow.stripe_subscription_id,
      })
    }
  }

  const { error } = await admin.auth.admin.deleteUser(user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (user.email) {
    try {
      await sendAccountDeletedEmail(user.email)
    } catch {
      // Deletion already succeeded — a failed confirmation email must not
      // surface as an error to a user whose account is genuinely gone.
    }
  }

  return NextResponse.json({ ok: true })
}
