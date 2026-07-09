// Extracted from app/page.tsx (T-66/T-112 pricing model: Free / Rostiro
// Pro / Founder Season Pass / Founding 500) so both the homepage and the
// dedicated /pricing page render identical content from one source.

import Link from 'next/link'

export default function PricingSection() {
  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: '',
      includes: ['1 league', 'Draft Kit', 'Daily Pulse', '3 start/sit calls a week', '3 trade checks a week'],
      cta: 'Start free',
      highlight: false,
    },
    {
      name: 'Rostiro Pro',
      price: '$9.99',
      period: '/mo',
      includes: ['Unlimited leagues', 'Full Pulse, every morning', 'Unlimited AI calls', 'Game Day live scores + push alerts', 'Waiver Day FAAB + Film Room recaps'],
      cta: 'Get started',
      highlight: true,
    },
    {
      name: '2026 Founder Season Pass',
      price: '$59',
      period: 'full season',
      includes: ['Everything in Rostiro Pro', 'Locked for the entire 2026 season', 'Launch-window pricing, won’t be offered again'],
      cta: 'Claim your season',
      highlight: false,
      badge: 'Launch window only',
    },
    {
      name: 'Founding 500',
      price: '$149',
      period: 'lifetime',
      includes: ['Everything in Rostiro Pro, for life', 'Founder badge', 'Priority feedback access', 'Early feature previews'],
      cta: 'Claim your spot',
      highlight: false,
      badge: 'First 500 only',
    },
  ]

  return (
    <section className="px-4 md:px-6 py-16 md:py-20">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ color: 'var(--t1)' }}>
            Start free. Upgrade when it&apos;s already paying for itself.
          </h2>
          <p className="text-sm mt-3" style={{ color: 'var(--t3)' }}>
            The Founder tiers are launch-window pricing: once the window closes, or the first 500 sell out, they&apos;re gone for good.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className="rounded-xl p-6 flex flex-col"
              style={{
                backgroundColor: 'var(--glass-solid)',
                border: plan.highlight ? '1px solid var(--signal)' : '1px solid var(--hairline)',
              }}
            >
              {(plan.highlight || plan.badge) && (
                <span
                  className="mono-data text-[10px] font-bold tracking-[0.12em] uppercase mb-3 self-start px-2 py-0.5 rounded"
                  style={
                    plan.highlight
                      ? { backgroundColor: 'var(--signal)', color: 'white' }
                      : { backgroundColor: 'rgba(245,200,66,0.14)', color: '#F5C842' }
                  }
                >
                  {plan.highlight ? 'Most popular' : plan.badge}
                </span>
              )}
              <h3 className="text-base font-bold" style={{ color: 'var(--t1)' }}>{plan.name}</h3>
              <p className="mt-1">
                <span className="mono-data text-2xl font-bold" style={{ color: 'var(--t1)' }}>{plan.price}</span>
                <span className="mono-data text-sm ml-1" style={{ color: 'var(--t4)' }}>{plan.period}</span>
              </p>
              <ul className="mt-4 space-y-2 flex-1">
                {plan.includes.map((item) => (
                  <li key={item} className="text-sm flex items-start gap-2" style={{ color: 'var(--t2)' }}>
                    <span style={{ color: 'var(--signal)' }}>&#10003;</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="text-sm font-semibold px-4 py-2.5 rounded-lg text-center transition-all mt-6 hover:brightness-110"
                style={{
                  backgroundColor: plan.highlight ? 'var(--cta)' : 'var(--glass)',
                  color: plan.highlight ? 'white' : 'var(--t1)',
                }}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
