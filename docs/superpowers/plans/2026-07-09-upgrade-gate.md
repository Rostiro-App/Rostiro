# Unified Upgrade Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the T-151 unified "your Week 1 access just ended, upgrade now" moment, and rebuild every scattered per-feature Pro-upgrade nudge across the app on one shared gate-status resolver, copy source, and reusable component.

**Architecture:** A server-side gate-status resolver (`lib/upgradeGate.ts`) built on the existing `isFreePlan`/promo-window logic, feeding two client surfaces mounted once in `AppShell` (a one-time full-screen interstitial, a persistent daily-dismissible banner) plus a reusable inline `UpgradeNudge` component swapped into six existing per-feature gate points. All copy lives in one file, `lib/upgradeCopy.ts`.

**Tech Stack:** Next.js App Router (route handlers + Server/Client Components), Supabase (Postgres + `@supabase/ssr`), TypeScript, Zod for request validation, Tailwind utility classes + inline style objects (existing codebase convention, no CSS modules).

## Global Constraints

- Voice per `Rostiro_Marketing_System_v1.md` §18: direct, honest, fantasy-native, no manufactured urgency, no corporate SaaS language. Every string used in this plan is copied verbatim from `docs/superpowers/specs/2026-07-09-upgrade-gate-design.md` §3 — do not paraphrase.
- A paid user (`starter`/`pro`/`commissioner`) must never see any gate UI — every new check gates on `isFreePlan` returning `true`, the same invariant every existing plan check in this codebase already relies on.
- The one-time interstitial is tracked via a DB column (`users.upgrade_gate_shown_at`), never sessionStorage/localStorage — it must never reappear across devices or sessions once seen.
- No new npm dependencies.
- **No test framework exists in this codebase** (`package.json` has no `test` script, no jest/vitest, no `__tests__` anywhere). This codebase's established verification convention (see any recent PRD changelog entry, e.g. T-150/T-152) is: `npx tsc --noEmit`, `npx eslint <changed files>`, then live functional verification via `curl` or the running dev server — not unit tests. Every task below follows that convention instead of writing test files.
- Fail-open on any metering/DB error — same posture as every existing gate in `lib/usageLimits.ts`: a broken gate-status check must never block a working feature, it should just render nothing extra.
- Follow existing style conventions exactly: inline `style={{ }}` objects using CSS custom properties (`var(--signal)`, `var(--t2)`, `var(--hairline)`, etc.), `mono-data` class on data/label text, no new colors invented.

---

### Task 1: Migration — `upgrade_gate_shown_at` column

**Files:**
- Create: `supabase/migration_upgrade_gate.sql`

**Interfaces:**
- Produces: `public.users.upgrade_gate_shown_at` (nullable `timestamptz`), read/written by `lib/upgradeGate.ts` (Task 3) and `app/api/upgrade-gate/dismiss/route.ts` (Task 4).

- [ ] **Step 1: Write the migration**

```sql
-- Upgrade Gate (T-151): tracks whether a free-plan user has already seen
-- the one-time full-screen "your Week 1 access just ended" / "your trial
-- just ended" interstitial. Must be DB-backed, not sessionStorage — once
-- shown, it must never reappear on a different device or a later session.
-- Idempotent; safe to re-run.

alter table public.users
  add column if not exists upgrade_gate_shown_at timestamptz;
```

- [ ] **Step 2: Run it against the real Supabase project**

Run in the Supabase SQL editor (same manual-run convention every other
`migration_*.sql` in this repo uses — there is no local migration runner).
Confirm with:

```sql
select column_name, data_type from information_schema.columns
where table_name = 'users' and column_name = 'upgrade_gate_shown_at';
```

Expected: one row, `upgrade_gate_shown_at | timestamp with time zone`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migration_upgrade_gate.sql
git commit -m "feat(upgrade-gate): add users.upgrade_gate_shown_at column"
```

---

### Task 2: `lib/upgradeCopy.ts` — copy source

**Files:**
- Create: `lib/upgradeCopy.ts`

**Interfaces:**
- Produces: `UPGRADE_COPY` object, `NudgeKey` type, `interstitialCopy(variant)` function — consumed by Tasks 3, 5, 6, 7, and every touchpoint task (9–14).

- [ ] **Step 1: Write the file**

```ts
// lib/upgradeCopy.ts
//
// T-151: single source of every upgrade-gate string in the app — the
// one-time interstitial, the persistent banner, and every per-feature
// inline nudge. Before this file, each of those was a hand-written
// one-off string at its own call site (Draft Copilot's recommend route,
// Film Room's card, the league-cap message, etc.) — inconsistent tone,
// no shared source, and several had no upgrade copy at all. Voice per
// Rostiro_Marketing_System_v1.md §18: direct, honest, no manufactured
// urgency, no corporate SaaS language.

export type NudgeKey =
  | 'live_scores'
  | 'draft_copilot'
  | 'film_room'
  | 'league_cap'
  | 'trade_analysis_quota'
  | 'start_sit_quota'

export const NUDGE_COPY: Record<NudgeKey, string> = {
  live_scores: 'Unlock live scores with Pro',
  draft_copilot: "Upgrade to Pro for Copilot's full reasoning",
  film_room: 'Unlock the full recap with Pro',
  league_cap: 'Free plan is limited to 1 league. Upgrade to Pro to add more',
  trade_analysis_quota: 'Weekly free trade analyses used. Upgrade to Pro for unlimited',
  start_sit_quota: 'Weekly free start/sit calls used. Upgrade to Pro for unlimited',
}

export type InterstitialVariant = 'just_ended_week1' | 'just_ended_trial'

interface InterstitialCopy {
  headline: string
  body: string
  primaryCta: string
  secondaryCta: string
}

export function interstitialCopy(variant: InterstitialVariant): InterstitialCopy {
  if (variant === 'just_ended_week1') {
    return {
      headline: "Week 1's over. So is the free look.",
      body: "You had the full Pulse all week — live scores, Draft Copilot's real reasoning, Film Room recaps, Waiver Day detail, unlimited AI trade and start/sit analysis. That's back to Free plan limits now.",
      primaryCta: 'Upgrade to Pro — $9.99/mo',
      secondaryCta: 'Maybe later',
    }
  }
  return {
    headline: 'Your free trial just ended.',
    body: "For the last 7 days you had the full Pulse — live scores, Draft Copilot's real reasoning, Film Room recaps, Waiver Day detail, unlimited AI trade and start/sit analysis. Upgrade to keep it going.",
    primaryCta: 'Upgrade to Pro — $9.99/mo',
    secondaryCta: 'Maybe later',
  }
}

export const BANNER_COPY = "You're back on Free plan limits."
export const BANNER_CTA = 'Upgrade to Pro'
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors (this file has no dependents yet, so this only confirms the file itself is syntactically/type valid).

- [ ] **Step 3: Commit**

```bash
git add lib/upgradeCopy.ts
git commit -m "feat(upgrade-gate): add shared copy source"
```

---

### Task 3: `lib/upgradeGate.ts` — gate status resolver

**Files:**
- Create: `lib/upgradeGate.ts`

**Interfaces:**
- Consumes: `isFreePlan(admin, userId)` from `lib/usageLimits.ts` (existing, unchanged).
- Produces: `type GateState = 'active' | 'just_ended_week1' | 'just_ended_trial' | 'gated' | 'paid'`, `getGateStatus(admin, userId): Promise<{ state: GateState }>` — consumed by `app/api/upgrade-gate/status/route.ts` (Task 4).

- [ ] **Step 1: Write the file**

```ts
// lib/upgradeGate.ts
//
// T-151: resolves which upgrade-gate UI (if any) a user should see right
// now. Built on top of lib/usageLimits.ts's isFreePlan — that function
// already knows "is this user currently gated," this module only adds
// "...and have they already seen the one-time interstitial about it."
//
// A user can be gated for two different reasons (T-150): the global,
// season-anchored Week 1 promo window ended, or their own personal
// fallback trial (for a late signup who joined after the window already
// closed) ended. The interstitial copy differs by which one applies
// (lib/upgradeCopy.ts), so this module also determines which variant.

import type { SupabaseClient } from '@supabase/supabase-js'
import { isFreePlan } from '@/lib/usageLimits'

export type GateState = 'active' | 'just_ended_week1' | 'just_ended_trial' | 'gated' | 'paid'

type AdminClient = Pick<SupabaseClient, 'from'>

interface UserRow {
  plan: string
  created_at: string | null
  trial_ends_at: string | null
  upgrade_gate_shown_at: string | null
}

interface PromoWindowRow {
  starts_at: string | null
  ends_at: string | null
}

export async function getGateStatus(admin: AdminClient, userId: string): Promise<{ state: GateState }> {
  const { data: userRow } = await admin
    .from('users')
    .select('plan, created_at, trial_ends_at, upgrade_gate_shown_at')
    .eq('id', userId)
    .maybeSingle()

  const row = userRow as UserRow | null
  const plan = row?.plan ?? 'free'
  if (plan !== 'free') return { state: 'paid' }

  const free = await isFreePlan(admin, userId)
  if (!free) return { state: 'active' }

  // Already gated. If the interstitial was already shown, nothing more
  // to decide — the persistent banner (a separate, client-side check)
  // takes over from here.
  if (row?.upgrade_gate_shown_at) return { state: 'gated' }

  // Not yet shown — figure out which variant. A user who signed up
  // before/during the real Week 1 promo window relies on that window
  // (T-150's primary mechanic); a user who signed up after it already
  // ended gets their own personal fallback trial instead. Same
  // before/after test T-150's isFreePlan already uses internally.
  const { data: promoRow } = await admin.from('promo_windows').select('starts_at, ends_at').eq('id', 1).maybeSingle()
  const promo = promoRow as PromoWindowRow | null
  const promoEndsAt = promo?.ends_at ? new Date(promo.ends_at) : null

  if (promoEndsAt && row?.created_at && new Date(row.created_at) <= promoEndsAt) {
    return { state: 'just_ended_week1' }
  }
  return { state: 'just_ended_trial' }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npx eslint lib/upgradeGate.ts`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/upgradeGate.ts
git commit -m "feat(upgrade-gate): add gate status resolver"
```

---

### Task 4: API routes — status and dismiss

**Files:**
- Create: `app/api/upgrade-gate/status/route.ts`
- Create: `app/api/upgrade-gate/dismiss/route.ts`

**Interfaces:**
- Consumes: `getGateStatus` (Task 3), `createSSRClient`/`createAdminClient` from `lib/supabase.ts`.
- Produces: `GET /api/upgrade-gate/status` → `{ state: GateState }`; `POST /api/upgrade-gate/dismiss` → `{ ok: true }`. Consumed by `UpgradeGateInterstitial`/`UpgradeBanner` (Tasks 6, 7).

- [ ] **Step 1: Write the status route**

```ts
// app/api/upgrade-gate/status/route.ts
import { createSSRClient, createAdminClient } from '@/lib/supabase'
import { getGateStatus } from '@/lib/upgradeGate'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  // Fail open — same posture as every other gate check in this codebase;
  // a broken status lookup should render no gate UI, never crash the shell.
  const { state } = await getGateStatus(admin, user.id).catch(() => ({ state: 'active' as const }))
  return NextResponse.json({ state })
}
```

- [ ] **Step 2: Write the dismiss route**

```ts
// app/api/upgrade-gate/dismiss/route.ts
import { createSSRClient, createAdminClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createSSRClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  // Idempotent: only ever sets it once. A second dismiss call (e.g. a
  // retried request) must never overwrite the original timestamp.
  const { data: existing } = await admin.from('users').select('upgrade_gate_shown_at').eq('id', user.id).maybeSingle()
  if (!existing?.upgrade_gate_shown_at) {
    await admin.from('users').update({ upgrade_gate_shown_at: new Date().toISOString() }).eq('id', user.id)
  }
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint app/api/upgrade-gate/status/route.ts app/api/upgrade-gate/dismiss/route.ts`
Expected: no errors.

- [ ] **Step 4: Manual verification against the real dev server**

```bash
npm run dev &
sleep 4
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/upgrade-gate/status
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/upgrade-gate/dismiss
```

Expected: both return `401` (no session cookie in a bare curl call) — confirms the auth guard works. Full behavior (a real `200` with a real state) is verified end-to-end in Task 8 once the components exist and can be exercised through a real logged-in browser session.

- [ ] **Step 5: Commit**

```bash
git add app/api/upgrade-gate
git commit -m "feat(upgrade-gate): add status and dismiss API routes"
```

---

### Task 5: `components/upgrade/UpgradeNudge.tsx` — reusable inline nudge

**Files:**
- Create: `components/upgrade/UpgradeNudge.tsx`

**Interfaces:**
- Consumes: `NUDGE_COPY`, `NudgeKey` from `lib/upgradeCopy.ts` (Task 2).
- Produces: `<UpgradeNudge feature={NudgeKey} />` — consumed by Tasks 9, 12, 13, 14.

- [ ] **Step 1: Write the component**

```tsx
// components/upgrade/UpgradeNudge.tsx
//
// T-151: the one reusable inline "you're hitting a Pro boundary" nudge —
// replaces six previously-scattered one-off strings (Pulse's live-score
// blur, Film Room's recap-gated line, the league-cap message, Draft
// Copilot's fallback text, and two that had no nudge at all: Trade
// Analyzer and Start/Sit quota-exceeded). Every instance now pulls from
// lib/upgradeCopy.ts and links to /upgrade — none of the originals linked
// anywhere.

'use client'

import Link from 'next/link'
import { NUDGE_COPY, type NudgeKey } from '@/lib/upgradeCopy'

export default function UpgradeNudge({ feature }: { feature: NudgeKey }) {
  return (
    <Link
      href="/upgrade"
      className="mono-data text-[10px] mt-1.5 inline-block hover:underline"
      style={{ color: 'var(--signal)' }}
    >
      {NUDGE_COPY[feature]} →
    </Link>
  )
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint components/upgrade/UpgradeNudge.tsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/upgrade/UpgradeNudge.tsx
git commit -m "feat(upgrade-gate): add reusable UpgradeNudge component"
```

---

### Task 6: `components/upgrade/UpgradeGateInterstitial.tsx` — one-time full-screen moment

**Files:**
- Create: `components/upgrade/UpgradeGateInterstitial.tsx`

**Interfaces:**
- Consumes: `GET /api/upgrade-gate/status`, `POST /api/upgrade-gate/dismiss` (Task 4); `interstitialCopy` from `lib/upgradeCopy.ts` (Task 2).
- Produces: `<UpgradeGateInterstitial />` (no props) — mounted in `AppShell` (Task 8).

- [ ] **Step 1: Write the component**

```tsx
// components/upgrade/UpgradeGateInterstitial.tsx
//
// T-151: the one-time, full-screen "your Week 1 access just ended" /
// "your trial just ended" moment. Mounted once in AppShell, same as
// BootSequence — but unlike BootSequence (deliberately replays every
// session), this must never reappear once dismissed, so it's gated by
// the server-side upgrade_gate_shown_at column, not sessionStorage.

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { interstitialCopy, type InterstitialVariant } from '@/lib/upgradeCopy'

type Status = 'loading' | 'hidden' | InterstitialVariant

export default function UpgradeGateInterstitial() {
  const [status, setStatus] = useState<Status>('loading')
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    fetch('/api/upgrade-gate/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { state?: string } | null) => {
        if (cancelled) return
        if (data?.state === 'just_ended_week1' || data?.state === 'just_ended_trial') {
          setStatus(data.state)
        } else {
          setStatus('hidden')
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('hidden')
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function dismiss() {
    setStatus('hidden')
    try {
      await fetch('/api/upgrade-gate/dismiss', { method: 'POST' })
    } catch {
      // Best-effort — worst case the interstitial reappears once more on
      // a later session, never worse than that.
    }
  }

  if (status === 'loading' || status === 'hidden') return null

  const copy = interstitialCopy(status)

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(3, 7, 13, 0.85)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="w-full max-w-sm rounded-xl p-6 text-center"
        style={{ backgroundColor: 'var(--glass-solid)', border: '1px solid var(--hairline)' }}
      >
        <h2 className="text-lg font-semibold text-white mb-3">{copy.headline}</h2>
        <p className="text-sm mb-5" style={{ color: 'var(--t2)' }}>{copy.body}</p>
        <button
          type="button"
          onClick={async () => {
            await dismiss()
            router.push('/upgrade')
          }}
          className="w-full font-semibold py-2.5 rounded-lg text-sm text-white hover:brightness-110"
          style={{ backgroundColor: 'var(--signal)' }}
        >
          {copy.primaryCta}
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="w-full mt-2 text-sm py-2"
          style={{ color: 'var(--t3)' }}
        >
          {copy.secondaryCta}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint components/upgrade/UpgradeGateInterstitial.tsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/upgrade/UpgradeGateInterstitial.tsx
git commit -m "feat(upgrade-gate): add one-time full-screen interstitial"
```

---

### Task 7: `components/upgrade/UpgradeBanner.tsx` — persistent daily-dismissible banner

**Files:**
- Create: `components/upgrade/UpgradeBanner.tsx`

**Interfaces:**
- Consumes: `GET /api/upgrade-gate/status` (Task 4); `BANNER_COPY`, `BANNER_CTA` from `lib/upgradeCopy.ts` (Task 2).
- Produces: `<UpgradeBanner />` (no props) — mounted in `AppShell` (Task 8).

- [ ] **Step 1: Write the component**

```tsx
// components/upgrade/UpgradeBanner.tsx
//
// T-151: the ongoing reminder that takes over after the one-time
// interstitial (UpgradeGateInterstitial) has been dismissed. Deliberately
// NOT DB-backed for its own dismissal state — a per-day dismiss is
// low-stakes enough that localStorage (same precedent as AppShell.tsx's
// `mode` cache) is the right call; the interstitial's one-time-ever
// state is the one that has to be DB-backed, not this.

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BANNER_COPY, BANNER_CTA } from '@/lib/upgradeCopy'

const DISMISS_KEY = 'rostiro_upgrade_banner_dismissed'

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function UpgradeBanner() {
  const [gated, setGated] = useState(false)
  const [dismissedToday, setDismissedToday] = useState(true)

  useEffect(() => {
    setDismissedToday(localStorage.getItem(DISMISS_KEY) === todayKey())
    let cancelled = false
    fetch('/api/upgrade-gate/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { state?: string } | null) => {
        if (!cancelled) setGated(data?.state === 'gated')
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!gated || dismissedToday) return null

  return (
    <div
      className="flex items-center justify-center gap-3 px-3 py-1.5 flex-shrink-0"
      style={{ backgroundColor: 'rgba(75,163,245,0.08)', borderBottom: '1px solid rgba(75,163,245,0.3)' }}
    >
      <span className="text-xs" style={{ color: 'var(--t1)' }}>{BANNER_COPY}</span>
      <Link href="/upgrade" className="text-xs font-semibold hover:underline" style={{ color: 'var(--signal)' }}>
        {BANNER_CTA} →
      </Link>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, todayKey())
          setDismissedToday(true)
        }}
        className="text-xs ml-1"
        style={{ color: 'var(--t3)' }}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint components/upgrade/UpgradeBanner.tsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/upgrade/UpgradeBanner.tsx
git commit -m "feat(upgrade-gate): add persistent daily-dismissible banner"
```

---

### Task 8: Mount both in `AppShell.tsx`

**Files:**
- Modify: `components/nav/AppShell.tsx`

**Interfaces:**
- Consumes: `UpgradeGateInterstitial` (Task 6), `UpgradeBanner` (Task 7).

- [ ] **Step 1: Add the imports**

In `components/nav/AppShell.tsx`, alongside the existing component imports near the top:

```tsx
import BootSequence from '@/components/BootSequence'
import LiveUnlockAnnouncement from '@/components/LiveUnlockAnnouncement'
import HintProvider from '@/components/hints/HintProvider'
import UpgradeGateInterstitial from '@/components/upgrade/UpgradeGateInterstitial'
import UpgradeBanner from '@/components/upgrade/UpgradeBanner'
```

- [ ] **Step 2: Mount the interstitial next to BootSequence**

Find:
```tsx
        {/* T-72: plays once per tab session, above everything else. */}
        <BootSequence />
```

Replace with:
```tsx
        {/* T-72: plays once per tab session, above everything else. */}
        <BootSequence />

        {/* T-151: one-time full-screen "your access just ended" moment —
            same full-screen layer as BootSequence, but gated by a DB flag
            (never sessionStorage) since it must never repeat. */}
        <UpgradeGateInterstitial />
```

- [ ] **Step 3: Mount the banner right after SystemBar**

Find:
```tsx
        {/* T-67: OS Shell system bar — full width, above everything, both
            breakpoints. */}
        <SystemBar mode={mode} onModeChange={handleModeChange} />
```

Replace with:
```tsx
        {/* T-67: OS Shell system bar — full width, above everything, both
            breakpoints. */}
        <SystemBar mode={mode} onModeChange={handleModeChange} />

        {/* T-151: persistent reminder for a free user who already saw the
            interstitial — dismissible per day, never blocks navigation. */}
        <UpgradeBanner />
```

- [ ] **Step 4: Typecheck, lint, build**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint components/nav/AppShell.tsx && npx next build`
Expected: all clean, build succeeds.

- [ ] **Step 5: Manual end-to-end verification**

```bash
npm run dev &
sleep 4
```

In a browser, log in as a real free-plan test account. Confirm:
- If `upgrade_gate_shown_at` is null and the account is currently gated (set this up via a past-dated `promo_windows` row through the existing Simulation Panel's "Promo Window" section, or direct SQL for a quick check), the full-screen interstitial appears on load.
- Clicking "Upgrade to Pro" navigates to `/upgrade` and the interstitial never reappears on reload.
- After dismissal, the slim banner appears at the top of the app shell; clicking ✕ hides it, and it stays hidden on reload today, but check `localStorage.getItem('rostiro_upgrade_banner_dismissed')` in devtools shows today's date.

- [ ] **Step 6: Commit**

```bash
git add components/nav/AppShell.tsx
git commit -m "feat(upgrade-gate): mount interstitial and banner in AppShell"
```

---

### Task 9: Swap Pulse page's live-score and Film Room nudges onto `UpgradeNudge`

**Files:**
- Modify: `app/(dashboard)/pulse/page.tsx`

**Interfaces:**
- Consumes: `UpgradeNudge` (Task 5).

- [ ] **Step 1: Add the import**

Near the top of `app/(dashboard)/pulse/page.tsx`, alongside the other component imports:

```tsx
import UpgradeNudge from '@/components/upgrade/UpgradeNudge'
```

- [ ] **Step 2: Replace the live-score gated line**

Find (in the live matchups block):
```tsx
          {scoresGated && (
            <p className="mono-data text-[10px] mt-2" style={{ color: 'var(--signal)' }}>
              Unlock live scores with Pro
            </p>
          )}
```

Replace with:
```tsx
          {scoresGated && <UpgradeNudge feature="live_scores" />}
```

- [ ] **Step 3: Replace the Film Room recap-gated line**

Find:
```tsx
                {r.recapGated && (
                  <p className="mono-data text-[10px] mt-1.5" style={{ color: 'var(--signal)' }}>
                    Unlock the full recap with Pro
                  </p>
                )}
```

Replace with:
```tsx
                {r.recapGated && <UpgradeNudge feature="film_room" />}
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint "app/(dashboard)/pulse/page.tsx"`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/pulse/page.tsx"
git commit -m "feat(upgrade-gate): use shared UpgradeNudge for Pulse's live-score and Film Room gates"
```

---

### Task 10: TickerBar and SystemBar — shared copy for live-score gates

**Files:**
- Modify: `components/nav/TickerBar.tsx`
- Modify: `components/nav/SystemBar.tsx`

**Interfaces:**
- Consumes: `NUDGE_COPY` from `lib/upgradeCopy.ts` (Task 2).

TickerBar's gated segment is a plain uppercase `<span>` inside an
auto-scrolling marquee — every other segment in it is plain text, so
wrapping just this one in a link would be an inconsistent, easy-to-mis-tap
target inside scrolling content. It stays plain text, but now pulled from
the shared copy source instead of a second hand-written string.
SystemBar's "PRO" badge, by contrast, is already a small, static, isolated
chip — a natural tap target — so it becomes a real link.

- [ ] **Step 1: TickerBar — import the copy and use it**

In `components/nav/TickerBar.tsx`, add the import alongside existing ones:

```tsx
import { NUDGE_COPY } from '@/lib/upgradeCopy'
```

Find:
```tsx
        <span key="gated-tail" style={{ color: 'var(--signal)' }}>
          UNLOCK LIVE SCORES WITH PRO
        </span>
      )
    }
```

Replace with:
```tsx
        <span key="gated-tail" style={{ color: 'var(--signal)' }}>
          {NUDGE_COPY.live_scores.toUpperCase()}
        </span>
      )
    }
```

- [ ] **Step 2: SystemBar — make the PRO badge a link**

In `components/nav/SystemBar.tsx`, add the import:

```tsx
import Link from 'next/link'
```

Find (appears twice, once in `LiveScoreBadge`, once in `LiveMatchupBadge`):
```tsx
      {gated && (
        <span
          className="text-[8.5px] font-bold tracking-[0.12em] px-1 rounded flex-shrink-0"
          style={{ color: 'var(--signal)', border: '1px solid rgba(75,163,245,0.45)' }}
        >
          PRO
        </span>
      )}
```

Replace **both** occurrences with:
```tsx
      {gated && (
        <Link
          href="/upgrade"
          className="text-[8.5px] font-bold tracking-[0.12em] px-1 rounded flex-shrink-0 hover:brightness-125"
          style={{ color: 'var(--signal)', border: '1px solid rgba(75,163,245,0.45)' }}
        >
          PRO
        </Link>
      )}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint components/nav/TickerBar.tsx components/nav/SystemBar.tsx`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/nav/TickerBar.tsx components/nav/SystemBar.tsx
git commit -m "feat(upgrade-gate): share live-score gate copy, link SystemBar's PRO badge"
```

---

### Task 11: Draft Copilot recommend route — shared copy

**Files:**
- Modify: `app/api/draft/session/[id]/recommend/route.ts`

**Interfaces:**
- Consumes: `NUDGE_COPY` from `lib/upgradeCopy.ts` (Task 2).

- [ ] **Step 1: Add the import**

```ts
import { NUDGE_COPY } from '@/lib/upgradeCopy'
```

- [ ] **Step 2: Replace the hand-written fallback strings**

Find:
```ts
  if (isFree) {
    const recommendations: DraftPickRecommendation[] = parsed.data.candidates.map((c) => ({
      playerId: c.playerId,
      reasoning: c.isNeeded
        ? `ADP ${Math.round(c.adp)} — fills an open roster need. Upgrade to Pro for Copilot's full pre-fetched reasoning.`
        : `ADP ${Math.round(c.adp)} — best remaining value. Upgrade to Pro for Copilot's full pre-fetched reasoning.`,
    }))
    return NextResponse.json({ recommendations })
  }
```

Replace with:
```ts
  if (isFree) {
    const recommendations: DraftPickRecommendation[] = parsed.data.candidates.map((c) => ({
      playerId: c.playerId,
      reasoning: c.isNeeded
        ? `ADP ${Math.round(c.adp)} — fills an open roster need. ${NUDGE_COPY.draft_copilot}.`
        : `ADP ${Math.round(c.adp)} — best remaining value. ${NUDGE_COPY.draft_copilot}.`,
    }))
    return NextResponse.json({ recommendations })
  }
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint "app/api/draft/session/[id]/recommend/route.ts"`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/api/draft/session/[id]/recommend/route.ts"
git commit -m "feat(upgrade-gate): use shared copy for Draft Copilot's Free fallback"
```

---

### Task 12: SleeperConnect league-cap message — shared copy and link

**Files:**
- Modify: `components/onboarding/SleeperConnect.tsx`

**Interfaces:**
- Consumes: `NUDGE_COPY` from `lib/upgradeCopy.ts` (Task 2).

- [ ] **Step 1: Add imports**

```tsx
import Link from 'next/link'
import { NUDGE_COPY } from '@/lib/upgradeCopy'
```

- [ ] **Step 2: Replace the message**

Find:
```tsx
      {skippedForPlan > 0 && (
        <div className="mt-4 rounded-lg px-3 py-2.5" style={{ backgroundColor: 'rgba(75,163,245,0.08)', border: '1px solid rgba(75,163,245,0.3)' }}>
          <p className="text-sm" style={{ color: 'var(--t1)' }}>
            {connectedCount > 0
              ? `Connected ${connectedCount} league${connectedCount !== 1 ? 's' : ''} — Free plan is limited to 1. `
              : `You're already at your Free plan limit (1 league) — `}
            {skippedForPlan} other{skippedForPlan !== 1 ? 's were' : ' was'} not connected. Upgrade to Pro to add {skippedForPlan !== 1 ? 'them' : 'it'}.
          </p>
```

Replace with:
```tsx
      {skippedForPlan > 0 && (
        <div className="mt-4 rounded-lg px-3 py-2.5" style={{ backgroundColor: 'rgba(75,163,245,0.08)', border: '1px solid rgba(75,163,245,0.3)' }}>
          <p className="text-sm" style={{ color: 'var(--t1)' }}>
            {connectedCount > 0
              ? `Connected ${connectedCount} league${connectedCount !== 1 ? 's' : ''} — `
              : `You're already at your Free plan limit (1 league) — `}
            {skippedForPlan} other{skippedForPlan !== 1 ? 's were' : ' was'} not connected.{' '}
            <Link href="/upgrade" className="font-semibold hover:underline" style={{ color: 'var(--signal)' }}>
              {NUDGE_COPY.league_cap} →
            </Link>
          </p>
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint components/onboarding/SleeperConnect.tsx`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/onboarding/SleeperConnect.tsx
git commit -m "feat(upgrade-gate): link SleeperConnect's league-cap message to /upgrade"
```

---

### Task 13: Trade Analyzer quota nudge (closes a silent gap)

**Files:**
- Modify: `types/index.ts` — add `quotaExceeded` to `TradeAnalysis`
- Modify: `app/api/trades/analyze/route.ts`
- Modify: `app/(dashboard)/trades/page.tsx`

**Interfaces:**
- Consumes: `UpgradeNudge` (Task 5).
- Produces: `TradeAnalysis.quotaExceeded: boolean` — a new field every consumer of this type must account for.

- [ ] **Step 1: Add the field to the type**

In `types/index.ts`, find:
```ts
export interface TradeAnalysis {
  verdict: 'win' | 'lose' | 'even'
  confidence: Confidence
  reasoning: string
  rosValueComparison: string
  rosterImpact: string
}
```

Replace with:
```ts
export interface TradeAnalysis {
  verdict: 'win' | 'lose' | 'even'
  confidence: Confidence
  reasoning: string
  rosValueComparison: string
  rosterImpact: string
  // T-151: true when this reasoning is the plain ADP fallback because the
  // user's weekly free Claude quota was already used, not because Claude
  // itself failed — lets the client show an upgrade nudge specifically
  // for "you're out of free analyses," distinct from a generic error.
  quotaExceeded: boolean
}
```

- [ ] **Step 2: Set the field in the route**

In `app/api/trades/analyze/route.ts`, find:
```ts
  const analysis: TradeAnalysis = { verdict, confidence, reasoning, rosValueComparison, rosterImpact }
  return NextResponse.json({ analysis })
```

Replace with:
```ts
  const analysis: TradeAnalysis = { verdict, confidence, reasoning, rosValueComparison, rosterImpact, quotaExceeded: !withinQuota }
  return NextResponse.json({ analysis })
```

- [ ] **Step 3: Render the nudge in the client**

In `app/(dashboard)/trades/page.tsx`, add the import:

```tsx
import UpgradeNudge from '@/components/upgrade/UpgradeNudge'
```

Find:
```tsx
      <p className="text-sm mb-3" style={{ color: 'var(--t2)' }}>{analysis.reasoning}</p>
      {showDetail && (
```

Replace with:
```tsx
      <p className="text-sm mb-3" style={{ color: 'var(--t2)' }}>{analysis.reasoning}</p>
      {analysis.quotaExceeded && <UpgradeNudge feature="trade_analysis_quota" />}
      {showDetail && (
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint app/api/trades/analyze/route.ts "app/(dashboard)/trades/page.tsx" types/index.ts`
Expected: no errors. If `tsc` reports other call sites constructing a `TradeAnalysis` object literal without `quotaExceeded`, add `quotaExceeded: false` there too — grep first to check:

```bash
grep -rn "TradeAnalysis = {" app lib | grep -v node_modules
```

Expected: only the one call site touched in Step 2. If more exist, fix each the same way before proceeding.

- [ ] **Step 5: Commit**

```bash
git add types/index.ts app/api/trades/analyze/route.ts "app/(dashboard)/trades/page.tsx"
git commit -m "feat(upgrade-gate): surface upgrade nudge when Trade Analyzer quota is exceeded"
```

---

### Task 14: Start/Sit quota nudge (closes a silent gap)

**Files:**
- Modify: `types/index.ts` — add `quotaExceeded` to `StartSitRecommendation`
- Modify: `app/api/lineup/sleeper/route.ts`
- Modify: `app/(dashboard)/lineup/page.tsx`

**Interfaces:**
- Consumes: `UpgradeNudge` (Task 5).
- Produces: `StartSitRecommendation.quotaExceeded: boolean`.

- [ ] **Step 1: Add the field to the type**

In `types/index.ts`, find:
```ts
export interface StartSitRecommendation {
  leagueId: string
  leagueName: string
  platform: Platform
  playerA: Player
  playerB: Player
  verdict: 'start_a' | 'start_b' | 'lean_a' | 'lean_b' | 'toss_up'
  confidence: Confidence
  reasoning: string
}
```

Replace with:
```ts
export interface StartSitRecommendation {
  leagueId: string
  leagueName: string
  platform: Platform
  playerA: Player
  playerB: Player
  verdict: 'start_a' | 'start_b' | 'lean_a' | 'lean_b' | 'toss_up'
  confidence: Confidence
  reasoning: string
  // T-151: same reasoning as TradeAnalysis.quotaExceeded — true only when
  // the weekly free quota, not a Claude failure, is why this is the plain
  // ADP-gap sentence instead of the full written explanation.
  quotaExceeded: boolean
}
```

- [ ] **Step 2: Set the field in the route**

In `app/api/lineup/sleeper/route.ts`, find:
```ts
    recommendations.push({
      leagueId: league.id,
      leagueName: league.league_name,
      platform: PLATFORM,
      playerA: toPlayer(c.starter),
      playerB: toPlayer(c.bench),
      verdict,
      confidence,
      reasoning,
    })
```

Replace with:
```ts
    recommendations.push({
      leagueId: league.id,
      leagueName: league.league_name,
      platform: PLATFORM,
      playerA: toPlayer(c.starter),
      playerB: toPlayer(c.bench),
      verdict,
      confidence,
      reasoning,
      quotaExceeded: !withinQuota,
    })
```

- [ ] **Step 3: Render the nudge in the client**

In `app/(dashboard)/lineup/page.tsx`, add the import:

```tsx
import UpgradeNudge from '@/components/upgrade/UpgradeNudge'
```

Find:
```tsx
      <p className="text-sm" style={{ color: 'var(--t2)' }}>{rec.reasoning}</p>

      {mode === 'savant' && (
```

Replace with:
```tsx
      <p className="text-sm" style={{ color: 'var(--t2)' }}>{rec.reasoning}</p>
      {rec.quotaExceeded && <UpgradeNudge feature="start_sit_quota" />}

      {mode === 'savant' && (
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint app/api/lineup/sleeper/route.ts "app/(dashboard)/lineup/page.tsx" types/index.ts`
Expected: no errors. Same cross-check as Task 13:

```bash
grep -rn "StartSitRecommendation" app lib | grep -v node_modules | grep -v "type StartSitRecommendation\|import.*StartSitRecommendation"
```

Confirm no other object literal constructs this type without `quotaExceeded`.

- [ ] **Step 5: Commit**

```bash
git add types/index.ts app/api/lineup/sleeper/route.ts "app/(dashboard)/lineup/page.tsx"
git commit -m "feat(upgrade-gate): surface upgrade nudge when Start/Sit quota is exceeded"
```

---

### Task 15: Admin Simulation Panel — replay the interstitial

**Files:**
- Modify: `app/api/admin/simulate/route.ts`
- Modify: `components/admin/SimulationPanel.tsx`

**Interfaces:**
- Produces: new admin action `reset_upgrade_gate` — nulls the founder test account's `upgrade_gate_shown_at` so the interstitial can be re-triggered during manual QA (Task 8's manual verification step, and all future pre-launch testing — the DB flag that makes it "one-time-ever" would otherwise make it untestable more than once per test account).

Adding a full "force each of the 5 GateStates" control was considered
(per the design spec's Section 7 note) but is unnecessary: every state
except the two "just_ended_*" ones is already directly reachable through
existing panel controls (`force_plan` for `paid`/`active`, `set_promo_window`
with a past `endsAt` for `gated`). The one thing genuinely missing is a way
to re-arm the one-time interstitial after it fires once — that's the only
new control this task adds.

- [ ] **Step 1: Add the action to the API route**

In `app/api/admin/simulate/route.ts`, find:
```ts
      case 'clear_promo_window': {
        await admin.from('promo_windows').update({ starts_at: null, ends_at: null, updated_at: new Date().toISOString() }).eq('id', 1)
        return NextResponse.json({ ok: true })
      }
      default:
        return NextResponse.json({ error: 'action must be one of set_time, force_state, force_plan, run_scenario, clear, set_promo_window, clear_promo_window' }, { status: 400 })
```

Replace with:
```ts
      case 'clear_promo_window': {
        await admin.from('promo_windows').update({ starts_at: null, ends_at: null, updated_at: new Date().toISOString() }).eq('id', 1)
        return NextResponse.json({ ok: true })
      }
      case 'reset_upgrade_gate': {
        // T-151: re-arms the one-time interstitial for the founder's own
        // test account, so it can be seen again during manual QA — the
        // DB-backed "shown once ever" flag is correct for production but
        // would otherwise make this untestable more than once.
        await admin.from('users').update({ upgrade_gate_shown_at: null }).eq('id', user.id)
        return NextResponse.json({ ok: true })
      }
      default:
        return NextResponse.json({ error: 'action must be one of set_time, force_state, force_plan, run_scenario, clear, set_promo_window, clear_promo_window, reset_upgrade_gate' }, { status: 400 })
```

- [ ] **Step 2: Add a button to the panel**

In `components/admin/SimulationPanel.tsx`, find the promo-window section's closing (right after the `Save`/`Clear` button pair, before the `TIME OVERRIDE` label — see the existing code at the location the `set_promo_window`/`clear_promo_window` buttons live) and add a new section immediately after it:

```tsx
          <p className="mono-data text-[9px] tracking-[0.12em] mt-4 mb-2" style={{ color: 'var(--t3)' }}>UPGRADE GATE</p>
          <button
            disabled={busy}
            onClick={() => runAction({ action: 'reset_upgrade_gate' }, 'Upgrade gate reset — the interstitial will show again on your next load.')}
            className="w-full text-[11px] font-medium px-2 py-1.5 rounded-lg disabled:opacity-50"
            style={{ color: 'var(--signal)', border: '1px solid var(--signal)' }}
          >
            Replay interstitial
          </button>
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint app/api/admin/simulate/route.ts components/admin/SimulationPanel.tsx`
Expected: no errors.

- [ ] **Step 4: Manual verification**

```bash
npm run dev &
sleep 4
```

Log in as the founder account (matching `ADMIN_EMAIL`), open the Simulation Panel, click "Replay interstitial," confirm the success toast text appears, then navigate — the full-screen interstitial should appear again (assuming the account is currently in a gated state per Task 8's setup).

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/simulate/route.ts components/admin/SimulationPanel.tsx
git commit -m "feat(upgrade-gate): add admin control to replay the interstitial for QA"
```

---

## Final verification (after all 15 tasks)

- [ ] Run the full clean-build check one more time end to end:

```bash
npx tsc --noEmit -p tsconfig.json && npx eslint . && npx next build
```

Expected: all three clean.

- [ ] Grep for any remaining hand-written upgrade strings that should have been migrated:

```bash
grep -rn "Upgrade to Pro\|Unlock.*with Pro\|Free plan is limited" app components lib | grep -v node_modules | grep -v "lib/upgradeCopy.ts\|lib/resend.ts"
```

Expected: no matches outside `lib/upgradeCopy.ts` and `lib/resend.ts` (the email templates were explicitly out of scope per the design spec).
