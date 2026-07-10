# DEMO_MODE Foundation (Phase 0–1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a route-isolated, in-memory demo of Rostiro (`app/demo`) driven by real-2025 fixtures + a timeline state machine, with a hidden Director's Console shell and a fully-rendering Standard state whose Health Score is genuinely computed.

**Architecture:** Everything lives under `app/demo/**` and imports only pure modules — never Supabase/Sleeper/ESPN — enforced by an ESLint rule that fails the build on violation. A React context (`DemoStateProvider`) holds a virtual clock + current OS state, advanced by a pure timeline machine over authored beats. Pure engines (`computeLeagueHealth`, a new `winProb`) run on baked fixtures; transient layers (push/alerts) are scripted toasts.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5, Vitest (added here) + @testing-library/react for component smoke tests, ESLint flat config.

## Global Constraints

- **Repo root:** `/Users/Lawrence/Documents/Rostiro` (NOT `/Users/Lawrence/Rostiro`, which is an empty decoy). All paths below are relative to the real root.
- **Branch:** work on `demo-mode-foundation` (already created; spec committed there).
- **Zero-leak rule (verbatim):** no file under `app/demo/**` may import `@/lib/supabase`, `@/lib/supabase-browser`, `@/lib/sleeper`, `@/lib/espn`, `@/lib/espnNews`, `@/lib/yahoo`, `@/lib/liveMatchupPoints`, `@/lib/pulse`, or any module that transitively imports `createAdminClient`/`createClient`. Allowed shared imports: `@/lib/healthScore`, `@/lib/scoring`, `@/lib/brandTokens`, `@/types`.
- **Real data only:** every player/stat/ADP number comes from real 2025 sources (nflverse + Fantasy Football Calculator ADP). No `Math.random`, no hand-typed stat lines.
- **State type (verbatim):** `RostiroState = 'draft' | 'standard' | 'waiver_day' | 'game_day' | 'film_room'` (from `types/index.ts`).
- **Console gating (verbatim):** render only when `process.env.NODE_ENV === 'development'` **or** URL search param `studio === 'true'`.
- **Commit after every task.** TDD: test first, watch it fail, implement, watch it pass, commit.

---

## File Structure

**Created:**
- `vitest.config.mts` — test runner config (jsdom env)
- `scripts/demo/build-fixtures.mts` — Phase-0 data pipeline (dev-run only, not bundled)
- `app/demo/fixtures/players.json`, `week.json`, `waivers.json` — baked by the pipeline
- `app/demo/fixtures/league.json`, `chat.json`, `timeline.json` — hand-authored
- `app/demo/fixtures/crest.tsx` — inline LL crest SVG
- `app/demo/lib/types.ts` — fixture + timeline TypeScript interfaces
- `app/demo/lib/timeline.ts` — pure timeline state machine + tests
- `app/demo/lib/winProb.ts` — pure win-probability fn + tests
- `app/demo/lib/DemoStateProvider.tsx` — React context wiring clock→state
- `app/demo/lib/loadFixtures.ts` — typed fixture loader (JSON→types)
- `app/demo/components/DirectorConsole.tsx` — gated drawer overlay
- `app/demo/components/StandardState.tsx` — Standard dashboard from fixtures
- `app/demo/components/ScriptedToast.tsx` — renders `activeAlert`
- `app/demo/layout.tsx`, `app/demo/page.tsx` — route shell + tour surface

**Modified:**
- `package.json` — add `test` script + dev deps
- `eslint.config.mjs` — add `app/demo/**` isolation block

---

## Task 1: Test runner (Vitest) + isolation lint rule

**Files:**
- Modify: `package.json`
- Create: `vitest.config.mts`
- Modify: `eslint.config.mjs`
- Test: `app/demo/lib/__smoke__/isolation.test.ts` (temporary sanity), plus a manual lint check

**Interfaces:**
- Produces: `npm test` (Vitest, jsdom) and an ESLint rule that errors on forbidden imports under `app/demo/**`.

- [ ] **Step 1: Install dev deps**

```bash
cd /Users/Lawrence/Documents/Rostiro
npm i -D vitest@^2 jsdom@^25 @testing-library/react@^16 @testing-library/jest-dom@^6 @vitejs/plugin-react@^4
```

- [ ] **Step 2: Add `test` script** to `package.json` `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.mts`**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', globals: true, include: ['app/demo/**/*.test.{ts,tsx}'] },
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
})
```

- [ ] **Step 4: Add isolation block to `eslint.config.mjs`** (append inside the `defineConfig([...])` array, after the existing rules object):

```js
{
  files: ['app/demo/**/*.{ts,tsx}'],
  ignores: ['scripts/**'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        { group: [
          '@/lib/supabase', '@/lib/supabase-browser', '@/lib/sleeper',
          '@/lib/espn', '@/lib/espnNews', '@/lib/yahoo',
          '@/lib/liveMatchupPoints', '@/lib/pulse',
        ], message: 'app/demo must stay in-memory: no Supabase/live-API/DB-coupled imports.' },
      ],
    }],
  },
},
```

- [ ] **Step 5: Verify the rule fires.** Temporarily create `app/demo/lib/__leak.ts` with `import { createAdminClient } from '@/lib/supabase'` and run:

```bash
npx eslint app/demo/lib/__leak.ts
```
Expected: error `no-restricted-imports ... app/demo must stay in-memory`. Then delete `__leak.ts`.

- [ ] **Step 6: Sanity test that Vitest runs.** Create `app/demo/lib/__smoke__/isolation.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
describe('vitest', () => { it('runs', () => { expect(1 + 1).toBe(2) }) })
```
Run: `npm test`
Expected: 1 passing test.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.mts eslint.config.mjs app/demo/lib/__smoke__/isolation.test.ts
git commit -m "chore: add Vitest + app/demo route-isolation lint rule"
```

---

## Task 2: Fixture & timeline types

**Files:**
- Create: `app/demo/lib/types.ts`

**Interfaces:**
- Produces: `DemoPlayer`, `DemoManager`, `DemoLeague`, `DemoWeek`, `PlayerStatline`, `TimelineBeat`, `ScriptedAlert`, `FixturePatch`, `DemoState`.

- [ ] **Step 1: Write `app/demo/lib/types.ts`** (types only; no test needed — consumed by later tasks):

```ts
import type { RostiroState } from '@/types'

export interface DemoPlayer {
  id: string            // nflverse gsis_id / player id
  name: string
  pos: string
  nflTeam: string
  headshotUrl: string | null
  adp: number | null
  season: { points: number; games: number }
}

export interface PlayerStatline {
  playerId: string
  points: number
  line: string          // e.g. "22 car, 118 yds, 2 TD"
}

export interface DemoManager {
  managerId: string
  teamName: string
  handle: string
  archetype: 'founder' | 'sweat' | 'casual' | 'flavor'
  roster: string[]      // DemoPlayer.id[]
  record: { w: number; l: number }
  seasonPoints: number
}

export interface DemoLeague { name: string; managers: DemoManager[] }

export interface DemoWeek {
  week: number
  matchups: { home: string; away: string }[]   // managerId pairs
  boxScores: Record<string, PlayerStatline>     // playerId → statline
}

export interface ScriptedAlert {
  id: string
  kind: 'touchdown' | 'injury' | 'trade' | 'waiver' | 'info'
  title: string
  body: string
}

export interface FixturePatch {
  boxScore?: PlayerStatline   // upsert a live scoring delta
}

export interface TimelineBeat {
  timeOffset: number          // seconds from tour start
  state?: RostiroState
  activeAlert?: ScriptedAlert
  patch?: FixturePatch
  label?: string
}

export interface DemoState {
  virtualClock: number
  currentState: RostiroState
  activeAlert: ScriptedAlert | null
}
```

- [ ] **Step 2: Commit**

```bash
git add app/demo/lib/types.ts
git commit -m "feat(demo): fixture and timeline type definitions"
```

---

## Task 3: Pure timeline state machine

**Files:**
- Create: `app/demo/lib/timeline.ts`
- Test: `app/demo/lib/timeline.test.ts`

**Interfaces:**
- Consumes: `TimelineBeat`, `DemoState`, `PlayerStatline` from `types.ts`.
- Produces: `resolveAt(beats, clock, initialState): DemoState` (pure — the state at any clock), and `collectPatches(beats, uptoClock): PlayerStatline[]` (all box-score upserts applied by `uptoClock`). `duration(beats): number`.

- [ ] **Step 1: Write failing tests** `app/demo/lib/timeline.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolveAt, collectPatches, duration } from './timeline'
import type { TimelineBeat } from './types'

const beats: TimelineBeat[] = [
  { timeOffset: 0, state: 'standard', label: 'intro' },
  { timeOffset: 10, state: 'game_day', activeAlert: { id: 'a1', kind: 'touchdown', title: 'TD', body: 'x' } },
  { timeOffset: 20, patch: { boxScore: { playerId: 'p1', points: 12.4, line: '1 TD' } } },
]

describe('resolveAt', () => {
  it('returns initial state before first beat effect', () => {
    expect(resolveAt(beats, -1, 'standard').currentState).toBe('standard')
  })
  it('applies the latest state beat at or before the clock', () => {
    expect(resolveAt(beats, 15, 'standard').currentState).toBe('game_day')
  })
  it('surfaces the alert from the most recent alert beat', () => {
    expect(resolveAt(beats, 12, 'standard').activeAlert?.id).toBe('a1')
  })
  it('keeps the active alert until a later alert beat replaces it', () => {
    // resolveAt is sticky: a state-only beat does not clear a prior alert.
    expect(resolveAt(beats, 25, 'standard').activeAlert?.id).toBe('a1')
  })
})

describe('collectPatches', () => {
  it('includes patches at or before the clock', () => {
    expect(collectPatches(beats, 20)).toHaveLength(1)
  })
  it('excludes future patches', () => {
    expect(collectPatches(beats, 19)).toHaveLength(0)
  })
})

describe('duration', () => {
  it('is the max timeOffset', () => { expect(duration(beats)).toBe(20) })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- timeline`
Expected: FAIL — `resolveAt` is not defined.

- [ ] **Step 3: Implement `app/demo/lib/timeline.ts`**

```ts
import type { TimelineBeat, DemoState, PlayerStatline } from './types'
import type { RostiroState } from '@/types'

/** Pure: the demo state at `clock` seconds, given the ordered beats. */
export function resolveAt(beats: TimelineBeat[], clock: number, initialState: RostiroState): DemoState {
  let currentState = initialState
  let activeAlert: DemoState['activeAlert'] = null
  for (const beat of beats) {
    if (beat.timeOffset > clock) break
    if (beat.state) currentState = beat.state
    if (beat.activeAlert) activeAlert = beat.activeAlert
  }
  return { virtualClock: clock, currentState, activeAlert }
}

/** Pure: every box-score upsert applied at or before `uptoClock`, in order. */
export function collectPatches(beats: TimelineBeat[], uptoClock: number): PlayerStatline[] {
  const out: PlayerStatline[] = []
  for (const beat of beats) {
    if (beat.timeOffset > uptoClock) break
    if (beat.patch?.boxScore) out.push(beat.patch.boxScore)
  }
  return out
}

export function duration(beats: TimelineBeat[]): number {
  return beats.reduce((max, b) => Math.max(max, b.timeOffset), 0)
}
```

Note: `beats` must be authored in ascending `timeOffset` order (the loop assumes it). The fixture loader (Task 6) sorts defensively.

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- timeline`
Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add app/demo/lib/timeline.ts app/demo/lib/timeline.test.ts
git commit -m "feat(demo): pure timeline state machine"
```

---

## Task 4: Win-probability pure function

**Files:**
- Create: `app/demo/lib/winProb.ts`
- Test: `app/demo/lib/winProb.test.ts`

**Interfaces:**
- Produces: `winProb({ marginNow, secondsRemaining, projMargin }): number` — probability home/"my team" wins, in [0,1].

- [ ] **Step 1: Write failing tests** `app/demo/lib/winProb.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { winProb } from './winProb'

describe('winProb', () => {
  it('is ~0.5 for a tie with everything remaining', () => {
    expect(winProb({ marginNow: 0, secondsRemaining: 3600, projMargin: 0 })).toBeCloseTo(0.5, 1)
  })
  it('approaches 1 for a large lead near the end', () => {
    expect(winProb({ marginNow: 40, secondsRemaining: 30, projMargin: 40 })).toBeGreaterThan(0.98)
  })
  it('approaches 0 for a large deficit near the end', () => {
    expect(winProb({ marginNow: -40, secondsRemaining: 30, projMargin: -40 })).toBeLessThan(0.02)
  })
  it('is monotonic in margin', () => {
    const a = winProb({ marginNow: 5, secondsRemaining: 1800, projMargin: 5 })
    const b = winProb({ marginNow: 15, secondsRemaining: 1800, projMargin: 15 })
    expect(b).toBeGreaterThan(a)
  })
  it('stays within [0,1]', () => {
    const p = winProb({ marginNow: 200, secondsRemaining: 0, projMargin: 200 })
    expect(p).toBeGreaterThanOrEqual(0)
    expect(p).toBeLessThanOrEqual(1)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- winProb`
Expected: FAIL — `winProb` not defined.

- [ ] **Step 3: Implement `app/demo/lib/winProb.ts`**

```ts
export interface WinProbInput {
  marginNow: number          // my projected-live points minus opponent's, right now
  secondsRemaining: number   // game-seconds left across my active players (0..3600+)
  projMargin: number         // expected final margin given remaining projections
}

/**
 * Logistic model. As time runs out the live margin dominates; early on the
 * projected final margin dominates. Sigma shrinks with remaining time so a
 * lead is worth more late. Demo-scoped but pure and side-effect-free, so it
 * can graduate into lib/ for the real Live tab later.
 */
export function winProb({ marginNow, secondsRemaining, projMargin }: WinProbInput): number {
  const frac = Math.max(0, Math.min(1, secondsRemaining / 3600)) // 1 = full game left
  // Blend: late game trusts the current margin, early game trusts projection.
  const effectiveMargin = marginNow * (1 - frac) + projMargin * frac
  // Uncertainty (points) scales with remaining time; floor keeps end-game crisp.
  const sigma = 3 + 22 * frac
  const p = 1 / (1 + Math.exp(-effectiveMargin / sigma))
  return Math.max(0, Math.min(1, p))
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- winProb`
Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add app/demo/lib/winProb.ts app/demo/lib/winProb.test.ts
git commit -m "feat(demo): pure win-probability function"
```

---

## Task 5: Phase-0 data pipeline (real 2025 fixtures)

**Files:**
- Create: `scripts/demo/build-fixtures.mts`
- Produces (git-committed output): `app/demo/fixtures/players.json`, `app/demo/fixtures/week.json`, `app/demo/fixtures/waivers.json`

**Interfaces:**
- Produces JSON conforming to `DemoPlayer[]`, `DemoWeek`, and a waivers array `{ playerId, name, pos, addPct, faabSuggestion }[]`.

This is a one-time dev script, not app code (excluded from lint isolation via `ignores: ['scripts/**']`). It fetches real public data. Verify asset filenames on the nflverse releases page if a URL 404s — nflverse occasionally renames release assets.

- [ ] **Step 1: Write `scripts/demo/build-fixtures.mts`**

```ts
/**
 * Phase-0 demo data pipeline. Run manually:
 *   npx tsx scripts/demo/build-fixtures.mts
 * Sources (all real, public):
 *   - nflverse player weekly stats + rosters (GitHub release CSVs)
 *   - Fantasy Football Calculator ADP API (2025 preseason)
 * Selects the highest-drama regular-season Sunday as the anchor week and
 * bakes players.json / week.json / waivers.json. No values are invented.
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const OUT = path.dirname(fileURLToPath(new URL('../../app/demo/fixtures/', import.meta.url)))

const NFLVERSE = 'https://github.com/nflverse/nflverse-data/releases/download'
const WEEKLY_URL  = `${NFLVERSE}/player_stats/stats_player_week_2025.csv`
const ROSTER_URL  = `${NFLVERSE}/weekly_rosters/roster_weekly_2025.csv`
const ADP_URL     = 'https://fantasyfootballcalculator.com/api/v1/adp/half-ppr?teams=10&year=2025'

async function csv(url: string): Promise<Record<string, string>[]> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  const text = await res.text()
  const [head, ...rows] = text.trim().split('\n')
  const cols = head.split(',')
  return rows.map((r) => {
    const cells = r.split(',')
    return Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? ''])) as Record<string, string>
  })
}

// 1. Weekly stats → per-player season totals + per-week fantasy points (half-PPR).
const weekly = await csv(WEEKLY_URL)
// nflverse weekly stat columns are documented; fantasy_points_ppr / _half exist
// in recent seasons. Fall back to computing from components if absent.
// 2. Roster → id → name/pos/team/headshot.
const rosters = await csv(ROSTER_URL)
// 3. ADP → id-by-name join (FFC gives name+position, not gsis_id).
const adp = await (await fetch(ADP_URL)).json() as { players: { name: string; position: string; adp: number }[] }

// --- Anchor-week selection ---------------------------------------------
// Score each regular-season week (1..14) by on-camera drama: total fantasy
// points scored + count of >=25-point individual games. Pick the max.
const byWeek = new Map<number, { total: number; booms: number }>()
for (const row of weekly) {
  const wk = Number(row.week)
  if (!wk || wk > 14) continue
  const pts = Number(row.fantasy_points_half_ppr ?? row.fantasy_points_ppr ?? 0)
  const cur = byWeek.get(wk) ?? { total: 0, booms: 0 }
  cur.total += pts
  if (pts >= 25) cur.booms += 1
  byWeek.set(wk, cur)
}
const anchorWeek = [...byWeek.entries()]
  .sort((a, b) => (b[1].total + b[1].booms * 10) - (a[1].total + a[1].booms * 10))[0][0]
console.log('Selected anchor week:', anchorWeek)

// --- Build players.json (top ~220 by season points) --------------------
// ... aggregate season totals per player_id, join roster name/pos/team/headshot,
//     join ADP by normalized name, keep top 220, write DemoPlayer[].
// --- Build week.json (anchor-week box scores) --------------------------
// ... for anchorWeek rows, write { playerId, points, line } using yards/TD cols.
// --- Build waivers.json (real breakouts) -------------------------------
// ... players with a large points jump into anchorWeek vs their prior avg,
//     low roster % proxy = high ADP/undrafted; suggest FAAB from boom size.

// writeFileSync(path.join(OUT, 'players.json'), JSON.stringify(players, null, 2))
// writeFileSync(path.join(OUT, 'week.json'), JSON.stringify(week, null, 2))
// writeFileSync(path.join(OUT, 'waivers.json'), JSON.stringify(waivers, null, 2))
console.log('Anchor week', anchorWeek, '— fill in the marked build sections, then uncomment writes.')
```

The three marked build sections are mechanical transforms over the fetched rows; implement them to emit the exact `DemoPlayer` / `DemoWeek` / waivers shapes from Task 2. Record the selected `anchorWeek` in a comment at the top of `league.json` (Task 7 rosters are chosen to make that week's matchups dramatic).

- [ ] **Step 2: Run the pipeline**

```bash
npx tsx scripts/demo/build-fixtures.mts
```
Expected: prints the selected anchor week and writes three JSON files under `app/demo/fixtures/`. Spot-check: open `players.json`, confirm real names (e.g. a known 2025 star) with plausible season points and a numeric ADP.

- [ ] **Step 3: Commit**

```bash
git add scripts/demo/build-fixtures.mts app/demo/fixtures/players.json app/demo/fixtures/week.json app/demo/fixtures/waivers.json
git commit -m "feat(demo): Phase-0 pipeline + baked real-2025 fixtures (anchor week)"
```

---

## Task 6: Hand-authored fixtures + typed loader

**Files:**
- Create: `app/demo/fixtures/league.json`, `chat.json`, `timeline.json`, `crest.tsx`
- Create: `app/demo/lib/loadFixtures.ts`
- Test: `app/demo/lib/loadFixtures.test.ts`

**Interfaces:**
- Consumes: fixture JSON + `types.ts`.
- Produces: `loadFixtures(): { players, league, week, waivers, chat, timeline }` (typed, timeline sorted by `timeOffset`), and `DemoCrest` React component.

- [ ] **Step 1: Author `league.json`** — the 10 locked managers. Each roster is filled with real `DemoPlayer.id`s from `players.json` (Task 5) — draft ~15 players per team so the anchor-week matchups are competitive; give Lawrence's Legends a strong-but-not-unbeatable core. Shape = `DemoLeague`:

```json
{
  "name": "Lawrence's Legends League",
  "managers": [
    { "managerId": "m01", "teamName": "Lawrence's Legends", "handle": "Lawrence T.", "archetype": "founder", "roster": ["<real ids>"], "record": { "w": 8, "l": 2 }, "seasonPoints": 1284.6 },
    { "managerId": "m02", "teamName": "Regression to the Mean", "handle": "Marcus Devane", "archetype": "sweat", "roster": [], "record": { "w": 7, "l": 3 }, "seasonPoints": 1240.1 },
    { "managerId": "m03", "teamName": "Priya's Process", "handle": "Priya Nair", "archetype": "sweat", "roster": [], "record": { "w": 3, "l": 7 }, "seasonPoints": 1150.0 },
    { "managerId": "m04", "teamName": "Okafor It All", "handle": "Danny Okafor", "archetype": "sweat", "roster": [], "record": { "w": 6, "l": 4 }, "seasonPoints": 1201.3 },
    { "managerId": "m05", "teamName": "Chad & the Sunshine Band", "handle": "Chad Beemer", "archetype": "casual", "roster": [], "record": { "w": 4, "l": 6 }, "seasonPoints": 1112.8 },
    { "managerId": "m06", "teamName": "Autodraft Anonymous", "handle": "Becks Lindqvist", "archetype": "casual", "roster": [], "record": { "w": 6, "l": 4 }, "seasonPoints": 1188.5 },
    { "managerId": "m07", "teamName": "Marchetti's Meatballs", "handle": "Tony Marchetti", "archetype": "casual", "roster": [], "record": { "w": 3, "l": 7 }, "seasonPoints": 1098.2 },
    { "managerId": "m08", "teamName": "Waiver Wire Warriors", "handle": "Jamal Rivers", "archetype": "flavor", "roster": [], "record": { "w": 5, "l": 5 }, "seasonPoints": 1165.9 },
    { "managerId": "m09", "teamName": "Tran Sackers", "handle": "Sophie Tran", "archetype": "flavor", "roster": [], "record": { "w": 8, "l": 2 }, "seasonPoints": 1276.4 },
    { "managerId": "m10", "teamName": "The Ocho", "handle": "Mike Osei", "archetype": "flavor", "roster": [], "record": { "w": 4, "l": 6 }, "seasonPoints": 1120.7 }
  ]
}
```

- [ ] **Step 2: Author `chat.json`** — activity-feed lines keyed by `managerId`, in each locked voice (see spec §6). At least 2 lines per manager. Example:

```json
{
  "m01": ["Rules are posted. Trade deadline is a deadline.", "Commissioner's note: waivers process Wednesday 3am. Set your claims."],
  "m09": ["gg", "was a good matchup"],
  "m10": ["Scoreboard. Oh wait, don't look 😅", "This is the year. I can feel it."]
}
```

- [ ] **Step 3: Author `timeline.json`** — a calm Standard-state loop for Phase 1 (Game Day beats are added by the Phase-2 spec). `TimelineBeat[]`, ascending `timeOffset`:

```json
[
  { "timeOffset": 0, "state": "standard", "label": "Standard — league home" },
  { "timeOffset": 8, "state": "standard", "activeAlert": { "id": "i1", "kind": "info", "title": "Health Score updated", "body": "Lawrence's Legends: 82 — Healthy" }, "label": "Health Score" },
  { "timeOffset": 18, "state": "standard", "label": "standings + chat" }
]
```

- [ ] **Step 4: Author `crest.tsx`** — inline SVG, dark navy circle + Rostiro pulse mark + silver "LL" monogram (no external asset):

```tsx
export function DemoCrest({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Lawrence's Legends crest">
      <circle cx="32" cy="32" r="31" fill="#0b1c3a" stroke="#c8ccd4" strokeWidth="1.5" />
      <text x="32" y="30" textAnchor="middle" fontSize="26" fontWeight="800" fill="#1f3a63" opacity="0.4" fontFamily="serif">LL</text>
      {/* Rostiro pulse mark */}
      <path d="M12 34 h10 l4 -12 l6 22 l4 -10 h16" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
```

- [ ] **Step 5: Write failing test** `app/demo/lib/loadFixtures.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { loadFixtures } from './loadFixtures'

describe('loadFixtures', () => {
  it('loads all 10 locked managers with founder first', () => {
    const { league } = loadFixtures()
    expect(league.managers).toHaveLength(10)
    expect(league.managers[0].teamName).toBe("Lawrence's Legends")
    expect(league.managers[0].archetype).toBe('founder')
  })
  it('returns timeline beats sorted by timeOffset', () => {
    const { timeline } = loadFixtures()
    const offs = timeline.map((b) => b.timeOffset)
    expect(offs).toEqual([...offs].sort((a, b) => a - b))
  })
  it('every roster player id exists in players', () => {
    const { players, league } = loadFixtures()
    const ids = new Set(players.map((p) => p.id))
    for (const m of league.managers) for (const pid of m.roster) expect(ids.has(pid)).toBe(true)
  })
})
```

- [ ] **Step 6: Run to verify failure**

Run: `npm test -- loadFixtures`
Expected: FAIL — `loadFixtures` not defined.

- [ ] **Step 7: Implement `app/demo/lib/loadFixtures.ts`**

```ts
import players from '@/app/demo/fixtures/players.json'
import league from '@/app/demo/fixtures/league.json'
import week from '@/app/demo/fixtures/week.json'
import waivers from '@/app/demo/fixtures/waivers.json'
import chat from '@/app/demo/fixtures/chat.json'
import timeline from '@/app/demo/fixtures/timeline.json'
import type { DemoPlayer, DemoLeague, DemoWeek, TimelineBeat } from './types'

export function loadFixtures() {
  return {
    players: players as DemoPlayer[],
    league: league as DemoLeague,
    week: week as DemoWeek,
    waivers: waivers as { playerId: string; name: string; pos: string; addPct: number; faabSuggestion: number }[],
    chat: chat as Record<string, string[]>,
    timeline: [...(timeline as TimelineBeat[])].sort((a, b) => a.timeOffset - b.timeOffset),
  }
}
```

Ensure `tsconfig.json` has `"resolveJsonModule": true` (Next sets this by default; add if the import errors).

- [ ] **Step 8: Run to verify pass**

Run: `npm test -- loadFixtures`
Expected: all passing.

- [ ] **Step 9: Commit**

```bash
git add app/demo/fixtures/ app/demo/lib/loadFixtures.ts app/demo/lib/loadFixtures.test.ts
git commit -m "feat(demo): authored league/chat/timeline/crest fixtures + typed loader"
```

---

## Task 7: DemoStateProvider (virtual clock → state)

**Files:**
- Create: `app/demo/lib/DemoStateProvider.tsx`
- Test: `app/demo/lib/DemoStateProvider.test.tsx`

**Interfaces:**
- Consumes: `loadFixtures`, `resolveAt`, `duration` from timeline.
- Produces: `<DemoStateProvider>` + hook `useDemo(): { state: DemoState; clock: number; playing: boolean; controls: DemoControls }` where `DemoControls = { play(): void; pause(): void; seek(sec: number): void; setSpeed(x: number): void; jumpToState(s: RostiroState): void; inject(alert: ScriptedAlert): void }`.

- [ ] **Step 1: Write failing test** `app/demo/lib/DemoStateProvider.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { DemoStateProvider, useDemo } from './DemoStateProvider'

function Probe() {
  const { state, controls } = useDemo()
  return (
    <div>
      <span data-testid="state">{state.currentState}</span>
      <button onClick={() => controls.jumpToState('game_day')}>jump</button>
    </div>
  )
}

describe('DemoStateProvider', () => {
  it('starts in the timeline initial state', () => {
    render(<DemoStateProvider autoplay={false}><Probe /></DemoStateProvider>)
    expect(screen.getByTestId('state').textContent).toBe('standard')
  })
  it('jumpToState overrides current state immediately', () => {
    render(<DemoStateProvider autoplay={false}><Probe /></DemoStateProvider>)
    act(() => { screen.getByText('jump').click() })
    expect(screen.getByTestId('state').textContent).toBe('game_day')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- DemoStateProvider`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `app/demo/lib/DemoStateProvider.tsx`**

```tsx
'use client'
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { RostiroState } from '@/types'
import type { DemoState, ScriptedAlert } from './types'
import { resolveAt, duration } from './timeline'
import { loadFixtures } from './loadFixtures'

export interface DemoControls {
  play(): void; pause(): void; seek(sec: number): void; setSpeed(x: number): void
  jumpToState(s: RostiroState): void; inject(alert: ScriptedAlert): void
}
interface Ctx { state: DemoState; clock: number; playing: boolean; controls: DemoControls }
const DemoCtx = createContext<Ctx | null>(null)

export function DemoStateProvider({ children, autoplay = true }: { children: ReactNode; autoplay?: boolean }) {
  const { timeline } = useMemo(() => loadFixtures(), [])
  const total = useMemo(() => duration(timeline), [timeline])
  const [clock, setClock] = useState(0)
  const [playing, setPlaying] = useState(autoplay)
  const [speed, setSpeed] = useState(1)
  const [override, setOverride] = useState<{ state?: RostiroState; alert?: ScriptedAlert } | null>(null)
  const raf = useRef<number | null>(null)
  const last = useRef<number>(0)

  useEffect(() => {
    if (!playing) return
    last.current = performance.now()
    const tick = (t: number) => {
      const dt = (t - last.current) / 1000 * speed
      last.current = t
      setClock((c) => (total > 0 ? (c + dt) % total : 0)) // loop
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [playing, speed, total])

  const base = resolveAt(timeline, clock, 'standard')
  const state: DemoState = {
    virtualClock: clock,
    currentState: override?.state ?? base.currentState,
    activeAlert: override?.alert ?? base.activeAlert,
  }

  const controls: DemoControls = {
    play: () => setPlaying(true),
    pause: () => setPlaying(false),
    seek: (sec) => { setOverride(null); setClock(Math.max(0, Math.min(total, sec))) },
    setSpeed: (x) => setSpeed(x),
    jumpToState: (s) => { setPlaying(false); setOverride({ state: s }) },
    inject: (alert) => setOverride((o) => ({ state: o?.state, alert })),
  }

  return <DemoCtx.Provider value={{ state, clock, playing, controls }}>{children}</DemoCtx.Provider>
}

export function useDemo(): Ctx {
  const ctx = useContext(DemoCtx)
  if (!ctx) throw new Error('useDemo must be used within DemoStateProvider')
  return ctx
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- DemoStateProvider`
Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add app/demo/lib/DemoStateProvider.tsx app/demo/lib/DemoStateProvider.test.tsx
git commit -m "feat(demo): DemoStateProvider virtual clock + controls"
```

---

## Task 8: Director's Console (gated drawer)

**Files:**
- Create: `app/demo/components/DirectorConsole.tsx`
- Test: `app/demo/components/DirectorConsole.test.tsx`

**Interfaces:**
- Consumes: `useDemo`, `STATE_CONFIG` from `@/lib/brandTokens`.
- Produces: `<DirectorConsole visible={boolean} />` — renders nothing when `!visible`; otherwise play/pause/scrub/speed + 5 jump-to-state buttons + a "Inject TD" button.

- [ ] **Step 1: Write failing test** `app/demo/components/DirectorConsole.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DemoStateProvider } from '../lib/DemoStateProvider'
import { DirectorConsole } from './DirectorConsole'

const wrap = (visible: boolean) =>
  render(<DemoStateProvider autoplay={false}><DirectorConsole visible={visible} /></DemoStateProvider>)

describe('DirectorConsole', () => {
  it('renders nothing when not visible', () => {
    const { container } = wrap(false)
    expect(container.textContent).toBe('')
  })
  it('renders 5 jump-to-state buttons when visible', () => {
    wrap(true)
    for (const s of ['Draft', 'Standard', 'Waiver', 'Game', 'Film']) {
      expect(screen.getByRole('button', { name: new RegExp(s, 'i') })).toBeTruthy()
    }
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- DirectorConsole`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `app/demo/components/DirectorConsole.tsx`**

```tsx
'use client'
import type { RostiroState } from '@/types'
import { useDemo } from '../lib/DemoStateProvider'

const STATES: { label: string; value: RostiroState }[] = [
  { label: 'Draft', value: 'draft' },
  { label: 'Standard', value: 'standard' },
  { label: 'Waiver', value: 'waiver_day' },
  { label: 'Game Day', value: 'game_day' },
  { label: 'Film Room', value: 'film_room' },
]

export function DirectorConsole({ visible }: { visible: boolean }) {
  const { state, clock, playing, controls } = useDemo()
  if (!visible) return null
  return (
    <aside style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: '#0b1c3a', color: '#fff', padding: '10px 16px', display: 'flex',
      gap: 12, alignItems: 'center', flexWrap: 'wrap', fontFamily: 'system-ui', fontSize: 13 }}>
      <strong>🎬 Director</strong>
      <button onClick={() => (playing ? controls.pause() : controls.play())}>{playing ? 'Pause' : 'Play'}</button>
      <span>clock {clock.toFixed(1)}s</span>
      <input type="range" min={0} max={60} step={0.5} value={Math.min(clock, 60)}
             onChange={(e) => controls.seek(Number(e.target.value))} aria-label="scrub" />
      <label>speed
        <select onChange={(e) => controls.setSpeed(Number(e.target.value))} defaultValue="1">
          <option value="0.5">0.5x</option><option value="1">1x</option><option value="2">2x</option>
        </select>
      </label>
      <span>|</span>
      {STATES.map((s) => (
        <button key={s.value} onClick={() => controls.jumpToState(s.value)}
                style={{ fontWeight: state.currentState === s.value ? 700 : 400 }}>{s.label}</button>
      ))}
      <span>|</span>
      <button onClick={() => controls.inject({ id: `td-${Date.now()}`, kind: 'touchdown', title: 'TOUCHDOWN', body: 'Injected score — +6.0' })}>Inject TD</button>
    </aside>
  )
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- DirectorConsole`
Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add app/demo/components/DirectorConsole.tsx app/demo/components/DirectorConsole.test.tsx
git commit -m "feat(demo): Director's Console drawer (play/scrub/jump/inject)"
```

---

## Task 9: ScriptedToast + StandardState (real Health Score)

**Files:**
- Create: `app/demo/components/ScriptedToast.tsx`
- Create: `app/demo/components/StandardState.tsx`
- Test: `app/demo/components/StandardState.test.tsx`

**Interfaces:**
- Consumes: `useDemo`, `loadFixtures`, `computeLeagueHealth` from `@/lib/healthScore`.
- Produces: `<StandardState />` (standings + chat + real Health Score card) and `<ScriptedToast />` (renders `state.activeAlert`).

- [ ] **Step 1: Write failing test** `app/demo/components/StandardState.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DemoStateProvider } from '../lib/DemoStateProvider'
import { StandardState } from './StandardState'

describe('StandardState', () => {
  it('shows the founder team and a numeric Health Score', () => {
    render(<DemoStateProvider autoplay={false}><StandardState /></DemoStateProvider>)
    expect(screen.getByText(/Lawrence's Legends/)).toBeTruthy()
    // Health Score card renders a number 0-100
    expect(screen.getByTestId('health-score').textContent).toMatch(/^\d{1,3}$/)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- StandardState`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `app/demo/components/ScriptedToast.tsx`**

```tsx
'use client'
import { useDemo } from '../lib/DemoStateProvider'

export function ScriptedToast() {
  const { state } = useDemo()
  if (!state.activeAlert) return null
  const a = state.activeAlert
  return (
    <div role="status" style={{ position: 'fixed', top: 16, right: 16, zIndex: 9000,
      background: '#111827', color: '#fff', padding: '12px 16px', borderRadius: 10,
      borderLeft: '4px solid #3b82f6', maxWidth: 320 }}>
      <div style={{ fontWeight: 700, fontSize: 13 }}>{a.title}</div>
      <div style={{ fontSize: 13, opacity: 0.85 }}>{a.body}</div>
    </div>
  )
}
```

- [ ] **Step 4: Implement `app/demo/components/StandardState.tsx`** — standings from `league.json`, chat from `chat.json`, and a **real** Health Score built from the founder roster + `players.json` fed into `computeLeagueHealth`:

```tsx
'use client'
import { useMemo } from 'react'
import { computeLeagueHealth, type HealthInput } from '@/lib/healthScore'
import { loadFixtures } from '../lib/loadFixtures'
import { DemoCrest } from '../fixtures/crest'

export function StandardState() {
  const { players, league, chat } = useMemo(() => loadFixtures(), [])
  const health = useMemo(() => {
    const byId = new Map(players.map((p) => [p.id, p]))
    const founder = league.managers[0]
    const rostered = new Set(league.managers.flatMap((m) => m.roster))
    const freeAgents = players.filter((p) => !rostered.has(p.id) && p.adp != null)
      .sort((a, b) => (a.adp! - b.adp!))
    const input: HealthInput = {
      myPlayers: founder.roster.map((id) => {
        const p = byId.get(id)
        return { playerId: id, adp: p?.adp ?? null, injuryStatus: null }
      }),
      starterIds: founder.roster.slice(0, 9),
      bestFreeAgentAdp: freeAgents[0]?.adp ?? null,
      bestFreeAgentName: freeAgents[0]?.name ?? null,
    }
    return computeLeagueHealth(input)
  }, [players, league])

  const standings = [...league.managers].sort((a, b) => b.record.w - a.record.w || b.seasonPoints - a.seasonPoints)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, padding: 24 }}>
      <section>
        <h2 style={{ display: 'flex', gap: 8, alignItems: 'center' }}><DemoCrest size={28} /> Standings</h2>
        <ol>
          {standings.map((m) => (
            <li key={m.managerId} style={{ fontWeight: m.archetype === 'founder' ? 700 : 400 }}>
              {m.teamName} — {m.record.w}-{m.record.l} ({m.seasonPoints.toFixed(1)})
            </li>
          ))}
        </ol>
      </section>
      <section>
        <h2>League Health</h2>
        <div style={{ fontSize: 48, fontWeight: 800 }} data-testid="health-score">{health.score ?? '—'}</div>
        <div>{health.status}</div>
        <h3>Activity</h3>
        <ul>
          {league.managers.slice(0, 4).flatMap((m) => (chat[m.managerId] ?? []).slice(0, 1).map((line, i) => (
            <li key={`${m.managerId}-${i}`}><strong>{m.handle}:</strong> {line}</li>
          )))}
        </ul>
      </section>
    </div>
  )
}
```

Confirm the `LeagueHealth.score` field renders as an integer; if `computeLeagueHealth` returns a float, wrap in `Math.round(...)` so the test regex `^\d{1,3}$` matches.

- [ ] **Step 5: Run to verify pass**

Run: `npm test -- StandardState`
Expected: passing (real, non-placeholder Health Score number shown).

- [ ] **Step 6: Commit**

```bash
git add app/demo/components/ScriptedToast.tsx app/demo/components/StandardState.tsx app/demo/components/StandardState.test.tsx
git commit -m "feat(demo): ScriptedToast + Standard state with real Health Score"
```

---

## Task 10: Route shell — layout + tour page (self-playing)

**Files:**
- Create: `app/demo/layout.tsx`
- Create: `app/demo/page.tsx`
- Test: `app/demo/page.test.tsx`

**Interfaces:**
- Consumes: everything above.
- Produces: `/demo` (public, autoplay tour) and `/demo?studio=true` (Console visible). Layout wraps children in `DemoStateProvider` + `ScriptedToast` + gated `DirectorConsole`.

- [ ] **Step 1: Write failing test** `app/demo/page.test.tsx` (render the page body with the provider; console visibility resolved by a prop the layout computes, tested via the client wrapper):

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DemoStateProvider } from './lib/DemoStateProvider'
import { DemoTour } from './page'

describe('DemoTour', () => {
  it('renders the Standard state surface by default', () => {
    render(<DemoStateProvider autoplay={false}><DemoTour consoleVisible={false} /></DemoStateProvider>)
    expect(screen.getByText(/Standings/)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- page`
Expected: FAIL — `DemoTour` not exported.

- [ ] **Step 3: Implement `app/demo/page.tsx`** — client tour that switches surface by `currentState` (only Standard is implemented in Phase 1; others show a labeled placeholder panel the follow-on specs replace):

```tsx
'use client'
import { useDemo } from './lib/DemoStateProvider'
import { StandardState } from './components/StandardState'
import { DirectorConsole } from './components/DirectorConsole'
import { ScriptedToast } from './components/ScriptedToast'

export function DemoTour({ consoleVisible }: { consoleVisible: boolean }) {
  const { state } = useDemo()
  return (
    <>
      {state.currentState === 'standard'
        ? <StandardState />
        : <div style={{ padding: 48, textAlign: 'center', opacity: 0.7 }}>
            {state.currentState} — engine ships in a follow-on spec
          </div>}
      <ScriptedToast />
      <DirectorConsole visible={consoleVisible} />
    </>
  )
}

export default function Page({ searchParams }: { searchParams: { studio?: string } }) {
  const consoleVisible = process.env.NODE_ENV === 'development' || searchParams?.studio === 'true'
  return <DemoTour consoleVisible={consoleVisible} />
}
```

- [ ] **Step 4: Implement `app/demo/layout.tsx`** — wraps the route subtree in the provider (autoplay on for public tour):

```tsx
import type { ReactNode } from 'react'
import { DemoStateProvider } from './lib/DemoStateProvider'

export default function DemoLayout({ children }: { children: ReactNode }) {
  return <DemoStateProvider autoplay>{children}</DemoStateProvider>
}
```

Note: `page.tsx` default export reads `searchParams` (a server-component prop) to compute `consoleVisible`, then hands it to the `'use client'` `DemoTour`. Because `layout.tsx` already provides the client context, keep the default `Page` a thin server wrapper; if Next flags the `'use client'`/`searchParams` boundary, move the `searchParams` read into `layout.tsx` and pass `consoleVisible` down via a second provider prop.

- [ ] **Step 5: Run to verify pass**

Run: `npm test -- page`
Expected: passing.

- [ ] **Step 6: Full suite + lint + build gate**

```bash
npm test && npm run lint && npm run build
```
Expected: all tests pass; lint clean (isolation rule satisfied); production build succeeds.

- [ ] **Step 7: Manual smoke** — `npm run dev`, open `http://localhost:3000/demo` (tour auto-plays Standard; Health Score is a real number) and `http://localhost:3000/demo?studio=true` (Console visible; jump-to-state + Inject TD work).

- [ ] **Step 8: Commit**

```bash
git add app/demo/layout.tsx app/demo/page.tsx app/demo/page.test.tsx
git commit -m "feat(demo): /demo route shell — self-playing tour + gated Console"
```

---

## Self-Review

**Spec coverage:**
- §2 zero-leak → Task 1 (lint rule) ✅ · in-memory only → all tasks import only fixtures/pure modules ✅ · real data → Task 5 ✅ · hybrid fidelity → Task 9 (real Health Score) + Task 4 (winProb) + Task 9 (scripted toast) ✅
- §3 architecture / file structure → Tasks 2,6,7,10 ✅
- §4 isolation enforcement → Task 1 ✅
- §5 fixture model → Tasks 2,5,6 ✅
- §6 locked league → Task 6 ✅
- §7 timeline machine + tour → Tasks 3,7,10 ✅
- §8 Console shell (gating + play/pause/scrub/jump + inject stub) → Task 8 ✅
- §9 engine wiring → Tasks 4,9 ✅
- §10 testing → each task's tests + Task 10 Step 6 gate ✅
- §11 out-of-scope states → Task 10 placeholders, follow-on specs ✅

**Placeholder scan:** The only intentionally-deferred code is Task 5's three marked transform sections (data-shaping over fetched real rows) — kept as described transforms rather than invented data, since the exact output depends on live 2025 rows. Every app-code task has complete, runnable code.

**Type consistency:** `resolveAt`/`collectPatches`/`duration` (Task 3) match their uses in Task 7. `DemoControls` (Task 7) matches its use in Task 8. `HealthInput`/`HealthPlayer` (Task 9) match the real `lib/healthScore.ts` signature. Fixture types (Task 2) match `loadFixtures` casts (Task 6).
