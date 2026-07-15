// New page, 2026-07-15: founder's message + a way for visitors to follow
// the build, requested alongside the footer social links in the same
// pass. Same layout pattern as /privacy and /faq (ambient-ground wrapper,
// PublicHeader/PublicFooter, Section helper) -- no new conventions
// introduced. Founder copy is grounded in what's actually true (solo
// build, real pricing tiers, the actual cross-league problem) -- same
// honesty discipline as every other public-facing page in this app.

import PublicHeader from '@/components/marketing/PublicHeader'
import PublicFooter from '@/components/marketing/PublicFooter'
import SocialLinks from '@/components/marketing/SocialLinks'

export const metadata = {
  title: 'About · Rostiro',
  description: "Why one person is building an operating system for fantasy football, and how to follow along.",
  alternates: { canonical: 'https://www.rostiro.com/about' },
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="py-6" style={{ borderTop: '1px solid var(--hairline)' }}>
      <h2 className="text-lg font-bold" style={{ color: 'var(--t1)' }}>{title}</h2>
      <div className="text-sm mt-3 space-y-3 leading-relaxed" style={{ color: 'var(--t2)' }}>
        {children}
      </div>
    </section>
  )
}

export default function AboutPage() {
  return (
    <div style={{ backgroundColor: 'var(--void)', position: 'relative' }}>
      <div className="ambient-ground" aria-hidden="true" />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <PublicHeader />

        <main className="px-4 md:px-6 py-14 md:py-20">
          <div className="max-w-2xl mx-auto">
            <span className="mono-data text-[11px] tracking-[0.16em] uppercase" style={{ color: 'var(--t3)' }}>
              About
            </span>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-2" style={{ color: 'var(--t1)' }}>
              Run Every League
            </h1>

            <Section title="What Rostiro is">
              <p>
                Rostiro is one dashboard for every fantasy football league you&apos;re in, across Sleeper,
                ESPN, and Yahoo. Instead of opening three apps every Sunday to figure out what actually
                needs your attention, Rostiro watches all of them and tells you.
              </p>
            </Section>

            <Section title="A founder's message">
              <p>
                I&apos;m building Rostiro by myself. The problem is a personal one: I&apos;m in more fantasy
                leagues than I can comfortably keep straight, spread across Sleeper, ESPN, and Yahoo, and I
                got tired of the real skill of fantasy football quietly becoming &quot;remember to open the
                right app before 1pm on Sunday.&quot; So I&apos;m building the tool I actually wanted, in public,
                mistakes and all.
              </p>
              <p>
                There&apos;s no big team or funding round behind this, just one person shipping. Free tier,
                Rostiro Pro at $9.99/mo, a Founder Season Pass, and a capped, one-time Founding 500 tier for
                the people who show up early. If you want to see how this actually gets built, week to week,
                the socials below are the honest version, not a highlight reel.
              </p>
            </Section>

            <Section title="Follow the build">
              <SocialLinks />
            </Section>
          </div>
        </main>

        <PublicFooter />
      </div>
    </div>
  )
}
