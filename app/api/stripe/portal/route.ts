// T-85: Stripe Customer Portal — lets any user with a stripe_customer_id
// (any paid plan, past or present) manage/cancel a subscription or view
// past one-time payment receipts, without building custom billing UI.

import { createSSRClient, createAdminClient } from '@/lib/supabase'
import { getStripeClient } from '@/lib/stripe'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const admin = createAdminClient()
    const { data, error: lookupError } = await admin
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle()

    if (lookupError) throw new Error(lookupError.message)

    if (!data?.stripe_customer_id) {
      return NextResponse.json({ error: 'No billing account yet' }, { status: 400 })
    }

    const stripe = getStripeClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL is not set')

    const session = await stripe.billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: `${appUrl}/profile`,
    })
    return NextResponse.json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[stripe/portal]', message)
    return NextResponse.json({ error: "Couldn't open billing portal" }, { status: 500 })
  }
}
