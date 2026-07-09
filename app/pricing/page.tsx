// Dedicated pricing page — the same PricingSection rendered on the
// homepage, given its own crawlable URL, title, and description so
// direct-intent searches ("rostiro pricing", "how much does rostiro
// cost") and AI-assistant answers have a single-purpose page to point to.

import PublicHeader from '@/components/marketing/PublicHeader'
import PublicFooter from '@/components/marketing/PublicFooter'
import PricingSection from '@/components/marketing/PricingSection'

export const metadata = {
  title: 'Pricing · Rostiro',
  description: 'Free to start: 1 league, Draft Kit, and a daily Pulse. Rostiro Pro is $9.99/mo for unlimited leagues. Launch-window tiers: Founder Season Pass ($59) and Founding 500 ($149 lifetime, capped at 500).',
  alternates: { canonical: 'https://www.rostiro.com/pricing' },
}

export default function PricingPage() {
  return (
    <div style={{ backgroundColor: 'var(--void)', position: 'relative' }}>
      <div className="ambient-ground" aria-hidden="true" />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <PublicHeader />
        <main className="pt-14 md:pt-20">
          <div className="max-w-2xl mx-auto text-center px-4">
            <span className="mono-data text-[11px] tracking-[0.16em] uppercase" style={{ color: 'var(--t3)' }}>
              Pricing
            </span>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-2" style={{ color: 'var(--t1)' }}>
              Start free. Upgrade when it&apos;s already paying for itself.
            </h1>
          </div>
          <PricingSection />
        </main>
        <PublicFooter />
      </div>
    </div>
  )
}
