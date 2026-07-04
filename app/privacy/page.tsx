// T-78: public privacy policy. Required before Yahoo OAuth review will pass
// (they check for a real, reachable privacy policy during app approval) and
// before real payments start under T-85.
//
// This is a founder-written draft, not legal counsel's — flagged inline
// below and in the PRD. It accurately describes what the product actually
// does today (checked against the schema and lib/claude.ts, not assumed),
// but a lawyer should review it before it's relied on for compliance.

import PublicHeader from '@/components/marketing/PublicHeader'
import PublicFooter from '@/components/marketing/PublicFooter'

export const metadata = {
  title: 'Privacy Policy — Rostiro',
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

export default function PrivacyPage() {
  return (
    <div style={{ backgroundColor: 'var(--void)', position: 'relative' }}>
      <div className="ambient-ground" aria-hidden="true" />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <PublicHeader />

        <main className="px-4 md:px-6 py-14 md:py-20">
          <div className="max-w-2xl mx-auto">
            <span className="mono-data text-[11px] tracking-[0.16em] uppercase" style={{ color: 'var(--t3)' }}>
              Legal
            </span>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-2" style={{ color: 'var(--t1)' }}>
              Privacy Policy
            </h1>
            <p className="mono-data text-xs mt-2" style={{ color: 'var(--t4)' }}>
              Last updated July 4, 2026
            </p>

            <div
              className="glass rounded-xl p-4 mt-6 text-xs leading-relaxed"
              style={{ color: 'var(--warn)', border: '1px solid rgba(245,166,35,.3)' }}
            >
              This policy describes what Rostiro actually collects and does with your data today,
              written directly by the Rostiro team. It has not yet been reviewed by a lawyer — treat
              it as an accurate draft, not a substitute for legal advice, until that review happens.
            </div>

            <Section title="What we collect">
              <p>
                <strong style={{ color: 'var(--t1)' }}>Account information:</strong> your email address and
                password (handled by our authentication provider; we never see or store your raw password).
              </p>
              <p>
                <strong style={{ color: 'var(--t1)' }}>League and roster data:</strong> when you connect a
                league, we pull rosters, scoring settings, matchups, and transaction data from ESPN, Yahoo,
                or Sleeper&apos;s own APIs. For Yahoo and ESPN, connecting requires an access token or session
                credential, which we store encrypted and use only to keep pulling your league&apos;s data on
                your behalf.
              </p>
              <p>
                <strong style={{ color: 'var(--t1)' }}>Usage data:</strong> which features you use, how often,
                and the AI-generated recommendations we&apos;ve produced for you — this is what powers your
                Pulse history and lets support diagnose an issue with your account.
              </p>
              <p>
                <strong style={{ color: 'var(--t1)' }}>Payment information:</strong> handled directly by our
                payment processor (Stripe) once billing is live — we store a reference to your subscription,
                never your card number.
              </p>
            </Section>

            <Section title="How we use it">
              <p>
                We use your league and roster data to compute the things Rostiro is actually for: a Health
                Score per league, start/sit and trade recommendations, waiver priority, and the daily Pulse
                list. All of that scoring happens in our own deterministic code — the same inputs always
                produce the same verdict.
              </p>
              <p>
                <strong style={{ color: 'var(--t1)' }}>AI processing disclosure:</strong> Rostiro uses
                Anthropic&apos;s Claude API to turn an already-computed verdict into a short, plain-English
                explanation of why — Claude never decides your lineup, waiver claim, or trade grade, it only
                narrates a decision our own code already made. The relevant roster and matchup context for
                that explanation is sent to Anthropic&apos;s API to generate it, governed by Anthropic&apos;s
                own API terms. We do not use your data to train our own models.
              </p>
            </Section>

            <Section title="Who we share it with">
              <p>
                We don&apos;t sell your data. We share it only with the services that make Rostiro work:
                ESPN, Yahoo, and Sleeper (to read the league data you&apos;ve connected), Anthropic (to
                generate AI explanations, above), Stripe (to process payments), and OneSignal (to deliver
                push notifications, only if you&apos;ve turned them on). Each of those services has its own
                privacy policy governing what it does with data it receives.
              </p>
            </Section>

            <Section title="Your controls">
              <p>
                <strong style={{ color: 'var(--t1)' }}>Export:</strong> download everything Rostiro has on
                your account, any time, from Settings → Data &amp; privacy.
              </p>
              <p>
                <strong style={{ color: 'var(--t1)' }}>Deletion:</strong> permanently delete your account and
                every row tied to it — connected leagues, Pulse history, AI query logs, notification
                subscriptions — from the same Settings page. This is irreversible and takes effect
                immediately.
              </p>
              <p>
                <strong style={{ color: 'var(--t1)' }}>Disconnect a league:</strong> remove a single
                connected league at any time from Settings without deleting your whole account.
              </p>
            </Section>

            <Section title="Data retention">
              <p>
                We keep your data for as long as your account is active, so Rostiro can keep computing
                Health Scores and Pulse history against it. If you delete your account, everything tied to
                it is removed immediately — there is no retention period afterward.
              </p>
            </Section>

            <Section title="Cookies">
              <p>
                We use one first-party session cookie, set by our authentication provider, to keep you
                signed in. We don&apos;t use third-party advertising or tracking cookies.
              </p>
            </Section>

            <Section title="Children's privacy">
              <p>
                Rostiro is not directed at, and we do not knowingly collect information from, anyone under
                13 years old.
              </p>
            </Section>

            <Section title="Changes to this policy">
              <p>
                If this policy changes in a way that matters to how your data is handled, we&apos;ll post the
                update here with a new &ldquo;last updated&rdquo; date.
              </p>
            </Section>

            <Section title="Contact">
              <p>
                Questions about this policy or your data — reach us at{' '}
                <span className="mono-data" style={{ color: 'var(--t1)' }}>privacy@rostiro.com</span>.
              </p>
            </Section>
          </div>
        </main>

        <PublicFooter />
      </div>
    </div>
  )
}
