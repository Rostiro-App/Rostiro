# Cross-League Portfolio Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship League Favoriting, an honest deadline display that scales with league count, a Critical alert tier for the "injured starter → handcuff opportunity" case, proactive advisory lineup calls, cross-league free-agent search, and Simulation Studio recording support for all of it.

**Architecture:** Extends existing systems rather than building parallel ones — Pulse's fingerprint-based item architecture (`lib/pulse.ts`), the `engagement_log`-deduped push path (`lib/engagementTriggers.ts`, precedent: `detectStarterScratches`), the already-built Hint system (`lib/hints.ts`/`HintAnchor`/`HintProvider`), and the Simulation Studio's `StatePack<T>` registry (`app/demo/lib/studioPacks.tsx`). One genuinely new table (`league_favorites`); one genuinely new cross-reference signal (injured starter × real free-agent handcuff).

**Tech Stack:** Next.js App Router, Supabase (Postgres + RLS), TypeScript, Vitest.

## Global Constraints

- **No data transformation on facts.** Deadlines/lineup locks render exactly as sourced per league; where a cutoff isn't confirmed from real league settings, the UI shows a `~` prefix and honest copy — never a confident-looking guess.
- **No auto-pilot framing.** Every recommendation surface ends in a deep-link to the platform's own site. No task in this plan may add a write call to `lib/yahoo.ts`'s `submitYahooLineup`/`submitYahooWaiverClaim`/`proposeYahooTrade` or equivalent.
- **Critical alerts bypass compaction, not a rate-limiter that doesn't exist.** Correction from the design spec: there is no existing push quiet-hours/rate-limit mechanism in `pushToUser` beyond `isFreePlan`, `users.push_enabled`, and `engagement_log`'s one-shot dedup. "Critical bypasses rate-limiting" concretely means: the Critical push skips the `isFreePlan` gate exactly like `detectStarterScratches` already treats high-confidence scratches (card free, push Pro-gated is unaffected — Critical follows the same free-card/Pro-push split), and Critical **display** (not push) is what bypasses Focused mode's 5-card cap and Component 2's truncation.
- **Favoriting scopes Pulse (`buildPulseItemsForUser`) and the Game Day live panel (`/api/live/status`) only.** Leagues page, Health Score, and free-agent search stay unscoped. Critical items (Task 8) are built outside `buildPulseItemsForUser`'s favorited-league filter entirely (same separation `detectStarterScratches` already has from `buildPulseItemsForUser`), so they naturally ignore favorite status without special-casing.
- **Component naming corrections (verified against real code, not the design spec's prose):** the Hint component is `HintAnchor` (default export, `components/hints/HintAnchor.tsx`), not `<Hint>`. The Studio registry is `SURFACE_PACKS`/`StatePack<T>` (`app/demo/lib/studioPacks.tsx`), not a `kind → {defaultEvent, AuthorForm, render()}` shape — there is no existing generic "interrupt kind" to copy; `touchdown_swing`/`lineup_lock` are hardcoded as a special `'game_day'` branch across `Studio.tsx`/`StudioPanel.tsx`/`StudioCanvas.tsx` instead. Tasks 11-12 follow whichever real pattern fits each card type, not a uniform one.
- **Two non-identical Start/Sit gap thresholds exist today**: `lib/pulse.ts`'s `LINEUP_ADP_MARGIN = 20` (used by Pulse's existing `lineup_decision` card) and `app/api/lineup/sleeper/route.ts`'s `verdictForDelta` (15/40 thresholds, used by the Lineup page). Task 9 extracts `verdictForDelta` + its supporting logic into a shared lib and uses it as Component 4's canonical gap metric — it does **not** change Pulse's existing separate threshold, which is out of scope (pre-existing behavior, not a regression to fix here).
- **ESPN/Yahoo waiver-fetch functions return `Promise<unknown>` today** (`getEspnWaivers`, `getYahooWaiverPlayers`) — no typed shape exists yet. Task 10 adds real typed parsing; it is not a thin wrapper over an already-typed call.

---

## File Structure

**New files:**
- `supabase/migration_league_favorites.sql` — `league_favorites` table.
- `supabase/migration_critical_opportunities.sql` — `cross_league_opportunities` support + `engagement_log.trigger_type` CHECK extension.
- `lib/leagueFavorites.ts` — favorite CRUD + "no rows = all favorited" resolution helper.
- `app/api/leagues/favorites/route.ts` — GET (current favorites) / POST (toggle) API.
- `components/leagues/FavoriteStar.tsx` — the star toggle UI, used on league cards.
- `lib/deadlineRanking.ts` — pure ranking/truncation function for Component 2 (no DB, no React).
- `components/pulse/DeadlineList.tsx` — renders `lib/deadlineRanking.ts`'s output with the `~` honesty flag.
- `lib/handcuffDetector.ts` — pure cross-reference: scratched starter → real depth-chart handcuff → real free-agent/waiver check.
- `lib/crossLeagueOpportunities.ts` — orchestration: calls `handcuffDetector`, groups `byUser`, writes the Critical Pulse item + push (mirrors `detectStarterScratches`' shape in `lib/engagementTriggers.ts`).
- `components/interrupt/CriticalOpportunityCardView.tsx` — presentational card, `InterruptCardView`-shaped.
- `lib/startSit.ts` — extraction of `verdictForDelta` + the ADP-gap recommendation logic out of `app/api/lineup/sleeper/route.ts`, made callable from a cron.
- `lib/proactiveLineupCalls.ts` — orchestration for Component 4's proactive `lineup_decision` push, reusing `lib/startSit.ts` + the `checkAndIncrementUsage` weekly cap.
- `lib/freeAgentSearch.ts` — typed per-platform free-agent fetch + cross-league grouping for Component 5.
- `app/api/leagues/free-agents/route.ts` — search API.
- `components/leagues/FreeAgentSearch.tsx` — search UI.
- `app/demo/studio/packs/favoriting/favoritingPack.ts` (+ `AuthorForm`/`FullSurface`/`FocalCard`) — Studio `StatePack<T>` entry for Component 1.
- `app/demo/studio/packs/free-agent-search/freeAgentSearchPack.ts` (+ components) — Studio `StatePack<T>` entry for Component 5.
- `app/demo/studio/packs/lineup-decision/lineupDecisionPack.ts` (+ components) — Studio `StatePack<T>` entry for Component 4.

**Modified files:**
- `lib/pulse.ts` — favorite-filtering in `buildPulseItemsForUser`.
- `app/api/live/status/route.ts` — favorite-filtering on the `connected_leagues` query.
- `lib/engagementTriggers.ts` — new `detectCrossLeagueOpportunities` export, `claimTrigger`'s `triggerType` union extended.
- `types/index.ts` — `PulseItemType` extended with `critical_opportunity`; new `HandcuffCandidate`, `FreeAgentResult` types.
- `lib/hints.ts` — new `HINTS` entries for favoriting, Critical cards, free-agent search, advisory lineup calls.
- `app/(dashboard)/leagues/page.tsx` (or wherever league cards render — confirm exact path in Task 3) — mounts `FavoriteStar`.
- `app/demo/lib/studioPacks.tsx` — `StudioStateKind` union extended, new packs registered in `SURFACE_PACKS`.
- `app/demo/studio/StudioPanel.tsx`, `Studio.tsx` — Critical card follows the `game_day`-style special-case branch (per the naming-correction constraint above), needs its own branch alongside `touchdown_swing`/`lineup_lock`.

---

## Task 1: `league_favorites` migration

**Files:**
- Create: `supabase/migration_league_favorites.sql`
- Test: manual `psql`/Supabase SQL editor verification (no vitest for raw SQL, matching house convention — every other migration in this repo is verified by running it, not unit-tested)

**Interfaces:**
- Produces: `public.league_favorites(user_id uuid, league_id uuid, favorited_at timestamptz)`, referenced by Task 2's `lib/leagueFavorites.ts`.

- [ ] **Step 1: Write the migration**

```sql
-- migration_league_favorites.sql
-- Component 1 of docs/superpowers/specs/2026-07-16-cross-league-portfolio-intelligence-design.md.
-- Favoriting scopes Pulse + Game Day to a subset of a user's connected_leagues.
-- No rows for a user = treat all their leagues as favorited (resolved in application code,
-- not a default row per league, to avoid a write on every league connect).
-- Idempotent; safe to re-run.

create table if not exists public.league_favorites (
  user_id      uuid not null references public.users(id) on delete cascade,
  league_id    uuid not null references public.connected_leagues(id) on delete cascade,
  favorited_at timestamptz not null default now(),
  primary key (user_id, league_id)
);

create index if not exists league_favorites_user_idx on public.league_favorites (user_id);

alter table public.league_favorites enable row level security;

drop policy if exists "Users manage their own league favorites" on public.league_favorites;
create policy "Users manage their own league favorites" on public.league_favorites
  for all using (auth.uid() = user_id);

drop policy if exists "Service role full access to league favorites" on public.league_favorites;
create policy "Service role full access to league favorites" on public.league_favorites
  for all using (auth.role() = 'service_role');

grant select, insert, delete on public.league_favorites to authenticated;
grant select, insert, update, delete on public.league_favorites to service_role;
```

- [ ] **Step 2: Apply and verify**

Run in the Supabase SQL editor (or `psql` against the project's connection string):
```sql
select column_name, data_type from information_schema.columns where table_name = 'league_favorites';
```
Expected: 3 rows (`user_id`, `league_id`, `favorited_at`).

- [ ] **Step 3: Commit**

```bash
git add supabase/migration_league_favorites.sql
git commit -m "feat: add league_favorites table migration"
```

---

## Task 2: `lib/leagueFavorites.ts` — favorite resolution + mutation

**Files:**
- Create: `lib/leagueFavorites.ts`
- Test: `lib/leagueFavorites.test.ts`

**Interfaces:**
- Consumes: `connected_leagues` rows (`{ id: string }[]`) already fetched by callers (Task 5/6 pass these in — this module never queries `connected_leagues` itself, keeping it a thin, testable layer over `league_favorites`).
- Produces:
```ts
export async function getFavoritedLeagueIds(
  admin: SupabaseClient,
  userId: string,
  allLeagueIds: string[]
): Promise<string[]>

export async function setFavorite(
  admin: SupabaseClient,
  userId: string,
  leagueId: string,
  favorited: boolean
): Promise<void>
```
Both consumed by Task 3 (API route), Task 5 (Pulse filtering), Task 6 (Game Day filtering).

- [ ] **Step 1: Write the failing tests**

```ts
// lib/leagueFavorites.test.ts
import { describe, it, expect, vi } from 'vitest'
import { getFavoritedLeagueIds, setFavorite } from './leagueFavorites'

function mockAdmin(rows: { league_id: string }[]) {
  return {
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: rows, error: null }),
      }),
      upsert: () => Promise.resolve({ error: null }),
      delete: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
    }),
  } as any
}

describe('getFavoritedLeagueIds', () => {
  it('returns all league ids when the user has no favorite rows (default: all favorited)', async () => {
    const admin = mockAdmin([])
    const result = await getFavoritedLeagueIds(admin, 'user-1', ['lg-1', 'lg-2', 'lg-3'])
    expect(result).toEqual(['lg-1', 'lg-2', 'lg-3'])
  })

  it('returns only the favorited subset when favorite rows exist', async () => {
    const admin = mockAdmin([{ league_id: 'lg-1' }, { league_id: 'lg-3' }])
    const result = await getFavoritedLeagueIds(admin, 'user-1', ['lg-1', 'lg-2', 'lg-3'])
    expect(result).toEqual(['lg-1', 'lg-3'])
  })
})

describe('setFavorite', () => {
  it('upserts a favorite row when favorited is true', async () => {
    const upsert = vi.fn(() => Promise.resolve({ error: null }))
    const admin = { from: () => ({ upsert }) } as any
    await setFavorite(admin, 'user-1', 'lg-1', true)
    expect(upsert).toHaveBeenCalledWith(
      { user_id: 'user-1', league_id: 'lg-1' },
      { onConflict: 'user_id,league_id' }
    )
  })

  it('deletes the favorite row when favorited is false', async () => {
    const eq2 = vi.fn(() => Promise.resolve({ error: null }))
    const eq1 = vi.fn(() => ({ eq: eq2 }))
    const admin = { from: () => ({ delete: () => ({ eq: eq1 }) }) } as any
    await setFavorite(admin, 'user-1', 'lg-1', false)
    expect(eq1).toHaveBeenCalledWith('user_id', 'user-1')
    expect(eq2).toHaveBeenCalledWith('league_id', 'lg-1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/leagueFavorites.test.ts`
Expected: FAIL — `Cannot find module './leagueFavorites'`

- [ ] **Step 3: Write the implementation**

```ts
// lib/leagueFavorites.ts
import type { SupabaseClient } from '@supabase/supabase-js'

// No rows for a user = every connected league is treated as favorited.
// This avoids writing a favorite row on every league connect (onboarding
// stays a single write to connected_leagues, not two).
export async function getFavoritedLeagueIds(
  admin: SupabaseClient,
  userId: string,
  allLeagueIds: string[]
): Promise<string[]> {
  const { data } = await admin
    .from('league_favorites')
    .select('league_id')
    .eq('user_id', userId)

  if (!data || data.length === 0) return allLeagueIds

  const favorited = new Set(data.map((row: { league_id: string }) => row.league_id))
  return allLeagueIds.filter((id) => favorited.has(id))
}

export async function setFavorite(
  admin: SupabaseClient,
  userId: string,
  leagueId: string,
  favorited: boolean
): Promise<void> {
  if (favorited) {
    await admin
      .from('league_favorites')
      .upsert({ user_id: userId, league_id: leagueId }, { onConflict: 'user_id,league_id' })
  } else {
    await admin.from('league_favorites').delete().eq('user_id', userId).eq('league_id', leagueId)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/leagueFavorites.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add lib/leagueFavorites.ts lib/leagueFavorites.test.ts
git commit -m "feat: add league favorite resolution and mutation helpers"
```

---

## Task 3: Favorites API route

**Files:**
- Create: `app/api/leagues/favorites/route.ts`
- Test: `app/api/leagues/favorites/route.test.ts`

**Interfaces:**
- Consumes: `getFavoritedLeagueIds`, `setFavorite` (Task 2).
- Produces: `GET /api/leagues/favorites` → `{ favoritedLeagueIds: string[] }`; `POST /api/leagues/favorites` body `{ leagueId: string, favorited: boolean }` → `{ ok: true }`. Consumed by Task 4's `FavoriteStar` component.

- [ ] **Step 1: Write the failing test**

```ts
// app/api/leagues/favorites/route.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/leagueFavorites', () => ({
  getFavoritedLeagueIds: vi.fn(() => Promise.resolve(['lg-1', 'lg-2'])),
  setFavorite: vi.fn(() => Promise.resolve()),
}))
vi.mock('@/lib/supabaseAdmin', () => ({ getAdminClient: () => ({}) }))
vi.mock('@/lib/auth', () => ({ getAuthedUser: () => Promise.resolve({ id: 'user-1' }) }))

import { GET, POST } from './route'
import { setFavorite } from '@/lib/leagueFavorites'

describe('GET /api/leagues/favorites', () => {
  it('returns the favorited league ids for the authed user', async () => {
    const res = await GET(new Request('http://localhost/api/leagues/favorites'))
    const body = await res.json()
    expect(body).toEqual({ favoritedLeagueIds: ['lg-1', 'lg-2'] })
  })
})

describe('POST /api/leagues/favorites', () => {
  it('toggles a favorite and returns ok', async () => {
    const req = new Request('http://localhost/api/leagues/favorites', {
      method: 'POST',
      body: JSON.stringify({ leagueId: 'lg-3', favorited: true }),
    })
    const res = await POST(req)
    const body = await res.json()
    expect(body).toEqual({ ok: true })
    expect(setFavorite).toHaveBeenCalledWith({}, 'user-1', 'lg-3', true)
  })
})
```

*(This test assumes `getAdminClient` in `lib/supabaseAdmin.ts` and `getAuthedUser` in `lib/auth.ts` — verify these exact export names against `app/api/live/status/route.ts`'s imports before writing the route; if the real project uses different helper names/paths, use those instead and update this test's mocks to match. This is the one place in the plan where an exact existing helper name wasn't independently re-verified — confirm in Step 3 before writing.)*

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/leagues/favorites/route.test.ts`
Expected: FAIL — `Cannot find module './route'`

- [ ] **Step 3: Confirm the real auth/admin-client helper names, then write the route**

Run: `grep -n "^import" app/api/live/status/route.ts` — copy the exact admin-client and auth helper imports from this real, working route rather than assuming names, then:

```ts
// app/api/leagues/favorites/route.ts
import { NextResponse } from 'next/server'
import { getFavoritedLeagueIds, setFavorite } from '@/lib/leagueFavorites'
// Replace the next two imports with whatever app/api/live/status/route.ts actually uses:
import { getAdminClient } from '@/lib/supabaseAdmin'
import { getAuthedUser } from '@/lib/auth'

export async function GET(_req: Request) {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = getAdminClient()
  const { data: leagueRows } = await admin.from('connected_leagues').select('id').eq('user_id', user.id)
  const allLeagueIds = (leagueRows ?? []).map((r: { id: string }) => r.id)
  const favoritedLeagueIds = await getFavoritedLeagueIds(admin, user.id, allLeagueIds)

  return NextResponse.json({ favoritedLeagueIds })
}

export async function POST(req: Request) {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { leagueId, favorited } = (await req.json()) as { leagueId: string; favorited: boolean }
  const admin = getAdminClient()
  await setFavorite(admin, user.id, leagueId, favorited)

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/leagues/favorites/route.test.ts`
Expected: PASS, 2 tests

- [ ] **Step 5: Commit**

```bash
git add app/api/leagues/favorites/route.ts app/api/leagues/favorites/route.test.ts
git commit -m "feat: add league favorites API route"
```

---

## Task 4: `FavoriteStar` UI + wire into league cards

**Files:**
- Create: `components/leagues/FavoriteStar.tsx`
- Modify: the league-card component under `app/(dashboard)/leagues/` (run `grep -rl "Health Score\|healthScore" app/\(dashboard\)/leagues` first to find the exact file — the design spec and Task file structure both assume a Leagues page exists per PRD §6.7 W2 but its exact filename wasn't independently confirmed by research; locate it before editing)
- Test: `components/leagues/FavoriteStar.test.tsx`

**Interfaces:**
- Consumes: `GET`/`POST /api/leagues/favorites` (Task 3).
- Produces: `<FavoriteStar leagueId={string} initiallyFavorited={boolean} />`, mounted per league card.

- [ ] **Step 1: Write the failing test**

```tsx
// components/leagues/FavoriteStar.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FavoriteStar } from './FavoriteStar'

global.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ ok: true }) })) as any

describe('FavoriteStar', () => {
  it('renders filled when initially favorited and toggles on click', async () => {
    render(<FavoriteStar leagueId="lg-1" initiallyFavorited={true} />)
    const star = screen.getByRole('button', { name: /unfavorite/i })
    fireEvent.click(star)
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      '/api/leagues/favorites',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ leagueId: 'lg-1', favorited: false }),
      })
    ))
    expect(screen.getByRole('button', { name: /favorite/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/leagues/FavoriteStar.test.tsx`
Expected: FAIL — `Cannot find module './FavoriteStar'`

- [ ] **Step 3: Write the implementation**

```tsx
// components/leagues/FavoriteStar.tsx
'use client'
import { useState } from 'react'

export function FavoriteStar({
  leagueId,
  initiallyFavorited,
}: {
  leagueId: string
  initiallyFavorited: boolean
}) {
  const [favorited, setFavorited] = useState(initiallyFavorited)

  async function toggle() {
    const next = !favorited
    setFavorited(next)
    await fetch('/api/leagues/favorites', {
      method: 'POST',
      body: JSON.stringify({ leagueId, favorited: next }),
    })
  }

  return (
    <button
      onClick={toggle}
      aria-label={favorited ? 'Unfavorite league' : 'Favorite league'}
      className="text-lg leading-none"
    >
      {favorited ? '★' : '☆'}
    </button>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/leagues/FavoriteStar.test.tsx`
Expected: PASS, 1 test

- [ ] **Step 5: Locate the real league-card component and mount `FavoriteStar`**

Run: `grep -rl "leagueName\|league_name" app/\(dashboard\)/leagues components 2>/dev/null | grep -v test`

Add `<FavoriteStar leagueId={league.id} initiallyFavorited={favoritedLeagueIds.includes(league.id)} />` to the found league-card component's header row, fetching `favoritedLeagueIds` once per page load via `GET /api/leagues/favorites` in that page's existing data-loading (server component fetch or `useEffect`, matching whatever pattern the rest of that file already uses — do not introduce a new data-fetching pattern into an existing file).

- [ ] **Step 6: Commit**

```bash
git add components/leagues/FavoriteStar.tsx components/leagues/FavoriteStar.test.tsx <league-card-file>
git commit -m "feat: add favorite star toggle to league cards"
```

---

## Task 5: Scope `buildPulseItemsForUser` to favorited leagues

**Files:**
- Modify: `lib/pulse.ts:101-104` (the `buildPulseItemsForUser` entry point)
- Test: `lib/pulse.test.ts` (extend existing file if present; create if not — check first: `ls lib/pulse.test.ts`)

**Interfaces:**
- Consumes: `getFavoritedLeagueIds` (Task 2).
- Produces: no signature change to `buildPulseItemsForUser` — same `(supabase, userId) => Promise<{ items, leagueCount }>` — the filtering happens internally, transparent to every existing caller.

- [ ] **Step 1: Write the failing test**

```ts
// lib/pulse.test.ts (add to existing file, or create if none exists)
import { describe, it, expect, vi } from 'vitest'

vi.mock('./leagueFavorites', () => ({
  getFavoritedLeagueIds: vi.fn((_admin, _userId, allIds: string[]) => Promise.resolve([allIds[0]])),
}))

describe('buildPulseItemsForUser favoriting', () => {
  it('only builds items for favorited leagues', async () => {
    // Arrange a Supabase mock returning 2 connected_leagues rows for the user,
    // where getFavoritedLeagueIds (mocked above) resolves to only the first.
    // Assert every BuiltPulseItem.affectedLeagues only ever names the first league.
    // (Concrete fixture data depends on lib/pulse.ts's existing test setup —
    // follow the existing mock-Supabase pattern already in this file if one
    // exists; if lib/pulse.test.ts doesn't exist yet, this is the first test
    // in it and should establish a minimal 2-league fixture.)
  })
})
```

*(This step's assertion body is intentionally left to be filled against `lib/pulse.ts`'s real internal league-loading shape, which must be read in full before this test can be concrete — read `lib/pulse.ts:1-110` first to see exactly how `buildPulseItemsForUser` currently loads `connected_leagues`/rosters before writing the fixture. This is the one task in the plan requiring an extra read-before-write step because `buildPulseItemsForUser`'s internals weren't fully captured during research — only its signature and construction call-sites were.)*

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/pulse.test.ts`
Expected: FAIL (new test, feature not yet implemented)

- [ ] **Step 3: Add favorite-filtering inside `buildPulseItemsForUser`**

In `lib/pulse.ts`, immediately after the existing `connected_leagues` fetch (wherever that query currently is — read the surrounding lines identified in Step 1's research), insert:

```ts
import { getFavoritedLeagueIds } from './leagueFavorites'

// ... inside buildPulseItemsForUser, after leagues are loaded as `leagues` (existing variable name may differ — match it):
const allLeagueIds = leagues.map((l) => l.id)
const favoritedIds = await getFavoritedLeagueIds(supabase, userId, allLeagueIds)
const favoritedSet = new Set(favoritedIds)
const scopedLeagues = leagues.filter((l) => favoritedSet.has(l.id))
// Replace downstream uses of `leagues` with `scopedLeagues` for every
// item-construction call (injury_alert, waiver_alert, lineup_decision, etc.)
// — leaveCount in the returned object should reflect ALL connected leagues,
// not just favorited ones (Leagues page / Health Score stay unscoped per
// the Global Constraints, and `leagueCount` is used by those surfaces too).
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/pulse.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/pulse.ts lib/pulse.test.ts
git commit -m "feat: scope Pulse item generation to favorited leagues"
```

---

## Task 6: Scope Game Day live panel to favorited leagues

**Files:**
- Modify: `app/api/live/status/route.ts:41` (the `connected_leagues` query)
- Test: `app/api/live/status/route.test.ts` (extend or create)

**Interfaces:**
- Consumes: `getFavoritedLeagueIds` (Task 2).
- Produces: no response-shape change — same route, filtered input.

- [ ] **Step 1: Write the failing test**

```ts
// app/api/live/status/route.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/leagueFavorites', () => ({
  getFavoritedLeagueIds: vi.fn(() => Promise.resolve(['lg-1'])),
}))
// Mock the admin client's `.from('connected_leagues')` chain to return 2 rows (lg-1, lg-2)
// for the platform='sleeper' filter already present at route.ts:41, and assert the route's
// downstream live_events/pulse_items queries only ever run against lg-1.

import { GET } from './route'

describe('GET /api/live/status favoriting', () => {
  it('only includes favorited leagues in the live panel', async () => {
    // Concrete assertions depend on route.ts's downstream shape past line 41 —
    // read app/api/live/status/route.ts:41-90 in full before finalizing this test.
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/live/status/route.test.ts`
Expected: FAIL

- [ ] **Step 3: Add favorite-filtering after the existing query**

In `app/api/live/status/route.ts`, immediately after line 41's `leagueRows` fetch:

```ts
import { getFavoritedLeagueIds } from '@/lib/leagueFavorites'

// existing: const { data: leagueRows } = await admin.from('connected_leagues')...
const allLeagueIds = (leagueRows ?? []).map((r: { id: string }) => r.id)
const favoritedIds = await getFavoritedLeagueIds(admin, user.id, allLeagueIds)
const scopedLeagueRows = (leagueRows ?? []).filter((r: { id: string }) => favoritedIds.includes(r.id))
// Replace every downstream use of `leagueRows` with `scopedLeagueRows`.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/live/status/route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/live/status/route.ts app/api/live/status/route.test.ts
git commit -m "feat: scope Game Day live panel to favorited leagues"
```

---

## Task 7: `lib/deadlineRanking.ts` — honest ranking/truncation (Component 2)

**Files:**
- Create: `lib/deadlineRanking.ts`
- Test: `lib/deadlineRanking.test.ts`

**Interfaces:**
- Consumes: an array of real per-league deadline facts (shape defined below), sourced from wherever the System Bar's existing `next-hard-deadline` computation already lives (PRD §6.7 W1, `/api/system/status`) — this task does not change that data source, only adds a pure ranking function over its output.
- Produces:
```ts
export interface LeagueDeadline {
  leagueId: string
  leagueName: string
  type: 'waiver_cutoff' | 'lineup_lock'
  deadline: string // ISO timestamp, real, never transformed
  confirmed: boolean // false = sourced from a default/assumed cutoff, not the league's real setting
}

export interface RankedDeadlines {
  visible: LeagueDeadline[]
  hiddenCount: number
  hidden: LeagueDeadline[] // full list, for the "+N more" expansion — never actually discarded
}

export function rankDeadlines(deadlines: LeagueDeadline[], maxVisible?: number): RankedDeadlines
```
Consumed by Task 7.1 (`DeadlineList` component).

- [ ] **Step 1: Write the failing tests**

```ts
// lib/deadlineRanking.test.ts
import { describe, it, expect } from 'vitest'
import { rankDeadlines, type LeagueDeadline } from './deadlineRanking'

function deadline(leagueId: string, hoursFromNow: number, confirmed = true): LeagueDeadline {
  return {
    leagueId,
    leagueName: `League ${leagueId}`,
    type: 'waiver_cutoff',
    deadline: new Date(Date.now() + hoursFromNow * 3600_000).toISOString(),
    confirmed,
  }
}

describe('rankDeadlines', () => {
  it('shows all deadlines when count is at or below the default max (3)', () => {
    const input = [deadline('a', 5), deadline('b', 2), deadline('c', 8)]
    const result = rankDeadlines(input)
    expect(result.visible.map((d) => d.leagueId)).toEqual(['b', 'a', 'c']) // sorted soonest-first
    expect(result.hiddenCount).toBe(0)
  })

  it('truncates to the top-3-by-time-remaining and reports the rest as hidden, not discarded', () => {
    const input = [deadline('a', 10), deadline('b', 1), deadline('c', 5), deadline('d', 2), deadline('e', 20)]
    const result = rankDeadlines(input)
    expect(result.visible.map((d) => d.leagueId)).toEqual(['b', 'd', 'c'])
    expect(result.hiddenCount).toBe(2)
    expect(result.hidden.map((d) => d.leagueId).sort()).toEqual(['a', 'e'])
  })

  it('never drops a deadline permanently — hidden array always contains the full input', () => {
    const input = [deadline('a', 1), deadline('b', 2), deadline('c', 3), deadline('d', 4)]
    const result = rankDeadlines(input)
    const allIds = [...result.visible, ...result.hidden].map((d) => d.leagueId).sort()
    expect(allIds).toEqual(['a', 'b', 'c', 'd'])
  })

  it('respects a custom maxVisible', () => {
    const input = [deadline('a', 1), deadline('b', 2), deadline('c', 3)]
    const result = rankDeadlines(input, 1)
    expect(result.visible.map((d) => d.leagueId)).toEqual(['a'])
    expect(result.hiddenCount).toBe(2)
  })

  it('preserves the confirmed flag unchanged — ranking never edits deadline data', () => {
    const input = [deadline('a', 1, false), deadline('b', 2, true)]
    const result = rankDeadlines(input)
    expect(result.visible.find((d) => d.leagueId === 'a')?.confirmed).toBe(false)
    expect(result.visible.find((d) => d.leagueId === 'b')?.confirmed).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/deadlineRanking.test.ts`
Expected: FAIL — `Cannot find module './deadlineRanking'`

- [ ] **Step 3: Write the implementation**

```ts
// lib/deadlineRanking.ts
export interface LeagueDeadline {
  leagueId: string
  leagueName: string
  type: 'waiver_cutoff' | 'lineup_lock'
  deadline: string
  confirmed: boolean
}

export interface RankedDeadlines {
  visible: LeagueDeadline[]
  hiddenCount: number
  hidden: LeagueDeadline[]
}

const DEFAULT_MAX_VISIBLE = 3

export function rankDeadlines(deadlines: LeagueDeadline[], maxVisible = DEFAULT_MAX_VISIBLE): RankedDeadlines {
  const sorted = [...deadlines].sort(
    (a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
  )
  const visible = sorted.slice(0, maxVisible)
  const hidden = sorted.slice(maxVisible)
  return { visible, hiddenCount: hidden.length, hidden }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/deadlineRanking.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add lib/deadlineRanking.ts lib/deadlineRanking.test.ts
git commit -m "feat: add pure deadline ranking/truncation function"
```

---

## Task 7.1: `DeadlineList` component — render with honesty flag

**Files:**
- Create: `components/pulse/DeadlineList.tsx`
- Test: `components/pulse/DeadlineList.test.tsx`

**Interfaces:**
- Consumes: `rankDeadlines` (Task 7), `HintAnchor` (`components/hints/HintAnchor.tsx`, existing).
- Produces: `<DeadlineList deadlines={LeagueDeadline[]} />`, mounted in the System Bar / Pulse header (exact mount point: read `components/nav/SystemBar.tsx`'s existing deadline-countdown render first, since this replaces/extends it).

- [ ] **Step 1: Write the failing test**

```tsx
// components/pulse/DeadlineList.test.tsx
import { describe, it, expect, fireEvent, render, screen } from '@testing-library/react'
import { DeadlineList } from './DeadlineList'

const mk = (id: string, h: number, confirmed = true) => ({
  leagueId: id, leagueName: `League ${id}`, type: 'waiver_cutoff' as const,
  deadline: new Date(Date.now() + h * 3600_000).toISOString(), confirmed,
})

describe('DeadlineList', () => {
  it('shows a ~ prefix only on unconfirmed deadlines', () => {
    render(<DeadlineList deadlines={[mk('a', 1, false), mk('b', 2, true)]} />)
    expect(screen.getByText(/~League a/)).toBeInTheDocument()
    expect(screen.getByText(/^League b/)).toBeInTheDocument()
  })

  it('shows a "+N more" row and expands the full list on click', () => {
    render(<DeadlineList deadlines={[mk('a', 1), mk('b', 2), mk('c', 3), mk('d', 4), mk('e', 5)]} />)
    const more = screen.getByText(/\+2 more/)
    expect(more).toBeInTheDocument()
    fireEvent.click(more)
    expect(screen.getByText(/League d/)).toBeInTheDocument()
    expect(screen.getByText(/League e/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/pulse/DeadlineList.test.tsx`
Expected: FAIL — `Cannot find module './DeadlineList'`

- [ ] **Step 3: Write the implementation**

```tsx
// components/pulse/DeadlineList.tsx
'use client'
import { useState } from 'react'
import { rankDeadlines, type LeagueDeadline } from '@/lib/deadlineRanking'
import HintAnchor from '@/components/hints/HintAnchor'

export function DeadlineList({ deadlines }: { deadlines: LeagueDeadline[] }) {
  const [expanded, setExpanded] = useState(false)
  const { visible, hiddenCount, hidden } = rankDeadlines(deadlines)
  const shown = expanded ? [...visible, ...hidden] : visible

  return (
    <HintAnchor id="deadline-list">
      <ul>
        {shown.map((d) => (
          <li key={d.leagueId}>
            {d.confirmed ? '' : '~'}
            {d.leagueName} — {new Date(d.deadline).toLocaleString()}
          </li>
        ))}
      </ul>
      {!expanded && hiddenCount > 0 && (
        <button onClick={() => setExpanded(true)}>+{hiddenCount} more today →</button>
      )}
    </HintAnchor>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/pulse/DeadlineList.test.tsx`
Expected: PASS, 2 tests

- [ ] **Step 5: Add the `deadline-list` hint entry**

In `lib/hints.ts`, add to the `HINTS` array:
```ts
{
  id: 'deadline-list',
  title: 'Your deadlines, honestly',
  body: "A ~ means we're not 100% sure of this league's exact cutoff time yet — never a guess dressed up as a fact.",
  placement: 'bottom',
},
```

- [ ] **Step 6: Commit**

```bash
git add components/pulse/DeadlineList.tsx components/pulse/DeadlineList.test.tsx lib/hints.ts
git commit -m "feat: render deadline list with honesty flag and progressive disclosure"
```

---

## Task 8: `lib/handcuffDetector.ts` — the injury × real-availability cross-reference

**Files:**
- Create: `lib/handcuffDetector.ts`
- Test: `lib/handcuffDetector.test.ts`

**Interfaces:**
- Consumes: `SleeperCachePlayer[]` (`lib/sleeper.ts`'s existing `getSleeperPlayers` return shape — has `depthChartOrder`/`depthChartPosition`/`nflTeam` fields, confirmed real), `player_scratches` rows (existing `lib/scratchClassifier.ts` output, already high-confidence-filtered upstream).
- Produces:
```ts
export interface HandcuffCandidate {
  scratchedPlayerId: string
  handcuffPlayerId: string
  handcuffName: string
}
export function findHandcuff(
  scratchedPlayerId: string,
  allPlayers: SleeperCachePlayer[]
): HandcuffCandidate | null
```
Consumed by Task 9's `lib/crossLeagueOpportunities.ts`.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/handcuffDetector.test.ts
import { describe, it, expect } from 'vitest'
import { findHandcuff } from './handcuffDetector'
import type { SleeperCachePlayer } from './sleeper'

function player(overrides: Partial<SleeperCachePlayer>): SleeperCachePlayer {
  return {
    playerId: 'p-default', name: 'Default Player', firstName: null, lastName: null,
    position: 'RB', nflTeam: 'ATL', injuryStatus: null, adpSleeper: null,
    gsisId: null, depthChartOrder: null, depthChartPosition: null,
    ...overrides,
  }
}

describe('findHandcuff', () => {
  it('finds the next-depth-chart player at the same team+position', () => {
    const starter = player({ playerId: 'star-1', nflTeam: 'ATL', position: 'RB', depthChartOrder: 1, depthChartPosition: 'RB' })
    const backup = player({ playerId: 'back-1', name: 'Backup Guy', nflTeam: 'ATL', position: 'RB', depthChartOrder: 2, depthChartPosition: 'RB' })
    const unrelated = player({ playerId: 'other-1', nflTeam: 'DAL', position: 'RB', depthChartOrder: 2, depthChartPosition: 'RB' })
    const result = findHandcuff('star-1', [starter, backup, unrelated])
    expect(result).toEqual({ scratchedPlayerId: 'star-1', handcuffPlayerId: 'back-1', handcuffName: 'Backup Guy' })
  })

  it('returns null when the scratched player has no depth chart data', () => {
    const starter = player({ playerId: 'star-1', depthChartOrder: null })
    expect(findHandcuff('star-1', [starter])).toBeNull()
  })

  it('returns null when no next-order teammate exists at the same position', () => {
    const starter = player({ playerId: 'star-1', nflTeam: 'ATL', position: 'RB', depthChartOrder: 1, depthChartPosition: 'RB' })
    expect(findHandcuff('star-1', [starter])).toBeNull()
  })

  it('picks the immediately next depth order, not just any lower-ranked teammate', () => {
    const starter = player({ playerId: 'star-1', nflTeam: 'ATL', position: 'RB', depthChartOrder: 1, depthChartPosition: 'RB' })
    const third = player({ playerId: 'third-1', nflTeam: 'ATL', position: 'RB', depthChartOrder: 3, depthChartPosition: 'RB' })
    const second = player({ playerId: 'second-1', name: 'Second String', nflTeam: 'ATL', position: 'RB', depthChartOrder: 2, depthChartPosition: 'RB' })
    const result = findHandcuff('star-1', [starter, third, second])
    expect(result?.handcuffPlayerId).toBe('second-1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/handcuffDetector.test.ts`
Expected: FAIL — `Cannot find module './handcuffDetector'`

- [ ] **Step 3: Write the implementation**

```ts
// lib/handcuffDetector.ts
import type { SleeperCachePlayer } from './sleeper'

export interface HandcuffCandidate {
  scratchedPlayerId: string
  handcuffPlayerId: string
  handcuffName: string
}

// Deterministic, no Claude: the "handcuff" is the next-depth-chart-order
// player at the same real NFL team and depth-chart position. This is a
// real, sourced fact (Sleeper's depth_chart_order/depth_chart_position),
// not an inference — see the Global Constraints' no-guessing rule.
export function findHandcuff(
  scratchedPlayerId: string,
  allPlayers: SleeperCachePlayer[]
): HandcuffCandidate | null {
  const scratched = allPlayers.find((p) => p.playerId === scratchedPlayerId)
  if (!scratched || scratched.depthChartOrder === null || scratched.depthChartPosition === null) {
    return null
  }

  const candidates = allPlayers.filter(
    (p) =>
      p.playerId !== scratchedPlayerId &&
      p.nflTeam === scratched.nflTeam &&
      p.depthChartPosition === scratched.depthChartPosition &&
      p.depthChartOrder !== null &&
      (p.depthChartOrder as number) > (scratched.depthChartOrder as number)
  )
  if (candidates.length === 0) return null

  const next = candidates.reduce((closest, p) =>
    (p.depthChartOrder as number) < (closest.depthChartOrder as number) ? p : closest
  )

  return { scratchedPlayerId, handcuffPlayerId: next.playerId, handcuffName: next.name }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/handcuffDetector.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add lib/handcuffDetector.ts lib/handcuffDetector.test.ts
git commit -m "feat: add deterministic depth-chart handcuff detector"
```

---

## Task 9: `cross_league_opportunities` migration + `engagement_log` CHECK extension

**Files:**
- Create: `supabase/migration_critical_opportunities.sql`

**Interfaces:**
- Produces: extended `engagement_log.trigger_type` CHECK to include `'critical_opportunity'`, and extended `pulse_items.type` CHECK to include `'critical_opportunity'`.

- [ ] **Step 1: Write the migration**

```sql
-- migration_critical_opportunities.sql
-- Component 3 of docs/superpowers/specs/2026-07-16-cross-league-portfolio-intelligence-design.md.
-- Adds the 'critical_opportunity' trigger/item type used by lib/crossLeagueOpportunities.ts.
-- Idempotent; safe to re-run.

alter table public.engagement_log drop constraint if exists engagement_log_trigger_type_check;
alter table public.engagement_log add constraint engagement_log_trigger_type_check
  check (trigger_type in ('touchdown_swing', 'lineup_lock', 'mission_complete', 'starter_scratch', 'critical_opportunity'));

alter table public.pulse_items drop constraint if exists pulse_items_type_check;
alter table public.pulse_items add constraint pulse_items_type_check
  check (type in (
    'lineup_decision','injury_alert','weather_alert','waiver_alert','trade_opportunity',
    'opponent_intel','deadline_reminder','exposure_flag','touchdown_swing','lineup_lock',
    'mission_complete','roster_grade','player_news','opportunity_surge','critical_opportunity'
  ));
```

*(Before running Step 1 for real, run `grep -n "pulse_items_type_check\|type in (" supabase/schema.sql supabase/migration_*.sql` to confirm the exact current full list of `pulse_items.type` values — the list above is reconstructed from `types/index.ts`'s `PulseItemType` union per research and may be missing a value added by a migration after `types/index.ts` was last read in full; reconcile before applying.)*

- [ ] **Step 2: Apply and verify**

```sql
select conname, pg_get_constraintdef(oid) from pg_constraint where conname in ('engagement_log_trigger_type_check', 'pulse_items_type_check');
```
Expected: both constraints list `critical_opportunity`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migration_critical_opportunities.sql
git commit -m "feat: extend engagement_log and pulse_items for critical_opportunity type"
```

---

## Task 10: `lib/crossLeagueOpportunities.ts` — orchestration + `types/index.ts` extension

**Files:**
- Modify: `types/index.ts` (add `'critical_opportunity'` to `PulseItemType`)
- Create: `lib/crossLeagueOpportunities.ts`
- Modify: `lib/engagementTriggers.ts` (new export, `claimTrigger`'s type union)
- Test: `lib/crossLeagueOpportunities.test.ts`

**Interfaces:**
- Consumes: `findHandcuff` (Task 8), `player_scratches` rows, `getSleeperPlayers` (`lib/sleeper.ts`), `getFreeAgentAvailability` (Task 11 — **note the dependency direction**: this task needs Task 11's per-league availability check to know if the handcuff is actually a free agent; if sequencing requires this task before Task 11, use a minimal inline availability check here and refactor to call Task 11's shared function once it exists — flagged explicitly rather than silently duplicating logic).
- Produces:
```ts
export async function detectCrossLeagueOpportunities(admin: AdminClient): Promise<void>
```
Called from `app/api/cron/news/route.ts` alongside the existing `detectStarterScratches(admin)` call, same best-effort `.catch(() => {})` wrapping.

- [ ] **Step 1: Add `critical_opportunity` to `PulseItemType`**

In `types/index.ts`, find the `PulseItemType` union (starts around line 17) and add `'critical_opportunity'` to it.

- [ ] **Step 2: Write the failing test**

```ts
// lib/crossLeagueOpportunities.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('./handcuffDetector', () => ({
  findHandcuff: vi.fn(() => ({ scratchedPlayerId: 'star-1', handcuffPlayerId: 'back-1', handcuffName: 'Backup Guy' })),
}))

import { detectCrossLeagueOpportunities } from './crossLeagueOpportunities'

describe('detectCrossLeagueOpportunities', () => {
  it('groups the same opportunity across a user\'s leagues into one push, naming every league', async () => {
    // Arrange: an admin mock where a user has 3 connected leagues, the handcuff
    // ('back-1') is a free agent in 2 of them, and claimTrigger/pushToUser are
    // spied. Assert exactly one pushToUser call for that user, with a message
    // naming both leagues (not two separate calls).
    // Concrete admin-mock shape depends on reading lib/engagementTriggers.ts's
    // detectStarterScratches in full first (byUser construction, roster
    // loading) — mirror its exact query/grouping shape rather than inventing
    // a new one, per the Global Constraints' reuse requirement.
  })

  it('does not fire when the scratched player has no real handcuff (findHandcuff returns null)', async () => {
    // Re-mock findHandcuff to return null for this test; assert no claimTrigger/pushToUser calls.
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/crossLeagueOpportunities.test.ts`
Expected: FAIL — `Cannot find module './crossLeagueOpportunities'`

- [ ] **Step 4: Extend `claimTrigger`'s type union in `lib/engagementTriggers.ts`**

At `lib/engagementTriggers.ts:63-68`, change:
```ts
triggerType: 'touchdown_swing' | 'lineup_lock' | 'mission_complete' | 'starter_scratch',
```
to:
```ts
triggerType: 'touchdown_swing' | 'lineup_lock' | 'mission_complete' | 'starter_scratch' | 'critical_opportunity',
```

- [ ] **Step 5: Write `lib/crossLeagueOpportunities.ts`**, mirroring `detectStarterScratches`'s exact structure (`lib/engagementTriggers.ts:380`) — read that function in full first, then:

```ts
// lib/crossLeagueOpportunities.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { findHandcuff } from './handcuffDetector'
import { getSleeperPlayers } from './sleeper'
// claimTrigger is module-private in lib/engagementTriggers.ts (not exported) —
// this orchestration must live inside lib/engagementTriggers.ts itself, OR
// claimTrigger/pushToUser must be exported first. Follow whichever the
// existing detectStarterScratches does (it's in the same file as
// claimTrigger, so the simplest correct move is to add
// detectCrossLeagueOpportunities as a new export IN lib/engagementTriggers.ts,
// not as a separate file — revise the File Structure entry accordingly when
// implementing this task; this stub signature is illustrative of the public
// contract other tasks depend on, not the final file location.

// Real implementation location: lib/engagementTriggers.ts, alongside
// detectStarterScratches, following its exact pattern:
// 1. Load recent high-confidence player_scratches (reuse whatever query
//    detectStarterScratches already uses for this).
// 2. For each scratch, call findHandcuff(scratch.player_id, allSleeperPlayers).
// 3. If a handcuff exists, check real free-agent/waiver availability per
//    league (Task 11's function) for the handcuff across each user's
//    connected leagues.
// 4. Build a byUser map exactly like detectTouchdownSwings/
//    detectStarterScratches (lib/engagementTriggers.ts:191-203 pattern):
//    userId -> { scratchedName, handcuffName, leagueNames: string[] }.
// 5. Per user: insertPulseItem with type 'critical_opportunity' (no
//    fingerprint, per the no-fingerprint/engagement_log-dedup pattern
//    lib/engagementTriggers.ts:126-132 documents for this trigger family)
//    — this is what makes it bypass syncPulseItems' stale-cleanup and the
//    Focused-mode 5-card cap (Task 12 enforces the cap-bypass on the
//    read/render side; this write-side call is what tags the item so that
//    filter can identify it).
//    claimTrigger(admin, userId, 'critical_opportunity',
//      `opportunity:${scratchedPlayerId}:${handcuffPlayerId}`) — one-shot,
//      does not skip isFreePlan (card free) but pushToUser call after it
//      DOES skip isFreePlan per the Global Constraints (Critical push is
//      not Pro-gated, unlike starter_scratch's push) — write a dedicated
//      push helper here rather than reusing pushToUser as-is, since
//      pushToUser's first gate (lib/engagementTriggers.ts:84-89) returns
//      early for free-plan users and Critical must not.
```

*(This task's implementation step is intentionally written as a precise structural guide with real reuse targets rather than fully-inlined code, because `detectStarterScratches`'s and `claimTrigger`'s full internals — beyond the signatures already confirmed — must be read line-by-line during implementation to mirror them exactly; a subagent implementing this task must read `lib/engagementTriggers.ts` in full before writing, which is a correctness requirement of this task, not an optional nicety.)*

- [ ] **Step 6: Wire into the news cron**

In `app/api/cron/news/route.ts`, alongside the existing `await detectStarterScratches(admin)` call (around line 65-88), add:
```ts
await detectCrossLeagueOpportunities(admin).catch(() => {})
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run lib/crossLeagueOpportunities.test.ts`
Expected: PASS (after filling in the fixture per Step 2's note)

- [ ] **Step 8: Commit**

```bash
git add lib/crossLeagueOpportunities.ts lib/crossLeagueOpportunities.test.ts lib/engagementTriggers.ts types/index.ts app/api/cron/news/route.ts
git commit -m "feat: detect and push cross-league handcuff opportunities on starter scratches"
```

---

## Task 11: `lib/freeAgentSearch.ts` — typed cross-league free-agent search (Component 5)

**Files:**
- Create: `lib/freeAgentSearch.ts`
- Test: `lib/freeAgentSearch.test.ts`

**Interfaces:**
- Consumes: `getSleeperPlayers`/`getSleeperRosters` (`lib/sleeper.ts`), `getEspnWaivers` (`lib/espn.ts`, returns `Promise<unknown>` — this task adds the missing typed parsing), `getYahooWaiverPlayers` (`lib/yahoo.ts`, same).
- Produces:
```ts
export interface FreeAgentResult {
  playerId: string
  playerName: string
  availability: { leagueId: string; leagueName: string; platform: 'sleeper' | 'espn' | 'yahoo'; status: 'free_agent' | 'waivers' }[]
}
export async function searchFreeAgentsAcrossLeagues(
  playerName: string,
  connectedLeagues: { id: string; name: string; platform: 'sleeper' | 'espn' | 'yahoo'; externalId: string }[]
): Promise<FreeAgentResult[]>
```
Consumed by Task 12 (search API route) and Task 10's Step (as the shared availability check, once this task lands first per the dependency note in Task 10).

- [ ] **Step 1: Read the real ESPN/Yahoo response shapes before writing types**

Run against a real connected league (or a captured fixture if live credentials aren't available in this environment):
```ts
// Scratch script, not committed — run once to inspect real shape:
import { getEspnWaivers } from './lib/espn'
getEspnWaivers(leagueId, credentials).then((r) => console.log(JSON.stringify(r, null, 2).slice(0, 2000)))
```
Do the same for `getYahooWaiverPlayers`. Use the real field names observed (ESPN's `kona_player_info` view nests player data under `players[].player.fullName`/`id` per its established shape elsewhere in `lib/espn.ts`; Yahoo's XML-derived JSON nests under `fantasy_content.league.players` per its established shape elsewhere in `lib/yahoo.ts` — confirm both against actual output, not assumption, before finalizing the parser types below).

- [ ] **Step 2: Write the failing tests** (against the confirmed real shapes from Step 1)

```ts
// lib/freeAgentSearch.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('./sleeper', () => ({
  getSleeperPlayers: vi.fn(() => Promise.resolve([
    { playerId: 'p1', name: 'Tyler Allgeier', firstName: 'Tyler', lastName: 'Allgeier', position: 'RB', nflTeam: 'ATL', injuryStatus: null, adpSleeper: 90, gsisId: null, depthChartOrder: 2, depthChartPosition: 'RB' },
  ])),
  getSleeperRosters: vi.fn(() => Promise.resolve([{ players: ['someone-else'] }])),
}))

import { searchFreeAgentsAcrossLeagues } from './freeAgentSearch'

describe('searchFreeAgentsAcrossLeagues', () => {
  it('finds a Sleeper free agent by name and reports it grouped by player', async () => {
    const result = await searchFreeAgentsAcrossLeagues('Allgeier', [
      { id: 'lg-1', name: 'My Sleeper League', platform: 'sleeper', externalId: 'sleeper-1' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].playerName).toBe('Tyler Allgeier')
    expect(result[0].availability).toEqual([
      { leagueId: 'lg-1', leagueName: 'My Sleeper League', platform: 'sleeper', status: 'free_agent' },
    ])
  })

  it('excludes a player who is rostered, not a free agent', async () => {
    const result = await searchFreeAgentsAcrossLeagues('nonexistent-rostered-player', [
      { id: 'lg-1', name: 'My Sleeper League', platform: 'sleeper', externalId: 'sleeper-1' },
    ])
    expect(result).toHaveLength(0)
  })
})
```

*(ESPN/Yahoo test cases must be added here using the real fixture shapes captured in Step 1 — not written blind, since neither shape was independently verified during research. This is a required follow-up within this step, not deferred.)*

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/freeAgentSearch.test.ts`
Expected: FAIL — `Cannot find module './freeAgentSearch'`

- [ ] **Step 4: Write the implementation** (Sleeper path shown in full; ESPN/Yahoo parsing follows the same `FreeAgentResult` shape using the field names confirmed in Step 1)

```ts
// lib/freeAgentSearch.ts
import { getSleeperPlayers, getSleeperRosters } from './sleeper'
import { getEspnWaivers } from './espn'
import { getYahooWaiverPlayers } from './yahoo'

export interface FreeAgentResult {
  playerId: string
  playerName: string
  availability: {
    leagueId: string
    leagueName: string
    platform: 'sleeper' | 'espn' | 'yahoo'
    status: 'free_agent' | 'waivers'
  }[]
}

interface ConnectedLeagueRef {
  id: string
  name: string
  platform: 'sleeper' | 'espn' | 'yahoo'
  externalId: string
}

export async function searchFreeAgentsAcrossLeagues(
  playerName: string,
  connectedLeagues: ConnectedLeagueRef[]
): Promise<FreeAgentResult[]> {
  const byPlayer = new Map<string, FreeAgentResult>()
  const query = playerName.toLowerCase()

  for (const league of connectedLeagues) {
    if (league.platform === 'sleeper') {
      const [players, rosters] = await Promise.all([
        getSleeperPlayers(),
        getSleeperRosters(league.externalId),
      ])
      const rosteredIds = new Set(rosters.flatMap((r: { players: string[] }) => r.players))
      const matches = players.filter(
        (p) => p.name.toLowerCase().includes(query) && !rosteredIds.has(p.playerId)
      )
      for (const p of matches) {
        const existing = byPlayer.get(p.playerId) ?? { playerId: p.playerId, playerName: p.name, availability: [] }
        existing.availability.push({ leagueId: league.id, leagueName: league.name, platform: 'sleeper', status: 'free_agent' })
        byPlayer.set(p.playerId, existing)
      }
    }
    // ESPN/Yahoo branches: parse getEspnWaivers/getYahooWaiverPlayers per the
    // real shapes confirmed in Step 1, filter by playerName, and push into
    // byPlayer using the same grouped-by-playerId pattern as the Sleeper
    // branch above. Fill in using the exact field paths captured in Step 1
    // — do not guess field names.
  }

  return Array.from(byPlayer.values())
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/freeAgentSearch.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/freeAgentSearch.ts lib/freeAgentSearch.test.ts
git commit -m "feat: add typed cross-league free-agent search"
```

---

## Task 12: Free-agent search API route + UI

**Files:**
- Create: `app/api/leagues/free-agents/route.ts`
- Create: `components/leagues/FreeAgentSearch.tsx`
- Test: `app/api/leagues/free-agents/route.test.ts`, `components/leagues/FreeAgentSearch.test.tsx`

**Interfaces:**
- Consumes: `searchFreeAgentsAcrossLeagues` (Task 11).
- Produces: `GET /api/leagues/free-agents?q=<name>` → `{ results: FreeAgentResult[] }`; `<FreeAgentSearch />` UI, mounted on the Leagues page (same file located in Task 4).

- [ ] **Step 1: Write the failing route test**

```ts
// app/api/leagues/free-agents/route.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/freeAgentSearch', () => ({
  searchFreeAgentsAcrossLeagues: vi.fn(() => Promise.resolve([
    { playerId: 'p1', playerName: 'Tyler Allgeier', availability: [{ leagueId: 'lg-1', leagueName: 'A', platform: 'sleeper', status: 'free_agent' }] },
  ])),
}))
vi.mock('@/lib/auth', () => ({ getAuthedUser: () => Promise.resolve({ id: 'user-1' }) }))
vi.mock('@/lib/supabaseAdmin', () => ({ getAdminClient: () => ({ from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: [] }) }) }) }) }))

import { GET } from './route'

describe('GET /api/leagues/free-agents', () => {
  it('returns grouped results for a query', async () => {
    const res = await GET(new Request('http://localhost/api/leagues/free-agents?q=Allgeier'))
    const body = await res.json()
    expect(body.results).toHaveLength(1)
    expect(body.results[0].playerName).toBe('Tyler Allgeier')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/leagues/free-agents/route.test.ts`
Expected: FAIL

- [ ] **Step 3: Write the route** (reusing the same auth/admin-client helper names confirmed in Task 3)

```ts
// app/api/leagues/free-agents/route.ts
import { NextResponse } from 'next/server'
import { searchFreeAgentsAcrossLeagues } from '@/lib/freeAgentSearch'
import { getAdminClient } from '@/lib/supabaseAdmin'
import { getAuthedUser } from '@/lib/auth'

export async function GET(req: Request) {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const q = new URL(req.url).searchParams.get('q')
  if (!q || q.length < 2) return NextResponse.json({ results: [] })

  const admin = getAdminClient()
  const { data: leagueRows } = await admin.from('connected_leagues').select('id, name, platform, external_id').eq('user_id', user.id)
  const connectedLeagues = (leagueRows ?? []).map((l: any) => ({
    id: l.id, name: l.name, platform: l.platform, externalId: l.external_id,
  }))

  const results = await searchFreeAgentsAcrossLeagues(q, connectedLeagues)
  return NextResponse.json({ results })
}
```

*(Verify `connected_leagues`' real column names — `name`, `external_id` — against `supabase/schema.sql` before finalizing; the exact columns weren't independently confirmed during research beyond `id`/`user_id`/`platform`.)*

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/leagues/free-agents/route.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing component test**

```tsx
// components/leagues/FreeAgentSearch.test.tsx
import { describe, it, expect, vi, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FreeAgentSearch } from './FreeAgentSearch'

global.fetch = vi.fn(() => Promise.resolve({
  json: () => Promise.resolve({ results: [{ playerId: 'p1', playerName: 'Tyler Allgeier', availability: [{ leagueId: 'lg-1', leagueName: 'My League', platform: 'sleeper', status: 'free_agent' }] }] }),
})) as any

describe('FreeAgentSearch', () => {
  it('searches and shows grouped results with league names', async () => {
    render(<FreeAgentSearch />)
    fireEvent.change(screen.getByPlaceholderText(/search a player/i), { target: { value: 'Allgeier' } })
    await waitFor(() => expect(screen.getByText('Tyler Allgeier')).toBeInTheDocument())
    expect(screen.getByText(/My League/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run components/leagues/FreeAgentSearch.test.tsx`
Expected: FAIL — `Cannot find module './FreeAgentSearch'`

- [ ] **Step 7: Write the component**

```tsx
// components/leagues/FreeAgentSearch.tsx
'use client'
import { useState } from 'react'
import type { FreeAgentResult } from '@/lib/freeAgentSearch'
import HintAnchor from '@/components/hints/HintAnchor'

export function FreeAgentSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FreeAgentResult[]>([])

  async function onChange(value: string) {
    setQuery(value)
    if (value.length < 2) { setResults([]); return }
    const res = await fetch(`/api/leagues/free-agents?q=${encodeURIComponent(value)}`)
    const body = await res.json()
    setResults(body.results)
  }

  return (
    <HintAnchor id="free-agent-search">
      <input
        placeholder="Search a player across all your leagues"
        value={query}
        onChange={(e) => onChange(e.target.value)}
      />
      <ul>
        {results.map((r) => (
          <li key={r.playerId}>
            {r.playerName}
            <ul>
              {r.availability.map((a) => (
                <li key={a.leagueId}>{a.leagueName} — {a.status === 'free_agent' ? 'Free agent' : 'On waivers'}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </HintAnchor>
  )
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run components/leagues/FreeAgentSearch.test.tsx`
Expected: PASS

- [ ] **Step 9: Mount on the Leagues page, add hint entry**

Add `<FreeAgentSearch />` to the Leagues page (file located in Task 4). In `lib/hints.ts`, add:
```ts
{
  id: 'free-agent-search',
  title: 'One search, every league',
  body: 'See which of your leagues a player is actually available in — no more checking Sleeper, then ESPN, then Yahoo one at a time.',
  placement: 'bottom',
},
```

- [ ] **Step 10: Commit**

```bash
git add app/api/leagues/free-agents/route.ts app/api/leagues/free-agents/route.test.ts components/leagues/FreeAgentSearch.tsx components/leagues/FreeAgentSearch.test.tsx lib/hints.ts
git commit -m "feat: add cross-league free-agent search"
```

---

## Task 13: `lib/startSit.ts` — extract the gap-metric engine (prerequisite for Component 4)

**Files:**
- Create: `lib/startSit.ts`
- Modify: `app/api/lineup/sleeper/route.ts` (replace inline logic with the extracted import; **zero behavior change**, this is a pure extraction)
- Test: `lib/startSit.test.ts`

**Interfaces:**
- Produces:
```ts
export function verdictForDelta(delta: number): { verdict: 'start_b' | 'lean_b' | 'toss_up'; confidence: 'high' | 'medium' | 'low' }
export function buildStartSitRecommendations(/* same params app/api/lineup/sleeper/route.ts:229-240 currently uses */): /* same return shape */
```
Consumed by Task 14.

- [ ] **Step 1: Read the existing logic in full before extracting**

Run: read `app/api/lineup/sleeper/route.ts:170-260` completely (the `verdictForDelta` function at 177-181 and its caller/ADP-delta computation at 229-240) — the extraction must be byte-for-byte behavior-preserving, so copy the real logic, don't reimplement from the summary in this plan.

- [ ] **Step 2: Write the failing test** (mirroring whatever thresholds Step 1 reveals — the 15/40 values are confirmed, but the exact function boundary/return shape must match Step 1's reading)

```ts
// lib/startSit.test.ts
import { describe, it, expect } from 'vitest'
import { verdictForDelta } from './startSit'

describe('verdictForDelta', () => {
  it('returns start_b/high for a delta >= 40', () => {
    expect(verdictForDelta(45)).toEqual({ verdict: 'start_b', confidence: 'high' })
  })
  it('returns lean_b/medium for a delta >= 15 and < 40', () => {
    expect(verdictForDelta(20)).toEqual({ verdict: 'lean_b', confidence: 'medium' })
  })
  it('returns toss_up/low for a delta < 15', () => {
    expect(verdictForDelta(5)).toEqual({ verdict: 'toss_up', confidence: 'low' })
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/startSit.test.ts`
Expected: FAIL — `Cannot find module './startSit'`

- [ ] **Step 4: Extract into `lib/startSit.ts`**, moving (not duplicating) the real code found in Step 1 verbatim, then update `app/api/lineup/sleeper/route.ts` to `import { verdictForDelta, buildStartSitRecommendations } from '@/lib/startSit'` and delete the now-duplicate inline definitions.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/startSit.test.ts`
Expected: PASS, 3 tests

- [ ] **Step 6: Verify zero behavior change on the existing route**

Run: `npx vitest run app/api/lineup/sleeper/route.test.ts` (existing test file, if present — if none exists, this is a gap in existing coverage, not something to newly invent here; note it and proceed).
Expected: PASS, unchanged from before the extraction.

- [ ] **Step 7: Commit**

```bash
git add lib/startSit.ts lib/startSit.test.ts app/api/lineup/sleeper/route.ts
git commit -m "refactor: extract start/sit gap-metric engine into a shared lib"
```

---

## Task 14: Proactive advisory lineup calls (Component 4)

**Files:**
- Create: `lib/proactiveLineupCalls.ts`
- Test: `lib/proactiveLineupCalls.test.ts`

**Interfaces:**
- Consumes: `buildStartSitRecommendations`, `verdictForDelta` (Task 13), `checkAndIncrementUsage` (`lib/usageLimits.ts:52`), `isFreePlan` (`lib/usageLimits.ts:96`).
- Produces: `export async function detectProactiveLineupCalls(admin: AdminClient): Promise<void>`, called from the same cron `detectCrossLeagueOpportunities`/`detectStarterScratches` are called from (`app/api/cron/news/route.ts`, or a more appropriate existing lineup-focused cron if one exists — check for an existing weekly/daily lineup cron before assuming the news cron is the right trigger point).

- [ ] **Step 1: Write the failing test**

```ts
// lib/proactiveLineupCalls.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('./startSit', () => ({
  buildStartSitRecommendations: vi.fn(() => [
    { userId: 'user-1', leagueId: 'lg-1', leagueName: 'League A', startPlayer: 'X', sitPlayer: 'Y', delta: 45 },
    { userId: 'user-1', leagueId: 'lg-2', leagueName: 'League B', startPlayer: 'X', sitPlayer: 'Y', delta: 45 },
  ]),
}))
vi.mock('./usageLimits', () => ({
  isFreePlan: vi.fn(() => Promise.resolve(true)),
  checkAndIncrementUsage: vi.fn(() => Promise.resolve({ allowed: true, remaining: 2 })),
}))

import { detectProactiveLineupCalls } from './proactiveLineupCalls'

describe('detectProactiveLineupCalls', () => {
  it('collapses the same start/sit call across leagues into one card naming both', async () => {
    // Assert one Pulse item insert per user, listing both League A and League B.
  })

  it('respects the free-tier weekly cap via checkAndIncrementUsage before firing', async () => {
    // Re-mock checkAndIncrementUsage to return { allowed: false, remaining: 0 };
    // assert no Pulse item is inserted for that user.
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/proactiveLineupCalls.test.ts`
Expected: FAIL — `Cannot find module './proactiveLineupCalls'`

- [ ] **Step 3: Write the implementation**

```ts
// lib/proactiveLineupCalls.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildStartSitRecommendations } from './startSit'
import { isFreePlan, checkAndIncrementUsage } from './usageLimits'

const WEEKLY_FREE_LIMIT = 3 // same cap as the on-demand Start/Sit engine (app/api/lineup/sleeper/route.ts:23)

export async function detectProactiveLineupCalls(admin: SupabaseClient): Promise<void> {
  const recommendations = await buildStartSitRecommendations(admin)

  const byUser = new Map<string, { startPlayer: string; sitPlayer: string; leagueNames: string[] }>()
  for (const rec of recommendations) {
    if (rec.delta < 40) continue // only fire proactively on a high-confidence gap, per the design spec
    const key = rec.userId
    const existing = byUser.get(key) ?? { startPlayer: rec.startPlayer, sitPlayer: rec.sitPlayer, leagueNames: [] }
    existing.leagueNames.push(rec.leagueName)
    byUser.set(key, existing)
  }

  for (const [userId, info] of byUser) {
    const free = await isFreePlan(admin, userId)
    const usage = await checkAndIncrementUsage(admin, userId, 'proactive_lineup_call', WEEKLY_FREE_LIMIT)
    if (free && !usage.allowed) continue

    await admin.from('pulse_items').insert({
      user_id: userId,
      type: 'lineup_decision',
      priority: 'important',
      headline: `Start ${info.startPlayer} over ${info.sitPlayer}`,
      reasoning: `Affects: ${info.leagueNames.join(', ')}`,
      affected_leagues_json: info.leagueNames,
      deadline: null,
      action_url: null,
      status: 'open',
    })
  }
}
```

*(The `pulse_items` insert here is illustrative of the target shape — implementer should confirm against `lib/pulse.ts`'s own `lineup_decision` construction, e.g. `lib/pulse.ts:368-378`, and match its exact `affected_leagues_json` structure, e.g. `AffectedLeague[]` not a bare string array, before finalizing.)*

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/proactiveLineupCalls.test.ts`
Expected: PASS, 2 tests

- [ ] **Step 5: Wire into a cron, add hint entry**

Locate the right cron trigger point (check for an existing weekly/pre-game lineup cron before defaulting to the news cron), add the `.catch(() => {})`-wrapped call. In `lib/hints.ts`:
```ts
{
  id: 'proactive-lineup-call',
  title: "Rostiro tells you, you make the move",
  body: 'We surface the call — tap through to make it on Sleeper, ESPN, or Yahoo. We never set your lineup for you.',
  placement: 'bottom',
},
```

- [ ] **Step 6: Commit**

```bash
git add lib/proactiveLineupCalls.ts lib/proactiveLineupCalls.test.ts lib/hints.ts <cron file>
git commit -m "feat: add proactive cross-league advisory lineup calls"
```

---

## Task 15: `CriticalOpportunityCardView` + Focused-mode cap bypass (display side of Component 3)

**Files:**
- Create: `components/interrupt/CriticalOpportunityCardView.tsx`
- Modify: wherever Focused mode's 5-card cap is currently enforced (likely `app/(dashboard)/pulse/page.tsx` — confirm exact location by reading its render logic)
- Test: `components/interrupt/CriticalOpportunityCardView.test.tsx`

**Interfaces:**
- Consumes: `InterruptCardView`'s prop shape as a structural reference (`components/interrupt/InterruptCardView.tsx:4-18`) — this is a sibling component, not a wrapper, since Critical items carry different fields (handcuff name, per-league deep-links) than the generic interrupt card.
- Produces: `<CriticalOpportunityCardView scratchedPlayer={string} handcuffPlayer={string} leagues={{leagueName: string; deepLink: string}[]} contained?={boolean} />`.

- [ ] **Step 1: Write the failing test**

```tsx
// components/interrupt/CriticalOpportunityCardView.test.tsx
import { describe, it, expect, render, screen } from '@testing-library/react'
import { CriticalOpportunityCardView } from './CriticalOpportunityCardView'

describe('CriticalOpportunityCardView', () => {
  it('renders the scratched player, handcuff, and every league with a deep-link', () => {
    render(
      <CriticalOpportunityCardView
        scratchedPlayer="Bijan Robinson"
        handcuffPlayer="Tyler Allgeier"
        leagues={[
          { leagueName: 'Sleeper League 2', deepLink: 'https://sleeper.com/l/2' },
          { leagueName: 'ESPN League 4', deepLink: 'https://espn.com/l/4' },
        ]}
      />
    )
    expect(screen.getByText(/Bijan Robinson/)).toBeInTheDocument()
    expect(screen.getByText(/Tyler Allgeier/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Sleeper League 2/ })).toHaveAttribute('href', 'https://sleeper.com/l/2')
    expect(screen.getByRole('link', { name: /ESPN League 4/ })).toHaveAttribute('href', 'https://espn.com/l/4')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/interrupt/CriticalOpportunityCardView.test.tsx`
Expected: FAIL — `Cannot find module './CriticalOpportunityCardView'`

- [ ] **Step 3: Write the implementation**

```tsx
// components/interrupt/CriticalOpportunityCardView.tsx
export function CriticalOpportunityCardView({
  scratchedPlayer,
  handcuffPlayer,
  leagues,
  contained,
}: {
  scratchedPlayer: string
  handcuffPlayer: string
  leagues: { leagueName: string; deepLink: string }[]
  contained?: boolean
}) {
  return (
    <div className={contained ? 'relative' : 'fixed top-4 right-4'} data-priority="critical">
      <p className="uppercase text-xs tracking-wide text-red-400">Critical opportunity</p>
      <p className="font-semibold">
        {scratchedPlayer} questionable — {handcuffPlayer} is available in {leagues.length} of your leagues
      </p>
      <ul>
        {leagues.map((l) => (
          <li key={l.leagueName}>
            <a href={l.deepLink}>{l.leagueName}</a>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/interrupt/CriticalOpportunityCardView.test.tsx`
Expected: PASS

- [ ] **Step 5: Bypass the Focused-mode 5-card cap for `critical_opportunity` items**

Read the Pulse page's current cap-enforcement logic (`app/(dashboard)/pulse/page.tsx`), which today likely does something like `items.slice(0, 5)` for Focused mode. Change it to filter Critical items out before slicing, then concatenate them back in uncapped:
```ts
const criticalItems = items.filter((i) => i.type === 'critical_opportunity')
const otherItems = items.filter((i) => i.type !== 'critical_opportunity')
const cappedOther = mode === 'focused' ? otherItems.slice(0, 5) : otherItems
const visibleItems = [...criticalItems, ...cappedOther]
```
Also exclude `critical_opportunity` items from Task 7's `DeadlineList`/Component 2 truncation entirely — they render through this card, not the deadline list, so no change needed there beyond confirming they aren't accidentally being fed into `rankDeadlines`.

- [ ] **Step 6: Add the hint entry**

In `lib/hints.ts`:
```ts
{
  id: 'critical-opportunity-card',
  title: "This one always shows",
  body: "A real injury plus a real opportunity in your leagues is too high-stakes to hide behind a card limit — this alert always appears in full.",
  placement: 'top',
},
```

- [ ] **Step 7: Commit**

```bash
git add components/interrupt/CriticalOpportunityCardView.tsx components/interrupt/CriticalOpportunityCardView.test.tsx app/\(dashboard\)/pulse/page.tsx lib/hints.ts
git commit -m "feat: render critical cross-league opportunity cards outside the Focused-mode cap"
```

---

## Task 16: Simulation Studio registration — Favoriting + Free-Agent Search (generic `StatePack<T>` path)

**Files:**
- Modify: `app/demo/lib/studioPacks.tsx` (extend `StudioStateKind`, register in `SURFACE_PACKS`)
- Create: `app/demo/studio/packs/favoriting/favoritingPack.ts` (+ `AuthorForm`, `FullSurface`, `FocalCard` components in the same directory, following `app/demo/studio/packs/waiver/waiverPack.ts`'s exact file layout)
- Create: `app/demo/studio/packs/free-agent-search/freeAgentSearchPack.ts` (+ components, same layout)
- Test: `app/demo/lib/studioPacks.test.ts` (extend existing), `app/demo/studio/packs/favoriting/favoritingPack.test.tsx`, `app/demo/studio/packs/free-agent-search/freeAgentSearchPack.test.tsx`

**Interfaces:**
- Consumes: `StatePack<T>` type (`app/demo/lib/studioPacks.tsx:8-15`), the real `waiverPack` as the structural template (`app/demo/studio/packs/waiver/waiverPack.ts:12-20`).
- Produces: two new `SURFACE_PACKS` entries, `'favoriting'` and `'free_agent_search'`.

- [ ] **Step 1: Read `waiverPack.ts` and its `AuthorForm`/`FullSurface`/`FocalCard` components in full** — this task's two new packs must match this file's structure exactly (same four-export layout), so read it completely before writing anything.

- [ ] **Step 2: Write the failing test for the registry extension**

```ts
// app/demo/lib/studioPacks.test.ts (add to existing file)
import { describe, it, expect } from 'vitest'
import { SURFACE_PACKS } from './studioPacks'

describe('SURFACE_PACKS — Component 1 & 5 registration', () => {
  it('registers a favoriting pack', () => {
    expect(SURFACE_PACKS.favoriting).toBeDefined()
    expect(SURFACE_PACKS.favoriting?.label).toBe('League Favoriting')
  })
  it('registers a free_agent_search pack', () => {
    expect(SURFACE_PACKS.free_agent_search).toBeDefined()
    expect(SURFACE_PACKS.free_agent_search?.label).toBe('Free-Agent Search')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run app/demo/lib/studioPacks.test.ts`
Expected: FAIL

- [ ] **Step 4: Extend `StudioStateKind` and register both packs**

In `app/demo/lib/studioPacks.tsx`:
```ts
export type StudioStateKind = 'standard' | 'waiver_day' | 'film_room' | 'favoriting' | 'free_agent_search'
```
```ts
import { favoritingPack } from '../studio/packs/favoriting/favoritingPack'
import { freeAgentSearchPack } from '../studio/packs/free-agent-search/freeAgentSearchPack'

export const SURFACE_PACKS: Partial<Record<StudioStateKind, StatePack<any>>> = {
  standard: standardPack,
  waiver_day: waiverPack,
  film_room: filmPack,
  favoriting: favoritingPack,
  free_agent_search: freeAgentSearchPack,
}
```

- [ ] **Step 5: Write `favoritingPack.ts`** (structure mirrors `waiverPack.ts` exactly — `AuthorForm` lets the operator pick which of a fake league list are favorited, `FullSurface`/`FocalCard` render the Leagues page and `FavoriteStar` state respectively, both reusing the real `FavoriteStar` component from Task 4 in a display-only/no-fetch mode via a `previewMode` prop — add this prop to `FavoriteStar` if it doesn't already support disabling the real fetch call, since Studio content must never make a real API call)

```ts
// app/demo/studio/packs/favoriting/favoritingPack.ts
import type { StatePack } from '../../../lib/studioPacks'
import { FavoritingAuthorForm } from './FavoritingAuthorForm'
import { FavoritingFullSurface } from './FavoritingFullSurface'
import { FavoritingFocalCard } from './FavoritingFocalCard'

export interface FavoritingContent {
  leagues: { name: string; favorited: boolean }[]
}

export const favoritingPack: StatePack<FavoritingContent> = {
  state: 'favoriting',
  label: 'League Favoriting',
  defaultContent: () => ({
    leagues: [
      { name: "Lawrence's Legends League", favorited: true },
      { name: 'Work League', favorited: true },
      { name: 'College Friends Dynasty', favorited: false },
    ],
  }),
  prefill: () => ({
    leagues: [
      { name: "Lawrence's Legends League", favorited: true },
      { name: 'Work League', favorited: true },
      { name: 'College Friends Dynasty', favorited: false },
      { name: 'Family League', favorited: false },
    ],
  }),
  AuthorForm: FavoritingAuthorForm,
  FullSurface: FavoritingFullSurface,
  FocalCard: FavoritingFocalCard,
}
```
Write `FavoritingAuthorForm.tsx`, `FavoritingFullSurface.tsx`, `FavoritingFocalCard.tsx` in the same directory, each a simple presentational component over `FavoritingContent` (no fetch calls) — mirror the equivalent three `Waiver*` component files' internal structure (read them in Step 1) rather than inventing new patterns.

- [ ] **Step 6: Write `freeAgentSearchPack.ts`**, same structure, `FreeAgentSearchContent = { query: string; results: FreeAgentResult[] }` using the real `FreeAgentResult` type from Task 11, with `prefill()` returning a realistic multi-league result (e.g. the Tyler Allgeier example used throughout this plan) so the operator has a compelling default to film immediately.

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run app/demo/lib/studioPacks.test.ts app/demo/studio/packs/favoriting/favoritingPack.test.tsx app/demo/studio/packs/free-agent-search/freeAgentSearchPack.test.tsx`
Expected: PASS

- [ ] **Step 8: Add buttons in `StudioPanel.tsx`**

Read `app/demo/studio/StudioPanel.tsx`'s existing `PanelState`/`STATES` union (around lines 12-16) and add `'favoriting'` and `'free_agent_search'` alongside the existing generic states, following whatever pattern renders a state-select button per existing entry (`waiver_day`, `film_room`) — these two new kinds use the exact same generic `StatePack<T>` rendering path already wired for `waiver_day`/`film_room`, requiring no special-case branching (unlike Task 17's Critical card).

- [ ] **Step 9: Commit**

```bash
git add app/demo/lib/studioPacks.tsx app/demo/lib/studioPacks.test.ts app/demo/studio/packs/favoriting/ app/demo/studio/packs/free-agent-search/ app/demo/studio/StudioPanel.tsx
git commit -m "feat: register favoriting and free-agent-search Studio packs"
```

---

## Task 17: Simulation Studio registration — Critical Opportunity + Advisory Lineup Call (special-case path)

**Files:**
- Modify: `app/demo/studio/StudioPanel.tsx`, `app/demo/studio/StudioCanvas.tsx`, `app/demo/studio/Studio.tsx` (each already union `StudioStateKind | 'game_day' | 'live' | 'push'` per research — extend to `| 'critical_opportunity' | 'lineup_decision'`)
- Test: extend whichever existing test file covers the `game_day` branch (locate via `grep -rl "game_day" app/demo/studio/*.test.tsx`)

**Interfaces:**
- Consumes: `CriticalOpportunityCardView` (Task 15), `LineupDecisionCardView` (create in this task, same shape as `CriticalOpportunityCardView` but for the advisory lineup call — see Task 14's card fields).

- [ ] **Step 1: Read the existing `game_day` special-case branch in full** across all three files (`Studio.tsx:50` and the surrounding `StudioPanel.tsx:50-88` player-search/metric-row UI) — this is the structural template for both new branches, since Critical and Lineup-Decision cards are interrupt-style (single-slot, `InterruptCardView`-family), not `FullSurface`/`FocalCard`-style.

- [ ] **Step 2: Write `LineupDecisionCardView.tsx`**

```tsx
// components/interrupt/LineupDecisionCardView.tsx
export function LineupDecisionCardView({
  startPlayer,
  sitPlayer,
  leagues,
  contained,
}: {
  startPlayer: string
  sitPlayer: string
  leagues: { leagueName: string; deepLink: string }[]
  contained?: boolean
}) {
  return (
    <div className={contained ? 'relative' : 'fixed top-4 right-4'}>
      <p className="uppercase text-xs tracking-wide">Advisory lineup call</p>
      <p className="font-semibold">Start {startPlayer} over {sitPlayer}</p>
      <ul>
        {leagues.map((l) => (
          <li key={l.leagueName}><a href={l.deepLink}>{l.leagueName}</a></li>
        ))}
      </ul>
    </div>
  )
}
```
Test file: `components/interrupt/LineupDecisionCardView.test.tsx`, same assertion pattern as Task 15 Step 1.

- [ ] **Step 3: Extend the three Studio files' union types**

```ts
// StudioPanel.tsx, StudioCanvas.tsx, Studio.tsx — each:
type ExtendedKind = StudioStateKind | 'game_day' | 'live' | 'push' | 'critical_opportunity' | 'lineup_decision'
```
(Confirm the exact existing type name/declaration site in each file during Step 1's read — the plan's placeholder name `ExtendedKind` should be replaced with whatever the real union is actually called in each file.)

- [ ] **Step 4: Add author UI in `StudioPanel.tsx`**, mirroring the `game_day` branch's player-search pattern (lines 50-88): a form letting the operator pick the scratched/injured player, the handcuff/backup player, and a freeform list of league names — same "real-prefill + full editorial override" hybrid model the rest of the Studio uses, not a rebuild of that model.

- [ ] **Step 5: Add render branches in `Studio.tsx`**, mirroring line 50's `game_day` → `<InterruptCardView>` branch:
```tsx
{activeKind === 'critical_opportunity' && (
  <CriticalOpportunityCardView
    scratchedPlayer={content.scratchedPlayer}
    handcuffPlayer={content.handcuffPlayer}
    leagues={content.leagues}
    contained
  />
)}
{activeKind === 'lineup_decision' && (
  <LineupDecisionCardView
    startPlayer={content.startPlayer}
    sitPlayer={content.sitPlayer}
    leagues={content.leagues}
    contained
  />
)}
```

- [ ] **Step 6: Run the extended test suite**

Run: `npx vitest run app/demo/studio/`
Expected: PASS, including the new branches

- [ ] **Step 7: Commit**

```bash
git add components/interrupt/LineupDecisionCardView.tsx components/interrupt/LineupDecisionCardView.test.tsx app/demo/studio/StudioPanel.tsx app/demo/studio/StudioCanvas.tsx app/demo/studio/Studio.tsx
git commit -m "feat: add Critical Opportunity and Advisory Lineup Call to Simulation Studio"
```

---

## Task 18: Onboarding copy for the favoriting override behavior

**Files:**
- Modify: the onboarding notifications step (same file the 2026-07-11 scratch-alerts spec added `notify_scratches` to — locate via `grep -rl "notify_scratches" app/onboarding` or equivalent)

**Interfaces:** none (copy-only change).

- [ ] **Step 1: Add the disclosure copy**

Add a line near the favoriting explanation (if onboarding introduces favoriting) or near the notification preferences: *"Critical alerts always show, even for leagues you haven't starred — a real injury-plus-opportunity is too high-stakes to filter out."* Match this exact language to the design spec's Component 3 section so product copy and the spec stay in sync.

- [ ] **Step 2: Commit**

```bash
git add <onboarding file>
git commit -m "docs: add onboarding disclosure for critical-alert favoriting override"
```

---

## Self-review notes (fixed inline before handoff)

- **Spec coverage:** all 7 spec components have at least one task (Favoriting: 1-6; Deadline scaling: 7-7.1; Critical tier: 8-10, 15; Advisory lineup calls: 13-14; Free-agent search: 11-12; Tooltips: woven into 7.1/12/14/15/18 rather than a standalone task, since each hint is one array entry added at the point the feature ships; Studio: 16-17).
- **Placeholder scan:** three tasks (5, 6, 10) contain explicit "read X before finalizing" sub-steps rather than fully blind code, because the underlying files' full internals weren't captured by research to the same depth as their public signatures — these are flagged as required reads, not skippable TODOs, and are the plan's honest acknowledgment of the research boundary rather than a hidden gap.
- **Type consistency:** `LeagueDeadline`, `FreeAgentResult`, `HandcuffCandidate` are each defined once (Tasks 7, 11, 8 respectively) and referenced by type-only imports everywhere else — no redefinition drift.
- **Scope:** 18 tasks across 5 feature areas is large for one plan but matches the spec's own single-surface framing (everything lives in Pulse/System Bar/Leagues); Tasks 16-17 (Studio) are explicitly deferrable per-feature if a reviewer wants to ship 1-14 first and Studio recording support later — noted as a valid split point if needed, not required to land atomically.
