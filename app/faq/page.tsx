// Comprehensive FAQ — neutralizes the real objections both personas
// (PRD §3's Savant and casual manager) actually raise before signing up.
// Answers are checked against what the product actually does today (the
// same discipline as /privacy), not aspirational copy.

import PublicHeader from '@/components/marketing/PublicHeader'
import PublicFooter from '@/components/marketing/PublicFooter'
import FaqAccordion, { type FaqItem } from '@/components/marketing/FaqAccordion'

export const metadata = {
  title: 'FAQ — Rostiro',
  description: 'Answers on how Rostiro works with ESPN, Yahoo, and Sleeper, what Focused/Balanced/Savant modes mean, and how your league credentials are secured.',
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
              No — and that&apos;s deliberate. Rostiro doesn&apos;t run your league, score your matchups, or
              host your draft. ESPN, Yahoo, and Sleeper still do all of that. Rostiro watches all three at
              once and tells you what to do about what it sees.
            </p>
            <p className="mt-3">
              For Yahoo leagues, Rostiro can also set your lineup, claim a waiver, or propose a trade
              directly, since Yahoo&apos;s API supports that. For ESPN and Sleeper, Rostiro deep-links you to
              the exact right screen on their own site to make the move yourself — it never pretends to take
              an action neither platform actually lets a third party take.
            </p>
          </>
        ),
      },
      {
        question: 'Which platforms and league types are supported?',
        answer: (
          <p>
            ESPN, Yahoo, and Sleeper today. Standard, half-PPR, full-PPR, TE premium, and Superflex/2QB
            formats are all read correctly from your league&apos;s real scoring settings — Rostiro never
            assumes a generic scoring format. Dynasty and keeper leagues work the same way rosters and
            waivers already do; Rostiro doesn&apos;t yet have dynasty-specific features like rookie draft
            pick valuations.
          </p>
        ),
      },
      {
        question: 'Is this sports betting advice?',
        answer: (
          <p>
            No. Rostiro is a decision-support tool for skill-based season-long and weekly fantasy leagues —
            it doesn&apos;t place bets, doesn&apos;t set lines, and doesn&apos;t make picks against a spread.
            Nothing in the product is financial, investment, or betting advice, and Rostiro never guarantees
            a result in your league. See the{' '}
            <a href="/terms" className="underline" style={{ color: 'var(--signal)' }}>Terms of Service</a>{' '}
            for the full disclaimer.
          </p>
        ),
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
              It&apos;s a density choice, not a skill level — pick the one that matches how you actually want
              to play, set it once at signup, and change it anytime.
            </p>
            <ul className="mt-3 space-y-2">
              <li><strong style={{ color: 'var(--t1)' }}>Focused</strong> — &ldquo;Tell me what to do.&rdquo; Five decisions max, the verdict before any reasoning, one tap to act.</li>
              <li><strong style={{ color: 'var(--t1)' }}>Balanced</strong> — &ldquo;Show me the key stuff.&rdquo; The call, plus the context that produced it — matchup, injury, weather — visible inline.</li>
              <li><strong style={{ color: 'var(--t1)' }}>Savant</strong> — &ldquo;Give me everything.&rdquo; The full data layer: target share, usage trends, projections, nothing hidden. Rostiro advises, it never decides for you.</li>
            </ul>
            <p className="mt-3">
              Mode changes what every screen in the product shows — Pulse, Draft Kit, Lineups, Trades — not
              just one page.
            </p>
          </>
        ),
      },
      {
        question: 'Can I switch modes later?',
        answer: <p>Anytime, from the mode chip in the System Bar or from Settings. Nothing about your account or history changes when you switch.</p>,
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
              <li><strong style={{ color: 'var(--t1)' }}>Sleeper</strong> — public, read-only API, no credentials at all. There&apos;s nothing to steal because nothing is stored.</li>
              <li><strong style={{ color: 'var(--t1)' }}>Yahoo</strong> — official OAuth 2.0. Rostiro never sees your Yahoo password, only a scoped access token, encrypted at rest with AES-256-GCM.</li>
              <li><strong style={{ color: 'var(--t1)' }}>ESPN</strong> — ESPN has no official API, so private leagues require a browser cookie handshake (espn_s2/SWID). That cookie is encrypted at rest the same way, AES-256-GCM, and used only to read your league&apos;s own data.</li>
            </ul>
            <p className="mt-3">
              Sleeper and ESPN access is read-only by construction — Rostiro can&apos;t write anything back to
              either platform even if it wanted to. Full detail is in the{' '}
              <a href="/privacy" className="underline" style={{ color: 'var(--signal)' }}>Privacy Policy</a>.
            </p>
          </>
        ),
      },
      {
        question: 'Can Rostiro make changes to my team without me knowing?',
        answer: (
          <p>
            Only where a platform&apos;s own API allows it, and only when you tap to confirm. Yahoo is the
            one platform where Rostiro can submit a lineup, waiver claim, or trade proposal directly — every
            one of those is a deliberate action you take, never automatic. ESPN and Sleeper moves always
            deep-link you to that platform&apos;s own site to finish the action yourself.
          </p>
        ),
      },
      {
        question: 'Can I delete my data?',
        answer: (
          <p>
            Yes, anytime, from Settings → Data &amp; privacy — export everything Rostiro has on your account,
            or permanently delete your account and every row tied to it. Deletion takes effect immediately
            and can&apos;t be undone.
          </p>
        ),
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
              One that does gets named — which player, how many points, which leagues — then clears itself,
              instead of piling up as a permanent notification you have to manually dismiss.
            </p>
          </>
        ),
      },
      {
        question: 'Will Rostiro spam me with notifications during a live game?',
        answer: (
          <p>
            No — there&apos;s a hard rate ceiling regardless of how many games or leagues are live at once,
            and events are deduplicated across leagues (one push naming all three leagues a player affects,
            never three separate pushes). Push notifications for live events are a Pro feature; every plan
            still sees the same events inside the app the next time you open it.
          </p>
        ),
      },
    ],
  },
  {
    title: 'Pricing & plans',
    items: [
      {
        question: 'Is there a free plan?',
        answer: <p>Yes, forever — one league, Draft Kit, a daily Pulse, and a limited number of AI-assisted start/sit and trade calls per week. No credit card required to start.</p>,
      },
      {
        question: 'Can I cancel anytime?',
        answer: <p>Yes. Rostiro Pro is a standard monthly subscription with no lock-in — cancel from Settings and it stays active through the end of the current billing period.</p>,
      },
      {
        question: 'What happens to the Founder tiers after launch?',
        answer: <p>The 2026 Founder Season Pass and the Founding 500 lifetime tier are launch-window pricing. Once the window closes, or the first 500 sell out, neither is offered again at that price.</p>,
      },
    ],
  },
]

export default function FaqPage() {
  return (
    <div style={{ backgroundColor: 'var(--void)', position: 'relative' }}>
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
