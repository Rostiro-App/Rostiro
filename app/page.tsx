// T-66: Marketing landing page. Public, no auth. Every section earns its
// place by selling an outcome, not a feature list, per the PRD's core
// philosophy: "Never market AI. Market the outcome."

import Link from 'next/link'
import PublicHeader from '@/components/marketing/PublicHeader'
import PublicFooter from '@/components/marketing/PublicFooter'

export default function Home() {
  return (
    <div style={{ backgroundColor: '#0D1B2A' }}>
      <PublicHeader />
      <Hero />
      <ProblemSection />
      <PulseSection />
      <ModeSection />
      <PlatformSection />
      <FeatureStrip />
      <DraftKitSection />
      <PricingSection />
      <FinalCTA />
      <PublicFooter />
    </div>
  )
}

// ─── Hero ──────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="px-4 md:px-6 pt-16 pb-20 md:pt-24 md:pb-28">
      <div className="max-w-3xl mx-auto text-center">
        <span
          className="inline-block text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full mb-6"
          style={{ backgroundColor: '#378ADD18', color: '#378ADD' }}
        >
          The operating system for fantasy sports
        </span>
        <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight leading-[1.1]">
          Run Every League.
        </h1>
        <p className="text-lg md:text-xl mt-6 leading-relaxed" style={{ color: '#8AAABB' }}>
          You didn&apos;t lose because you made a bad call. You lost because the alert was in
          a different app. Rostiro watches every league you play, on every platform you use,
          and tells you the one thing to do before it costs you.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-9">
          <Link
            href="/signup"
            className="text-sm font-semibold px-6 py-3 rounded-xl text-white transition-all hover:brightness-110"
            style={{ backgroundColor: '#378ADD' }}
          >
            Get started free
          </Link>
          <Link
            href="/draft"
            className="text-sm font-semibold px-6 py-3 rounded-xl transition-all"
            style={{ backgroundColor: '#1A3048', color: 'white' }}
          >
            Try Draft Kit, no signup
          </Link>
        </div>
        <p className="text-xs mt-4" style={{ color: '#3A5A7A' }}>
          Free plan forever. No credit card required.
        </p>
      </div>

      <PulsePreviewCard />
    </section>
  )
}

// Recreation of the PRD's "north star" morning screen, as a static visual proof point.
function PulsePreviewCard() {
  const items = [
    { tag: 'CRITICAL', color: '#E84040', text: 'Bench Stefon Diggs in 2 leagues. 31 mph winds in Buffalo at kickoff.' },
    { tag: 'IMPORTANT', color: '#F59E0B', text: 'Claim Jaylen Warren in League 2. Waiver cutoff is 3:00 PM today.' },
    { tag: 'REVIEW', color: '#378ADD', text: 'Trade pending: your Kupp for their Ekeler. Lean accept, it fixes your RB2 gap.' },
    { tag: 'WATCH', color: '#8AAABB', text: 'Joe Mixon is questionable. Pivot option ready: Zach Moss.' },
  ]

  return (
    <div
      className="max-w-2xl mx-auto mt-14 rounded-2xl overflow-hidden"
      style={{ backgroundColor: '#0A1520', border: '1px solid #1A3048', boxShadow: '0 20px 60px -20px #00000080' }}
    >
      <div className="px-5 py-4" style={{ borderBottom: '1px solid #1A3048' }}>
        <p className="text-sm font-semibold text-white">Good morning. 5 decisions across 3 leagues.</p>
        <p className="text-xs mt-0.5" style={{ color: '#3A5A7A' }}>Estimated time to clear: 2 minutes.</p>
      </div>
      <div>
        {items.map((item) => (
          <div
            key={item.tag}
            className="flex items-start gap-3 px-5 py-3.5 text-left"
            style={{ borderTop: '1px solid #1A3048', borderLeft: `3px solid ${item.color}` }}
          >
            <span
              className="text-[10px] font-bold tracking-widest flex-shrink-0 mt-0.5"
              style={{ color: item.color }}
            >
              {item.tag}
            </span>
            <p className="text-sm" style={{ color: '#C5D6E3' }}>{item.text}</p>
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
    <section className="px-4 md:px-6 py-16 md:py-20" style={{ backgroundColor: '#0A1520' }}>
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
          You&apos;re not bad at fantasy. You&apos;re just checking the wrong app.
        </h2>
        <div className="grid md:grid-cols-3 gap-4 mt-10 text-left">
          {scenarios.map((s) => (
            <div key={s} className="rounded-xl p-5" style={{ backgroundColor: '#07111C', border: '1px solid #1A3048' }}>
              <p className="text-sm leading-relaxed" style={{ color: '#8AAABB' }}>{s}</p>
            </div>
          ))}
        </div>
        <p className="text-base mt-8 font-medium" style={{ color: '#378ADD' }}>
          Rostiro watches all of it, so you don&apos;t have to remember to.
        </p>
      </div>
    </section>
  )
}

// ─── Pulse product section ──────────────────────────────────────────────────────

function PulseSection() {
  return (
    <section className="px-4 md:px-6 py-16 md:py-24">
      <div className="max-w-3xl mx-auto text-center">
        <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#378ADD' }}>
          Rostiro Pulse
        </span>
        <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight mt-3">
          One list. Every league. What actually matters today.
        </h2>
        <p className="text-base md:text-lg mt-5 leading-relaxed" style={{ color: '#8AAABB' }}>
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
    { icon: '⚡', name: 'Focused', tagline: 'Tell me what to do.', body: 'Five decisions, max. The verdict first, reasoning if you want it. Built for the 90-second check between meetings.' },
    { icon: '⚖️', name: 'Balanced', tagline: 'Show me the key stuff.', body: 'The call, plus the context that made it: matchup, injury, weather. Tap anything to go deeper.' },
    { icon: '🧠', name: 'Savant', tagline: 'Give me everything.', body: 'The full data layer. Target share, usage trends, Vegas lines. Rostiro advises, you decide.' },
  ]

  return (
    <section className="px-4 md:px-6 py-16 md:py-20" style={{ backgroundColor: '#0A1520' }}>
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Built around how you actually play.
          </h2>
          <p className="text-base mt-3" style={{ color: '#5A7A9A' }}>
            Pick a mode once. It reshapes the entire product around you, not the other way around.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {modes.map((m) => (
            <div key={m.name} className="rounded-xl p-6" style={{ backgroundColor: '#07111C', border: '1px solid #1A3048' }}>
              <span className="text-2xl">{m.icon}</span>
              <h3 className="text-lg font-bold text-white mt-3">{m.name}</h3>
              <p className="text-sm font-medium mt-0.5" style={{ color: '#378ADD' }}>&ldquo;{m.tagline}&rdquo;</p>
              <p className="text-sm mt-3 leading-relaxed" style={{ color: '#5A7A9A' }}>{m.body}</p>
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
    <section className="px-4 md:px-6 py-14 md:py-16">
      <div className="max-w-3xl mx-auto text-center">
        <p className="text-sm font-semibold tracking-widest uppercase" style={{ color: '#3A5A7A' }}>
          Works with the leagues you&apos;re already in
        </p>
        <div className="flex items-center justify-center gap-8 md:gap-12 mt-6">
          {platforms.map((p) => (
            <span key={p} className="text-xl md:text-2xl font-bold" style={{ color: '#3A5A7A' }}>
              {p}
            </span>
          ))}
        </div>
        <p className="text-sm mt-6" style={{ color: '#5A7A9A' }}>
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
    <section className="px-4 md:px-6 py-16 md:py-20" style={{ backgroundColor: '#0A1520' }}>
      <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-8">
        {features.map((f) => (
          <div key={f.title}>
            <h3 className="text-base font-bold text-white leading-snug">{f.title}</h3>
            <p className="text-sm mt-2 leading-relaxed" style={{ color: '#5A7A9A' }}>{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Draft Kit ─────────────────────────────────────────────────────────────────

function DraftKitSection() {
  return (
    <section className="px-4 md:px-6 py-16 md:py-24">
      <div
        className="max-w-4xl mx-auto rounded-2xl p-8 md:p-12 text-center"
        style={{ backgroundColor: '#07111C', border: '1px solid #1A3048' }}
      >
        <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#378ADD' }}>
          Rostiro Draft Kit
        </span>
        <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight mt-3">
          Draft smarter, before you even sign up.
        </h2>
        <p className="text-base mt-4 max-w-xl mx-auto leading-relaxed" style={{ color: '#8AAABB' }}>
          Real ADP, sorted into tiers, filterable by position. No account, no email, no catch.
          Open it on draft night and know exactly who is a value at your pick.
        </p>
        <Link
          href="/draft"
          className="inline-block text-sm font-semibold px-6 py-3 rounded-xl text-white transition-all hover:brightness-110 mt-7"
          style={{ backgroundColor: '#378ADD' }}
        >
          Open Draft Kit, free
        </Link>
      </div>
    </section>
  )
}

// ─── Pricing ───────────────────────────────────────────────────────────────────

function PricingSection() {
  const plans = [
    { name: 'Scout', price: '$0', period: '', includes: ['1 league', 'Draft Kit', 'Basic Pulse', '3 start/sit calls a week', '3 trade checks a week'], cta: 'Start free', highlight: false },
    { name: 'Starter', price: '$8', period: '/mo', includes: ['3 leagues', 'Full Pulse, every morning', 'Unlimited AI calls', 'Push notifications', 'Yahoo lineup + waiver sync'], cta: 'Get started', highlight: true },
    { name: 'Pro', price: '$15', period: '/mo', includes: ['10 leagues', 'Cross-league intelligence', 'Proactive trade alerts', 'What-if roster sims'], cta: 'Get started', highlight: false },
    { name: 'Commissioner', price: '$19', period: '/mo', includes: ['Unlimited leagues', 'Co-manager seats', 'Custom digest'], cta: 'Get started', highlight: false },
  ]

  return (
    <section className="px-4 md:px-6 py-16 md:py-20" style={{ backgroundColor: '#0A1520' }}>
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Start free. Upgrade when it&apos;s already paying for itself.
          </h2>
          <p className="text-sm mt-3" style={{ color: '#5A7A9A' }}>
            Every plan starts with a 7-day trial of the tier above it.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className="rounded-xl p-6 flex flex-col"
              style={{
                backgroundColor: '#07111C',
                border: plan.highlight ? '1px solid #378ADD' : '1px solid #1A3048',
              }}
            >
              {plan.highlight && (
                <span
                  className="text-[10px] font-bold tracking-widest uppercase mb-3 self-start px-2 py-0.5 rounded"
                  style={{ backgroundColor: '#378ADD', color: 'white' }}
                >
                  Most popular
                </span>
              )}
              <h3 className="text-base font-bold text-white">{plan.name}</h3>
              <p className="mt-1">
                <span className="text-2xl font-bold text-white">{plan.price}</span>
                <span className="text-sm" style={{ color: '#3A5A7A' }}>{plan.period}</span>
              </p>
              <ul className="mt-4 space-y-2 flex-1">
                {plan.includes.map((item) => (
                  <li key={item} className="text-sm flex items-start gap-2" style={{ color: '#8AAABB' }}>
                    <span style={{ color: '#378ADD' }}>&#10003;</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="text-sm font-semibold px-4 py-2.5 rounded-lg text-center transition-all mt-6 hover:brightness-110"
                style={{
                  backgroundColor: plan.highlight ? '#378ADD' : '#1A3048',
                  color: 'white',
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
        <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight">
          Your next league mistake is preventable.
        </h2>
        <p className="text-base mt-4" style={{ color: '#8AAABB' }}>
          Connect a league in under a minute, or try Draft Kit free, no account needed.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
          <Link
            href="/signup"
            className="text-sm font-semibold px-6 py-3 rounded-xl text-white transition-all hover:brightness-110"
            style={{ backgroundColor: '#378ADD' }}
          >
            Get started free
          </Link>
          <Link
            href="/draft"
            className="text-sm font-semibold px-6 py-3 rounded-xl transition-all"
            style={{ backgroundColor: '#1A3048', color: 'white' }}
          >
            Try Draft Kit
          </Link>
        </div>
      </div>
    </section>
  )
}
