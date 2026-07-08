# T-85 Stripe: Go-Live Checklist

Status (2026-07-08): Stripe integration is built, deployed, and verified end-to-end
in **test mode** on production (rostiro.com) — Rostiro Pro and Founding 500 both
confirmed working via real test-mode checkouts (Founder Season Pass confirmed
working directly by the founder). Deliberately staying on test-mode credentials
until ready to accept real customers. This doc is the checklist for that switch.

## 1. Activate the Stripe account for live payments

Stripe requires business verification before it allows live charges: legal
business details, a bank account for payouts, tax ID. This happens in the
Stripe Dashboard (toggle "Activate account" from test mode), not in this repo.

## 2. Recreate the 3 Prices in live mode

Test mode and live mode have completely separate Product/Price catalogs.
Recreate the same 3 Prices under live mode:
- Rostiro Pro — $9.99/mo, recurring
- Founder Season Pass — $59, one-time
- Founding 500 — $149, one-time

Each gets a new `price_...` ID, distinct from the test-mode ones already in use.

## 3. Get live-mode API keys (restricted key preferred)

Use a **restricted API key** (`rk_live_...`) scoped to only the permissions this
app needs, rather than the full live secret key (`sk_live_...`) — limits the
blast radius if it ever leaks. See Stripe's restricted-key docs for scoping
guidance matching what `lib/stripe.ts` actually calls (Checkout Sessions,
Billing Portal, Customers, Subscriptions).

## 4. Set up a live-mode webhook endpoint

Same `https://www.rostiro.com/api/stripe/webhook` URL (note: `www`, not the
bare apex domain — the bare domain 308-redirects to `www`, and Stripe does not
follow redirects when delivering webhooks; this bit us once already in test
mode). Register it under live mode, listening for the same 2 events:
- `checkout.session.completed`
- `customer.subscription.deleted`

Live mode gets its own distinct signing secret — do not reuse the test-mode one.

## 5. Swap every Stripe env var in Vercel to live-mode values

- `STRIPE_SECRET_KEY` → live restricted key
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → live publishable key
- `STRIPE_WEBHOOK_SECRET` → the new live-mode endpoint's secret
- `STRIPE_PRICE_PRO`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_COMMISSIONER` → the
  new live-mode Price IDs from step 2

No code changes needed — the app already just reads whatever's in these env
vars. Redeploy after saving (and don't reuse a cached build — `NEXT_PUBLIC_*`
vars get compiled into the bundle at build time, not read fresh at runtime).

## Also close out before going live

- **T-137** (PRD): real lawyer review of Terms/Privacy, business entity
  registration, sales tax setup (Stripe Tax can handle calculation if wanted).
- **Season Pass expiry date**: confirm the real date — currently a placeholder
  (`SEASON_PASS_EXPIRES_AT` in `lib/stripe.ts`, `2027-02-09T00:00:00Z`).
- **Re-run the same manual verification pass** (one real checkout per tier)
  against live mode once configured, rather than assuming it'll just work.
  Test mode caught 4 real config mistakes this way (domain typo, webhook
  redirect, wrong price, wrong top-bar badge label) that would not have
  surfaced from re-reading the config by eye — live mode's config is entirely
  separate and just as capable of the same kind of mistake.
