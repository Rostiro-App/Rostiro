// T-74: Features page. The OS story, told with the real design tokens and
// real embedded components (the actual TickerBar, a genuinely interactive
// Pulse mode demo) rather than static screenshots, per the PRD's standing
// "no screenshots" note on this task. Three pillars, each pitched twice:
// once for the Savant (density, control, cross-league efficiency) and once
// for the Newbie/Casual manager (safety net, no homework, survive the group
// chat), since PRD §3's two personas need to see themselves in the same
// page, not two different landing pages.

import Link from 'next/link'
import PublicHeader from '@/components/marketing/PublicHeader'
import PublicFooter from '@/components/marketing/PublicFooter'
import TickerBar from '@/components/nav/TickerBar'
import ProductVideoDemo from '@/components/marketing/ProductVideoDemo'
import InteractivePulseDemo from '@/components/marketing/InteractivePulseDemo'
import DataJoinDiagram from '@/components/marketing/DataJoinDiagram'
import { STATE_CONFIG } from '@/lib/brandTokens'

export const metadata = {
  title: 'Features · Rostiro',
  description: 'The operating system for fantasy sports: one Pulse across every league, a weekly cycle that reshapes itself, and Game Day Mission Control.',
}

export default function FeaturesPage() {
  return (
    <div style={{ backgroundColor: 'var(--void)', position: 'relative' }}>
      <div className="ambient-ground" aria-hidden="true" />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <PublicHeader />

        <FeaturesHero />
        <PillarOne />
        <PillarTwo />
        <PillarThree />
        <DataEngineeringSection />
        <ClosingCTA />

        {/* Real ticker, not a mockup. Its own data fetch (/api/adp/movers)
            is public, same posture as Draft Kit. Game Day/state theming
            just stays quiet for a logged-out visitor, which is honest. */}
        <TickerBar />
        <PublicFooter />
      </div>
    </div>
  )
}

// ─── Hero ──────────────────────────────────────────────────────────────────────

function FeaturesHero() {
  return (
    <section className="px-4 md:px-6 pt-14 pb-10 md:pt-20 md:pb-14 text-center">
      <span
        className="mono-data inline-block text-[11px] tracking-[0.16em] uppercase px-3 py-1 rounded-full mb-5"
        style={{ backgroundColor: 'var(--signal-dim)', color: 'var(--signal)' }}
      >
        How Rostiro actually works
      </span>
      <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-[1.15] max-w-3xl mx-auto" style={{ color: 'var(--t1)' }}>
        One system. Every league. It looks different depending on what day it is,
        on purpose.
      </h1>
      <p className="text-base md:text-lg mt-5 max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--t2)' }}>
        Whether you&apos;re running five leagues on a spreadsheet or you just want someone to
        tell you who to start, Rostiro is built to meet you exactly there.
      </p>
    </section>
  )
}

// ─── Pillar 1: The Unified Cross-League Command Center ─────────────────────────

function PillarOne() {
  return (
    <section className="px-4 md:px-6 py-16 md:py-24" style={{ backgroundColor: 'var(--glass-solid)' }}>
      <div className="max-w-5xl mx-auto">
        <PillarHeader
          eyebrow="Pillar 1"
          title="The Pulse: your cross-league command center"
          subtitle="One ranked list, computed from every league you play, on every platform you use."
        />

        <div className="grid md:grid-cols-2 gap-5 mt-10">
          <PitchCard
            audience="For the Savant"
            body="Sleeper, ESPN, and Yahoo aggregated into one decision engine. Cross-league exposure, waiver priority, and trade grades computed together, not three tabs you reconcile in your head. Zero app-switching fatigue."
          />
          <PitchCard
            audience="For the casual manager"
            body="A 2-minute morning checklist. Rostiro tells you exactly who to start, what to claim, and why, in plain English, not a spreadsheet. No homework, no research rabbit hole before kickoff."
          />
        </div>

        <div className="mt-12">
          <InteractivePulseDemo />
          <p className="text-center text-xs mt-4 mono-data tracking-wide" style={{ color: 'var(--t4)' }}>
            Same decision, three densities. Tap a mode above
          </p>
        </div>

        {/* Founder B-roll clip: connect a second and third league (Sleeper to
            Yahoo to ESPN) back to back, then land on Pulse showing one
            unified list that names all three leagues in the same card. */}
        <div className="mt-14 max-w-2xl mx-auto">
          <ProductVideoDemo
            caption="Three leagues, one morning list. Connecting a league to Pulse in under a minute"
            recordingNote="Founder B-roll clip: connect a second and third league (Sleeper to Yahoo to ESPN) back to back, then land on Pulse showing one unified list that names all three leagues in the same card."
          />
        </div>
      </div>
    </section>
  )
}

// ─── Pillar 2: The Adaptive Weekly Cycle (Rostiro States) ───────────────────────

function PillarTwo() {
  const states: { key: keyof typeof STATE_CONFIG; label: string; when: string; savant: string; newbie: string }[] = [
    {
      key: 'draft',
      label: 'Draft',
      when: 'Preseason',
      savant: 'Live pick tracking, tiered ADP, format-aware strategy weighting.',
      newbie: 'Tells you who to pick, and why, before the clock runs out.',
    },
    {
      key: 'standard',
      label: 'Standard',
      when: 'Wed–Sat',
      savant: 'Calm monitoring: one ranked list, nothing manufactured to feel urgent.',
      newbie: 'Nothing to do most days. Rostiro only speaks up when something matters.',
    },
    {
      key: 'waiver_day',
      label: 'Waiver Day',
      when: 'Tue night / Wed',
      savant: 'Priority targets ranked by real FAAB math and roster-health delta.',
      newbie: 'The one player worth your bid this week, explained in one line.',
    },
    {
      key: 'game_day',
      label: 'Game Day',
      when: 'Thu / Sun / Mon',
      savant: 'Live scores that name your rostered players, not just team totals.',
      newbie: 'Watch your team win without refreshing four different apps.',
    },
    {
      key: 'film_room',
      label: 'Film Room',
      when: 'Mon night / Tue AM',
      savant: 'Usage deltas and a buy-low/sell-high signal from real snap-count data.',
      newbie: 'A quick, honest recap. Win or lose, never a pile-on.',
    },
  ]

  return (
    <section className="px-4 md:px-6 py-16 md:py-24">
      <div className="max-w-5xl mx-auto">
        <PillarHeader
          eyebrow="Pillar 2"
          title="The Adaptive Weekly Cycle"
          subtitle="Rostiro reshapes the entire cockpit around the rhythm of the NFL week: five states, driven by the calendar, never a setting you manage."
        />

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-10">
          {states.map((s) => {
            const color = STATE_CONFIG[s.key].color
            return (
              <div key={s.key} className="glass rounded-xl p-5 flex flex-col" style={{ borderTop: `2.5px solid ${color}` }}>
                <span className="mono-data text-[10px] font-bold tracking-[0.12em]" style={{ color }}>
                  {s.label.toUpperCase()}
                </span>
                <span className="mono-data text-[10px] mt-1" style={{ color: 'var(--t4)' }}>{s.when}</span>
                <p className="text-[12.5px] mt-3 leading-relaxed" style={{ color: 'var(--t2)' }}>{s.savant}</p>
                <p className="text-[12.5px] mt-2 leading-relaxed" style={{ color: 'var(--t3)' }}>{s.newbie}</p>
              </div>
            )
          })}
        </div>

        {/* Founder B-roll clip: a single Sunday timelapse (sped up) showing
            the System Bar accent and Pulse header visibly sweep from
            Standard's blue to Game Day's cockpit red at the first kickoff. */}
        <div className="mt-14 max-w-2xl mx-auto">
          <ProductVideoDemo
            caption="The kickoff transition. Watch the whole OS shift the moment your first game goes live"
            recordingNote="Founder B-roll clip: a single Sunday timelapse (sped up) showing the System Bar accent and Pulse header visibly sweep from Standard's blue to Game Day's cockpit red at the first kickoff."
          />
        </div>
      </div>
    </section>
  )
}

// ─── Pillar 3: Game Day Mission Control & the Interrupt Stack ───────────────────

function PillarThree() {
  const traditional = [
    'Four browser tabs, one per league, none of them talking to each other.',
    'A score update buried under a dozen other unrelated notifications.',
    'You still don’t know if the play that just happened touched your roster.',
  ]
  const rostiro = [
    'One screen. Every live game that touches one of your rosters, named.',
    'A touchdown flashes once, tells you who scored and what it’s worth, then clears itself.',
    'Nothing interrupts you unless it changes your matchup, your opponent’s, or the waiver wire.',
  ]

  return (
    <section className="px-4 md:px-6 py-16 md:py-24" style={{ backgroundColor: 'var(--glass-solid)' }}>
      <div className="max-w-5xl mx-auto">
        <PillarHeader
          eyebrow="Pillar 3"
          title="Game Day Mission Control"
          subtitle="A genuinely new pattern for watching fantasy football live: peripheral situational awareness, not a wall of tabs."
        />

        <div className="grid md:grid-cols-2 gap-5 mt-10">
          <div className="rounded-xl p-6" style={{ border: '1px solid var(--hairline)' }}>
            <span className="mono-data text-[10.5px] font-bold tracking-[0.12em] uppercase" style={{ color: 'var(--t4)' }}>
              The old way
            </span>
            <ul className="mt-4 space-y-3">
              {traditional.map((t) => (
                <li key={t} className="text-sm flex items-start gap-2.5" style={{ color: 'var(--t3)' }}>
                  <span style={{ color: 'var(--t4)' }}>✕</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl p-6" style={{ border: '1px solid var(--signal)', backgroundColor: 'var(--signal-dim)' }}>
            <span className="mono-data text-[10.5px] font-bold tracking-[0.12em] uppercase" style={{ color: 'var(--signal)' }}>
              Mission Control
            </span>
            <ul className="mt-4 space-y-3">
              {rostiro.map((r) => (
                <li key={r} className="text-sm flex items-start gap-2.5" style={{ color: 'var(--t1)' }}>
                  <span style={{ color: 'var(--live)' }}>✓</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5 mt-5">
          <PitchCard
            audience="For the Savant"
            body="Every live game that touches a rostered player, aggregated by team, with per-player point deltas and projections against your league's real scoring settings, not a generic average."
          />
          <PitchCard
            audience="For the casual manager"
            body="You'll know the moment your team scores, without staring at the screen for three hours. One card flashes, tells you what happened, and gets out of your way."
          />
        </div>

        <div className="rounded-xl p-6 mt-8" style={{ border: '1px solid var(--hairline)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--t1)' }}>The Interrupt Stack</p>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--t2)' }}>
            One persistent slot, not a notification pile. A touchdown or a lineup-lock panic takes the slot,
            names exactly what happened, and clears itself: auto-dismissing for a scoring play, staying put
            only when something genuinely needs a decision from you (a starter just got flagged doubtful
            twelve minutes before kickoff). A second event queues behind the first instead of stacking on
            top of it, no matter how many leagues are live at once.
          </p>
        </div>

        {/* Founder B-roll clip: a real Sunday afternoon. Trigger a
            touchdown_swing scenario via the dev Simulation Panel, capture
            the Interrupt Stack card appearing, flashing the point delta,
            then auto-dismissing on its own a few seconds later. */}
        <div className="mt-10 max-w-2xl mx-auto">
          <ProductVideoDemo
            caption="The Interrupt Stack in action. A touchdown lands, gets named, and clears itself"
            recordingNote="Founder B-roll clip: a real Sunday afternoon. Trigger a touchdown_swing scenario via the dev Simulation Panel, capture the Interrupt Stack card appearing, flashing the point delta, then auto-dismissing on its own a few seconds later."
          />
        </div>
      </div>
    </section>
  )
}

// ─── Data engineering: the "how it's built" section for the Savant reader ──────

function DataEngineeringSection() {
  return (
    <section className="px-4 md:px-6 py-16 md:py-20">
      <div className="max-w-4xl mx-auto text-center">
        <span className="mono-data text-[11px] tracking-[0.16em] uppercase" style={{ color: 'var(--t4)' }}>
          Under the hood
        </span>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight mt-3" style={{ color: 'var(--t1)' }}>
          Usage data doesn&apos;t arrive pre-matched. We built the join ourselves.
        </h2>
        <p className="text-sm md:text-base mt-4 max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--t2)' }}>
          nflverse&apos;s snap-count data only carries a Pro-Football-Reference ID, not a Sleeper one.
          Getting real usage trends onto your roster takes a real crosswalk, resolved once per sync and
          cached, not guessed at.
        </p>
        <div className="glass rounded-2xl p-6 md:p-10 mt-10">
          <DataJoinDiagram />
        </div>
      </div>
    </section>
  )
}

// ─── Closing CTA ─────────────────────────────────────────────────────────────────

function ClosingCTA() {
  return (
    <section className="px-4 md:px-6 py-16 md:py-24 text-center">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl md:text-4xl font-bold tracking-tight" style={{ color: 'var(--t1)' }}>
          See it work on your own leagues.
        </h2>
        <p className="text-base mt-4" style={{ color: 'var(--t2)' }}>
          Free plan, forever. Connect a league in under a minute.
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
            href="/faq"
            className="glass text-sm font-semibold px-6 py-3 rounded-xl transition-all hover:border-[var(--hairline-bright)]"
            style={{ color: 'var(--t1)' }}
          >
            Read the FAQ
          </Link>
        </div>
      </div>
    </section>
  )
}

// ─── Shared bits ─────────────────────────────────────────────────────────────────

function PillarHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div className="text-center max-w-2xl mx-auto">
      <span className="mono-data text-[11px] tracking-[0.16em] uppercase" style={{ color: 'var(--signal)' }}>
        {eyebrow}
      </span>
      <h2 className="text-2xl md:text-3xl font-bold tracking-tight mt-3" style={{ color: 'var(--t1)' }}>
        {title}
      </h2>
      <p className="text-base mt-4 leading-relaxed" style={{ color: 'var(--t3)' }}>{subtitle}</p>
    </div>
  )
}

function PitchCard({ audience, body }: { audience: string; body: string }) {
  return (
    <div className="glass rounded-xl p-6">
      <span
        className="mono-data text-[10px] font-bold tracking-[0.12em] uppercase px-2 py-0.5 rounded"
        style={{ backgroundColor: 'var(--signal-dim)', color: 'var(--signal)' }}
      >
        {audience}
      </span>
      <p className="text-sm mt-3 leading-relaxed" style={{ color: 'var(--t2)' }}>{body}</p>
    </div>
  )
}
