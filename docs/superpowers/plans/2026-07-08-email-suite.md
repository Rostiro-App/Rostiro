# Branded Email Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 9 new branded transactional emails (billing lifecycle, account lifecycle, founder/feedback notifications) to Rostiro, extending the existing `lib/resend.ts` foundation from T-135.

**Architecture:** One new migration (a single nullable timestamp column), one extension to `lib/resend.ts` (9 new send functions + one optional `accentColor` parameter on the existing `emailShell()`), and 5 small hooks into already-existing routes/webhooks at their natural trigger points. No new infrastructure, no new cron jobs beyond extending the one that already exists.

**Tech Stack:** Resend (`resend` npm package, already installed and used), Next.js 16 App Router route handlers, Supabase.

## Global Constraints

- Reuse the existing `lib/resend.ts` pattern exactly: `getResendClient()` (lazy construction), `FROM`, `APP_URL`, `emailShell()`. Do not create a second template system.
- Every new email send is wrapped in try/catch and must never block or fail the underlying action (payment processing, account deletion, feedback submission all succeed regardless of email delivery) — same posture as the existing `sendSignupConfirmationEmail`/`sendPasswordResetEmail` call sites in `app/api/auth/signup/route.ts` and `app/api/auth/forgot-password/route.ts`.
- **HTML-escape any user-supplied free text before interpolating into an email body.** The feedback message (Task 7) is the only new user-supplied text going into an email — it must be escaped, since `emailShell()`'s `bodyHtml` parameter is inserted as raw HTML with no sanitization.
- Reuse the existing `ADMIN_EMAIL` env var for the founder notification email (Task 7) — do not add a new env var for this.
- New migration file follows the existing one-migration-per-feature convention (see `supabase/migration_founder_recognition.sql` for the idiomatic style: a comment block explaining why, then idempotent `alter table ... add column if not exists`).
- No automated test framework in this repo — verification is manual: trigger the real code path and visually inspect the actual received email (not just the generated HTML string) in a real mail client, consistent with how T-85 was verified.
- Brand kit compliance (`rostiro-brand-kit.md`): all 9 emails use the existing shell's default accent color `#378ADD` (brand kit's `--r-standard`/primary UI accent) **except** the Founding 500 email, which uses gold `#F5C842` (brand kit's `--r-playoffs` token, already used in-app for the Founding 500 badge on the Profile page) — this is the one intentional exception, not a precedent to add more colors elsewhere.

---

## Task 1: Migration + `lib/resend.ts` extension

**Files:**
- Create: `supabase/migration_email_suite.sql`
- Modify: `lib/resend.ts` (add `accentColor` param to `emailShell()`; add 9 new exported send functions)

**Interfaces:**
- Produces: `sendWelcomeEmail(to, ctaUrl)`, `sendProStartedEmail(to)`, `sendSeasonPassPurchasedEmail(to)`, `sendFoundingWelcomeEmail(to, foundingNumber)`, `sendSubscriptionCanceledEmail(to)`, `sendSeasonPassExpiringEmail(to)`, `sendSeasonPassExpiredEmail(to)`, `sendAccountDeletedEmail(to)`, `sendFeedbackReceivedEmail(to)`, `sendFeedbackNotificationEmail(founderEmail, memberEmail, message)` — all `Promise<void>`, all consumed by Tasks 2-7.
- Consumes: existing `getResendClient()`, `FROM`, `APP_URL`, `COLOR`, `emailShell()` (all already in `lib/resend.ts`).

- [ ] **Step 1: Write the migration**

```sql
-- Email suite (2026-07-08) — run once in the Supabase SQL editor. Idempotent.
--
-- Backs the "Season Pass expiring soon" reminder email: the cron in
-- app/api/cron/season-pass-expiry/route.ts needs to fire that reminder
-- exactly once per user, not every day the cron runs while a user is in
-- the 6-8-day warning window. This column is the one-shot guard — null
-- until the reminder is sent, then set, same pattern as any other
-- "already notified" flag.

alter table public.users
  add column if not exists season_pass_expiry_warned_at timestamptz;
```

Run this in the Supabase SQL editor (same manual step as every other migration in this repo — there is no migration-runner tooling).

- [ ] **Step 2: Add `accentColor` to `emailShell()` in `lib/resend.ts`**

Change the `EmailShellInput` interface and the function signature/body:

```typescript
interface EmailShellInput {
  previewText: string
  heading: string
  bodyHtml: string
  ctaLabel: string
  ctaUrl: string
  footerNote: string
  accentColor?: string
}
```

In the function body, change every reference to `COLOR.signal` for the CTA button's `background-color` to use the new parameter with the existing color as its default:

```typescript
function emailShell({ previewText, heading, bodyHtml, ctaLabel, ctaUrl, footerNote, accentColor = COLOR.signal }: EmailShellInput): string {
```

And in the CTA button's `<td>` style, change `background-color:${COLOR.signal};` to `background-color:${accentColor};`. Leave every other part of `emailShell()` — the wordmark, card, borders, text colors — completely unchanged.

- [ ] **Step 3: Add a small HTML-escape helper**

Add near the top of `lib/resend.ts`, after the `COLOR` constant:

```typescript
// Escapes user-supplied free text before it goes into an email body —
// emailShell()'s bodyHtml is inserted as raw HTML with no sanitization,
// so anything a user typed (e.g. the founder-feedback message, Task 7)
// must be escaped here first, or it could break the email's markup or
// inject arbitrary HTML into an email sent from rostiro.com.
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
```

- [ ] **Step 4: Add the 9 send functions**

Append to `lib/resend.ts`, after the existing `sendPasswordResetEmail`:

```typescript
export async function sendWelcomeEmail(to: string): Promise<void> {
  const html = emailShell({
    previewText: 'Your Rostiro OS is live.',
    heading: "You're in.",
    bodyHtml: 'Your Rostiro OS is live. Connect a league to get your first Pulse briefing.',
    ctaLabel: 'Go to Rostiro',
    ctaUrl: `${APP_URL}/pulse`,
    footerNote: "You're receiving this because you just confirmed your Rostiro account.",
  })
  const { error } = await getResendClient().emails.send({
    from: FROM, to, subject: 'Welcome to Rostiro', html,
    text: `Welcome to Rostiro. Go to your dashboard: ${APP_URL}/pulse`,
  })
  if (error) throw new Error(error.message)
}

export async function sendProStartedEmail(to: string): Promise<void> {
  const html = emailShell({
    previewText: "You're on Rostiro Pro.",
    heading: 'Welcome to Pro',
    bodyHtml: 'Unlimited leagues, full Pulse depth, and unlimited AI are live on your account now.',
    ctaLabel: 'Open Rostiro',
    ctaUrl: `${APP_URL}/pulse`,
    footerNote: 'Manage your subscription anytime from Profile → Manage billing.',
  })
  const { error } = await getResendClient().emails.send({
    from: FROM, to, subject: "You're on Rostiro Pro", html,
    text: `You're on Rostiro Pro. Open Rostiro: ${APP_URL}/pulse`,
  })
  if (error) throw new Error(error.message)
}

export async function sendSeasonPassPurchasedEmail(to: string): Promise<void> {
  const html = emailShell({
    previewText: 'Your Founder Season Pass is active.',
    heading: 'Season Pass activated',
    bodyHtml: 'Full access is unlocked through the end of the season — no recurring charge.',
    ctaLabel: 'Open Rostiro',
    ctaUrl: `${APP_URL}/pulse`,
    footerNote: "Your pass expires at the end of the season; we'll email you before it does.",
  })
  const { error } = await getResendClient().emails.send({
    from: FROM, to, subject: 'Your Founder Season Pass is active', html,
    text: `Your Founder Season Pass is active. Open Rostiro: ${APP_URL}/pulse`,
  })
  if (error) throw new Error(error.message)
}

export async function sendFoundingWelcomeEmail(to: string, foundingNumber: number): Promise<void> {
  const html = emailShell({
    previewText: 'Welcome to the Founding 500.',
    heading: `You're Founding Member #${foundingNumber}`,
    bodyHtml: 'Lifetime access, locked in for good. Thank you for backing Rostiro from the start.',
    ctaLabel: 'View your Founder badge',
    ctaUrl: `${APP_URL}/profile`,
    footerNote: 'Founding 500 membership is permanent and non-transferable.',
    accentColor: '#F5C842',
  })
  const { error } = await getResendClient().emails.send({
    from: FROM, to, subject: 'Welcome to the Founding 500', html,
    text: `You're Founding Member #${foundingNumber} of 500. View your badge: ${APP_URL}/profile`,
  })
  if (error) throw new Error(error.message)
}

export async function sendSubscriptionCanceledEmail(to: string): Promise<void> {
  const html = emailShell({
    previewText: 'Your Rostiro Pro subscription was canceled.',
    heading: 'Subscription canceled',
    bodyHtml: 'Your account has moved to the Free plan. You can resubscribe anytime.',
    ctaLabel: 'View plans',
    ctaUrl: `${APP_URL}/upgrade`,
    footerNote: "If this wasn't you, contact support right away.",
  })
  const { error } = await getResendClient().emails.send({
    from: FROM, to, subject: 'Your Rostiro Pro subscription was canceled', html,
    text: `Your Rostiro Pro subscription was canceled. View plans: ${APP_URL}/upgrade`,
  })
  if (error) throw new Error(error.message)
}

export async function sendSeasonPassExpiringEmail(to: string): Promise<void> {
  const html = emailShell({
    previewText: 'Your Season Pass expires in about a week.',
    heading: 'Your Season Pass is ending soon',
    bodyHtml: 'Your Founder Season Pass access ends soon. Upgrade to Rostiro Pro or Founding 500 to keep full access without interruption.',
    ctaLabel: 'View plans',
    ctaUrl: `${APP_URL}/upgrade`,
    footerNote: "No action needed if you're fine reverting to Free.",
  })
  const { error } = await getResendClient().emails.send({
    from: FROM, to, subject: 'Your Season Pass expires in about a week', html,
    text: `Your Season Pass expires soon. View plans: ${APP_URL}/upgrade`,
  })
  if (error) throw new Error(error.message)
}

export async function sendSeasonPassExpiredEmail(to: string): Promise<void> {
  const html = emailShell({
    previewText: 'Your Season Pass has ended.',
    heading: 'Your Season Pass has ended',
    bodyHtml: 'Your account is back on the Free plan. Upgrade anytime to unlock full access again.',
    ctaLabel: 'View plans',
    ctaUrl: `${APP_URL}/upgrade`,
    footerNote: 'Thanks for being a Founder Season Pass member this season.',
  })
  const { error } = await getResendClient().emails.send({
    from: FROM, to, subject: 'Your Season Pass has ended', html,
    text: `Your Season Pass has ended. View plans: ${APP_URL}/upgrade`,
  })
  if (error) throw new Error(error.message)
}

export async function sendAccountDeletedEmail(to: string): Promise<void> {
  const html = emailShell({
    previewText: 'Your Rostiro account has been deleted.',
    heading: 'Account deleted',
    bodyHtml: 'Your account and all associated data have been permanently deleted, per your request.',
    ctaLabel: 'Learn more',
    ctaUrl: APP_URL,
    footerNote: "If you didn't request this, contact support immediately.",
  })
  const { error } = await getResendClient().emails.send({
    from: FROM, to, subject: 'Your Rostiro account has been deleted', html,
    text: 'Your Rostiro account and all associated data have been permanently deleted, per your request.',
  })
  if (error) throw new Error(error.message)
}

export async function sendFeedbackReceivedEmail(to: string): Promise<void> {
  const html = emailShell({
    previewText: 'We received your feedback.',
    heading: 'Thanks for the feedback',
    bodyHtml: 'Your message went straight to the founder, flagged as priority. We read every Founding 500 submission.',
    ctaLabel: 'Back to Rostiro',
    ctaUrl: `${APP_URL}/profile`,
    footerNote: 'This is a one-time confirmation — no reply is expected unless the founder follows up directly.',
  })
  const { error } = await getResendClient().emails.send({
    from: FROM, to, subject: 'We received your feedback', html,
    text: 'We received your feedback. It went straight to the founder, flagged as priority.',
  })
  if (error) throw new Error(error.message)
}

export async function sendFeedbackNotificationEmail(founderEmail: string, memberEmail: string, message: string): Promise<void> {
  const html = emailShell({
    previewText: 'New Founding 500 feedback received.',
    heading: 'New feedback received',
    bodyHtml: `From: ${escapeHtml(memberEmail)}<br/><br/>${escapeHtml(message)}`,
    ctaLabel: 'Open Rostiro',
    ctaUrl: APP_URL,
    footerNote: 'Sent because a Founding 500 member submitted feedback.',
  })
  const { error } = await getResendClient().emails.send({
    from: FROM, to: founderEmail, subject: 'New Founding 500 feedback', html,
    text: `New feedback from ${memberEmail}: ${message}`,
  })
  if (error) throw new Error(error.message)
}
```

- [ ] **Step 5: Verify it compiles**

Run: `npx next build 2>&1 | grep -i "lib/resend"`
Expected: no output (no errors referencing this file).

- [ ] **Step 6: Commit**

```bash
git add supabase/migration_email_suite.sql lib/resend.ts
git commit -m "feat(email): add migration + 9 new branded email send functions"
```

---

## Task 2: Welcome email

**Files:**
- Modify: `app/api/auth/callback/route.ts`

**Interfaces:**
- Consumes: `sendWelcomeEmail(to)` from `lib/resend.ts` (Task 1).

- [ ] **Step 1: Modify the callback route**

The current file:

```typescript
// Supabase Auth callback — handles magic link and OAuth redirects.
// Exchanges the code for a session and redirects to onboarding or dashboard.

import { createSSRClient } from '@/lib/supabase'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/pulse'

  if (code) {
    const supabase = await createSSRClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
```

Change it to send the welcome email only when `next === '/onboarding'` (the signup-confirmation path — the password-reset path uses `next=/reset-password`, so this check is what distinguishes a fresh signup confirmation from every other use of this shared callback):

```typescript
// Supabase Auth callback — handles magic link and OAuth redirects.
// Exchanges the code for a session and redirects to onboarding or dashboard.

import { createSSRClient } from '@/lib/supabase'
import { sendWelcomeEmail } from '@/lib/resend'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/pulse'

  if (code) {
    const supabase = await createSSRClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // next=/onboarding only ever comes from app/api/auth/signup/route.ts's
      // redirectTo — every other caller of this shared callback (password
      // reset, any future OAuth flow) uses a different `next`, so this is
      // the one reliable signal that this is a fresh signup confirmation,
      // not just "a session now exists."
      if (next === '/onboarding' && data.user?.email) {
        try {
          await sendWelcomeEmail(data.user.email)
        } catch {
          // A welcome email failing to send must never block onboarding.
        }
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
```

- [ ] **Step 2: Manual verification**

Sign up a fresh test account through `/signup`, click the confirmation link from the real received email, and confirm: (a) you land on `/onboarding` as before (no regression), (b) a new "Welcome to Rostiro" email arrives at that address, correctly branded (check it in a real mail client, not just by reading the generated HTML).

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/callback/route.ts
git commit -m "feat(email): send welcome email on signup confirmation"
```

---

## Task 3: Pro / Season Pass / Founding 500 purchase emails

**Files:**
- Modify: `app/api/stripe/webhook/route.ts`

**Interfaces:**
- Consumes: `sendProStartedEmail`, `sendSeasonPassPurchasedEmail`, `sendFoundingWelcomeEmail` from `lib/resend.ts` (Task 1).

- [ ] **Step 1: Extend the `checkout.session.completed` handler**

The current handler already does a `currentUserRow` lookup selecting `plan` — extend that same query to also select `email`, so no second DB round-trip is needed. Then send the matching email right after the `update` succeeds (not before — only email once the plan change is actually persisted).

Change:
```typescript
        const { data: currentUserRow } = await admin
          .from('users')
          .select('plan')
          .eq('id', userId)
          .maybeSingle()
```
to:
```typescript
        const { data: currentUserRow } = await admin
          .from('users')
          .select('plan, email')
          .eq('id', userId)
          .maybeSingle()
```

Then, after the existing block:
```typescript
        const { error } = await admin.from('users').update(update).eq('id', userId)
        if (error) throw new Error(error.message)
        break
      }
```
change it to send the matching email once the update succeeds:
```typescript
        const { error } = await admin.from('users').update(update).eq('id', userId)
        if (error) throw new Error(error.message)

        const email = currentUserRow?.email
        if (email) {
          try {
            if (plan === 'pro') await sendProStartedEmail(email)
            if (plan === 'starter') await sendSeasonPassPurchasedEmail(email)
            if (plan === 'commissioner') {
              // foundingNumber is guaranteed non-null here — the `break`
              // a few lines up already returns early when it's null.
              await sendFoundingWelcomeEmail(email, foundingNumber!)
            }
          } catch {
            // A purchase email failing to send must never fail the webhook
            // — the plan is already correctly persisted at this point.
          }
        }
        break
      }
```

Note: `foundingNumber` is declared inside the `if (plan === 'commissioner')` block earlier in the same function — check the current variable scoping when making this edit; if `foundingNumber` isn't already accessible at this point in the function (i.e. it's block-scoped to the `if`), hoist its declaration (`let foundingNumber: number | null = null` before that `if`, then assign inside it) so it's readable here. Read the full current file before editing to get this right — do not guess at the exact surrounding lines.

Add the import at the top of the file:
```typescript
import { sendProStartedEmail, sendSeasonPassPurchasedEmail, sendFoundingWelcomeEmail } from '@/lib/resend'
```

- [ ] **Step 2: Manual verification**

Using the same manual Stripe-test-mode-checkout process established for T-85 (real test card, `/upgrade` page): complete one checkout for each of the 3 paid tiers on a real test account and confirm each triggers the correct branded email at the account's real address — Pro → "Welcome to Pro", Season Pass → "Season Pass activated", Founding 500 → "You're Founding Member #N" with the gold accent color visibly different from the other emails' blue.

- [ ] **Step 3: Commit**

```bash
git add app/api/stripe/webhook/route.ts
git commit -m "feat(email): send purchase-confirmation emails on checkout.session.completed"
```

---

## Task 4: Subscription canceled email

**Files:**
- Modify: `app/api/stripe/webhook/route.ts`

**Interfaces:**
- Consumes: `sendSubscriptionCanceledEmail` from `lib/resend.ts` (Task 1).

- [ ] **Step 1: Extend the `customer.subscription.deleted` handler**

Current handler:
```typescript
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
        const { error } = await admin
          .from('users')
          .update({ plan: 'free', stripe_subscription_id: null })
          .eq('stripe_customer_id', customerId)
        if (error) throw new Error(error.message)
        break
      }
```

Change to fetch the email in the same `.update()` call via `.select()`, then send the email after:
```typescript
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
        const { data: updatedRows, error } = await admin
          .from('users')
          .update({ plan: 'free', stripe_subscription_id: null })
          .eq('stripe_customer_id', customerId)
          .select('email')
        if (error) throw new Error(error.message)

        const email = updatedRows?.[0]?.email
        if (email) {
          try {
            await sendSubscriptionCanceledEmail(email)
          } catch {
            // Must never fail the webhook — the downgrade already succeeded.
          }
        }
        break
      }
```

Add `sendSubscriptionCanceledEmail` to the existing `@/lib/resend` import from Task 3 (combine into one import statement — do not add a second, duplicate import line).

- [ ] **Step 2: Manual verification**

Using the active test-mode Pro subscription from earlier T-85 testing (or a fresh one), cancel it via the Billing Portal (`/profile` → "Manage billing" → "Cancel subscription"), wait for the webhook to fire, and confirm the "Your Rostiro Pro subscription was canceled" email arrives at the real account email.

- [ ] **Step 3: Commit**

```bash
git add app/api/stripe/webhook/route.ts
git commit -m "feat(email): send cancellation email on customer.subscription.deleted"
```

---

## Task 5: Season Pass expiring-soon + expired emails

**Files:**
- Modify: `app/api/cron/season-pass-expiry/route.ts`

**Interfaces:**
- Consumes: `sendSeasonPassExpiringEmail`, `sendSeasonPassExpiredEmail` from `lib/resend.ts` (Task 1); `season_pass_expiry_warned_at` column (Task 1's migration).

- [ ] **Step 1: Extend the cron route**

Current file (full):
```typescript
// T-85: daily downgrade of expired Founder Season Passes (plan='starter')
// back to Free once season_pass_expires_at has passed. Same shape as
// every other scheduled job in this directory — a dedicated cron entry
// rather than a lazy check-on-read, so it doesn't touch isFreePlan's
// existing hot path (called from nearly every gated feature) at all.

import { createAdminClient } from '@/lib/supabase'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    const nowIso = new Date().toISOString()

    const { data, error } = await admin
      .from('users')
      .update({ plan: 'free', season_pass_expires_at: null })
      .eq('plan', 'starter')
      .lt('season_pass_expires_at', nowIso)
      .select('id')

    if (error) throw new Error(error.message)

    return NextResponse.json({ downgraded: data?.length ?? 0 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

Replace with a version that also handles the 6-8-day-out warning, and fetches emails for the actual-expiry downgrade so it can email those users too:

```typescript
// T-85: daily downgrade of expired Founder Season Passes (plan='starter')
// back to Free once season_pass_expires_at has passed. Same shape as
// every other scheduled job in this directory — a dedicated cron entry
// rather than a lazy check-on-read, so it doesn't touch isFreePlan's
// existing hot path (called from nearly every gated feature) at all.
//
// Also sends two emails (added for the email suite): a one-time "expiring
// soon" warning ~7 days before expiry (guarded by
// season_pass_expiry_warned_at so it only ever fires once per user), and
// an "expired" notice at the actual downgrade moment.

import { createAdminClient } from '@/lib/supabase'
import { sendSeasonPassExpiringEmail, sendSeasonPassExpiredEmail } from '@/lib/resend'
import { NextResponse, type NextRequest } from 'next/server'

const WARNING_WINDOW_MIN_DAYS = 6
const WARNING_WINDOW_MAX_DAYS = 8

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    const now = new Date()
    const nowIso = now.toISOString()

    // Expiring-soon warning: plan='starter', not yet warned, expiry
    // between 6 and 8 days from now.
    const warnWindowStart = new Date(now.getTime() + WARNING_WINDOW_MIN_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const warnWindowEnd = new Date(now.getTime() + WARNING_WINDOW_MAX_DAYS * 24 * 60 * 60 * 1000).toISOString()

    const { data: toWarn, error: warnSelectError } = await admin
      .from('users')
      .select('id, email')
      .eq('plan', 'starter')
      .is('season_pass_expiry_warned_at', null)
      .gte('season_pass_expires_at', warnWindowStart)
      .lte('season_pass_expires_at', warnWindowEnd)

    if (warnSelectError) throw new Error(warnSelectError.message)

    let warned = 0
    for (const row of toWarn ?? []) {
      try {
        await sendSeasonPassExpiringEmail(row.email)
      } catch {
        // A failed send shouldn't stop the warned_at flag from being set —
        // otherwise a persistent Resend failure would re-attempt (and
        // re-fail) this same user every day for the rest of the window.
      }
      const { error: markError } = await admin
        .from('users')
        .update({ season_pass_expiry_warned_at: nowIso })
        .eq('id', row.id)
      if (!markError) warned += 1
    }

    // Actual expiry downgrade — unchanged logic, now also emails.
    const { data: downgraded, error: downgradeError } = await admin
      .from('users')
      .update({ plan: 'free', season_pass_expires_at: null, season_pass_expiry_warned_at: null })
      .eq('plan', 'starter')
      .lt('season_pass_expires_at', nowIso)
      .select('email')

    if (downgradeError) throw new Error(downgradeError.message)

    for (const row of downgraded ?? []) {
      try {
        await sendSeasonPassExpiredEmail(row.email)
      } catch {
        // Downgrade already succeeded — a failed email must not surface as an error.
      }
    }

    return NextResponse.json({ warned, downgraded: downgraded?.length ?? 0 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

Note: `season_pass_expiry_warned_at` is also reset to `null` in the final downgrade update — this is a small but real detail worth getting right: since a downgraded user's `season_pass_expires_at` is cleared, a stale non-null `warned_at` would just sit there harmlessly, but clearing both together keeps the row's Season-Pass-related fields consistently "unset" if they ever re-purchase a Season Pass later (the checkout webhook, Task 3, never touches `warned_at` on a fresh purchase, so leaving a stale value from a *previous* pass could otherwise cause the new pass's warning email to be skipped incorrectly next time).

- [ ] **Step 2: Manual verification — warning path**

In the Supabase SQL editor, temporarily set a real test user's `plan = 'starter'`, `season_pass_expires_at` to ~7 days from now, and `season_pass_expiry_warned_at = null`. Run:
`curl -s https://rostiro.com/api/cron/season-pass-expiry -H "Authorization: Bearer <CRON_SECRET>" -w "\n%{http_code}\n"`
Expected: `200`, `{"warned":1,"downgraded":0}` (or more if other rows match), the "Your Season Pass is ending soon" email arrives, and re-querying that user's row shows `season_pass_expiry_warned_at` is now set. Run the same curl again immediately — expected `{"warned":0,...}` (no duplicate email), confirming the one-shot guard works.

- [ ] **Step 3: Manual verification — expiry path**

Set that same (or another) test user's `season_pass_expires_at` to a past date, run the same curl again. Expected: `{"warned":0,"downgraded":1}`, the "Your Season Pass has ended" email arrives, and the user's row shows `plan = 'free'`, `season_pass_expires_at = null`, `season_pass_expiry_warned_at = null`.

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/season-pass-expiry/route.ts
git commit -m "feat(email): add Season Pass expiring-soon and expired emails to cron"
```

---

## Task 6: Account deletion confirmation email

**Files:**
- Modify: `app/api/settings/delete-account/route.ts`

**Interfaces:**
- Consumes: `sendAccountDeletedEmail` from `lib/resend.ts` (Task 1).

- [ ] **Step 1: Modify the route**

Current file:
```typescript
import { createAdminClient, createSSRClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const Body = z.object({ confirm: z.literal('DELETE') })

export async function POST(request: Request) {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Type DELETE to confirm account deletion' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
```

Change to send the email *before* deletion (the address won't exist to read afterward), but only actually count on the deletion's own success/failure — the email is sent best-effort right before the irreversible operation:

```typescript
import { createAdminClient, createSSRClient } from '@/lib/supabase'
import { sendAccountDeletedEmail } from '@/lib/resend'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const Body = z.object({ confirm: z.literal('DELETE') })

export async function POST(request: Request) {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Type DELETE to confirm account deletion' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (user.email) {
    try {
      await sendAccountDeletedEmail(user.email)
    } catch {
      // Deletion already succeeded — a failed confirmation email must not
      // surface as an error to a user whose account is genuinely gone.
    }
  }

  return NextResponse.json({ ok: true })
}
```

Note the email send happens *after* `deleteUser` succeeds, not before — `user.email` is still available from the `getUser()` call earlier in the same request (captured in the closure), even though the DB row is now gone. This is both more correct (never emails a "deleted" confirmation if the deletion actually failed) and simpler than trying to read the email before deletion.

- [ ] **Step 2: Manual verification**

Using a genuine throwaway test account (this is irreversible — do not use a real account you want to keep), go through Settings → Danger zone → delete account, type `DELETE` to confirm, and confirm the "Your Rostiro account has been deleted" email arrives at that address, and the account is genuinely gone (attempting to log back in fails).

- [ ] **Step 3: Commit**

```bash
git add app/api/settings/delete-account/route.ts
git commit -m "feat(email): send confirmation email on account deletion"
```

---

## Task 7: Feedback received + founder notification emails

**Files:**
- Modify: `app/api/founder/feedback/route.ts`

**Interfaces:**
- Consumes: `sendFeedbackReceivedEmail`, `sendFeedbackNotificationEmail` from `lib/resend.ts` (Task 1); `process.env.ADMIN_EMAIL` (existing).

- [ ] **Step 1: Modify the route**

Current file:
```typescript
// T-111: priority feedback access — a real, separate channel from generic
// support, gated server-side on plan='commissioner' (not just hidden in the
// UI), so it's an actual Founding 500 benefit rather than a client-side
// courtesy anyone could bypass.

import { createSSRClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const Body = z.object({ message: z.string().min(1).max(2000) })

export async function POST(request: Request) {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('plan').eq('id', user.id).maybeSingle()
  if (profile?.plan !== 'commissioner') {
    return NextResponse.json({ error: 'Founder feedback is a Founding 500 benefit' }, { status: 403 })
  }

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'message required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('founder_feedback')
    .insert({ user_id: user.id, message: parsed.data.message })

  if (error) {
    // 42P01 (Postgres "undefined_table") / PGRST205 (PostgREST's schema-cache
    // equivalent) both mean migration_founder_recognition.sql hasn't run yet.
    if (error.code === '42P01' || error.code === 'PGRST205') {
      return NextResponse.json(
        { error: 'Founder feedback not enabled yet — run migration_founder_recognition.sql' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
```

Change to send both emails after a successful insert:

```typescript
// T-111: priority feedback access — a real, separate channel from generic
// support, gated server-side on plan='commissioner' (not just hidden in the
// UI), so it's an actual Founding 500 benefit rather than a client-side
// courtesy anyone could bypass.

import { createSSRClient } from '@/lib/supabase'
import { sendFeedbackReceivedEmail, sendFeedbackNotificationEmail } from '@/lib/resend'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const Body = z.object({ message: z.string().min(1).max(2000) })

export async function POST(request: Request) {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('plan').eq('id', user.id).maybeSingle()
  if (profile?.plan !== 'commissioner') {
    return NextResponse.json({ error: 'Founder feedback is a Founding 500 benefit' }, { status: 403 })
  }

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'message required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('founder_feedback')
    .insert({ user_id: user.id, message: parsed.data.message })

  if (error) {
    // 42P01 (Postgres "undefined_table") / PGRST205 (PostgREST's schema-cache
    // equivalent) both mean migration_founder_recognition.sql hasn't run yet.
    if (error.code === '42P01' || error.code === 'PGRST205') {
      return NextResponse.json(
        { error: 'Founder feedback not enabled yet — run migration_founder_recognition.sql' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (user.email) {
    try {
      await sendFeedbackReceivedEmail(user.email)
    } catch {
      // Feedback is already saved — a failed confirmation email is not an error.
    }
    const adminEmail = process.env.ADMIN_EMAIL
    if (adminEmail) {
      try {
        await sendFeedbackNotificationEmail(adminEmail, user.email, parsed.data.message)
      } catch {
        // Same posture — the founder notification is a courtesy, not a
        // requirement for the feedback submission itself to succeed.
      }
    }
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Manual verification**

Using a real Founding 500 (`commissioner`-plan) test account, submit feedback through the Profile page's feedback form. Confirm: (a) the existing in-app "sent" confirmation still works (no regression), (b) a "We received your feedback" email arrives at the submitting account's address, (c) a "New Founding 500 feedback" email arrives at whatever `ADMIN_EMAIL` is currently set to, containing the submitted message text correctly (and, if you want to specifically confirm the HTML-escaping from Task 1 Step 3, try submitting a message containing `<b>test</b>` or similar and confirm it renders as literal text in the received email, not as bold/interpreted HTML).

- [ ] **Step 3: Commit**

```bash
git add app/api/founder/feedback/route.ts
git commit -m "feat(email): send feedback-received and founder-notification emails"
```

---

## Self-Review Notes

- **Spec coverage:** all 9 emails from the spec have a task and a concrete trigger point. Migration (spec's schema change) is Task 1. `accentColor`/gold-for-Founding-500 (spec's brand kit section) is Task 1 Step 2 + Task 1's `sendFoundingWelcomeEmail`. HTML-escaping (spec's error-handling note, expanded into its own Global Constraint) is Task 1 Step 3 + used in Task 7's `sendFeedbackNotificationEmail`.
- **Placeholder scan:** no TBD/TODO; Task 3's note about `foundingNumber` scoping is a real instruction to read-before-editing, not a placeholder — the implementer needs to check the actual current variable scope rather than being handed possibly-stale line numbers for a file this plan doesn't reproduce in full at that point.
- **Type consistency:** every new `lib/resend.ts` export used by Tasks 2-7 matches the exact function name and parameter order specified in Task 1's Step 4 code.
- **Out of scope, unchanged from spec:** weekly digest, re-engagement nudges, T-151 upgrade-gate email — not touched by any task here.
