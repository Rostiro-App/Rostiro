// T-85: shared Stripe client + plan/price config. Every stripe route
// imports from here rather than instantiating its own client, so the API
// version and key are set in exactly one place.

import Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'

let client: Stripe | null = null

export function getStripeClient(): Stripe {
  if (client) return client
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  client = new Stripe(key, { apiVersion: '2026-06-24.dahlia' })
  return client
}

export type PaidPlan = 'pro' | 'starter' | 'commissioner'

// One Stripe Price ID per paid plan — new, distinct env var names from the
// stale v4 STRIPE_PRICE_*_MONTHLY/ANNUAL vars in .env.example, which belong
// to the four-tier + Intelligence add-on model PRD v5 replaced.
export function getPriceId(plan: PaidPlan): string {
  const envKey = {
    pro: 'STRIPE_PRICE_PRO',
    starter: 'STRIPE_PRICE_STARTER',
    commissioner: 'STRIPE_PRICE_COMMISSIONER',
  }[plan]
  const priceId = process.env[envKey]
  if (!priceId) throw new Error(`${envKey} is not set`)
  return priceId
}

// Founder Season Pass ($59, one-time) grants access through end of season.
// 2026 season anchor: day after Super Bowl LXI (Sun Feb 8, 2027) —
// confirm with founder before this ships to production; same category of
// external NFL-schedule fact as T-150/T-151's dates.
export const SEASON_PASS_EXPIRES_AT = new Date('2027-02-09T00:00:00Z')

// Looks up the current user's Stripe customer id, creating one on first
// checkout. Every checkout/portal call site uses this so a user never
// ends up with duplicate Stripe customers.
export async function getOrCreateStripeCustomer(
  admin: SupabaseClient,
  userId: string,
  email: string
): Promise<string> {
  const { data, error: lookupError } = await admin
    .from('users')
    .select('stripe_customer_id')
    .eq('id', userId)
    .maybeSingle()
  if (lookupError) throw new Error(lookupError.message)

  if (data?.stripe_customer_id) return data.stripe_customer_id

  const stripe = getStripeClient()
  const customer = await stripe.customers.create({ email, metadata: { userId } })

  const { error } = await admin
    .from('users')
    .update({ stripe_customer_id: customer.id })
    .eq('id', userId)
  if (error) throw new Error(error.message)

  return customer.id
}
