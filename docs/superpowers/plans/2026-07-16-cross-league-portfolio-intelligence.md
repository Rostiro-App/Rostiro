# Cross-League Portfolio Intelligence Implementation Plan (v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Canonical Player Identity, League Favoriting (corrected schema), an honest deadline display that scales with league count, a Critical alert tier scoped to running backs with disclosed confidence, cross-league free-agent search with honest availability states, and Simulation Studio recording support.

**v2 changes from v1 (full rationale in `docs/superpowers/specs/2026-07-16-cross-league-portfolio-intelligence-design.md`):** a second-opinion review found a favoriting-persistence bug, an IDOR in the favorites API, a self-contradiction on Critical push gating, an incomplete dedup design, and two places v1 itself violated the founder's own "never present a guess as a fact" rule (depth-chart handcuffs, ADP-driven proactive pushes). This plan fixes all of them. **Advisory lineup calls are no longer in scope this pass** — the existing on-demand Start/Sit engine is unchanged; the proactive-push idea from v1 is deferred pending real weekly projections. **Canonical Player Identity is a new prerequisite task** (Task 0) that Components 3 and 5 both depend on.

**Architecture:** Extends existing systems — Pulse's fingerprint-based item architecture (`lib/pulse.ts`), the Hint system (`lib/hints.ts`/`HintAnchor`/`HintProvider`), and the Simulation Studio's `StatePack<T>` registry (`app/demo/lib/studioPacks.tsx`). Two new tables (`league_preferences`, and whatever Task 0 finds `player_mappings`' real current state to be); one new cross-reference (RB-only injury × real free-agent/waiver availability).

**Tech Stack:** Next.js App Router, Supabase (Postgres + RLS), TypeScript, Vitest.

## Global Constraints

- **No data transformation on facts, and no undisclosed inference either.** Deadlines/lineup locks render exactly as sourced. Any inferred conclusion (a depth-chart "next guy up") must carry a `confidence`/`provenance` label — never presented with the same certainty as a sourced fact.
- **No auto-pilot framing.** No task in this plan may add a write call to `lib/yahoo.ts`'s `submitYahooLineup`/`submitYahooWaiverClaim`/`proposeYahooTrade` or equivalent.
- **Push notifications always respect `users.push_enabled = false`, with zero exceptions, for every alert type in this plan including Critical.** Only in-app display (the Focused-mode 5-card cap) is bypassed for Critical items — never a user's own notification settings.
- **Favoriting uses `league_preferences(user_id, league_id, is_favorited)`, not a presence/absence table.** Missing row = favorited (true). Every favorite/unfavorite action **upserts an explicit row** — never deletes. This is a corrected design; the original delete-based approach cannot represent "favorited-by-default but explicitly unfavorited one league," which is the common case.
- **Every mutation to `league_preferences` must verify league ownership** (`connected_leagues.id = leagueId AND connected_leagues.user_id = authenticated user`) before writing, even though the write itself goes through a service-role client that bypasses RLS.
- **Cross-platform player comparisons (Components 3 and 5) must go through the canonical identity layer (Task 0), never raw per-platform IDs.**
- **Critical alerts are restricted to running backs in this pass**, and their copy must say "next listed RB on the depth chart," never "the handcuff" or "the confirmed replacement."
- **Advisory lineup calls are out of scope for this plan.** Do not add a proactive push based on ADP gaps. The existing on-demand Start/Sit engine (`app/api/lineup/sleeper/route.ts`) is not touched by this plan at all.
- **Free-agent search never calls a live per-platform API synchronously inside a search request.** Sleeper reads from the existing `players_cache` table; ESPN/Yahoo calls are bounded-parallel and cached with a short TTL.
- **Component naming corrections (verified against real code):** the Hint component is `HintAnchor` (default export, `components/hints/HintAnchor.tsx`). The Studio registry is `SURFACE_PACKS`/`StatePack<T>` (`app/demo/lib/studioPacks.tsx`) for generic surfaces; `touchdown_swing`/`lineup_lock`/Critical follow the special-cased `'game_day'`-style branch across `Studio.tsx`/`StudioPanel.tsx`/`StudioCanvas.tsx` instead, since they're interrupt-style single-slot cards, not `FullSurface`/`FocalCard` pairs.

---

## File Structure

**New files:**
- `supabase/migration_league_preferences.sql` — `league_preferences` table (corrected schema).
- `supabase/migration_player_mappings.sql` — creates/completes `player_mappings` if Task 0's audit finds it genuinely missing or incomplete (see Task 0 Step 1 — this file's exact contents depend on that audit, not assumed up front).
- `lib/playerIdentity.ts` — canonical identity resolution (Task 0).
- `lib/leagueFavorites.ts` — favorite CRUD (corrected: upsert-only, ownership-checked).
- `app/api/leagues/favorites/route.ts` — GET/POST, with ownership verification.
- `components/leagues/FavoriteStar.tsx` — star toggle UI.
- `lib/deadlineRanking.ts` — pure ranking/truncation (unchanged from v1).
- `components/pulse/DeadlineList.tsx` — renders with the `~` honesty flag (unchanged from v1).
- `lib/handcuffDetector.ts` — RB-only, confidence-labeled depth-chart lookup (revised from v1).
- `lib/crossLeagueOpportunities.ts` — orchestration, now fingerprint-based (revised from v1).
- `components/interrupt/CriticalOpportunityCardView.tsx` — presentational card with confidence copy.
- `lib/freeAgentAvailability.ts` — typed per-platform availability with the 5-state model (`rostered`/`free_agent`/`waivers`/`pending_transaction`/`unconfirmed`), debounced/cached/rate-limit-aware.
- `app/api/leagues/free-agents/route.ts` — search API.
- `components/leagues/FreeAgentSearch.tsx` — debounced search UI.
- `app/demo/studio/packs/favoriting/favoritingPack.ts` (+ components) — Studio `StatePack<T>` entry.
- `app/demo/studio/packs/free-agent-search/freeAgentSearchPack.ts` (+ components) — Studio `StatePack<T>` entry.

**Modified files:**
- `lib/pulse.ts` — favorite-filtering in `buildPulseItemsForUser`.
- `app/api/live/status/route.ts` — favorite-filtering on the `connected_leagues` query.
- `lib/engagementTriggers.ts` — Critical push path added, respecting `isFreePlan`/`push_enabled` exactly like every other push (no bypass).
- `types/index.ts` — `PulseItemType` extended with `critical_opportunity`; new `CanonicalPlayer`, `AvailabilityStatus`, `HandcuffCandidate` (revised: includes `confidence`/`provenance`) types.
- `lib/hints.ts` — new entries for favoriting, Critical cards, free-agent search.
- League-card page (exact path confirmed in Task 3) — mounts `FavoriteStar`.
- `app/demo/lib/studioPacks.tsx` — `StudioStateKind` extended, two new packs registered.
- `app/demo/studio/StudioPanel.tsx`, `Studio.tsx`, `StudioCanvas.tsx` — Critical card special-case branch.

**Explicitly not modified:** `app/api/lineup/sleeper/route.ts` — Component 4's proactive-push idea is deferred; the existing on-demand Start/Sit engine is untouched by this plan.

---

## Task 0: Canonical Player Identity (new prerequisite for Tasks 8 and 11)

**Files:**
- Audit first, then create/modify as the audit dictates: `supabase/migration_player_mappings.sql` (only if needed), `lib/playerIdentity.ts`
- Test: `lib/playerIdentity.test.ts`

**Interfaces:**
- Produces:
```ts
export interface CanonicalPlayer {
  canonicalPlayerId: string
  gsisId: string | null
  sleeperPlayerId: string | null
  espnPlayerId: string | null
  yahooPlayerId: string | null
  name: string
  team: string | null
  position: string
}
export async function resolveCanonicalPlayer(
  admin: SupabaseClient,
  ref: { platform: 'sleeper' | 'espn' | 'yahoo'; platformPlayerId: string }
): Promise<CanonicalPlayer | null>
```
Consumed by Task 8 (`handcuffDetector`/`crossLeagueOpportunities`) and Task 11 (`freeAgentAvailability`).

- [ ] **Step 1: Audit the real current state of `player_mappings` before writing anything**

Run:
```bash
grep -rn "player_mappings" supabase/ lib/ app/ --include="*.sql" --include="*.ts"
```
Read every match in full. Confirm: (a) does the table exist in any migration or `schema.sql`, and if so its exact columns; (b) is it seeded with any real rows today (check `supabase/seed*.sql` or any seeding script); (c) confirm `lib/sleeper.ts`'s `SleeperCachePlayer.gsisId` field is actually populated in practice (not just typed as nullable) by reading a sample of real `players_cache` rows if a way to inspect them exists in this environment, or by reading `lib/sleeper.ts`'s mapping code (`p.gsisId` assignment) to confirm it's sourced from a real Sleeper API field, not left null by construction.

**This step's findings determine whether Step 3 below writes a new migration, an ALTER on an existing table, or a seed script for an existing-but-empty table** — do not assume any of the three before this audit completes.

- [ ] **Step 2: Write the failing test** (structure is stable regardless of Step 1's findings, since it tests `resolveCanonicalPlayer`'s public contract, not the storage layer)

```ts
// lib/playerIdentity.test.ts
import { describe, it, expect, vi } from 'vitest'

function mockAdmin(rows: any[]) {
  return {
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: rows, error: null }) }) }),
    }),
  } as any
}

import { resolveCanonicalPlayer } from './playerIdentity'

describe('resolveCanonicalPlayer', () => {
  it('resolves a Sleeper player id to its canonical record via a real mapping row', async () => {
    const admin = mockAdmin([{
      canonical_player_id: 'cp-1', gsis_id: '00-001', sleeper_player_id: 'sl-1',
      espn_player_id: 'es-1', yahoo_player_id: 'ya-1', name: 'Tyler Allgeier', team: 'ATL', position: 'RB',
    }])
    const result = await resolveCanonicalPlayer(admin, { platform: 'sleeper', platformPlayerId: 'sl-1' })
    expect(result).toEqual({
      canonicalPlayerId: 'cp-1', gsisId: '00-001', sleeperPlayerId: 'sl-1',
      espnPlayerId: 'es-1', yahooPlayerId: 'ya-1', name: 'Tyler Allgeier', team: 'ATL', position: 'RB',
    })
  })

  it('returns null for a platform player id with no mapping row (never guesses a match)', async () => {
    const admin = mockAdmin([])
    const result = await resolveCanonicalPlayer(admin, { platform: 'sleeper', platformPlayerId: 'unknown-id' })
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/playerIdentity.test.ts`
Expected: FAIL — `Cannot find module './playerIdentity'`

- [ ] **Step 4: Based on Step 1's audit, write the migration (only the branch that applies)**

If `player_mappings` doesn't exist:
```sql
-- migration_player_mappings.sql
-- Component 0 of docs/superpowers/specs/2026-07-16-cross-league-portfolio-intelligence-design.md.
-- Idempotent; safe to re-run.
create table if not exists public.player_mappings (
  canonical_player_id uuid primary key default gen_random_uuid(),
  gsis_id text,
  sleeper_player_id text,
  espn_player_id text,
  yahoo_player_id text,
  name text not null,
  team text,
  position text not null,
  match_confidence text not null default 'exact' check (match_confidence in ('exact', 'fuzzy')),
  created_at timestamptz not null default now()
);
create index if not exists player_mappings_sleeper_idx on public.player_mappings (sleeper_player_id);
create index if not exists player_mappings_espn_idx on public.player_mappings (espn_player_id);
create index if not exists player_mappings_yahoo_idx on public.player_mappings (yahoo_player_id);
create index if not exists player_mappings_gsis_idx on public.player_mappings (gsis_id);

alter table public.player_mappings enable row level security;
drop policy if exists "Authenticated read access to player mappings" on public.player_mappings;
create policy "Authenticated read access to player mappings" on public.player_mappings
  for select using (auth.role() = 'authenticated');
drop policy if exists "Service role full access to player mappings" on public.player_mappings;
create policy "Service role full access to player mappings" on public.player_mappings
  for all using (auth.role() = 'service_role');
grant select on public.player_mappings to authenticated;
grant select, insert, update, delete on public.player_mappings to service_role;
```
If it already exists but is genuinely unseeded (per Step 1's finding), write a seed script instead (`scripts/seedPlayerMappings.ts`) that joins `players_cache`'s `gsis_id` against nflverse or platform-specific ID lists already available in the codebase — the exact join logic depends on what Step 1 found already exists; do not duplicate an existing join-chain solution (the PRD changelog references one was already built for a different feature — locate and reuse it, e.g. via `grep -rn "gsisId\|gsis_id" lib/` for the existing join code).

- [ ] **Step 5: Write `lib/playerIdentity.ts`**

```ts
// lib/playerIdentity.ts
import type { SupabaseClient } from '@supabase/supabase-js'

export interface CanonicalPlayer {
  canonicalPlayerId: string
  gsisId: string | null
  sleeperPlayerId: string | null
  espnPlayerId: string | null
  yahooPlayerId: string | null
  name: string
  team: string | null
  position: string
}

const PLATFORM_COLUMN: Record<'sleeper' | 'espn' | 'yahoo', string> = {
  sleeper: 'sleeper_player_id',
  espn: 'espn_player_id',
  yahoo: 'yahoo_player_id',
}

export async function resolveCanonicalPlayer(
  admin: SupabaseClient,
  ref: { platform: 'sleeper' | 'espn' | 'yahoo'; platformPlayerId: string }
): Promise<CanonicalPlayer | null> {
  const column = PLATFORM_COLUMN[ref.platform]
  const { data } = await admin
    .from('player_mappings')
    .select('canonical_player_id, gsis_id, sleeper_player_id, espn_player_id, yahoo_player_id, name, team, position')
    .eq(column, ref.platformPlayerId)
    .eq('canonical_player_id', 'canonical_player_id') // no-op placeholder removed below

  const rows = data ?? []
  if (rows.length === 0) return null

  const row = rows[0]
  return {
    canonicalPlayerId: row.canonical_player_id,
    gsisId: row.gsis_id,
    sleeperPlayerId: row.sleeper_player_id,
    espnPlayerId: row.espn_player_id,
    yahooPlayerId: row.yahoo_player_id,
    name: row.name,
    team: row.team,
    position: row.position,
  }
}
```
*(Remove the placeholder no-op `.eq('canonical_player_id', ...)` line before committing — it was left in to flag that this query needs exactly one real `.eq(column, value)` call, not two; the test's mock only expects a single chained `.eq`.)*

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run lib/playerIdentity.test.ts`
Expected: PASS, 2 tests

- [ ] **Step 7: Commit**

```bash
git add lib/playerIdentity.ts lib/playerIdentity.test.ts supabase/migration_player_mappings.sql
git commit -m "feat: add canonical cross-platform player identity resolution"
```

---

## Task 1: `league_preferences` migration (corrected schema)

**Files:**
- Create: `supabase/migration_league_preferences.sql`

- [ ] **Step 1: Write the migration**

```sql
-- migration_league_preferences.sql
-- Component 1 of the cross-league-portfolio-intelligence spec (v2 — corrected schema).
-- Explicit is_favorited boolean, missing row = favorited by default. Every
-- favorite/unfavorite action upserts a row; nothing is ever deleted, which is
-- what makes "favorited by default but explicitly unfavorited one league"
-- representable (the v1 delete-based design could not represent this state).
-- Idempotent; safe to re-run.

create table if not exists public.league_preferences (
  user_id      uuid not null references public.users(id) on delete cascade,
  league_id    uuid not null references public.connected_leagues(id) on delete cascade,
  is_favorited boolean not null default true,
  updated_at   timestamptz not null default now(),
  primary key (user_id, league_id)
);

create index if not exists league_preferences_user_idx on public.league_preferences (user_id);

alter table public.league_preferences enable row level security;

drop policy if exists "Users manage their own league preferences" on public.league_preferences;
create policy "Users manage their own league preferences" on public.league_preferences
  for all using (auth.uid() = user_id);

drop policy if exists "Service role full access to league preferences" on public.league_preferences;
create policy "Service role full access to league preferences" on public.league_preferences
  for all using (auth.role() = 'service_role');

grant select, insert, update on public.league_preferences to authenticated;
grant select, insert, update, delete on public.league_preferences to service_role;
```

- [ ] **Step 2: Apply and verify**

```sql
select column_name, data_type, column_default from information_schema.columns where table_name = 'league_preferences';
```
Expected: 4 rows, `is_favorited` shows `column_default = 'true'`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migration_league_preferences.sql
git commit -m "feat: add league_preferences table with corrected favoriting schema"
```

---

## Task 2: `lib/leagueFavorites.ts` — upsert-only favorite resolution + mutation

**Files:**
- Create: `lib/leagueFavorites.ts`
- Test: `lib/leagueFavorites.test.ts`

**Interfaces:**
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

- [ ] **Step 1: Write the failing tests — including the regression test for the v1 bug**

```ts
// lib/leagueFavorites.test.ts
import { describe, it, expect, vi } from 'vitest'
import { getFavoritedLeagueIds, setFavorite } from './leagueFavorites'

function mockAdmin(rows: { league_id: string; is_favorited: boolean }[]) {
  return {
    from: () => ({
      select: () => ({ eq: () => Promise.resolve({ data: rows, error: null }) }),
      upsert: vi.fn(() => Promise.resolve({ error: null })),
    }),
  } as any
}

describe('getFavoritedLeagueIds', () => {
  it('returns all league ids when the user has no preference rows (default: all favorited)', async () => {
    const admin = mockAdmin([])
    const result = await getFavoritedLeagueIds(admin, 'user-1', ['lg-1', 'lg-2', 'lg-3'])
    expect(result).toEqual(['lg-1', 'lg-2', 'lg-3'])
  })

  it('excludes a league with an explicit is_favorited=false row, even when it is the ONLY row (regression test for the v1 bug)', async () => {
    // This is the exact scenario the v1 delete-based design got wrong: a user
    // who started with zero rows unfavorites exactly one league. With the
    // corrected upsert-only design, that produces a single explicit
    // is_favorited=false row — and the resolver must honor it, not fall back
    // to "no rows = all favorited" just because only one row exists.
    const admin = mockAdmin([{ league_id: 'lg-2', is_favorited: false }])
    const result = await getFavoritedLeagueIds(admin, 'user-1', ['lg-1', 'lg-2', 'lg-3'])
    expect(result).toEqual(['lg-1', 'lg-3'])
  })

  it('includes a league with an explicit is_favorited=true row alongside leagues with no row', async () => {
    const admin = mockAdmin([{ league_id: 'lg-1', is_favorited: true }])
    const result = await getFavoritedLeagueIds(admin, 'user-1', ['lg-1', 'lg-2'])
    expect(result).toEqual(['lg-1', 'lg-2']) // lg-1 explicit true, lg-2 defaults true (no row)
  })
})

describe('setFavorite', () => {
  it('always upserts, never deletes — regression test for the v1 delete-based bug', async () => {
    const upsert = vi.fn(() => Promise.resolve({ error: null }))
    const admin = { from: () => ({ upsert }) } as any
    await setFavorite(admin, 'user-1', 'lg-1', false)
    expect(upsert).toHaveBeenCalledWith(
      { user_id: 'user-1', league_id: 'lg-1', is_favorited: false },
      { onConflict: 'user_id,league_id' }
    )
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

// Missing row = favorited (true) by default. Every explicit row — true or
// false — must be honored even when it's the only row for that user; the
// "no rows at all" default only applies when there are truly zero rows.
export async function getFavoritedLeagueIds(
  admin: SupabaseClient,
  userId: string,
  allLeagueIds: string[]
): Promise<string[]> {
  const { data } = await admin
    .from('league_preferences')
    .select('league_id, is_favorited')
    .eq('user_id', userId)

  const rows = data ?? []
  if (rows.length === 0) return allLeagueIds

  const explicit = new Map(rows.map((r: { league_id: string; is_favorited: boolean }) => [r.league_id, r.is_favorited]))
  return allLeagueIds.filter((id) => explicit.get(id) ?? true)
}

// Always upserts an explicit row — never deletes. A delete cannot represent
// "favorited by default but explicitly unfavorited," which silently broke
// unfavoriting in the v1 design.
export async function setFavorite(
  admin: SupabaseClient,
  userId: string,
  leagueId: string,
  favorited: boolean
): Promise<void> {
  await admin
    .from('league_preferences')
    .upsert({ user_id: userId, league_id: leagueId, is_favorited: favorited }, { onConflict: 'user_id,league_id' })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/leagueFavorites.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add lib/leagueFavorites.ts lib/leagueFavorites.test.ts
git commit -m "feat: add upsert-only league favorite resolution (fixes v1 persistence bug)"
```

---

## Task 3: Favorites API route — with ownership verification (closes the v1 IDOR)

**Files:**
- Create: `app/api/leagues/favorites/route.ts`
- Test: `app/api/leagues/favorites/route.test.ts`

**Interfaces:**
- Consumes: `getFavoritedLeagueIds`, `setFavorite` (Task 2).
- Produces: `GET /api/leagues/favorites` → `{ favoritedLeagueIds: string[] }`; `POST /api/leagues/favorites` body `{ leagueId: string, favorited: boolean }` → `{ ok: true }` or `403` if the league isn't owned by the authenticated user.

- [ ] **Step 1: Confirm the real auth/admin-client helper names**

Run: `grep -n "^import" app/api/live/status/route.ts` — use these exact imports, not assumed names, in Step 3.

- [ ] **Step 2: Write the failing tests — including the regression test for the v1 IDOR**

```ts
// app/api/leagues/favorites/route.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/leagueFavorites', () => ({
  getFavoritedLeagueIds: vi.fn(() => Promise.resolve(['lg-1', 'lg-2'])),
  setFavorite: vi.fn(() => Promise.resolve()),
}))
vi.mock('@/lib/auth', () => ({ getAuthedUser: () => Promise.resolve({ id: 'user-1' }) }))

const ownershipRows: Record<string, { id: string; user_id: string }> = {
  'lg-owned': { id: 'lg-owned', user_id: 'user-1' },
  'lg-other-users': { id: 'lg-other-users', user_id: 'user-2' },
}

vi.mock('@/lib/supabaseAdmin', () => ({
  getAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: (_col: string, val: string) => ({
          eq: () => Promise.resolve({ data: [] }), // GET path (unused by these tests)
          single: () => Promise.resolve({ data: ownershipRows[val] ?? null }),
        }),
      }),
    }),
  }),
}))

import { POST } from './route'
import { setFavorite } from '@/lib/leagueFavorites'

describe('POST /api/leagues/favorites ownership check', () => {
  it('allows a favorite change on a league the authenticated user actually owns', async () => {
    const req = new Request('http://localhost/api/leagues/favorites', {
      method: 'POST', body: JSON.stringify({ leagueId: 'lg-owned', favorited: false }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(setFavorite).toHaveBeenCalledWith(expect.anything(), 'user-1', 'lg-owned', false)
  })

  it('rejects a favorite change on a league owned by a different user (regression test for the v1 IDOR)', async () => {
    const req = new Request('http://localhost/api/leagues/favorites', {
      method: 'POST', body: JSON.stringify({ leagueId: 'lg-other-users', favorited: false }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('rejects a favorite change on a leagueId that does not exist at all', async () => {
    const req = new Request('http://localhost/api/leagues/favorites', {
      method: 'POST', body: JSON.stringify({ leagueId: 'lg-nonexistent', favorited: false }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run app/api/leagues/favorites/route.test.ts`
Expected: FAIL — `Cannot find module './route'`

- [ ] **Step 4: Write the route with the ownership check**

```ts
// app/api/leagues/favorites/route.ts
import { NextResponse } from 'next/server'
import { getFavoritedLeagueIds, setFavorite } from '@/lib/leagueFavorites'
import { getAdminClient } from '@/lib/supabaseAdmin' // replace with Step 1's confirmed real import
import { getAuthedUser } from '@/lib/auth' // replace with Step 1's confirmed real import

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

  const body = (await req.json()) as { leagueId?: unknown; favorited?: unknown }
  if (typeof body.leagueId !== 'string' || typeof body.favorited !== 'boolean') {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 })
  }

  const admin = getAdminClient()

  // Ownership check — closes the v1 IDOR. A service-role write with no
  // ownership verification lets any authenticated user modify any other
  // user's league preferences; this must run before setFavorite, always.
  const { data: league } = await admin
    .from('connected_leagues')
    .select('id, user_id')
    .eq('id', body.leagueId)
    .single()

  if (!league || league.user_id !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    await setFavorite(admin, user.id, body.leagueId, body.favorited)
  } catch {
    return NextResponse.json({ error: 'failed to persist favorite' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run app/api/leagues/favorites/route.test.ts`
Expected: PASS, 3 tests

- [ ] **Step 6: Commit**

```bash
git add app/api/leagues/favorites/route.ts app/api/leagues/favorites/route.test.ts
git commit -m "feat: add league favorites API with ownership verification (fixes v1 IDOR)"
```

---

## Task 4: `FavoriteStar` UI + wire into league cards

**Files:**
- Create: `components/leagues/FavoriteStar.tsx`
- Modify: the league-card component (locate via `grep -rl "Health Score\|healthScore" "app/(dashboard)/leagues"` first)
- Test: `components/leagues/FavoriteStar.test.tsx`

**Interfaces:**
- Consumes: `GET`/`POST /api/leagues/favorites` (Task 3).

- [ ] **Step 1: Write the failing test**

```tsx
// components/leagues/FavoriteStar.test.tsx
import { describe, it, expect, vi, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FavoriteStar } from './FavoriteStar'

global.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ ok: true }) })) as any

describe('FavoriteStar', () => {
  it('renders filled when initially favorited and toggles on click', async () => {
    render(<FavoriteStar leagueId="lg-1" initiallyFavorited={true} />)
    fireEvent.click(screen.getByRole('button', { name: /unfavorite/i }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      '/api/leagues/favorites',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ leagueId: 'lg-1', favorited: false }) })
    ))
    expect(screen.getByRole('button', { name: /favorite/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/leagues/FavoriteStar.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write the implementation**

```tsx
// components/leagues/FavoriteStar.tsx
'use client'
import { useState } from 'react'

export function FavoriteStar({ leagueId, initiallyFavorited }: { leagueId: string; initiallyFavorited: boolean }) {
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
    <button onClick={toggle} aria-label={favorited ? 'Unfavorite league' : 'Favorite league'} className="text-lg leading-none">
      {favorited ? '★' : '☆'}
    </button>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/leagues/FavoriteStar.test.tsx`
Expected: PASS

- [ ] **Step 5: Locate the league-card component and mount `FavoriteStar`**

Run: `grep -rl "leagueName\|league_name" "app/(dashboard)/leagues" components 2>/dev/null | grep -v test`

Add `<FavoriteStar leagueId={league.id} initiallyFavorited={favoritedLeagueIds.includes(league.id)} />` to the found component, fetching `favoritedLeagueIds` once per page load via `GET /api/leagues/favorites` using whatever data-loading pattern that file already uses.

- [ ] **Step 6: Commit**

```bash
git add components/leagues/FavoriteStar.tsx components/leagues/FavoriteStar.test.tsx <league-card-file>
git commit -m "feat: add favorite star toggle to league cards"
```

---

## Task 5: Scope `buildPulseItemsForUser` to favorited leagues

**Files:**
- Modify: `lib/pulse.ts` (the `buildPulseItemsForUser` entry point)
- Test: `lib/pulse.test.ts`

- [ ] **Step 1: Read `lib/pulse.ts:1-110` in full** to see exactly how `buildPulseItemsForUser` currently loads `connected_leagues`, before writing the fixture below.

- [ ] **Step 2: Write the failing test**

```ts
// lib/pulse.test.ts (add to existing file, or create if none exists)
import { describe, it, expect, vi } from 'vitest'

vi.mock('./leagueFavorites', () => ({
  getFavoritedLeagueIds: vi.fn((_admin: unknown, _userId: string, allIds: string[]) => Promise.resolve([allIds[0]])),
}))

// Fixture must match lib/pulse.ts's real internal league-loading shape,
// confirmed in Step 1. Assert every BuiltPulseItem.affectedLeagues only
// ever names the first league (the one getFavoritedLeagueIds resolved to).
describe('buildPulseItemsForUser favoriting', () => {
  it('only builds items for favorited leagues', async () => {
    // Fill in against the real shape from Step 1.
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/pulse.test.ts`
Expected: FAIL

- [ ] **Step 4: Add favorite-filtering inside `buildPulseItemsForUser`**

Immediately after the existing `connected_leagues` fetch:
```ts
import { getFavoritedLeagueIds } from './leagueFavorites'

const allLeagueIds = leagues.map((l) => l.id) // match existing variable name from Step 1's read
const favoritedIds = await getFavoritedLeagueIds(supabase, userId, allLeagueIds)
const favoritedSet = new Set(favoritedIds)
const scopedLeagues = leagues.filter((l) => favoritedSet.has(l.id))
// Replace downstream item-construction uses of `leagues` with `scopedLeagues`.
// `leagueCount` in the returned object stays based on ALL connected leagues
// (Leagues page / Health Score are unscoped per the spec).
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/pulse.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/pulse.ts lib/pulse.test.ts
git commit -m "feat: scope Pulse item generation to favorited leagues"
```

---

## Task 6: Scope Game Day live panel to favorited leagues

**Files:**
- Modify: `app/api/live/status/route.ts:41`
- Test: `app/api/live/status/route.test.ts`

- [ ] **Step 1: Read `app/api/live/status/route.ts:41-90` in full** before writing the fixture.

- [ ] **Step 2: Write the failing test**, asserting downstream queries only run against favorited league rows (concrete shape depends on Step 1's read).

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run app/api/live/status/route.test.ts`
Expected: FAIL

- [ ] **Step 4: Add favorite-filtering after the existing query**

```ts
import { getFavoritedLeagueIds } from '@/lib/leagueFavorites'

const allLeagueIds = (leagueRows ?? []).map((r: { id: string }) => r.id)
const favoritedIds = await getFavoritedLeagueIds(admin, user.id, allLeagueIds)
const scopedLeagueRows = (leagueRows ?? []).filter((r: { id: string }) => favoritedIds.includes(r.id))
// Replace every downstream use of `leagueRows` with `scopedLeagueRows`.
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run app/api/live/status/route.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/api/live/status/route.ts app/api/live/status/route.test.ts
git commit -m "feat: scope Game Day live panel to favorited leagues"
```

---

## Task 7: `lib/deadlineRanking.ts` + `DeadlineList` (unchanged from v1 — this design held up under review)

**Files:**
- Create: `lib/deadlineRanking.ts`, `lib/deadlineRanking.test.ts`
- Create: `components/pulse/DeadlineList.tsx`, `components/pulse/DeadlineList.test.tsx`

**Interfaces:**
```ts
export interface LeagueDeadline {
  leagueId: string
  leagueName: string
  type: 'waiver_cutoff' | 'lineup_lock'
  deadline: string
  confirmed: boolean
}
export interface RankedDeadlines { visible: LeagueDeadline[]; hiddenCount: number; hidden: LeagueDeadline[] }
export function rankDeadlines(deadlines: LeagueDeadline[], maxVisible?: number): RankedDeadlines
```

- [ ] **Step 1: Write the failing tests**

```ts
// lib/deadlineRanking.test.ts
import { describe, it, expect } from 'vitest'
import { rankDeadlines, type LeagueDeadline } from './deadlineRanking'

function deadline(leagueId: string, hoursFromNow: number, confirmed = true): LeagueDeadline {
  return {
    leagueId, leagueName: `League ${leagueId}`, type: 'waiver_cutoff',
    deadline: new Date(Date.now() + hoursFromNow * 3600_000).toISOString(), confirmed,
  }
}

describe('rankDeadlines', () => {
  it('shows all deadlines when count is at or below the default max (3)', () => {
    const result = rankDeadlines([deadline('a', 5), deadline('b', 2), deadline('c', 8)])
    expect(result.visible.map((d) => d.leagueId)).toEqual(['b', 'a', 'c'])
    expect(result.hiddenCount).toBe(0)
  })

  it('truncates to top-3-by-time-remaining, reports the rest as hidden not discarded', () => {
    const input = [deadline('a', 10), deadline('b', 1), deadline('c', 5), deadline('d', 2), deadline('e', 20)]
    const result = rankDeadlines(input)
    expect(result.visible.map((d) => d.leagueId)).toEqual(['b', 'd', 'c'])
    expect(result.hiddenCount).toBe(2)
    expect(result.hidden.map((d) => d.leagueId).sort()).toEqual(['a', 'e'])
  })

  it('never drops a deadline permanently', () => {
    const input = [deadline('a', 1), deadline('b', 2), deadline('c', 3), deadline('d', 4)]
    const result = rankDeadlines(input)
    expect([...result.visible, ...result.hidden].map((d) => d.leagueId).sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('preserves the confirmed flag unchanged', () => {
    const result = rankDeadlines([deadline('a', 1, false), deadline('b', 2, true)])
    expect(result.visible.find((d) => d.leagueId === 'a')?.confirmed).toBe(false)
    expect(result.visible.find((d) => d.leagueId === 'b')?.confirmed).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/deadlineRanking.test.ts`
Expected: FAIL

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
export interface RankedDeadlines { visible: LeagueDeadline[]; hiddenCount: number; hidden: LeagueDeadline[] }

const DEFAULT_MAX_VISIBLE = 3

export function rankDeadlines(deadlines: LeagueDeadline[], maxVisible = DEFAULT_MAX_VISIBLE): RankedDeadlines {
  const sorted = [...deadlines].sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
  return { visible: sorted.slice(0, maxVisible), hiddenCount: Math.max(0, sorted.length - maxVisible), hidden: sorted.slice(maxVisible) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/deadlineRanking.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Write the failing `DeadlineList` test**

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

  it('shows "+N more" and expands the full list on click', () => {
    render(<DeadlineList deadlines={[mk('a', 1), mk('b', 2), mk('c', 3), mk('d', 4), mk('e', 5)]} />)
    fireEvent.click(screen.getByText(/\+2 more/))
    expect(screen.getByText(/League d/)).toBeInTheDocument()
    expect(screen.getByText(/League e/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run components/pulse/DeadlineList.test.tsx`
Expected: FAIL

- [ ] **Step 7: Write the implementation**

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
          <li key={d.leagueId}>{d.confirmed ? '' : '~'}{d.leagueName} — {new Date(d.deadline).toLocaleString()}</li>
        ))}
      </ul>
      {!expanded && hiddenCount > 0 && <button onClick={() => setExpanded(true)}>+{hiddenCount} more today →</button>}
    </HintAnchor>
  )
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run components/pulse/DeadlineList.test.tsx`
Expected: PASS, 2 tests

- [ ] **Step 9: Add the hint entry**

In `lib/hints.ts`:
```ts
{
  id: 'deadline-list',
  title: 'Your deadlines, honestly',
  body: "A ~ means we're not 100% sure of this league's exact cutoff time yet — never a guess dressed up as a fact.",
  placement: 'bottom',
},
```

- [ ] **Step 10: Commit**

```bash
git add lib/deadlineRanking.ts lib/deadlineRanking.test.ts components/pulse/DeadlineList.tsx components/pulse/DeadlineList.test.tsx lib/hints.ts
git commit -m "feat: render deadline list with honesty flag and progressive disclosure"
```

---

## Task 8: `lib/handcuffDetector.ts` — RB-only, confidence-labeled (revised from v1)

**Files:**
- Create: `lib/handcuffDetector.ts`, `lib/handcuffDetector.test.ts`

**Interfaces:**
```ts
export interface HandcuffCandidate {
  scratchedPlayerId: string
  handcuffPlayerId: string
  handcuffName: string
  confidence: 'depth_chart_next_rb' // the only value in v1 — explicit, not a vague "high/low"
  provenance: string // human-readable disclosure string for the UI, e.g. "Next listed RB on Atlanta's depth chart — not a confirmed replacement."
}
export function findHandcuff(
  scratchedPlayerId: string,
  allPlayers: SleeperCachePlayer[]
): HandcuffCandidate | null
```

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
  it('finds the next-depth-chart RB at the same team, with disclosed confidence/provenance', () => {
    const starter = player({ playerId: 'star-1', nflTeam: 'ATL', position: 'RB', depthChartOrder: 1, depthChartPosition: 'RB' })
    const backup = player({ playerId: 'back-1', name: 'Backup Guy', nflTeam: 'ATL', position: 'RB', depthChartOrder: 2, depthChartPosition: 'RB' })
    const result = findHandcuff('star-1', [starter, backup])
    expect(result).toEqual({
      scratchedPlayerId: 'star-1', handcuffPlayerId: 'back-1', handcuffName: 'Backup Guy',
      confidence: 'depth_chart_next_rb',
      provenance: "Next listed RB on ATL's depth chart — not a confirmed replacement.",
    })
  })

  it('returns null for a non-RB position, even with valid depth-chart data (v1 correction: RB-only)', () => {
    const starter = player({ playerId: 'star-1', position: 'WR', depthChartPosition: 'WR', nflTeam: 'ATL', depthChartOrder: 1 })
    const backup = player({ playerId: 'back-1', position: 'WR', depthChartPosition: 'WR', nflTeam: 'ATL', depthChartOrder: 2 })
    expect(findHandcuff('star-1', [starter, backup])).toBeNull()
  })

  it('returns null when the scratched player has no depth chart data', () => {
    const starter = player({ playerId: 'star-1', depthChartOrder: null })
    expect(findHandcuff('star-1', [starter])).toBeNull()
  })

  it('returns null when no next-order teammate exists at the same position', () => {
    const starter = player({ playerId: 'star-1', nflTeam: 'ATL', position: 'RB', depthChartOrder: 1, depthChartPosition: 'RB' })
    expect(findHandcuff('star-1', [starter])).toBeNull()
  })

  it('picks the immediately next depth order, not any lower-ranked teammate', () => {
    const starter = player({ playerId: 'star-1', nflTeam: 'ATL', position: 'RB', depthChartOrder: 1, depthChartPosition: 'RB' })
    const third = player({ playerId: 'third-1', nflTeam: 'ATL', position: 'RB', depthChartOrder: 3, depthChartPosition: 'RB' })
    const second = player({ playerId: 'second-1', name: 'Second String', nflTeam: 'ATL', position: 'RB', depthChartOrder: 2, depthChartPosition: 'RB' })
    expect(findHandcuff('star-1', [starter, third, second])?.handcuffPlayerId).toBe('second-1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/handcuffDetector.test.ts`
Expected: FAIL

- [ ] **Step 3: Write the implementation**

```ts
// lib/handcuffDetector.ts
import type { SleeperCachePlayer } from './sleeper'

export interface HandcuffCandidate {
  scratchedPlayerId: string
  handcuffPlayerId: string
  handcuffName: string
  confidence: 'depth_chart_next_rb'
  provenance: string
}

// RB-only in v1 (design spec Component 3): depth-chart succession is the
// most reliable proxy for real workload transfer at RB, and still
// unreliable elsewhere (committee backfields, WR/TE usage reshuffling).
// This is a disclosed inference, never presented as a confirmed fact —
// see the provenance string every result carries.
export function findHandcuff(scratchedPlayerId: string, allPlayers: SleeperCachePlayer[]): HandcuffCandidate | null {
  const scratched = allPlayers.find((p) => p.playerId === scratchedPlayerId)
  if (!scratched || scratched.position !== 'RB' || scratched.depthChartOrder === null || scratched.depthChartPosition === null) {
    return null
  }

  const candidates = allPlayers.filter(
    (p) =>
      p.playerId !== scratchedPlayerId &&
      p.position === 'RB' &&
      p.nflTeam === scratched.nflTeam &&
      p.depthChartPosition === scratched.depthChartPosition &&
      p.depthChartOrder !== null &&
      (p.depthChartOrder as number) > (scratched.depthChartOrder as number)
  )
  if (candidates.length === 0) return null

  const next = candidates.reduce((closest, p) => ((p.depthChartOrder as number) < (closest.depthChartOrder as number) ? p : closest))

  return {
    scratchedPlayerId,
    handcuffPlayerId: next.playerId,
    handcuffName: next.name,
    confidence: 'depth_chart_next_rb',
    provenance: `Next listed RB on ${scratched.nflTeam}'s depth chart — not a confirmed replacement.`,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/handcuffDetector.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add lib/handcuffDetector.ts lib/handcuffDetector.test.ts
git commit -m "feat: add RB-only depth-chart handcuff detector with disclosed confidence"
```

---

## Task 9: `critical_opportunity` type support — fingerprint-based, not `engagement_log`-one-shot (revised from v1)

**Files:**
- Create: `supabase/migration_critical_opportunities.sql`
- Modify: `types/index.ts`

**v1 correction:** no separate `cross_league_opportunities` table is created. The signal is computed live from `player_scratches` (existing) + Task 0's identity layer + Task 8's handcuff detector + Task 11's availability check; the only new persisted record is the Pulse item itself, deduped by its own fingerprint — the same reconciliation pattern every other Pulse card already uses, chosen because the underlying facts (injury status, free-agent availability) change hour to hour and the card should track that, not fire once via `engagement_log` and go stale.

- [ ] **Step 1: Confirm the current full `pulse_items.type` CHECK list before writing the ALTER**

Run: `grep -n "pulse_items_type_check\|type in (" supabase/schema.sql supabase/migration_*.sql` — use the real, current full list, not the reconstructed one below, if they differ.

- [ ] **Step 2: Write the migration**

```sql
-- migration_critical_opportunities.sql
-- Component 3 of the cross-league-portfolio-intelligence spec (v2).
-- Adds 'critical_opportunity' to pulse_items.type. No new table — the
-- Pulse item itself, fingerprint-deduped, is the only persisted record.
-- Idempotent; safe to re-run.

alter table public.pulse_items drop constraint if exists pulse_items_type_check;
alter table public.pulse_items add constraint pulse_items_type_check
  check (type in (
    -- Paste the real, current full list confirmed in Step 1 here, plus 'critical_opportunity'.
    'lineup_decision','injury_alert','weather_alert','waiver_alert','trade_opportunity',
    'opponent_intel','deadline_reminder','exposure_flag','touchdown_swing','lineup_lock',
    'mission_complete','roster_grade','player_news','opportunity_surge','critical_opportunity'
  ));
```

- [ ] **Step 3: Apply and verify**

```sql
select pg_get_constraintdef(oid) from pg_constraint where conname = 'pulse_items_type_check';
```
Expected: includes `critical_opportunity`.

- [ ] **Step 4: Add `'critical_opportunity'` to `PulseItemType` in `types/index.ts`**

- [ ] **Step 5: Commit**

```bash
git add supabase/migration_critical_opportunities.sql types/index.ts
git commit -m "feat: add critical_opportunity Pulse item type (fingerprint-based, no separate table)"
```

---

## Task 10: `lib/crossLeagueOpportunities.ts` — fingerprint-based orchestration, correct push gating (revised from v1)

**Files:**
- Create: `lib/crossLeagueOpportunities.ts`, `lib/crossLeagueOpportunities.test.ts`
- Modify: `lib/pulse.ts` (fingerprint builder, following the existing injury_alert pattern), `lib/engagementTriggers.ts` (Critical push path, no `isFreePlan` bypass), `app/api/cron/news/route.ts` (wire the call)

**Interfaces:**
```ts
export async function buildCrossLeagueOpportunityItems(
  admin: SupabaseClient,
  userId: string,
  favoritedAndAllLeagues: /* all connected leagues — Critical ignores the favorited-only filter per Locked Decision 6 */ ConnectedLeagueRef[]
): Promise<BuiltPulseItem[]> // consumed by buildPulseItemsForUser directly, same as every other item builder — NOT a separate cron-only path, since this needs to be fingerprint-reconciled on every Pulse build like injury_alert is.
```
**This is a structural change from v1**, which modeled Critical as a cron-triggered, `engagement_log`-deduped, Pulse-bypassing insert (copying `detectStarterScratches`' pattern). v2 instead makes it a **builder function called from within `buildPulseItemsForUser`**, exactly like `injury_alert`/`waiver_alert` already are — this is what makes fingerprint reconciliation (open→resolved→re-opened tracked correctly, no repeated firing) work for free, using infrastructure that already exists (`syncPulseItems`), rather than building new dedup logic from scratch.

**Push notification is a separate, smaller path**, wired into the existing news-cron detection flow but gated exactly like every other Pro push (no bypass) — see Step 5.

- [ ] **Step 1: Read `lib/pulse.ts`'s `injury_alert` builder in full** (`lib/pulse.ts:333-345` per prior research) — this is the structural template for the fingerprint-based builder in Step 3, not `detectStarterScratches`.

- [ ] **Step 2: Write the failing test**

```ts
// lib/crossLeagueOpportunities.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('./handcuffDetector', () => ({
  findHandcuff: vi.fn(() => ({
    scratchedPlayerId: 'star-1', handcuffPlayerId: 'back-1', handcuffName: 'Backup Guy',
    confidence: 'depth_chart_next_rb', provenance: "Next listed RB on ATL's depth chart — not a confirmed replacement.",
  })),
}))
vi.mock('./freeAgentAvailability', () => ({
  checkAvailability: vi.fn(() => Promise.resolve('free_agent')),
}))

import { buildCrossLeagueOpportunityItems } from './crossLeagueOpportunities'

describe('buildCrossLeagueOpportunityItems', () => {
  it('produces one item per opportunity, fingerprinted, naming every affected league', async () => {
    // Assert a single BuiltPulseItem with fingerprint
    // `critical:{scratchedPlayerId}:{handcuffPlayerId}`, affectedLeagues
    // listing every league where checkAvailability resolved to
    // 'free_agent' or 'waivers', and reasoning including the provenance string.
  })

  it('produces no item when findHandcuff returns null', async () => {
    // Re-mock to null; assert an empty array.
  })

  it('produces no item when the handcuff is rostered or unconfirmed in every league', async () => {
    // Re-mock checkAvailability to 'rostered' / 'unconfirmed'; assert empty array
    // — never fabricate an opportunity out of an unconfirmed availability state.
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/crossLeagueOpportunities.test.ts`
Expected: FAIL

- [ ] **Step 4: Write the implementation**, following the real `injury_alert` fingerprint pattern read in Step 1

```ts
// lib/crossLeagueOpportunities.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { findHandcuff } from './handcuffDetector'
import { checkAvailability } from './freeAgentAvailability'
import type { BuiltPulseItem } from './pulse' // exact import path per lib/pulse.ts's real export

interface ConnectedLeagueRef { id: string; name: string; platform: 'sleeper' | 'espn' | 'yahoo'; externalId: string }

export async function buildCrossLeagueOpportunityItems(
  admin: SupabaseClient,
  userId: string,
  allLeagues: ConnectedLeagueRef[],
  scratchedRosteredStarters: { playerId: string; playerName: string }[], // sourced from the existing player_scratches + roster join already used by injury_alert
  allSleeperPlayers: import('./sleeper').SleeperCachePlayer[]
): Promise<BuiltPulseItem[]> {
  const items: BuiltPulseItem[] = []

  for (const scratched of scratchedRosteredStarters) {
    const handcuff = findHandcuff(scratched.playerId, allSleeperPlayers)
    if (!handcuff) continue

    const affected: { leagueId: string; leagueName: string; platform: 'sleeper' | 'espn' | 'yahoo' }[] = []
    for (const league of allLeagues) {
      const status = await checkAvailability(handcuff.handcuffPlayerId, league)
      if (status === 'free_agent' || status === 'waivers') {
        affected.push({ leagueId: league.id, leagueName: league.name, platform: league.platform })
      }
    }
    if (affected.length === 0) continue

    items.push({
      fingerprint: `critical:${handcuff.scratchedPlayerId}:${handcuff.handcuffPlayerId}`,
      type: 'critical_opportunity',
      priority: 'critical',
      headline: `${scratched.playerName} questionable — ${handcuff.handcuffName} available in ${affected.length} of your leagues`,
      reasoning: handcuff.provenance,
      affectedLeagues: affected,
      deadline: null,
      actionUrl: null,
    })
  }

  return items
}
```

- [ ] **Step 5: Wire into `buildPulseItemsForUser`** (per the structural note above — this runs on every Pulse build, using ALL connected leagues, not the favorited-only `scopedLeagues` from Task 5):

```ts
// inside buildPulseItemsForUser, alongside the other item builders:
const criticalItems = await buildCrossLeagueOpportunityItems(supabase, userId, leagues /* all, not scopedLeagues */, scratchedStarters, allSleeperPlayers)
items.push(...criticalItems)
```

- [ ] **Step 6: Add the Critical push path — correctly gated, no bypass (v1 correction)**

In `lib/engagementTriggers.ts`, add a push call that mirrors `detectStarterScratches`'s existing gates exactly (`isFreePlan`, `push_enabled`, subscription lookup) — **do not skip any of them**:
```ts
// Fires alongside the existing detectStarterScratches call in the news cron,
// reading the same player_scratches rows this task's builder also reads.
// Gated identically to every other push in this codebase — Pro-only,
// push_enabled respected, no Critical-specific bypass (v1 proposed one; v2
// removes it per the design spec's corrected Locked Decision 7).
```
Implementer detail: reuse `pushToUser`'s existing gates unmodified — this task adds a new *caller* of the existing push path, not a new gate-skipping variant of it.

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run lib/crossLeagueOpportunities.test.ts`
Expected: PASS, 3 tests

- [ ] **Step 8: Commit**

```bash
git add lib/crossLeagueOpportunities.ts lib/crossLeagueOpportunities.test.ts lib/pulse.ts lib/engagementTriggers.ts
git commit -m "feat: build fingerprinted critical cross-league opportunity items with correct push gating"
```

---

## Task 11: `lib/freeAgentAvailability.ts` — honest 5-state availability, cached, rate-limit-aware (revised from v1)

**Files:**
- Create: `lib/freeAgentAvailability.ts`, `lib/freeAgentAvailability.test.ts`

**Interfaces:**
```ts
export type AvailabilityStatus = 'rostered' | 'free_agent' | 'waivers' | 'pending_transaction' | 'unconfirmed'
export async function checkAvailability(
  canonicalPlayerId: string,
  league: { id: string; platform: 'sleeper' | 'espn' | 'yahoo'; externalId: string }
): Promise<AvailabilityStatus>
```

- [ ] **Step 1: Read the real ESPN/Yahoo response shapes**

Run a scratch script (not committed) against `getEspnWaivers`/`getYahooWaiverPlayers` with real credentials or a captured fixture, confirming: ESPN's `kona_player_info` response already distinguishes `FREEAGENT` vs `WAIVERS` in its filter/response (per the filter already sent — confirm the *response* actually echoes which bucket each player is in, not just that the request filtered for both); Yahoo's `status=A` waiver query's actual field names for availability state.

- [ ] **Step 2: Write the failing tests**

```ts
// lib/freeAgentAvailability.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('./sleeper', () => ({
  getSleeperRosters: vi.fn(() => Promise.resolve([{ players: ['rostered-1'] }])),
}))
vi.mock('./playersCache', () => ({
  getCachedSleeperPlayerIds: vi.fn(() => Promise.resolve(['rostered-1', 'free-1'])),
}))

import { checkAvailability } from './freeAgentAvailability'

describe('checkAvailability', () => {
  it('returns rostered for a player on a Sleeper roster', async () => {
    const result = await checkAvailability('free-1' /* canonical id resolving to sleeper 'rostered-1' via a mocked identity lookup */, { id: 'lg-1', platform: 'sleeper', externalId: 'sleeper-lg-1' })
    // Concrete assertion depends on wiring the canonical-id -> platform-id
    // resolution (Task 0) into this test's mocks — fill in against the real
    // resolveCanonicalPlayer signature once Task 0 is implemented.
  })

  it('returns unconfirmed rather than free_agent when the platform cannot distinguish waiver state', async () => {
    // Sleeper has no reliable per-player waiver-period signal from a simple
    // roster diff — assert the honest fallback, not an optimistic free_agent guess.
  })

  it('degrades to unconfirmed (not a thrown error) when a platform call is rate-limited', async () => {
    // Mock a rejected/429 response from the platform call; assert the
    // function returns 'unconfirmed' rather than throwing, so Task 10's
    // per-league loop never crashes the whole search on one bad league.
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/freeAgentAvailability.test.ts`
Expected: FAIL

- [ ] **Step 4: Write the implementation**

```ts
// lib/freeAgentAvailability.ts
import { resolveCanonicalPlayer } from './playerIdentity'
import { getSleeperRosters } from './sleeper'
import { getEspnWaivers } from './espn'
import { getYahooWaiverPlayers } from './yahoo'
import { getAdminClient } from './supabaseAdmin' // confirm real export name against Task 3's Step 1 finding

export type AvailabilityStatus = 'rostered' | 'free_agent' | 'waivers' | 'pending_transaction' | 'unconfirmed'

// Short server-side cache to avoid hammering platform APIs on repeated
// searches within the same short window. TTL is intentionally short (waiver
// state changes fast) — this is a rate-limit/latency guard, not a source of
// staleness that would violate the no-guessing rule.
const CACHE_TTL_MS = 60_000
const cache = new Map<string, { status: AvailabilityStatus; expiresAt: number }>()

export async function checkAvailability(
  canonicalPlayerId: string,
  league: { id: string; platform: 'sleeper' | 'espn' | 'yahoo'; externalId: string }
): Promise<AvailabilityStatus> {
  const cacheKey = `${canonicalPlayerId}:${league.id}`
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.status

  let status: AvailabilityStatus
  try {
    const admin = getAdminClient()
    const player = await resolveCanonicalPlayer(admin, { platform: league.platform, platformPlayerId: canonicalPlayerId })
    if (!player) { status = 'unconfirmed' }
    else if (league.platform === 'sleeper' && player.sleeperPlayerId) {
      const rosters = await getSleeperRosters(league.externalId)
      const rosteredIds = new Set(rosters.flatMap((r: { players: string[] }) => r.players))
      // Sleeper's roster diff alone can't distinguish a true free agent from
      // a player mid-waiver-period — honest fallback per the design spec.
      status = rosteredIds.has(player.sleeperPlayerId) ? 'rostered' : 'unconfirmed'
    } else {
      // ESPN/Yahoo branches: parse per the real shapes confirmed in Step 1,
      // returning 'free_agent'/'waivers' where the platform's own response
      // actually distinguishes them (confirmed available for ESPN's
      // FREEAGENT/WAIVERS filter), 'unconfirmed' otherwise.
      status = 'unconfirmed'
    }
  } catch {
    status = 'unconfirmed' // rate-limited/failed calls degrade honestly, never throw into the caller
  }

  cache.set(cacheKey, { status, expiresAt: Date.now() + CACHE_TTL_MS })
  return status
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/freeAgentAvailability.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/freeAgentAvailability.ts lib/freeAgentAvailability.test.ts
git commit -m "feat: add honest 5-state cross-platform availability check with caching"
```

---

## Task 12: Free-agent search API + debounced UI (revised from v1: caching, debounce, min-length, cancellation)

**Files:**
- Create: `app/api/leagues/free-agents/route.ts`, `app/api/leagues/free-agents/route.test.ts`
- Create: `components/leagues/FreeAgentSearch.tsx`, `components/leagues/FreeAgentSearch.test.tsx`

**Interfaces:**
```ts
export interface FreeAgentResult {
  canonicalPlayerId: string
  playerName: string
  availability: { leagueId: string; leagueName: string; platform: 'sleeper' | 'espn' | 'yahoo'; status: AvailabilityStatus }[]
}
```

- [ ] **Step 1: Write the failing route test**

```ts
// app/api/leagues/free-agents/route.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/freeAgentAvailability', () => ({ checkAvailability: vi.fn(() => Promise.resolve('free_agent')) }))
vi.mock('@/lib/auth', () => ({ getAuthedUser: () => Promise.resolve({ id: 'user-1' }) }))
vi.mock('@/lib/supabaseAdmin', () => ({ getAdminClient: () => ({ from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: [] }) }) }) }) }))

import { GET } from './route'

describe('GET /api/leagues/free-agents', () => {
  it('rejects queries under 3 characters (v2: min-length enforced server-side too, not just client debounce)', async () => {
    const res = await GET(new Request('http://localhost/api/leagues/free-agents?q=Al'))
    const body = await res.json()
    expect(body.results).toEqual([])
  })

  it('returns results for a valid query', async () => {
    const res = await GET(new Request('http://localhost/api/leagues/free-agents?q=Allgeier'))
    const body = await res.json()
    expect(Array.isArray(body.results)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/leagues/free-agents/route.test.ts`
Expected: FAIL

- [ ] **Step 3: Write the route** (server-side min-length enforced independent of client debounce — never trust the client alone for a rate-limit-relevant guard)

```ts
// app/api/leagues/free-agents/route.ts
import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabaseAdmin'
import { getAuthedUser } from '@/lib/auth'
// Search orchestration (Sleeper via players_cache, ESPN/Yahoo via
// freeAgentAvailability with bounded parallelism) lives in a helper this
// step implements inline or factors into lib/freeAgentSearch.ts, calling
// checkAvailability (Task 11) per league with Promise.all bounded to a
// reasonable concurrency (e.g. 3 at a time via a simple chunking loop, not
// unbounded Promise.all across 9 leagues at once).

export async function GET(req: Request) {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const q = new URL(req.url).searchParams.get('q') ?? ''
  if (q.length < 3) return NextResponse.json({ results: [] })

  const admin = getAdminClient()
  const { data: leagueRows } = await admin.from('connected_leagues').select('id, name, platform, external_id').eq('user_id', user.id)
  // ... search orchestration per the note above, bounded-parallel across leagueRows.

  return NextResponse.json({ results: [] }) // placeholder return shape — implementer fills in the real orchestration per the note above before this task is done; the empty-array contract must still hold for q.length < 3.
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/leagues/free-agents/route.test.ts`
Expected: PASS (both tests pass against the min-length guard; the second test only asserts array shape, not populated results, since full orchestration wiring is implementation-detail work flagged in Step 3)

- [ ] **Step 5: Write the failing component test — including debounce and cancellation**

```tsx
// components/leagues/FreeAgentSearch.test.tsx
import { describe, it, expect, vi, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FreeAgentSearch } from './FreeAgentSearch'

vi.useFakeTimers()
global.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ results: [] }) })) as any

describe('FreeAgentSearch', () => {
  it('does not fire a request until the debounce window elapses', () => {
    render(<FreeAgentSearch />)
    fireEvent.change(screen.getByPlaceholderText(/search a player/i), { target: { value: 'All' } })
    expect(fetch).not.toHaveBeenCalled()
    vi.advanceTimersByTime(400)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('only fires once for rapid keystrokes within the debounce window, not once per keystroke', () => {
    render(<FreeAgentSearch />)
    const input = screen.getByPlaceholderText(/search a player/i)
    fireEvent.change(input, { target: { value: 'A' } })
    fireEvent.change(input, { target: { value: 'Al' } })
    fireEvent.change(input, { target: { value: 'All' } })
    vi.advanceTimersByTime(400)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('does not search below the 3-character minimum', () => {
    render(<FreeAgentSearch />)
    fireEvent.change(screen.getByPlaceholderText(/search a player/i), { target: { value: 'Al' } })
    vi.advanceTimersByTime(400)
    expect(fetch).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run components/leagues/FreeAgentSearch.test.tsx`
Expected: FAIL

- [ ] **Step 7: Write the implementation with debounce, min-length, and request cancellation**

```tsx
// components/leagues/FreeAgentSearch.tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import type { FreeAgentResult } from '@/lib/freeAgentSearch'
import HintAnchor from '@/components/hints/HintAnchor'

const DEBOUNCE_MS = 400
const MIN_QUERY_LENGTH = 3

export function FreeAgentSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FreeAgentResult[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const abortRef = useRef<AbortController>()

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (query.length < MIN_QUERY_LENGTH) { setResults([]); return }

    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      try {
        const res = await fetch(`/api/leagues/free-agents?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        const body = await res.json()
        setResults(body.results)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') throw err
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(debounceRef.current)
  }, [query])

  return (
    <HintAnchor id="free-agent-search">
      <input placeholder="Search a player across all your leagues" value={query} onChange={(e) => setQuery(e.target.value)} />
      <ul>
        {results.map((r) => (
          <li key={r.canonicalPlayerId}>
            {r.playerName}
            <ul>
              {r.availability.map((a) => (
                <li key={a.leagueId}>{a.leagueName} — {a.status === 'unconfirmed' ? 'Availability unconfirmed' : a.status === 'waivers' ? 'On waivers' : a.status === 'free_agent' ? 'Free agent' : 'Rostered'}</li>
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
Expected: PASS, 3 tests

- [ ] **Step 9: Mount on the Leagues page, add hint entry**

Add `<FreeAgentSearch />` to the Leagues page (Task 4's located file). In `lib/hints.ts`:
```ts
{
  id: 'free-agent-search',
  title: 'One search, every league',
  body: "See which of your leagues a player is actually available in — and we'll tell you honestly if we can't confirm it, instead of guessing.",
  placement: 'bottom',
},
```

- [ ] **Step 10: Commit**

```bash
git add app/api/leagues/free-agents/route.ts app/api/leagues/free-agents/route.test.ts components/leagues/FreeAgentSearch.tsx components/leagues/FreeAgentSearch.test.tsx lib/hints.ts
git commit -m "feat: add debounced cross-league free-agent search with honest availability states"
```

---

## Task 13: `CriticalOpportunityCardView` + Focused-mode cap bypass (display side, push gating unchanged from Task 10)

**Files:**
- Create: `components/interrupt/CriticalOpportunityCardView.tsx`, `components/interrupt/CriticalOpportunityCardView.test.tsx`
- Modify: Focused-mode cap enforcement (locate in `app/(dashboard)/pulse/page.tsx`)

- [ ] **Step 1: Write the failing test**

```tsx
// components/interrupt/CriticalOpportunityCardView.test.tsx
import { describe, it, expect, render, screen } from '@testing-library/react'
import { CriticalOpportunityCardView } from './CriticalOpportunityCardView'

describe('CriticalOpportunityCardView', () => {
  it('renders the scratched player, handcuff, provenance disclosure, and per-league deep-links', () => {
    render(
      <CriticalOpportunityCardView
        scratchedPlayer="Bijan Robinson"
        handcuffPlayer="Tyler Allgeier"
        provenance="Next listed RB on ATL's depth chart — not a confirmed replacement."
        leagues={[{ leagueName: 'Sleeper League 2', deepLink: 'https://sleeper.com/l/2' }]}
      />
    )
    expect(screen.getByText(/Bijan Robinson/)).toBeInTheDocument()
    expect(screen.getByText(/not a confirmed replacement/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Sleeper League 2/ })).toHaveAttribute('href', 'https://sleeper.com/l/2')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/interrupt/CriticalOpportunityCardView.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write the implementation**

```tsx
// components/interrupt/CriticalOpportunityCardView.tsx
export function CriticalOpportunityCardView({
  scratchedPlayer, handcuffPlayer, provenance, leagues, contained,
}: {
  scratchedPlayer: string
  handcuffPlayer: string
  provenance: string
  leagues: { leagueName: string; deepLink: string }[]
  contained?: boolean
}) {
  return (
    <div className={contained ? 'relative' : 'fixed top-4 right-4'} data-priority="critical">
      <p className="uppercase text-xs tracking-wide text-red-400">Critical opportunity</p>
      <p className="font-semibold">{scratchedPlayer} questionable — {handcuffPlayer} available in {leagues.length} of your leagues</p>
      <p className="text-xs text-neutral-400">{provenance}</p>
      <ul>
        {leagues.map((l) => (<li key={l.leagueName}><a href={l.deepLink}>{l.leagueName}</a></li>))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/interrupt/CriticalOpportunityCardView.test.tsx`
Expected: PASS

- [ ] **Step 5: Bypass the Focused-mode 5-card cap for `critical_opportunity` items**

In `app/(dashboard)/pulse/page.tsx`:
```ts
const criticalItems = items.filter((i) => i.type === 'critical_opportunity')
const otherItems = items.filter((i) => i.type !== 'critical_opportunity')
const cappedOther = mode === 'focused' ? otherItems.slice(0, 5) : otherItems
const visibleItems = [...criticalItems, ...cappedOther]
```

- [ ] **Step 6: Add the hint entry**

In `lib/hints.ts`:
```ts
{
  id: 'critical-opportunity-card',
  title: 'This one always shows',
  body: "A real injury plus a real opportunity in your leagues is too high-stakes to hide behind a card limit — this alert always appears in full. We'll only push it to your phone if you're on Pro and have notifications on.",
  placement: 'top',
},
```

- [ ] **Step 7: Commit**

```bash
git add components/interrupt/CriticalOpportunityCardView.tsx components/interrupt/CriticalOpportunityCardView.test.tsx "app/(dashboard)/pulse/page.tsx" lib/hints.ts
git commit -m "feat: render critical opportunity cards outside the Focused-mode cap"
```

---

## Task 14: Simulation Studio registration — Favoriting + Free-Agent Search (generic `StatePack<T>` path)

**Files:**
- Modify: `app/demo/lib/studioPacks.tsx`
- Create: `app/demo/studio/packs/favoriting/favoritingPack.ts` (+ `AuthorForm`/`FullSurface`/`FocalCard`, mirroring `app/demo/studio/packs/waiver/waiverPack.ts`'s exact file layout)
- Create: `app/demo/studio/packs/free-agent-search/freeAgentSearchPack.ts` (+ components, same layout)
- Test: extend `app/demo/lib/studioPacks.test.ts`, plus per-pack test files

- [ ] **Step 1: Read `waiverPack.ts` and its `AuthorForm`/`FullSurface`/`FocalCard` components in full** before writing anything — this task's two packs must match this structure exactly.

- [ ] **Step 2: Write the failing registry test**

```ts
// app/demo/lib/studioPacks.test.ts (add to existing file)
import { describe, it, expect } from 'vitest'
import { SURFACE_PACKS } from './studioPacks'

describe('SURFACE_PACKS — favoriting & free-agent-search registration', () => {
  it('registers a favoriting pack', () => {
    expect(SURFACE_PACKS.favoriting?.label).toBe('League Favoriting')
  })
  it('registers a free_agent_search pack', () => {
    expect(SURFACE_PACKS.free_agent_search?.label).toBe('Free-Agent Search')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run app/demo/lib/studioPacks.test.ts`
Expected: FAIL

- [ ] **Step 4: Extend `StudioStateKind` and register both packs**

```ts
export type StudioStateKind = 'standard' | 'waiver_day' | 'film_room' | 'favoriting' | 'free_agent_search'
```
```ts
import { favoritingPack } from '../studio/packs/favoriting/favoritingPack'
import { freeAgentSearchPack } from '../studio/packs/free-agent-search/freeAgentSearchPack'

export const SURFACE_PACKS: Partial<Record<StudioStateKind, StatePack<any>>> = {
  standard: standardPack, waiver_day: waiverPack, film_room: filmPack,
  favoriting: favoritingPack, free_agent_search: freeAgentSearchPack,
}
```

- [ ] **Step 5: Write `favoritingPack.ts`**, mirroring `waiverPack.ts`'s structure, with `defaultContent`/`prefill` returning realistic sample league lists with mixed favorited states, and `AuthorForm`/`FullSurface`/`FocalCard` as display-only presentational components (no real fetch calls — Studio content never hits a live API).

- [ ] **Step 6: Write `freeAgentSearchPack.ts`**, same structure, `prefill()` returning a realistic multi-league result set using the real `FreeAgentResult` shape from Task 12, including at least one `unconfirmed` availability entry so the honest-disclosure UX is itself demonstrable on camera.

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run app/demo/lib/studioPacks.test.ts app/demo/studio/packs/favoriting/favoritingPack.test.tsx app/demo/studio/packs/free-agent-search/freeAgentSearchPack.test.tsx`
Expected: PASS

- [ ] **Step 8: Add buttons in `StudioPanel.tsx`**, following the existing `waiver_day`/`film_room` pattern — no special-case branching needed, both use the generic `StatePack<T>` path.

- [ ] **Step 9: Commit**

```bash
git add app/demo/lib/studioPacks.tsx app/demo/lib/studioPacks.test.ts app/demo/studio/packs/favoriting/ app/demo/studio/packs/free-agent-search/ app/demo/studio/StudioPanel.tsx
git commit -m "feat: register favoriting and free-agent-search Studio packs"
```

---

## Task 15: Simulation Studio registration — Critical Opportunity (special-case path)

**Files:**
- Modify: `app/demo/studio/StudioPanel.tsx`, `app/demo/studio/StudioCanvas.tsx`, `app/demo/studio/Studio.tsx`
- Test: extend whichever existing test file covers the `game_day` branch (`grep -rl "game_day" app/demo/studio/*.test.tsx`)

- [ ] **Step 1: Read the existing `game_day` special-case branch in full** across all three files — the structural template for this task, since Critical is interrupt-style (single-slot), not `FullSurface`/`FocalCard`-style.

- [ ] **Step 2: Extend the three files' union types** to include `'critical_opportunity'`, following whatever the real existing union declaration is called in each file (confirm in Step 1, don't assume a name).

- [ ] **Step 3: Add author UI in `StudioPanel.tsx`**, mirroring the `game_day` branch's player-search pattern: a form letting the operator pick the scratched player, the handcuff/backup player, the provenance string (pre-filled with the real template, editable), and a freeform league list.

- [ ] **Step 4: Add the render branch in `Studio.tsx`**, mirroring the `game_day` → `<InterruptCardView>` branch:
```tsx
{activeKind === 'critical_opportunity' && (
  <CriticalOpportunityCardView
    scratchedPlayer={content.scratchedPlayer}
    handcuffPlayer={content.handcuffPlayer}
    provenance={content.provenance}
    leagues={content.leagues}
    contained
  />
)}
```

- [ ] **Step 5: Run the extended test suite**

Run: `npx vitest run app/demo/studio/`
Expected: PASS, including the new branch

- [ ] **Step 6: Commit**

```bash
git add app/demo/studio/StudioPanel.tsx app/demo/studio/StudioCanvas.tsx app/demo/studio/Studio.tsx
git commit -m "feat: add Critical Opportunity card to Simulation Studio"
```

---

## Task 16: Onboarding copy for the favoriting override + honesty disclosures

**Files:**
- Modify: the onboarding notifications step (locate via `grep -rl "notify_scratches" app/onboarding` or equivalent)

- [ ] **Step 1: Add the disclosure copy**

*"Critical alerts always show in-app, even for leagues you haven't starred — a real injury-plus-opportunity is too high-stakes to filter out. We'll only push it to your phone if you're on Pro and have notifications turned on — we never override your notification settings."* Matches the design spec's corrected Locked Decisions 6-7 exactly.

- [ ] **Step 2: Commit**

```bash
git add <onboarding file>
git commit -m "docs: add onboarding disclosure for critical-alert favoriting override and push gating"
```

---

## Self-review notes (v2, fixed inline before handoff)

- **Spec coverage:** Component 0 (Task 0, new), Component 1 (Tasks 1-4, schema and IDOR both fixed), Component 2 (Task 7, unchanged — held up under review), Component 3 (Tasks 8-10, 13, RB-only + fingerprint-based + push-gating-fixed), Component 4 (explicitly removed from this plan, not silently dropped — called out in Global Constraints and the Goal statement), Component 5 (Tasks 11-12, honest 5-state model + performance-hardened), Component 6 (woven into 7/12/13/16), Component 7 (Tasks 14-15, Advisory-lineup-call pack dropped along with Component 4).
- **Placeholder scan:** Tasks 5, 6, 10 (Step 2's test body) and 12 (Step 3's route body) contain explicit "read X / fill in Y" sub-steps rather than fully blind code — these mark genuine research boundaries (files whose full internals weren't captured to code-level depth during grounding research), not skippable TODOs; each names exactly what must be read and why before the step can be completed.
- **Type consistency:** `CanonicalPlayer` (Task 0), `HandcuffCandidate` (Task 8, now includes `confidence`/`provenance`), `AvailabilityStatus` (Task 11), `FreeAgentResult` (Task 12) are each defined once and referenced by type-only imports elsewhere — no redefinition drift. `LeagueDeadline`/`RankedDeadlines` (Task 7) unchanged from v1.
- **Scope:** 16 tasks (down from v1's 18, despite adding Task 0, because Component 4's two tasks were removed entirely) — Tasks 14-15 (Studio) remain explicitly deferrable if a reviewer wants to ship 0-13 first.
