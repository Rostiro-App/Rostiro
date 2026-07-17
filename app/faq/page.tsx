// Comprehensive FAQ. Neutralizes the real objections both personas
// (PRD §3's Savant and casual manager) actually raise before signing up.
// Answers are checked against what the product actually does today (the
// same discipline as /privacy), not aspirational copy.

import PublicHeader from '@/components/marketing/PublicHeader'
import PublicFooter from '@/components/marketing/PublicFooter'
import FaqAccordion, { type FaqItem } from '@/components/marketing/FaqAccordion'

export const metadata = {
  title: 'FAQ · Rostiro',
  description: 'Answers on how Rostiro works with ESPN, Yahoo, and Sleeper, what Focused/Balanced/Savant modes mean, and how your league credentials are secured.',
  alternates: { canonical: 'https://www.rostiro.com/faq' },
}

interface FaqGroup {
  title: string
  items: FaqItem[]
}

const GROUPS: FaqGroup[] = [
  {
    title: 'What Rostiro actually is',
    items: [
      {
        question: 'Do you replace ESPN, Yahoo, or Sleeper?',
        answer: (
          <>
            <p>
              No, and that&apos;s deliberate. Rostiro doesn&apos;t run your league, score your matchups, or
              host your draft. ESPN, Yahoo, and Sleeper still do all of that. Rostiro watches all three at
              once and tells you what to do about what it sees.
            </p>
            <p className="mt-3">
              Rostiro connects to ESPN, Yahoo, and Sleeper read-only and deep-links you to the exact right
              screen on each platform&apos;s own site to make the move yourself. It never pretends to take an
              action a platform doesn&apos;t actually let a third party take.
            </p>
          </>
        ),
        answerText: "No, and that's deliberate. Rostiro doesn't run your league, score your matchups, or host your draft. ESPN, Yahoo, and Sleeper still do all of that. Rostiro watches all three at once and tells you what to do about what it sees. Rostiro connects to all three read-only and deep-links you to the exact right screen on each platform's own site to make the move yourself.",
      },
      {
        question: 'Which platforms and league types are supported?',
        answer: (
          <p>
            ESPN, Yahoo, and Sleeper today. Standard, half-PPR, full-PPR, TE premium, and Superflex/2QB
            formats are all read correctly from your league&apos;s real scoring settings; Rostiro never
            assumes a generic scoring format. Dynasty and keeper leagues work the same way rosters and
            waivers already do, though Rostiro doesn&apos;t yet have dynasty-specific features like rookie
            draft pick valuations.
          </p>
        ),
        answerText: "ESPN, Yahoo, and Sleeper today. Standard, half-PPR, full-PPR, TE premium, and Superflex/2QB formats are all read correctly from your league's real scoring settings. Dynasty and keeper leagues work the same way rosters and waivers already do, though Rostiro doesn't yet have dynasty-specific features like rookie draft pick valuations.",
      },
      {
        question: 'Is this sports betting advice?',
        answer: (
          <p>
            No. Rostiro is a decision-support tool for skill-based season-long and weekly fantasy leagues.
            It doesn&apos;t place bets, doesn&apos;t set lines, and doesn&apos;t make picks against a spread.
            Nothing in the product is financial, investment, or betting advice, and Rostiro never guarantees
            a result in your league. See the{' '}
            <a href="/terms" className="underline" style={{ color: 'var(--signal)' }}>Terms of Service</a>{' '}
            for the full disclaimer.
          </p>
        ),
        answerText: "No. Rostiro is a decision-support tool for skill-based season-long and weekly fantasy leagues. It doesn't place bets, doesn't set lines, and doesn't make picks against a spread. Nothing in the product is financial, investment, or betting advice, and Rostiro never guarantees a result in your league.",
      },
    ],
  },
  {
    title: 'Modes & personalization',
    items: [
      {
        question: 'What’s the difference between Focused, Balanced, and Savant modes?',
        answer: (
          <>
            <p>
              It&apos;s a density choice, not a skill level. Pick the one that matches how you actually want
              to play, set it once at signup, and change it anytime.
            </p>
            <ul className="mt-3 space-y-2">
              <li><strong style={{ color: 'var(--t1)' }}>Focused.</strong> &ldquo;Tell me what to do.&rdquo; Five decisions max, the verdict before any reasoning, one tap to act.</li>
              <li><strong style={{ color: 'var(--t1)' }}>Balanced.</strong> &ldquo;Show me the key stuff.&rdquo; The call, plus the context that produced it (matchup, injury, weather), visible inline.</li>
              <li><strong style={{ color: 'var(--t1)' }}>Savant.</strong> &ldquo;Give me everything.&rdquo; The full data layer: target share, usage trends, projections, nothing hidden. Rostiro advises, it never decides for you.</li>
            </ul>
            <p className="mt-3">
              Mode changes what every screen in the product shows: Pulse, Draft Kit, Lineups, Trades, not
              just one page.
            </p>
          </>
        ),
        answerText: "It's a density choice, not a skill level. Focused: tell me what to do, five decisions max, the verdict before any reasoning. Balanced: show me the key stuff, the call plus the context that produced it. Savant: give me everything, the full data layer with nothing hidden. Mode changes what every screen in the product shows, not just one page.",
      },
      {
        question: 'Can I switch modes later?',
        answer: <p>Anytime, from the mode chip in the System Bar or from Settings. Nothing about your account or history changes when you switch.</p>,
        answerText: "Anytime, from the mode chip in the System Bar or from Settings. Nothing about your account or history changes when you switch.",
      },
    ],
  },
  {
    title: 'Security & your data',
    items: [
      {
        question: 'How secure are my connected league credentials?',
        answer: (
          <>
            <p>
              Rostiro connects to your leagues read-mostly, and encrypts anything sensitive it has to store.
            </p>
            <ul className="mt-3 space-y-2">
              <li><strong style={{ color: 'var(--t1)' }}>Sleeper.</strong> Public, read-only API, no credentials at all. There&apos;s nothing to steal because nothing is stored.</li>
              <li><strong style={{ color: 'var(--t1)' }}>Yahoo.</strong> Official OAuth 2.0, read-only. Rostiro never sees your Yahoo password, only a scoped access token, encrypted at rest with AES-256-GCM.</li>
              <li><strong style={{ color: 'var(--t1)' }}>ESPN.</strong> ESPN has no official API, so private leagues require a browser cookie handshake (espn_s2/SWID). That cookie is encrypted at rest the same way, AES-256-GCM, and used only to read your league&apos;s own data.</li>
            </ul>
            <p className="mt-3">
              Access to all three platforms is read-only by construction. Rostiro can&apos;t write anything
              back to any of them even if it wanted to. Full detail is in the{' '}
              <a href="/privacy" className="underline" style={{ color: 'var(--signal)' }}>Privacy Policy</a>.
            </p>
          </>
        ),
        answerText: "Rostiro connects to your leagues read-only, and encrypts anything sensitive it has to store. Sleeper: public, read-only API, no credentials stored at all. Yahoo: official OAuth 2.0, read-only, Rostiro never sees your password, only a scoped access token encrypted at rest with AES-256-GCM. ESPN: a browser cookie handshake for private leagues, encrypted at rest the same way and used only to read your league's own data.",
      },
      {
        question: 'Can Rostiro make changes to my team without me knowing?',
        answer: (
          <p>
            No. Rostiro doesn&apos;t submit a lineup, claim a waiver, or propose a trade on any platform —
            ESPN, Yahoo, and Sleeper are all read-only connections. Every recommendation deep-links you to
            the exact right screen on that platform&apos;s own site, and you&apos;re the one who makes the move.
          </p>
        ),
        answerText: "No. Rostiro doesn't submit a lineup, claim a waiver, or propose a trade on any platform — ESPN, Yahoo, and Sleeper are all read-only connections. Every recommendation deep-links you to the exact right screen on that platform's own site, and you're the one who makes the move.",
      },
      {
        question: 'Can I delete my data?',
        answer: (
          <p>
            Yes, anytime, from Settings, then Data &amp; privacy. Export everything Rostiro has on your
            account, or permanently delete your account and every row tied to it. Deletion takes effect
            immediately and can&apos;t be undone.
          </p>
        ),
        answerText: "Yes, anytime, from Settings, then Data & privacy. Export everything Rostiro has on your account, or permanently delete your account and every row tied to it. Deletion takes effect immediately and can't be undone.",
      },
    ],
  },
  {
    title: 'Game Day',
    items: [
      {
        question: 'Why is Game Day on Rostiro different from checking a normal fantasy app?',
        answer: (
          <>
            <p>
              Most fantasy apps show you every score whether it matters to you or not. Rostiro filters
              through a portfolio-relevance rule first: it only interrupts you if a live event directly
              touches your own roster, your opponent&apos;s roster, or the waiver wire in a league you&apos;re
              actually in.
            </p>
            <p className="mt-3">
              A touchdown from a player nobody on either side of your matchup rosters never reaches you.
              One that does gets named (which player, how many points, which leagues), then clears itself,
              instead of piling up as a permanent notification you have to manually dismiss.
            </p>
          </>
        ),
        answerText: "Most fantasy apps show every score whether it matters to you or not. Rostiro filters through a portfolio-relevance rule first: it only interrupts you if a live event directly touches your own roster, your opponent's roster, or the waiver wire in a league you're actually in.",
      },
      {
        question: 'Will Rostiro spam me with notifications during a live game?',
        answer: (
          <p>
            No, there&apos;s a hard rate ceiling regardless of how many games or leagues are live at once,
            and events are deduplicated across leagues (one push naming all three leagues a player affects,
            never three separate pushes). Push notifications for live events are a Pro feature; every plan
            still sees the same events inside the app the next time you open it.
          </p>
        ),
        answerText: "No, there's a hard rate ceiling regardless of how many games or leagues are live at once, and events are deduplicated across leagues. Push notifications for live events are a Pro feature; every plan still sees the same events inside the app the next time you open it.",
      },
    ],
  },
  {
    title: 'Pricing & plans',
    items: [
      {
        question: 'Is there a free plan?',
        answer: <p>Yes, forever: one league, Draft Kit, a daily Pulse, and a limited number of AI-assisted start/sit and trade calls per week. No credit card required to start.</p>,
        answerText: "Yes, forever: one league, Draft Kit, a daily Pulse, and a limited number of AI-assisted start/sit and trade calls per week. No credit card required to start.",
      },
      {
        question: 'Can I cancel anytime?',
        answer: <p>Yes. Rostiro Pro is a standard monthly subscription with no lock-in. Cancel from Settings and it stays active through the end of the current billing period.</p>,
        answerText: "Yes. Rostiro Pro is a standard monthly subscription with no lock-in. Cancel from Settings and it stays active through the end of the current billing period.",
      },
      {
        question: 'What happens to the Founder tiers after launch?',
        answer: <p>The 2026 Founder Season Pass and the Founding 500 lifetime tier are launch-window pricing. Once the window closes, or the first 500 sell out, neither is offered again at that price.</p>,
        answerText: "The 2026 Founder Season Pass and the Founding 500 lifetime tier are launch-window pricing. Once the window closes, or the first 500 sell out, neither is offered again at that price.",
      },
    ],
  },
]

const faqPageSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: GROUPS.flatMap((group) =>
    group.items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answerText,
      },
    }))
  ),
}

export default function FaqPage() {
  return (
    <div style={{ backgroundColor: 'var(--void)', position: 'relative' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageSchema) }}
      />
      <div className="ambient-ground" aria-hidden="true" />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <PublicHeader />

        <main className="px-4 md:px-6 py-14 md:py-20">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <span className="mono-data text-[11px] tracking-[0.16em] uppercase" style={{ color: 'var(--t3)' }}>
              Frequently asked
            </span>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-2" style={{ color: 'var(--t1)' }}>
              Questions worth asking before you connect a league
            </h1>
          </div>

          <div className="max-w-2xl mx-auto space-y-12">
            {GROUPS.map((group) => (
              <div key={group.title}>
                <h2 className="mono-data text-[11px] tracking-[0.16em] uppercase mb-4" style={{ color: 'var(--signal)' }}>
                  {group.title}
                </h2>
                <FaqAccordion items={group.items} />
              </div>
            ))}
          </div>
        </main>

        <PublicFooter />
      </div>
    </div>
  )
}
