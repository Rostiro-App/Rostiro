// T-85: creates a Stripe Checkout Session for one of the 3 paid plans and
// returns the hosted URL to redirect to. Auth required — same
// createSSRClient() pattern as every other route in app/api.

import { createSSRClient, createAdminClient } from '@/lib/supabase'
import { getStripeClient, getPriceId, getOrCreateStripeCustomer, type PaidPlan } from '@/lib/stripe'
import { getFoundingCount } from '@/lib/founderRecognition'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

const Body = z.object({
  plan: z.enum(['pro', 'starter', 'commissioner']),
})

const FOUNDING_500_CAP = 500

export async function POST(request: NextRequest) {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const plan: PaidPlan = parsed.data.plan

  try {
    const admin = createAdminClient()

    if (plan === 'commissioner') {
      const count = await getFoundingCount(admin)
      if (count >= FOUNDING_500_CAP) {
        return NextResponse.json({ error: 'Founding 500 is sold out' }, { status: 409 })
      }
    }

    const customerId = await getOrCreateStripeCustomer(admin, user.id, user.email ?? '')

    const stripe = getStripeClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL is not set')

    const session = await stripe.checkout.sessions.create({
      mode: plan === 'pro' ? 'subscription' : 'payment',
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: getPriceId(plan), quantity: 1 }],
      success_url: `${appUrl}/upgrade?checkout=success`,
      cancel_url: `${appUrl}/upgrade?checkout=cancelled`,
    })

    if (!session.url) throw new Error('Stripe did not return a checkout URL')
    return NextResponse.json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[stripe/checkout]', message)
    return NextResponse.json({ error: "Couldn't start checkout" }, { status: 500 })
  }
}
