'use client'

import { useState } from 'react'

interface Tier {
  plan: 'pro' | 'starter' | 'commissioner'
  name: string
  price: string
  description: string
}

const TIERS: Tier[] = [
  { plan: 'pro', name: 'Rostiro Pro', price: '$9.99/mo', description: 'Unlimited leagues, full Pulse depth, unlimited AI.' },
  { plan: 'starter', name: 'Founder Season Pass', price: '$59', description: 'One-time — full access through end of season.' },
  { plan: 'commissioner', name: 'Founding 500', price: '$149', description: 'One-time — lifetime access, founder badge, capped at 500.' },
]

// Local copy of lib/stripe.ts's PLAN_RANK — not imported directly because
// lib/stripe.ts has a top-level `import Stripe from 'stripe'`, which would
// pull the whole (Node-only) Stripe SDK into this client bundle. Small,
// duplicated map beats that risk. Keep in sync with lib/stripe.ts if the
// tier hierarchy ever changes. commissioner (Founding 500, one-time
// lifetime) is the permanent top tier, ranked above pro despite its lower
// one-time price.
const PLAN_RANK: Record<'free' | Tier['plan'], number> = {
  free: 0,
  starter: 1,
  pro: 2,
  commissioner: 3,
}

export default function UpgradeButtons({
  currentPlan,
  foundingRemaining,
}: {
  currentPlan: string
  foundingRemaining: number
}) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function choosePlan(plan: Tier['plan']) {
    setError(null)
    setLoadingPlan(plan)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Checkout failed')
      window.location.href = body.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed')
      setLoadingPlan(null)
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm" style={{ color: '#FF6B6B' }}>{error}</p>
      )}
      {TIERS.map((tier) => {
        const isCurrent = currentPlan === tier.plan
        const currentRank = PLAN_RANK[currentPlan as keyof typeof PLAN_RANK] ?? 0
        const isIncluded = !isCurrent && PLAN_RANK[tier.plan] <= currentRank
        const soldOut = tier.plan === 'commissioner' && foundingRemaining <= 0
        return (
          <div key={tier.plan} className="rounded-xl p-4" style={{ backgroundColor: 'var(--glass-solid)', border: '1px solid var(--hairline)' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">{tier.name}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--t3)' }}>{tier.description}</p>
                {tier.plan === 'commissioner' && (
                  <p className="text-xs mt-1" style={{ color: 'var(--t4)' }}>
                    {soldOut ? 'Sold out' : `${foundingRemaining} of 500 remaining`}
                  </p>
                )}
              </div>
              <div className="text-right flex-shrink-0 ml-4">
                <p className="text-sm font-semibold text-white mb-2">{tier.price}</p>
                <button
                  onClick={() => choosePlan(tier.plan)}
                  disabled={isCurrent || isIncluded || soldOut || loadingPlan !== null}
                  className="text-xs font-semibold px-3 py-2 rounded-lg disabled:opacity-60"
                  style={{ backgroundColor: 'var(--signal)', color: 'white' }}
                >
                  {isCurrent ? 'Current plan' : isIncluded ? 'Included in your plan' : soldOut ? 'Sold out' : loadingPlan === tier.plan ? 'Loading…' : 'Choose plan'}
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
