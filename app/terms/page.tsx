// Founder-written Terms of Service baseline — same posture as /privacy:
// accurate to what the product actually does today, not legal counsel's
// work product. Flagged inline and here. The core liability concern this
// draft is built to address (founder, July 2026): a fantasy manager losing
// their league and blaming Rostiro's recommendation for it. Sections 6-7
// and 11-14 are where that risk actually gets addressed — "no guaranteed
// outcome," "AI-generated, not human-reviewed," "as-is," a real liability
// cap, and an arbitration/class-action-waiver clause, all standard in the
// fantasy-advice and SaaS category, not novel. This still needs a real
// lawyer before it's relied on — the banner below says so, and means it.

import PublicHeader from '@/components/marketing/PublicHeader'
import PublicFooter from '@/components/marketing/PublicFooter'

export const metadata = {
  title: 'Terms of Service — Rostiro',
}

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section className="py-6" style={{ borderTop: '1px solid var(--hairline)' }}>
      <h2 className="text-lg font-bold" style={{ color: 'var(--t1)' }}>
        <span className="mono-data" style={{ color: 'var(--t4)' }}>{number}</span> {title}
      </h2>
      <div className="text-sm mt-3 space-y-3 leading-relaxed" style={{ color: 'var(--t2)' }}>
        {children}
      </div>
    </section>
  )
}

export default function TermsPage() {
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
              Terms of Service
            </h1>
            <p className="mono-data text-xs mt-2" style={{ color: 'var(--t4)' }}>
              Founder-written baseline, pending legal counsel review
            </p>

            <div
              className="glass rounded-xl p-4 mt-6 text-xs leading-relaxed"
              style={{ color: 'var(--warn)', border: '1px solid rgba(245,166,35,.3)' }}
            >
              This is a founder-written baseline describing the terms we intend to operate under, written
              directly by the Rostiro team. It has not yet been reviewed by a lawyer — treat it as an honest
              draft of our intent, not a substitute for legal advice, until that review happens and this
              banner is removed.
            </div>

            <Section number="1." title="Acceptance of these Terms">
              <p>
                By creating a Rostiro account or using rostiro.com in any way, you agree to these Terms of
                Service and to our{' '}
                <a href="/privacy" className="underline" style={{ color: 'var(--signal)' }}>Privacy Policy</a>.
                If you don&apos;t agree, don&apos;t use Rostiro.
              </p>
            </Section>

            <Section number="2." title="What Rostiro is — and isn't">
              <p>
                Rostiro is an analytical companion for fantasy football managers who already play on ESPN,
                Yahoo, and/or Sleeper. Rostiro reads your connected league data and gives you decision
                support — a daily prioritized list, start/sit and trade reasoning, waiver targets, and live
                score tracking — to make managing multiple leagues faster and less error-prone.
              </p>
              <p>
                Rostiro is <strong style={{ color: 'var(--t1)' }}>not</strong> a fantasy platform, a league
                host, a scoring engine, a stat provider, or a sportsbook. It does not run your league, settle
                your matchups, or hold or move any money on your behalf. It does not replace ESPN, Yahoo, or
                Sleeper — it enhances the experience you already have on top of them. Rostiro is not
                affiliated with, sponsored by, or endorsed by ESPN, Yahoo, or Sleeper; all trademarks belong
                to their respective owners.
              </p>
            </Section>

            <Section number="3." title="Eligibility">
              <p>
                You must be at least 13 years old to create a Rostiro account. If you&apos;re under the age
                of majority in your jurisdiction, you confirm you have a parent or guardian&apos;s permission
                to use Rostiro. One account per person; you&apos;re responsible for everything that happens
                under your account.
              </p>
            </Section>

            <Section number="4." title="Your account and security">
              <p>
                You&apos;re responsible for keeping your login credentials confidential and for all activity
                under your account. Tell us immediately at{' '}
                <span className="mono-data" style={{ color: 'var(--t1)' }}>support@rostiro.com</span> if you
                believe your account has been compromised.
              </p>
            </Section>

            <Section number="5." title="Connected platforms — read-only and OAuth boundaries">
              <p>
                Rostiro connects to your fantasy leagues in three different ways, and the access level
                matters:
              </p>
              <ul className="space-y-2 pl-1">
                <li>
                  <strong style={{ color: 'var(--t1)' }}>Sleeper</strong> — read-only, via Sleeper&apos;s
                  public API. Rostiro cannot make any change to a Sleeper league on your behalf.
                </li>
                <li>
                  <strong style={{ color: 'var(--t1)' }}>ESPN</strong> — read-only, via a browser cookie
                  handshake you provide (ESPN has no official public API). Rostiro cannot make any change to
                  an ESPN league on your behalf, and never has write access of any kind.
                </li>
                <li>
                  <strong style={{ color: 'var(--t1)' }}>Yahoo</strong> — read and write, via Yahoo&apos;s
                  official OAuth 2.0 authorization. This is the one platform where Rostiro can submit a
                  lineup, waiver claim, or trade proposal directly, and only ever when you explicitly tap to
                  do so. You can revoke this access at any time from your Yahoo account settings or from
                  Rostiro&apos;s own Settings page.
                </li>
              </ul>
              <p>
                You&apos;re responsible for complying with each connected platform&apos;s own terms of
                service. Rostiro is not responsible for any action a connected platform takes against your
                account — suspension, data changes, or access revocation — including as a result of that
                platform&apos;s own policies toward third-party tools.
              </p>
            </Section>

            <Section number="6." title="AI-generated content">
              <p>
                Rostiro uses Anthropic&apos;s Claude API to generate the plain-English reasoning behind a
                recommendation. The underlying verdict — the start/sit call, the waiver priority, the trade
                grade — is always computed first by Rostiro&apos;s own deterministic logic against your real
                league data; Claude only narrates a decision that logic already made, it never makes the
                decision itself.
              </p>
              <p>
                That said, AI-generated text can be incomplete, out of date, or simply wrong, and is not
                reviewed by a human before it reaches you. You&apos;re responsible for independently
                verifying anything that matters before you act on it — a player&apos;s injury status, a
                platform&apos;s own roster deadline, a league&apos;s specific rules. Rostiro is not liable for
                any inaccuracy in AI-generated reasoning text.
              </p>
            </Section>

            <Section number="7." title="No guaranteed outcomes — please read this section">
              <p>
                This is the most important section of these Terms, so we&apos;re not going to bury it in
                legal language.
              </p>
              <p>
                Fantasy football involves real, inherent uncertainty — injuries, weather, coaching decisions,
                and plain bad luck are outside anyone&apos;s control, including ours. Every recommendation
                Rostiro gives — a start/sit call, a waiver priority, a trade grade, a Health Score, a Draft
                Copilot suggestion — is an informational opinion generated from available statistics at the
                time it was given. It is <strong style={{ color: 'var(--t1)' }}>not</strong> a guarantee of
                any result.
              </p>
              <p>
                <strong style={{ color: 'var(--t1)' }}>
                  Rostiro does not guarantee that following its recommendations will win you a matchup, a
                  waiver claim, a trade, or your league. You are solely responsible for every roster decision
                  you make, whether or not it followed a Rostiro recommendation.
                </strong>{' '}
                Rostiro is not liable for any loss — a lost matchup, a missed payout, a league consequence,
                or any other outcome — arising from your reliance on its recommendations.
              </p>
              <p>
                Rostiro is a decision-support tool for skill-based fantasy contests. It is not financial
                advice, investment advice, or betting advice, does not facilitate wagering of any kind, and
                does not make picks against a betting line or point spread.
              </p>
            </Section>

            <Section number="8." title="Subscriptions and payments">
              <p>
                Rostiro Pro and the Founder tiers are paid subscriptions or one-time purchases billed through
                Stripe. By subscribing, you authorize Rostiro to charge your payment method on the stated
                schedule. Monthly subscriptions can be canceled anytime from Settings and remain active
                through the end of the current billing period; we don&apos;t offer partial-period refunds
                except where required by law. The Founder Season Pass and Founding 500 are one-time purchases
                tied to the 2026 season and are non-refundable once purchased, except where required by law.
              </p>
            </Section>

            <Section number="9." title="Acceptable use">
              <p>You agree not to:</p>
              <ul className="space-y-1.5 pl-1">
                <li>Use Rostiro to violate any connected platform&apos;s own terms of service</li>
                <li>Attempt to reverse-engineer, scrape, or overload Rostiro&apos;s systems</li>
                <li>Share your account, or use another person&apos;s account without permission</li>
                <li>Use Rostiro for any unlawful purpose, including facilitating gambling where prohibited</li>
              </ul>
            </Section>

            <Section number="10." title="Intellectual property">
              <p>
                Rostiro and its logo, product names, and design are our property. You retain ownership of
                your own league data; connecting a league gives us a license to read and process it solely to
                provide the service back to you.
              </p>
            </Section>

            <Section number="11." title="Disclaimer of warranties">
              <p>
                Rostiro is provided <strong style={{ color: 'var(--t1)' }}>&ldquo;as is&rdquo;</strong> and{' '}
                <strong style={{ color: 'var(--t1)' }}>&ldquo;as available,&rdquo;</strong> without warranties
                of any kind, express or implied, including merchantability, fitness for a particular purpose,
                and non-infringement. We don&apos;t warrant that Rostiro will be uninterrupted, error-free, or
                that data pulled from ESPN, Yahoo, or Sleeper will always be accurate or current — those
                platforms are outside our control, and API outages, rate limits, or format changes on their
                end can cause sync delays or gaps.
              </p>
            </Section>

            <Section number="12." title="Limitation of liability">
              <p>
                To the maximum extent permitted by law, Rostiro and its officers, employees, and vendors
                (including Anthropic, Stripe, and OneSignal) are not liable for any indirect, incidental,
                special, consequential, or punitive damages, including lost profits, lost data, or lost
                fantasy league winnings, arising from your use of Rostiro. Our total liability for any claim
                arising from these Terms or your use of Rostiro is limited to the greater of $100 or the
                amount you paid us in the 12 months before the claim arose. Some jurisdictions don&apos;t
                allow the exclusion of certain damages, so some of these limits may not apply to you.
              </p>
            </Section>

            <Section number="13." title="Indemnification">
              <p>
                You agree to indemnify and hold Rostiro, its officers, and its vendors harmless from any
                claim arising from your use of Rostiro, your violation of these Terms, or your violation of a
                connected platform&apos;s own terms through your Rostiro account.
              </p>
            </Section>

            <Section number="14." title="Dispute resolution — arbitration and class action waiver">
              <p>
                You and Rostiro agree to resolve any dispute arising from these Terms through binding
                individual arbitration rather than in court, except that either party may bring an individual
                claim in small-claims court. You and Rostiro each waive the right to a jury trial and to
                participate in a class action or class arbitration. If you&apos;d rather not be bound by this
                clause, email{' '}
                <span className="mono-data" style={{ color: 'var(--t1)' }}>legal@rostiro.com</span> within 30
                days of creating your account to opt out.
              </p>
            </Section>

            <Section number="15." title="Termination">
              <p>
                You can delete your account anytime from Settings. We may suspend or terminate your access if
                you violate these Terms. Sections 6, 7, 11, 12, 13, and 14 survive termination.
              </p>
            </Section>

            <Section number="16." title="Changes to these Terms">
              <p>
                If we make a material change, we&apos;ll post the update here with a new &ldquo;last
                updated&rdquo; date and, where required, notify you directly. Continued use after a change
                means you accept the updated Terms.
              </p>
            </Section>

            <Section number="17." title="Governing law">
              <p>
                These Terms are governed by the laws of the United States and the state in which Rostiro is
                incorporated, without regard to conflict-of-law principles — to be finalized once entity
                formation is complete.
              </p>
            </Section>

            <Section number="18." title="Contact">
              <p>
                Questions about these Terms — reach us at{' '}
                <span className="mono-data" style={{ color: 'var(--t1)' }}>legal@rostiro.com</span>.
              </p>
            </Section>
          </div>
        </main>

        <PublicFooter />
      </div>
    </div>
  )
}
