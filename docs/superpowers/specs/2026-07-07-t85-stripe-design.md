# T-85: Stripe Pricing Rebuild — Design Spec

Date: 2026-07-07
Status: Approved for planning

## Context

T-85 is the last item in Phase 1 of the Rostiro PRD, previously blocked on a real Stripe
account existing. That blocker is now cleared: the founder created a Stripe account and
populated `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (test mode) in
`.env.local`. `STRIPE_WEBHOOK_SECRET` is still empty and will be filled in once the webhook
endpoint exists and a local/hosted listener is registered.

Confirmed target pricing model (per `Rostiro_PRD_v5.md`, confirmed with founder July 4, 2026):

- **Free** — $0
- **Rostiro Pro** — $9.99/month, recurring
- **Founder Season Pass** — $59, one-time, access through end of season
- **Founding 500** — $149, one-time, lifetime, capped at 500 purchases

The `users.plan` column already exists with `check (plan in ('free', 'starter', 'pro',
'commissioner'))`. `commissioner` is already used by existing gating logic and by
`migration_founder_recognition.sql`'s comments to mean Founding 500 (lifetime access +
founder badge + founding number). This spec reuses that enum as-is rather than migrating
it, mapping `starter` → Founder Season Pass. No existing check constraint or gating code
needs to change names, only what each value is sold as.

**Stale v4 leftovers, not used by this spec:** `.env.example` still lists
`STRIPE_PRICE_STARTER_MONTHLY/ANNUAL`, `STRIPE_PRICE_PRO_MONTHLY/ANNUAL`,
`STRIPE_PRICE_COMMISSIONER_MONTHLY/ANNUAL`, and `STRIPE_PRICE_INTELLIGENCE_ADDON_MONTHLY/ANNUAL`,
and `users.intelligence_addon` is a real column — both are artifacts of the four-tier
Scout/Starter/Pro/Commissioner + Intelligence add-on model that PRD v5 (Section 9 changelog,
`Rostiro_PRD_v5.md:82`) explicitly replaced with the confirmed model above. This spec does
not use the addon column or those annual/addon env var names. It's not this pass's job to
delete them (out of scope, and `intelligence_addon` may still be read elsewhere) — implementation
should add new, distinctly-named price env vars (see below) rather than repurpose the stale ones.

Two related tickets depend on this work but are explicitly out of scope here:
- **T-112** (marketing landing page pricing section) — reads current plan model, doesn't
  need any of the code built in this spec.
- **T-151** (unified "Upgrade now" gate shown to Free users after the Week 1 promo window,
  hard deadline Sept 15, 2026) — will link to the `/upgrade` page this spec builds, but its
  own gate UI/trigger logic is a separate pass.
- **T-137** (legal/tax: Terms/Privacy lawyer review, business entity + sales tax
  registration) — business/legal actions, not code, bundled with going live on *real*
  payments. Not blocking for building against test-mode keys.

## Plan → Stripe mapping

| `users.plan` value | Product name | Price | Stripe mode | Recurs? | Expiry |
|---|---|---|---|---|---|
| `free` | Free | $0 | n/a | n/a | n/a |
| `pro` | Rostiro Pro | $9.99/mo | `subscription` | yes | n/a — active while subscription is active |
| `starter` | Founder Season Pass | $59 | `payment` (one-time) | no | `users.season_pass_expires_at`, enforced by cron-style check |
| `commissioner` | Founding 500 | $149 | `payment` (one-time) | no | none (lifetime), capped at 500 total |

Each plan corresponds to one Stripe Price ID, created in the Stripe Dashboard (test mode)
and referenced via new env vars — `STRIPE_PRICE_PRO`, `STRIPE_PRICE_STARTER`,
`STRIPE_PRICE_COMMISSIONER` — deliberately distinct names from the stale v4
`STRIPE_PRICE_*_MONTHLY/ANNUAL` vars above, so switching from test to live mode later is an
env change only and doesn't collide with the unused old names.

## Schema changes

**None needed.** `supabase/schema.sql` already has `stripe_customer_id`, `stripe_subscription_id`,
and `season_pass_expires_at` on `public.users` (added ahead of this spec, presumably
alongside the v4→v5 pricing rewrite). This spec uses those exact existing column names:

- `stripe_customer_id` — set on first checkout, reused for the Customer Portal and future
  checkouts so a user never ends up with duplicate Stripe customers.
- `stripe_subscription_id` — set for Pro subscribers only; used to look up subscription
  status if ever needed outside webhook events.
- `season_pass_expires_at` — set only for `starter` (Season Pass); null for every other
  plan. Reuses the same "date-driven downgrade" shape as T-150's `promo_windows` table
  rather than inventing a new pattern. (Every other reference to "plan_expires_at" elsewhere
  in this doc means this column — naming corrected after checking the real schema.)

No changes to the `plan` check constraint. `founding_number` / `founding_number_seq` /
`assign_founding_number()` already exist from T-111 and are called from here, not
redefined.

## Components

### 1. `app/api/stripe/checkout/route.ts`

`POST { plan: 'pro' | 'starter' | 'commissioner' }`

- Auth via `createSSRClient()`, same pattern as every other route in `app/api`.
- Rejects `plan === 'commissioner'` with a clear "Founding 500 is sold out" error if
  `founding_number_seq`'s current value is already ≥ 500 (checked via a read-only query
  before creating the session — the hard enforcement still lives in
  `assign_founding_number()`'s own `raise exception`, this is just an early, friendlier
  check so the user doesn't get to the Stripe payment screen for a plan that will fail at
  the webhook step).
- Looks up or creates a Stripe Customer, storing `stripe_customer_id` on first creation.
- Creates a Checkout Session: `mode: 'subscription'` for `pro`, `mode: 'payment'` for
  `starter`/`commissioner`, using the matching `STRIPE_PRICE_*` env var.
- `success_url` / `cancel_url` point to the new `/upgrade` page with a query param
  (`?checkout=success` / `?checkout=cancelled`) for a one-time confirmation banner.
- Returns `{ url }`; client redirects via `window.location.href`.

### 2. `app/api/stripe/webhook/route.ts`

- Verifies signature with `STRIPE_WEBHOOK_SECRET` (raw body required — Next.js route
  config disables body parsing / uses `req.text()` before `stripe.webhooks.constructEvent`).
- Uses `createAdminClient()` (service-role) since this runs with no authenticated user
  session — same pattern as other server-to-server routes like cron.
- Handles:
  - `checkout.session.completed` — looks up the user by `stripe_customer_id` (falling back
    to `client_reference_id` set at session-creation time to the Supabase user id, for the
    very first checkout before a customer id exists on the user row). Sets `users.plan`
    based on which price was purchased:
    - `pro` → `plan = 'pro'`, `stripe_subscription_id` from the session.
    - `starter` → `plan = 'starter'`, `season_pass_expires_at` = end of current NFL season
      (config value, not hardcoded per-request — see "Season end date" below).
    - `commissioner` → `plan = 'commissioner'`, then calls
      `assign_founding_number(user_id)`. If that raises (race: sold out between the
      early check and webhook), logs to `migration_error_log`'s error table and does
      **not** set `plan = 'commissioner'` — support handles the refund manually. This
      is a rare race (two checkouts completing within the same request window past
      count 500) and is deliberately not automated further here.
  - `customer.subscription.updated` — if `status` moves to `past_due` or `unpaid`,
    no immediate downgrade (grace period, matches Stripe's own dunning emails);
    logged for visibility only. Deliberately not building custom dunning logic this pass.
  - `customer.subscription.deleted` — sets `plan = 'free'`, clears
    `stripe_subscription_id`. This is the cancel path (whether initiated via the Customer
    Portal or the Stripe Dashboard).
- Returns `200` for all handled and explicitly-ignored event types (anything not listed
  above is a no-op 200, not an error — required so Stripe doesn't retry indefinitely).

**Season end date config**: a single `SEASON_END_DATE` constant (or a small config table,
mirroring `promo_windows`) rather than computing it. Default for the 2026 season: **Monday,
February 9, 2027** (day after Super Bowl LXI, Sunday Feb 8, 2027) — confirm this exact date
with the founder during implementation before it ships, since it's an external NFL-schedule
fact (same category as T-150/T-151's dates), not something to guess at design time. If it
changes, it's a one-line constant update, not a design change.

### 3. `app/api/stripe/portal/route.ts`

`POST` (no body) — auth required. Looks up `stripe_customer_id` for the current user
(400 if none exists — you can't manage billing you never started), creates a Stripe
Billing Portal session, returns `{ url }`. Used only by Pro subscribers in practice, but
not gated to `plan === 'pro'` in the route itself — if a user has any `stripe_customer_id`
the portal is meaningful (e.g. viewing past one-time payment receipts too).

### 4. `/upgrade` page (new, `app/(dashboard)/upgrade/page.tsx`)

- Server component reading the current user's `plan` from Supabase.
- Renders the 3 paid tiers as cards (Pro / Season Pass / Founding 500), each with a
  "Choose plan" button that POSTs to `/api/stripe/checkout` and redirects to the returned
  URL. The user's current plan's card is shown as active/disabled instead of clickable.
- Founding 500 card shows remaining count (500 − current `founding_number_seq` value) and
  switches to a disabled "Sold out" state once exhausted.
- Reads `?checkout=success|cancelled` query param for a dismissible confirmation/cancel
  banner at the top.
- Follows existing OS design tokens (void/glass/signal, mono tabular-nums) — same
  conventions as Profile/Settings pages, not the marketing landing page's separate style.

### 5. Profile page update (`app/(dashboard)/profile/page.tsx`)

Replace the current placeholder text ("Billing management arrives with Stripe checkout
(T-85) — nothing to manage yet on the Free plan.") with:
- If `plan === 'free'`: a "View plans" link to `/upgrade`.
- If `plan !== 'free'`: current plan name/badge, plus a "Manage billing" button that POSTs
  to `/api/stripe/portal` and redirects (only shown when `stripe_customer_id` exists —
  i.e. always true once any paid plan is active, since checkout always creates one).

### 6. Expiry enforcement (`lib/usageLimits.ts` or a new `lib/planExpiry.ts`)

- A check, following the same shape as the existing promo-window logic in
  `lib/usageLimits.ts`: on relevant reads (or via the existing cron route in
  `app/api/cron`), if `plan === 'starter'` and `season_pass_expires_at` is in the past, downgrade
  to `plan = 'free'` and clear `season_pass_expires_at`. Exact call site (lazy check-on-read vs.
  a dedicated cron entry) to be decided during implementation planning by following
  whichever existing pattern (`isFreePlan`'s promo-window check, or `app/api/cron`'s
  scheduled jobs) fits with the least new plumbing.

## Error handling

- Webhook signature verification failure → `400`, no processing, logged.
- Checkout route: Stripe API errors (network, invalid price id) → `500` with a generic
  "couldn't start checkout" message to the client; details logged server-side only (no
  Stripe internals leaked to the client).
- Founding 500 race at the webhook step → logged, plan not set to commissioner, no
  customer-facing error (the customer already completed a successful Stripe payment by
  this point — this is a support/refund follow-up, not a user-facing error path).

## Testing

- Webhook handler logic (event → DB state transitions) is unit-testable in isolation by
  constructing fake Stripe event payloads — no real Stripe calls needed for this part.
- Checkout/portal route creation calls Stripe's test-mode API directly (already-configured
  test keys) — verified manually via Stripe's test card numbers
  (`stripe:test-cards` skill) end-to-end: choose plan → Stripe test checkout → webhook
  fires (via `stripe listen` CLI forwarding to local dev) → `users.plan` updates → `/upgrade`
  reflects new plan.
- Founding 500 cap: test by manually advancing `founding_number_seq` in a test environment
  close to 500 and confirming both the early checkout-route check and the webhook's
  `assign_founding_number()` exception path behave as designed.

## Out of scope for this pass

- T-112 marketing landing page pricing section.
- T-151 unified "Upgrade now" gate UI/trigger (this spec only makes `/upgrade` exist for
  it to link to).
- T-137 legal/tax/business items.
- Dunning / failed-payment retry UX beyond Stripe's own default emails.
- Annual billing option for Pro (monthly only, per confirmed pricing).
