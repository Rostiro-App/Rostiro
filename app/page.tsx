// T-66/T-112: Marketing landing page. Public, no auth. Every section earns its
// place by selling an outcome, not a feature list, per the PRD's core
// philosophy: "Never market AI. Market the outcome."
//
// T-112 (July 2026): rebuilt on the real Rostiro OS design tokens
// (app/globals.css: void ground, glass surfaces, signal glow, mono
// tabular-nums) instead of a hardcoded navy palette that had drifted away
// from what the post-auth product actually looks like. Pricing corrected to
// the confirmed model: Free / Rostiro Pro / Founder Season Pass / Founding
// 500. The old Scout/Starter/Pro/Commissioner copy matched neither the
// shipped code nor the PRD's target.

import Link from 'next/link'
import PublicHeader from '@/components/marketing/PublicHeader'
import PublicFooter from '@/components/marketing/PublicFooter'
import OldWayVsRostiro from '@/components/marketing/OldWayVsRostiro'
import RostiroStatesCycle from '@/components/marketing/RostiroStatesCycle'
import PulseMark from '@/components/PulseMark'
import { STATE_CONFIG } from '@/lib/brandTokens'
import { getPublicRostiroState } from '@/lib/publicRostiroState'

export default async function Home() {
  // T-124: the hero reflects the real, live Rostiro State — schedule-driven
  // and identical for every visitor at a given moment, same as the public
  // ticker (lib/publicRostiroState.ts), not a per-user/demo value.
  const liveState = await getPublicRostiroState()

  return (
    <div style={{ backgroundColor: 'var(--void)', position: 'relative' }}>
      <div className="ambient-ground" aria-hidden="true" />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <PublicHeader />
        <Hero state={liveState} />
        <ProblemSection />
        <StatesSection />
        <PulseSection />
        <ModeSection />
        <PlatformSection />
        <FeatureStrip />
        <DraftKitSection />
        <PricingSection />
        <FinalCTA />
        <PublicFooter />
      </div>
    </div>
  )
}

// ─── Hero ──────────────────────────────────────────────────────────────────────

function Hero({ state }: { state: keyof typeof STATE_CONFIG }) {
  const accent = STATE_CONFIG[state].color

  return (
    <section className="px-4 md:px-6 pt-16 pb-20 md:pt-24 md:pb-28">
      <div className="max-w-3xl mx-auto text-center">
        <span
          className="hero-enter mono-data inline-flex items-center gap-2 text-[11px] tracking-[0.16em] uppercase px-3 py-1 rounded-full mb-6"
          style={{ backgroundColor: `${accent}22`, color: accent, animationDelay: '0ms' }}
        >
          {/* T-124: the one visitor-visible proof this is real, not a
              static claim — same PulseMark component and STATE_CONFIG the
              product itself reads, animating at this state's actual
              amplitude/cycle speed (lib/publicRostiroState.ts). */}
          <PulseMark state={state} />
          The operating system for fantasy sports
        </span>
        <h1
          className="hero-enter text-4xl md:text-6xl font-bold tracking-tight leading-[1.1]"
          style={{ color: 'var(--t1)', animationDelay: '90ms' }}
        >
          Run Every League.
        </h1>
        <p
          className="hero-enter text-lg md:text-xl mt-6 leading-relaxed"
          style={{ color: 'var(--t2)', animationDelay: '180ms' }}
        >
          You didn&apos;t lose because you made a bad call. You lost because the alert was in
          a different app. Rostiro watches every league you play, on every platform you use,
          and tells you the one thing to do before it costs you.
        </p>
        <div
          className="hero-enter flex flex-col sm:flex-row gap-3 justify-center mt-9"
          style={{ animationDelay: '270ms' }}
        >
          <Link
            href="/signup"
            className="text-sm font-semibold px-6 py-3 rounded-xl text-white transition-all hover:brightness-110"
            style={{ backgroundColor: 'var(--cta)' }}
          >
            Get started free
          </Link>
          <Link
            href="/draft"
            className="glass text-sm font-semibold px-6 py-3 rounded-xl transition-all hover:border-[var(--hairline-bright)]"
            style={{ color: 'var(--t1)' }}
          >
            Try Draft Kit, no signup
          </Link>
        </div>
        <p className="hero-enter text-xs mt-4" style={{ color: 'var(--t3)', animationDelay: '340ms' }}>
          Free plan forever. No credit card required.
        </p>
      </div>

      <PulsePreviewCard />
    </section>
  )
}

// A real reproduction of the System Bar + Pulse, using the same glass/
// mono-data/ping-dot primitives the post-auth product renders with, not an
// approximation of them in a different palette.
function PulsePreviewCard() {
  const items = [
    { tag: 'CRITICAL', color: 'var(--crit)', text: 'Bench Stefon Diggs in 2 leagues. 31 mph winds in Buffalo at kickoff.' },
    { tag: 'IMPORTANT', color: 'var(--warn)', text: 'Claim Jaylen Warren in League 2. Waiver cutoff is 3:00 PM today.' },
    { tag: 'REVIEW', color: 'var(--signal)', text: 'Trade pending: your Kupp for their Ekeler. Lean accept, it fixes your RB2 gap.' },
    { tag: 'WATCH', color: 'var(--t2)', text: 'Joe Mixon is questionable. Pivot option ready: Zach Moss.' },
  ]

  return (
    <div
      className="glass-heavy max-w-2xl mx-auto mt-14 rounded-2xl overflow-hidden"
      style={{ boxShadow: '0 20px 60px -20px rgba(0,0,0,0.6)' }}
    >
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--hairline)' }}>
        <div className="flex items-center gap-2">
          <span className="ping-dot inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--live)', color: 'var(--live)' }} />
          <span className="mono-data text-[10px] tracking-[0.1em]" style={{ color: 'var(--t3)' }}>SYNCED 12S AGO</span>
        </div>
        <span
          className="mono-data text-[10px] font-bold tracking-[0.12em] px-2 py-0.5 rounded"
          style={{ backgroundColor: `${STATE_CONFIG.standard.color}18`, color: STATE_CONFIG.standard.color }}
        >
          STANDARD
        </span>
      </div>
      <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--hairline)' }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--t1)' }}>Good morning. 5 decisions across 3 leagues.</p>
        <p className="mono-data text-xs mt-0.5" style={{ color: 'var(--t3)' }}>Estimated time to clear: 2 minutes.</p>
      </div>
      <div>
        {items.map((item) => (
          <div
            key={item.tag}
            className="flex items-start gap-3 px-5 py-3.5 text-left"
            style={{ borderTop: '1px solid var(--hairline)', borderLeft: `2.5px solid ${item.color}` }}
          >
            <span
              className="mono-data text-[10px] font-bold tracking-[0.12em] flex-shrink-0 mt-0.5"
              style={{ color: item.color }}
            >
              {item.tag}
            </span>
            <p className="text-sm" style={{ color: 'var(--t2)' }}>{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Problem ───────────────────────────────────────────────────────────────────

function ProblemSection() {
  const scenarios = [
    'A bench player takes a season-ending hit. ESPN has it. You find out Monday.',
    'A waiver window closes at 3pm in your Yahoo league. You had Sleeper open.',
    'Three of your rosters are all in on the same running back, and nobody warned you.',
  ]

  return (
    <section className="px-4 md:px-6 py-16 md:py-20" style={{ backgroundColor: 'var(--glass-solid)' }}>
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ color: 'var(--t1)' }}>
          You&apos;re not bad at fantasy. You&apos;re just checking the wrong app.
        </h2>
        <div className="grid md:grid-cols-3 gap-4 mt-10 text-left">
          {scenarios.map((s) => (
            <div key={s} className="glass rounded-xl p-5">
              <p className="text-sm leading-relaxed" style={{ color: 'var(--t2)' }}>{s}</p>
            </div>
          ))}
        </div>
        <p className="text-base mt-8 font-medium" style={{ color: 'var(--signal)' }}>
          Rostiro watches all of it, so you don&apos;t have to remember to.
        </p>
        <OldWayVsRostiro />
      </div>
    </section>
  )
}

// ─── Rostiro States ─────────────────────────────────────────────────────────────
// New section (T-112): the product's actual centerpiece (the OS reshapes
// around what day it is) had no representation anywhere on the marketing
// site before this. Colors pulled directly from lib/brandTokens.ts's
// STATE_CONFIG, the same source of truth the product renders from, so this
// can't drift out of sync the way the old pricing copy did.

function StatesSection() {
  const states: { key: keyof typeof STATE_CONFIG; label: string; when: string; copy: string }[] = [
    { key: 'draft', label: 'Draft', when: 'Preseason', copy: 'Live pick recommendations, tiered ADP, no dead air between picks.' },
    { key: 'standard', label: 'Standard', when: 'Wed–Sat', copy: 'Calm monitoring. One ranked list, nothing urgent inflated to look urgent.' },
    { key: 'waiver_day', label: 'Waiver Day', when: 'Tue night / Wed', copy: 'Priority targets, real FAAB math, and the roster-health delta each claim buys you.' },
    { key: 'game_day', label: 'Game Day', when: 'Thu / Sun / Mon', copy: 'Live scores that name your players, not just the teams. Mission control for kickoff to final whistle.' },
    { key: 'film_room', label: 'Film Room', when: 'Mon night / Tue AM', copy: 'A quiet recap of what just happened and what it means for next week. Win or lose, no pile-on.' },
  ]

  return (
    <section className="px-4 md:px-6 py-16 md:py-24">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <span className="mono-data text-[11px] tracking-[0.16em] uppercase" style={{ color: 'var(--t3)' }}>
            Rostiro States
          </span>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mt-3" style={{ color: 'var(--t1)' }}>
            Rostiro doesn&apos;t look the same on a random Tuesday as it does at kickoff.
          </h2>
          <p className="text-base mt-3 max-w-2xl mx-auto" style={{ color: 'var(--t3)' }}>
            The whole product reprioritizes itself around what your leagues actually need right now:
            five states, driven by the calendar, not a setting you have to manage.
          </p>
        </div>
        <RostiroStatesCycle />
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-14">
          {states.map((s) => {
            const color = STATE_CONFIG[s.key].color
            return (
              <div
                key={s.key}
                className="glass rounded-xl p-5 flex flex-col"
                style={{ borderTop: `2.5px solid ${color}` }}
              >
                <span className="mono-data text-[10px] font-bold tracking-[0.12em]" style={{ color }}>
                  {s.label.toUpperCase()}
                </span>
                <span className="mono-data text-[10px] mt-1" style={{ color: 'var(--t4)' }}>{s.when}</span>
                <p className="text-[13px] mt-3 leading-relaxed flex-1" style={{ color: 'var(--t2)' }}>{s.copy}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─── Pulse product section ──────────────────────────────────────────────────────

function PulseSection() {
  return (
    <section className="px-4 md:px-6 py-16 md:py-24" style={{ backgroundColor: 'var(--glass-solid)' }}>
      <div className="max-w-3xl mx-auto text-center">
        <span className="mono-data text-[11px] tracking-[0.16em] uppercase" style={{ color: 'var(--signal)' }}>
          Rostiro Pulse
        </span>
        <h2 className="text-2xl md:text-4xl font-bold tracking-tight mt-3" style={{ color: 'var(--t1)' }}>
          One list. Every league. What actually matters today.
        </h2>
        <p className="text-base md:text-lg mt-5 leading-relaxed" style={{ color: 'var(--t2)' }}>
          Every morning, Rostiro checks your rosters across ESPN, Yahoo, and Sleeper, then
          hands you a short, ranked list of what to do and why. Tap a decision and it takes
          you straight to the fix. No dashboards to dig through, no tabs to remember.
        </p>
      </div>
    </section>
  )
}

// ─── Modes ─────────────────────────────────────────────────────────────────────

function ModeSection() {
  const modes = [
    { name: 'Focused', tagline: 'Tell me what to do.', body: 'Five decisions, max. The verdict first, reasoning if you want it. Built for the 90-second check between meetings.' },
    { name: 'Balanced', tagline: 'Show me the key stuff.', body: 'The call, plus the context that made it: matchup, injury, weather. Tap anything to go deeper.' },
    { name: 'Savant', tagline: 'Give me everything.', body: 'The full data layer. Target share, usage trends, Vegas lines. Rostiro advises, you decide.' },
  ]

  return (
    <section className="px-4 md:px-6 py-16 md:py-20">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ color: 'var(--t1)' }}>
            Built around how you actually play.
          </h2>
          <p className="text-base mt-3" style={{ color: 'var(--t3)' }}>
            Pick a mode once. It reshapes the entire product around you, not the other way around.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {modes.map((m) => (
            <div key={m.name} className="glass rounded-xl p-6">
              <h3 className="text-lg font-bold" style={{ color: 'var(--t1)' }}>{m.name}</h3>
              <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--signal)' }}>&ldquo;{m.tagline}&rdquo;</p>
              <p className="text-sm mt-3 leading-relaxed" style={{ color: 'var(--t3)' }}>{m.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Platforms ─────────────────────────────────────────────────────────────────

function PlatformSection() {
  const platforms = ['ESPN', 'Yahoo', 'Sleeper']

  return (
    <section className="px-4 md:px-6 py-14 md:py-16" style={{ backgroundColor: 'var(--glass-solid)' }}>
      <div className="max-w-3xl mx-auto text-center">
        <p className="mono-data text-[11px] tracking-[0.16em] uppercase" style={{ color: 'var(--t4)' }}>
          Works with the leagues you&apos;re already in
        </p>
        <div className="flex items-center justify-center gap-8 md:gap-12 mt-6">
          {platforms.map((p) => (
            <span key={p} className="text-xl md:text-2xl font-bold" style={{ color: 'var(--t3)' }}>
              {p}
            </span>
          ))}
        </div>
        <p className="text-sm mt-6" style={{ color: 'var(--t3)' }}>
          Connect a league in under a minute. No new accounts for you, no new apps for your leaguemates.
        </p>
      </div>
    </section>
  )
}

// ─── Feature strip ───────────────────────────────────────────────────────────────

function FeatureStrip() {
  const features = [
    { title: 'Know which league needs you first', body: 'Every league gets a Health Score, so you open the app knowing where the risk is, not just reacting to it.' },
    { title: 'Set your lineup without leaving Rostiro', body: 'Yahoo leagues sync both ways. Set lineups, claim waivers, and propose trades right from Rostiro.' },
    { title: 'See your risk before it becomes a problem', body: 'Rostiro flags when you are overexposed to one player across your leagues, before a single injury wrecks your week.' },
  ]

  return (
    <section className="px-4 md:px-6 py-16 md:py-20">
      <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
        {features.map((f) => (
          <div key={f.title}>
            <h3 className="text-base font-bold leading-snug" style={{ color: 'var(--t1)' }}>{f.title}</h3>
            <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--t3)' }}>{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Draft Kit ─────────────────────────────────────────────────────────────────

function DraftKitSection() {
  return (
    <section className="px-4 md:px-6 py-16 md:py-24" style={{ backgroundColor: 'var(--glass-solid)' }}>
      <div className="glass-heavy max-w-4xl mx-auto rounded-2xl p-8 md:p-12 text-center">
        <span className="mono-data text-[11px] tracking-[0.16em] uppercase" style={{ color: 'var(--signal)' }}>
          Rostiro Draft Kit
        </span>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight mt-3" style={{ color: 'var(--t1)' }}>
          Draft smarter, before you even sign up.
        </h2>
        <p className="text-base mt-4 max-w-xl mx-auto leading-relaxed" style={{ color: 'var(--t2)' }}>
          Real ADP, sorted into tiers, filterable by position. No account, no email, no catch.
          Open it on draft night and know exactly who is a value at your pick.
        </p>
        <Link
          href="/draft"
          className="inline-block text-sm font-semibold px-6 py-3 rounded-xl text-white transition-all hover:brightness-110 mt-7"
          style={{ backgroundColor: 'var(--cta)' }}
        >
          Open Draft Kit, free
        </Link>
      </div>
    </section>
  )
}

// ─── Pricing ───────────────────────────────────────────────────────────────────
// T-112: corrected to the confirmed model (PRD §9): Free / Rostiro Pro /
// Founder Season Pass / Founding 500. The prior copy here (Scout/Starter/
// Pro/Commissioner) matched neither the shipped plan enum nor this model.

function PricingSection() {
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

// ─── Final CTA ─────────────────────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section className="px-4 md:px-6 py-16 md:py-24 text-center">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl md:text-4xl font-bold tracking-tight" style={{ color: 'var(--t1)' }}>
          Your next league mistake is preventable.
        </h2>
        <p className="text-base mt-4" style={{ color: 'var(--t2)' }}>
          Connect a league in under a minute, or try Draft Kit free, no account needed.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
          <Link
            href="/signup"
            className="text-sm font-semibold px-6 py-3 rounded-xl text-white transition-all hover:brightness-110"
            style={{ backgroundColor: 'var(--cta)' }}
          >
            Get started free
          </Link>
          <Link
            href="/draft"
            className="glass text-sm font-semibold px-6 py-3 rounded-xl transition-all hover:border-[var(--hairline-bright)]"
            style={{ color: 'var(--t1)' }}
          >
            Try Draft Kit
          </Link>
        </div>
      </div>
    </section>
  )
}
