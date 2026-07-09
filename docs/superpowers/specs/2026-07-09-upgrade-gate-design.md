# Unified Upgrade Gate Design

## Goal

T-151 (PRD): every Free user gets full Pro depth Sept 7–15, 2026 (Week 1
promo window, T-150), then should hit a single, deliberate "upgrade now"
moment the instant that window ends — not just today's silent per-feature
re-gating. That moment doesn't exist yet.

Separately, today's per-feature gate copy (Draft Copilot, Film Room, live
scores, league cap) is scattered — one-off strings hand-written per call
site, inconsistent tone, and none of them link anywhere. Two gates (Trade
Analyzer and Start/Sit weekly quota) have no upgrade copy at all — a Free
user who exhausts their weekly Claude quota gets a plain deterministic
analysis with zero indication Pro exists.

This spec unifies both: one gate-status system, one copy source, one
reusable nudge component, used everywhere a user hits a Pro boundary.

## Global Constraints

- Voice per `Rostiro_Marketing_System_v1.md` §18 (Founder voice guide):
  direct, honest, fantasy-native, no manufactured urgency, no corporate
  SaaS language ("unlock your potential", "game-changing").
- A paid user (starter/pro/commissioner) is never affected by any of this
  — the gate only ever evaluates for a free-plan user, same invariant
  `isFreePlan` already guarantees.
- The one-time interstitial must never reappear once seen, across
  devices/sessions — this requires a DB-backed flag, not sessionStorage
  (unlike `BootSequence`, which deliberately replays every session).
- No new npm dependencies.
- Existing `lib/usageLimits.ts` (`isFreePlan`, promo window logic) is not
  replaced, only built on top of.

## Section 1: Gate status resolution

New `lib/upgradeGate.ts`:

```ts
type GateState =
  | 'active'              // still inside promo window or personal trial
  | 'just_ended_week1'    // promo window ended, interstitial not yet shown
  | 'just_ended_trial'    // personal fallback trial ended, not yet shown
  | 'gated'               // free, already saw the interstitial
  | 'paid'                // starter/pro/commissioner

async function getGateStatus(admin, userId): Promise<{ state: GateState }>
```

Logic:
- Non-free plan → `paid`.
- Free plan, `isFreePlan` returns false (still active) → `active`.
- Free plan, `isFreePlan` returns true (currently gated):
  - If `users.upgrade_gate_shown_at` is null: determine which variant —
    if `now()` is past the promo window's `ends_at` and the user's
    `created_at` is before/during the window (they experienced the real
    Week 1 window) → `just_ended_week1`. Otherwise (their own
    `trial_ends_at` just passed) → `just_ended_trial`.
  - If `upgrade_gate_shown_at` is already set → `gated`.

## Section 2: Data model

New `supabase/migration_upgrade_gate.sql` (idempotent, matches existing
migration style):

```sql
alter table public.users
  add column if not exists upgrade_gate_shown_at timestamptz;
```

Banner's daily dismissal is NOT stored server-side — kept in
`localStorage` (key `rostiro_upgrade_banner_dismissed`, value = ISO date
string), same precedent as `AppShell.tsx`'s `mode` cache. Low-stakes,
per-device is acceptable, avoids a write on every dismiss.

## Section 3: Copy

New `lib/upgradeCopy.ts` — every string used by every touchpoint below,
so tone changes happen in exactly one file.

**Interstitial — `just_ended_week1` variant:**
- Headline: "Week 1's over. So is the free look."
- Body: "You had the full Pulse all week — live scores, Draft Copilot's
  real reasoning, Film Room recaps, Waiver Day detail, unlimited AI trade
  and start/sit analysis. That's back to Free plan limits now."
- Primary CTA: "Upgrade to Pro — $9.99/mo" → `/upgrade`
- Secondary: "Maybe later" → dismiss

**Interstitial — `just_ended_trial` variant:**
- Headline: "Your free trial just ended."
- Body: "For the last 7 days you had the full Pulse — live scores, Draft
  Copilot's real reasoning, Film Room recaps, Waiver Day detail,
  unlimited AI trade and start/sit analysis. Upgrade to keep it going."
- Same CTAs.

**Persistent banner (`gated` state, not dismissed today):**
- "You're back on Free plan limits. Upgrade to Pro →" + dismiss (✕)

**Per-feature nudges** (keyed lookup, each rendered by `UpgradeNudge`):

| key | copy |
|---|---|
| `live_scores` | "Unlock live scores with Pro →" |
| `draft_copilot` | "Upgrade to Pro for Copilot's full reasoning →" |
| `film_room` | "Unlock the full recap with Pro →" |
| `league_cap` | "Free plan is limited to 1 league. Upgrade to Pro to add more →" |
| `trade_analysis_quota` | "Weekly free trade analyses used. Upgrade to Pro for unlimited →" |
| `start_sit_quota` | "Weekly free start/sit calls used. Upgrade to Pro for unlimited →" |

## Section 4: Components

- `components/upgrade/UpgradeGateInterstitial.tsx` — full-screen overlay,
  mounted once in `AppShell`. Fetches `/api/upgrade-gate/status` on mount;
  renders only when state is `just_ended_week1` or `just_ended_trial`.
  CTA click and "Maybe later" both POST to `/api/upgrade-gate/dismiss`
  before proceeding (CTA navigates to `/upgrade` after).
- `components/upgrade/UpgradeBanner.tsx` — slim banner, also mounted once
  in `AppShell`. Renders when state is `gated` and
  `localStorage['rostiro_upgrade_banner_dismissed']` isn't today's date.
- `components/upgrade/UpgradeNudge.tsx` — `<UpgradeNudge feature="live_scores" />`.
  Looks up copy by key from `lib/upgradeCopy.ts`, renders as a `Link` to
  `/upgrade` in the existing `mono-data text-[10px]` signal-colored style
  already used at each of these call sites today (visual continuity, no
  redesign of the existing card chrome).

## Section 5: API routes

- `GET /api/upgrade-gate/status` — auth required, calls `getGateStatus`,
  returns `{ state }`.
- `POST /api/upgrade-gate/dismiss` — auth required, sets
  `upgrade_gate_shown_at = now()` if not already set. Idempotent.

## Section 6: Touchpoint integration

Existing call sites, switched to `UpgradeNudge`:
- `app/(dashboard)/pulse/page.tsx` — live-score blur nudge, Film Room
  recap-gated nudge
- `components/nav/TickerBar.tsx`, `components/nav/SystemBar.tsx` —
  live-score blur nudges (same `live_scores` key as Pulse, so copy can't
  drift out of sync between the three surfaces)
- `app/api/draft/session/[id]/recommend/route.ts` — server-side fallback
  string, updated to use `lib/upgradeCopy.ts`'s `draft_copilot` copy
  directly (this one is server-rendered text, not a client `UpgradeNudge`
  component, but pulls from the same copy source)
- `components/onboarding/SleeperConnect.tsx` — league-cap message

New nudges added (closing the two silent gaps):
- `app/api/trades/analyze/route.ts` — expose whether the response was
  quota-limited so the client can render the `trade_analysis_quota` nudge
- `app/api/lineup/sleeper/route.ts` — same, `start_sit_quota`

Not touched: Stripe checkout, `lib/resend.ts` email templates, `/pricing`
and `/upgrade` pages — already correct, out of scope.

## Section 7: Rollout note

`upgrade_gate_shown_at` only matters once real users exist past the
window — nothing here is exercisable until Sept 2026 in production, but
the Dev Simulation Suite (`components/admin/SimulationPanel.tsx`) should
get a way to force each `GateState` for pre-launch testing, matching the
existing Film Room/Game Day simulation pattern.
