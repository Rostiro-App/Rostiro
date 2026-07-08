# Branded Email Suite — Design Spec

Date: 2026-07-08
Status: Approved for planning

## Context

`lib/resend.ts` already has a working, branded email foundation (built for T-135):
a shared `emailShell()` HTML template function, a lazy `getResendClient()`, and
2 emails (signup confirmation, password reset). The Resend domain (`rostiro.com`)
is now DNS-verified and live. This spec adds 9 more emails covering billing
lifecycle, account lifecycle, and founder/feedback notifications — the full set
the founder wants beyond the already-built auth emails.

Explicitly out of scope (a separate, later project, per founder decision
2026-07-08): weekly recap/digest, re-engagement nudges for inactive users, and
a T-151 upgrade-gate email. These need new infrastructure (content generation,
a cron schedule, unsubscribe/preference management) and the digest/upgrade-gate
ones depend on T-151 itself not existing yet. Not touched here.

## Brand kit compliance (`rostiro-brand-kit.md`)

The existing `emailShell()` already correctly uses the marketing wordmark
treatment (white text, since an email is a hero surface outside the app shell —
brand kit section 1's "Marketing (dark)" wordmark color `#FFFFFF`, not the
in-product `#D0E4F5`) and pulls its color tokens from brand kit section 6:
`--r-navy-page` (#0D1B2A), `--r-navy-card` (#0F2235), `--r-border` (#1A3050),
`--r-text-primary` (#D0E4F5, used for body heading text — acceptable since
it's body copy, not the wordmark itself), `--r-text-muted` (#4A6580),
`--r-standard`/primary UI accent (#378ADD) for the CTA button.

This spec keeps that exact shell for all 9 new emails, with one addition:

**Founding 500 welcome email uses a gold accent** (`#F5C842`) instead of the
default blue (#378ADD) for its CTA button and a small "★ FOUNDER" mark in the
heading area — matching the existing in-app treatment for Founding 500 members
(the gold badge already used on the Profile page and brand kit's playoffs/gold
accent, `--r-playoffs`). This is not a new color invented for email; it's the
same token already used in-app for this exact membership tier, applied
consistently. Every other email uses the existing default blue accent — no
other new colors, no OS-State-reactive pulse mark in email (brand kit's
pulse-mark system is a live, animated in-product/app-icon element; static
email HTML has no equivalent and none is being invented).

**Explicitly not changing:** `emailShell()`'s structure, the wordmark
treatment, the table-based layout, or the brand kit itself. `emailShell()`
gains one new optional parameter (`accentColor`, defaulting to the existing
`#378ADD`) rather than a parallel second template function — avoids
duplicating the whole shell for one color swap.

## The 9 emails and their trigger points

| # | Email | Triggered from |
|---|---|---|
| 1 | Welcome (post-confirmation) | `app/api/auth/callback/route.ts`, only when the callback's `next` param is `/onboarding` (distinguishes a fresh signup confirmation from a password-reset callback, which shares this same route with `next=/reset-password`) |
| 2 | Rostiro Pro started | `app/api/stripe/webhook/route.ts`, `checkout.session.completed`, when the resolved plan is `pro` |
| 3 | Founder Season Pass purchased | same webhook handler, plan resolves to `starter` |
| 4 | Founding 500 welcome (with founding number, gold accent) | same webhook handler, plan resolves to `commissioner`, sent only after `assignFoundingNumber` returns a real number (not on the null/sold-out path) |
| 5 | Subscription canceled | `app/api/stripe/webhook/route.ts`, `customer.subscription.deleted` |
| 6 | Season Pass expiring soon (~7 days out) | Extend `app/api/cron/season-pass-expiry/route.ts` — new query for `plan = 'starter'` AND `season_pass_expires_at` between 6-8 days from now AND `season_pass_expiry_warned_at IS NULL`; send once, then set `season_pass_expiry_warned_at = now()` |
| 7 | Season Pass expired | Same cron route, at the existing downgrade-to-free step (already queries `season_pass_expires_at < now()`) |
| 8 | Account deletion confirmation | `app/api/settings/delete-account/route.ts` — sent *before* `admin.auth.admin.deleteUser()` runs, since the email address is needed and the row won't exist after |
| 9a | Feedback received (to the member) | `app/api/founder/feedback/route.ts`, after the `founder_feedback` insert succeeds |
| 9b | Feedback notification (to the founder) | Same route, sent to `process.env.ADMIN_EMAIL` (already exists, already identifies the founder's real account — reused, not duplicated into a new env var) |

## Schema change

One new nullable column, matching this codebase's one-migration-per-feature
convention:

```sql
alter table public.users
  add column if not exists season_pass_expiry_warned_at timestamptz;
```

## Error handling

Every new send call follows the exact pattern already established in
`app/api/auth/signup/route.ts` and `app/api/auth/forgot-password/route.ts`:
wrapped in try/catch, a failure is logged (or silently ignored where nothing
better exists yet) but never blocks or reverts the underlying action. A Resend
outage must never mean a payment fails to register, an account fails to
delete, or feedback fails to save. The one exception is #8 (deletion
confirmation): since it must fire *before* deletion but deletion is the
actually-important action, deletion proceeds regardless of whether the email
send succeeds — same posture as every other email in this spec.

## Testing

No automated test framework in this repo (consistent with T-85). Verification
is manual: each email's send function is exercised through its real trigger
path against the already-verified Resend domain, and the resulting email is
inspected for correct brand-kit-compliant rendering (checked directly, not
assumed from reading the HTML string) in at least one real mail client.

## Out of scope for this pass

- Weekly digest, re-engagement nudges, T-151 upgrade-gate email (separate
  future project, depends on T-151).
- Any change to the 2 existing emails (signup confirmation, password reset).
- Any change to `emailShell()`'s structure beyond the one optional
  `accentColor` parameter.
- Unsubscribe/preference management — all 9 emails are transactional
  (account/billing/feedback lifecycle events), not marketing sends, so no
  unsubscribe mechanism is required or being added.
