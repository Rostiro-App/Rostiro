// T-85: Stripe webhook — the single source of truth for plan changes.
// Verifies the signature against the raw request body (required by
// Stripe; Next.js App Router route handlers never auto-parse the body,
// so request.text() here is already raw — no special route config needed,
// unlike the old Pages Router bodyParser: false convention).

import { createAdminClient } from '@/lib/supabase'
import { getStripeClient, SEASON_PASS_EXPIRES_AT, PLAN_RANK, type PaidPlan } from '@/lib/stripe'
import { assignFoundingNumber } from '@/lib/founderRecognition'
import { logAppError } from '@/lib/errorLog'
import { sendProStartedEmail, sendSeasonPassPurchasedEmail, sendFoundingWelcomeEmail } from '@/lib/resend'
import { NextResponse, type NextRequest } from 'next/server'
import type Stripe from 'stripe'

function priceIdToPlan(priceId: string): PaidPlan | null {
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'pro'
  if (priceId === process.env.STRIPE_PRICE_STARTER) return 'starter'
  if (priceId === process.env.STRIPE_PRICE_COMMISSIONER) return 'commissioner'
  return null
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!signature || !secret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 400 })
  }

  const rawBody = await request.text()
  const stripe = getStripeClient()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Signature verification failed: ${message}` }, { status: 400 })
  }

  const admin = createAdminClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.client_reference_id
        if (!userId) break

        const stripeForLineItems = getStripeClient()
        const lineItems = await stripeForLineItems.checkout.sessions.listLineItems(session.id, { limit: 1 })
        const priceId = lineItems.data[0]?.price?.id
        const plan = priceId ? priceIdToPlan(priceId) : null
        if (!plan) break

        // Tier-hierarchy defense-in-depth: app/api/stripe/checkout/route.ts
        // already rejects a downgrade checkout at creation time, but this
        // is a rare race (two tabs, or Stripe redelivering a stale event)
        // worth guarding here too, same posture as the Founding-500
        // sold-out check just below. Equal rank (re-buying the same plan)
        // is still allowed through normally — only strictly-lower is blocked.
        const { data: currentUserRow } = await admin
          .from('users')
          .select('plan, email')
          .eq('id', userId)
          .maybeSingle()
        const currentPlan = (currentUserRow?.plan ?? 'free') as keyof typeof PLAN_RANK
        const currentRank = PLAN_RANK[currentPlan] ?? 0
        if (currentRank > PLAN_RANK[plan]) {
          await logAppError('stripe/webhook', new Error('Rejected downgrade at webhook time'), {
            userId,
            sessionId: session.id,
            currentPlan,
            attemptedPlan: plan,
          })
          break // do not overwrite a higher-ranked plan with a lower one
        }

        let foundingNumber: number | null = null
        if (plan === 'commissioner') {
          foundingNumber = await assignFoundingNumber(admin, userId)
          if (foundingNumber === null) {
            await logAppError('stripe/webhook', new Error('Founding 500 sold out or migration missing at webhook time'), { userId, sessionId: session.id })
            break // do not set plan = 'commissioner' — support handles refund manually
          }
        }

        const update: Record<string, unknown> = { plan }
        if (plan === 'pro') {
          update.stripe_subscription_id = typeof session.subscription === 'string' ? session.subscription : null
        }
        if (plan === 'starter') {
          update.season_pass_expires_at = SEASON_PASS_EXPIRES_AT.toISOString()
        }

        const { error } = await admin.from('users').update(update).eq('id', userId)
        if (error) throw new Error(error.message)

        const email = currentUserRow?.email
        if (email) {
          try {
            if (plan === 'pro') await sendProStartedEmail(email)
            if (plan === 'starter') await sendSeasonPassPurchasedEmail(email)
            if (plan === 'commissioner') {
              // foundingNumber is guaranteed non-null here — the `break`
              // a few lines up already returns early when it's null.
              await sendFoundingWelcomeEmail(email, foundingNumber!)
            }
          } catch {
            // A purchase email failing to send must never fail the webhook
            // — the plan is already correctly persisted at this point.
          }
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
        const { error } = await admin
          .from('users')
          .update({ plan: 'free', stripe_subscription_id: null })
          .eq('stripe_customer_id', customerId)
        if (error) throw new Error(error.message)
        break
      }

      default:
        // Every other event type is a deliberate no-op — still 200, so
        // Stripe doesn't retry indefinitely.
        break
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    await logAppError('stripe/webhook', err, { eventType: event.type, eventId: event.id })
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
