# Project A — Live Cross-League Win-Probability on the Interrupt Card — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the live product perform what the marketing depicts — on a real Game Day touchdown swing, show the user's current per-league win probability on the real Interrupt card, computed from real live matchup scores, Pro-gated.

**Architecture:** Graduate the pure `winProb` to `lib/`; add a pure `computeLeagueWinProbs` adapter over `LiveMatchupSummary`; compute metrics inside `detectTouchdownSwings` (Pro-gated) and persist them on the `pulse_items` row (new `metrics_json` column); thread the metrics through the read path (`rowToPulseItem`, `/api/pulse/interrupts`) into the already-built `InterruptCardView` metrics branch via `InterruptStack`.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Supabase (Postgres), Vitest.

## Global Constraints

- **Repo root:** `/Users/Lawrence/Documents/Rostiro` (NOT `/Users/Lawrence/Rostiro`).
- **Honesty:** rows show CURRENT per-league win probability ("Win Prob 62%") from real live matchup scores — never a fabricated per-TD delta (the team-level feed can't attribute the scoring player). The Simulation Studio's dramatized "+X%" is untouched.
- **Pro-gated:** compute/attach metrics only when `!(await isFreePlan(admin, userId))` (the existing helper in `lib/usageLimits.ts`). Free users get the card with no metric rows.
- **No live-app regression:** free-tier touchdown cards render exactly as today (no metrics). The interrupts route must still degrade safely pre-migration.
- **winProb signature (verbatim):** `winProb({ marginNow, secondsRemaining, projMargin }): number`.
- **`InterruptMetricRow`:** `{ leagueName: string; label: string; value: string; deltaPositive?: boolean }`.
- **Migration is a deploy prerequisite** — `metrics_json jsonb` on `pulse_items`; the operator applies it to Supabase.
- **Commit after every task. TDD.**

---

## File Structure

**Created:**
- `lib/winProb.ts` (+ `lib/winProb.test.ts`) — graduated pure function
- `lib/liveWinProb.ts` (+ `lib/liveWinProb.test.ts`) — per-league win-prob adapter
- `supabase/migration_interrupt_metrics.sql`

**Modified:**
- `app/demo/lib/winProb.ts` — re-export from `@/lib/winProb`
- `types/index.ts` — move `InterruptMetricRow` here; add `PulseItem.metrics?`
- `components/interrupt/InterruptCardView.tsx` — import `InterruptMetricRow` from `@/types`
- `lib/pulse.ts` — `PulseItemRow.metrics_json` + `rowToPulseItem` mapping
- `app/api/pulse/interrupts/route.ts` — select `metrics_json`
- `lib/engagementTriggers.ts` — `insertPulseItem` writes `metrics_json`; `detectTouchdownSwings` computes Pro-gated metrics
- `components/InterruptStack.tsx` — pass `metrics={current.metrics}`

---

## Task 1: Graduate `winProb` to `lib/`

**Files:**
- Create: `lib/winProb.ts`, `lib/winProb.test.ts`
- Modify: `app/demo/lib/winProb.ts`

**Interfaces:**
- Produces: `winProb(input: WinProbInput): number`, `WinProbInput` from `@/lib/winProb`. `app/demo/lib/winProb` re-exports it (demo/studio unchanged).

- [ ] **Step 1: Move the implementation.** Copy the ENTIRE current contents of `app/demo/lib/winProb.ts` into a new `lib/winProb.ts` (the `WinProbInput` interface + `winProb` function, unchanged).

- [ ] **Step 2: Re-export from the demo path.** Replace the contents of `app/demo/lib/winProb.ts` with:

```ts
export * from '@/lib/winProb'
```

- [ ] **Step 3: Write `lib/winProb.test.ts`** (mirror the demo tests so the graduated fn is covered):

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
    expect(p).toBeGreaterThanOrEqual(0); expect(p).toBeLessThanOrEqual(1)
  })
})
```

Note: `lib/winProb.test.ts` needs the vitest `include` to cover `lib/`. Add `'lib/**/*.test.ts'` to `vitest.config.mts` `include` in this task.

- [ ] **Step 4: Broaden vitest include** — edit `vitest.config.mts` `include` array, append `'lib/**/*.test.ts'`.

- [ ] **Step 5: Run** — `npm test -- winProb` → both `lib/winProb.test.ts` and the demo `app/demo/lib/winProb.test.ts` (which now imports the re-export) pass. Then FULL `npm test`.

- [ ] **Step 6: Commit**

```bash
git add lib/winProb.ts lib/winProb.test.ts app/demo/lib/winProb.ts vitest.config.mts
git commit -m "refactor(winprob): graduate pure winProb to lib/ (demo re-exports)"
```

---

## Task 2: Shared `InterruptMetricRow` type + `PulseItem.metrics`

**Files:**
- Modify: `types/index.ts`, `components/interrupt/InterruptCardView.tsx`

**Interfaces:**
- Produces: `InterruptMetricRow` exported from `@/types`; `PulseItem.metrics?: InterruptMetricRow[]`.

- [ ] **Step 1: Add `InterruptMetricRow` to `types/index.ts`.** Add near the `PulseItem` interface:

```ts
export interface InterruptMetricRow {
  leagueName: string
  label: string
  value: string
  deltaPositive?: boolean
}
```

- [ ] **Step 2: Add `metrics` to `PulseItem`** in `types/index.ts` — add this optional field to the `PulseItem` interface (after `affectedLeagues`):

```ts
  metrics?: InterruptMetricRow[]
```

- [ ] **Step 3: Update `InterruptCardView.tsx`** — remove its local `InterruptMetricRow` interface (lines defining `export interface InterruptMetricRow { ... }`) and import it from types instead. Change the top imports to:

```ts
import type { PulsePriority, InterruptMetricRow } from '@/types'
```
(Keep everything else — the `metrics?: InterruptMetricRow[]` prop usage now resolves to the `@/types` type. Any other file importing `InterruptMetricRow` from `@/components/interrupt/InterruptCardView` — e.g. the studio's `simEvents.ts` — must be updated to import from `@/types`; grep for it and fix.)

- [ ] **Step 4: Fix any consumers of the old type location.** Run `grep -rn "InterruptMetricRow" app components lib | grep -v "@/types"` and change any `from '@/components/interrupt/InterruptCardView'` (for the type) to `from '@/types'`. Known: `app/demo/lib/simEvents.ts` imports `InterruptMetricRow` from the component — repoint it to `@/types`.

- [ ] **Step 5: Run** — `npm test` (all pass) and `npm run build` (exit 0, confirms type move compiles).

- [ ] **Step 6: Commit**

```bash
git add types/index.ts components/interrupt/InterruptCardView.tsx app/demo/lib/simEvents.ts
git commit -m "refactor(types): move InterruptMetricRow to @/types + add PulseItem.metrics"
```

---

## Task 3: Live win-prob adapter — `lib/liveWinProb.ts`

**Files:**
- Create: `lib/liveWinProb.ts`, `lib/liveWinProb.test.ts`

**Interfaces:**
- Consumes: `winProb` (`./winProb`), `LiveMatchupSummary` (`./liveRoster`), `InterruptMetricRow` (`@/types`).
- Produces: `computeLeagueWinProbs(matchups, affectedLeagueIds): InterruptMetricRow[]`.

- [ ] **Step 1: Write failing tests** `lib/liveWinProb.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeLeagueWinProbs } from './liveWinProb'
import type { LiveMatchupSummary } from './liveRoster'

const mk = (leagueId: string, my: number, opp: number, myProj: number | null = null, oppProj: number | null = null): LiveMatchupSummary =>
  ({ leagueId, leagueName: `L-${leagueId}`, myScore: my, myProjectedScore: myProj, opponentScore: opp, opponentProjectedScore: oppProj })

describe('computeLeagueWinProbs', () => {
  it('only emits rows for affected leagues', () => {
    const rows = computeLeagueWinProbs([mk('a', 80, 70), mk('b', 60, 90)], new Set(['a']))
    expect(rows).toHaveLength(1)
    expect(rows[0].leagueName).toBe('L-a')
    expect(rows[0].label).toBe('Win Prob')
  })
  it('a clear leader is > 50% and deltaPositive', () => {
    const [r] = computeLeagueWinProbs([mk('a', 110, 80, 110, 80)], new Set(['a']))
    expect(r.value).toMatch(/^\d{1,3}%$/)
    expect(Number(r.value.replace('%', ''))).toBeGreaterThan(50)
    expect(r.deltaPositive).toBe(true)
  })
  it('a clear trailer is < 50% and not deltaPositive', () => {
    const [r] = computeLeagueWinProbs([mk('a', 80, 110, 80, 110)], new Set(['a']))
    expect(Number(r.value.replace('%', ''))).toBeLessThan(50)
    expect(r.deltaPositive).toBe(false)
  })
  it('empty affected set yields no rows', () => {
    expect(computeLeagueWinProbs([mk('a', 80, 70)], new Set())).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npm test -- liveWinProb` → FAIL.

- [ ] **Step 3: Implement `lib/liveWinProb.ts`**

```ts
import { winProb } from './winProb'
import type { LiveMatchupSummary } from './liveRoster'
import type { InterruptMetricRow } from '@/types'

// No per-matchup game clock exists in LiveMatchupSummary, so estimate how much
// game is left from the projection gap: a large (projected - current) means
// early in the slate (trust projection); ~0 means the games are effectively
// done (trust the current margin). Tuned so a full slate maps near a full game.
const EXPECTED_REMAINING_PTS = 120

/** Pure: current per-league win probability for the affected leagues. */
export function computeLeagueWinProbs(
  matchups: LiveMatchupSummary[],
  affectedLeagueIds: Set<string>,
): InterruptMetricRow[] {
  return matchups
    .filter((m) => affectedLeagueIds.has(m.leagueId))
    .map((m) => {
      const marginNow = m.myScore - m.opponentScore
      const myProj = m.myProjectedScore ?? m.myScore
      const oppProj = m.opponentProjectedScore ?? m.opponentScore
      const projMargin = myProj - oppProj
      const remainingPts = Math.max(0, (myProj - m.myScore) + (oppProj - m.opponentScore))
      const secondsRemaining = Math.min(3600, (remainingPts / EXPECTED_REMAINING_PTS) * 3600)
      const pct = Math.round(winProb({ marginNow, secondsRemaining, projMargin }) * 100)
      return { leagueName: m.leagueName, label: 'Win Prob', value: `${pct}%`, deltaPositive: pct >= 50 }
    })
}
```

- [ ] **Step 4: Run to verify pass** — `npm test -- liveWinProb` → PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/liveWinProb.ts lib/liveWinProb.test.ts
git commit -m "feat(winprob): per-league live win-prob adapter over LiveMatchupSummary"
```

---

## Task 4: DB migration + read-path plumbing

**Files:**
- Create: `supabase/migration_interrupt_metrics.sql`
- Modify: `lib/pulse.ts`, `app/api/pulse/interrupts/route.ts`
- Test: `lib/pulse.test.ts` (create or extend) for `rowToPulseItem`

**Interfaces:**
- `PulseItemRow.metrics_json?: InterruptMetricRow[] | null`; `rowToPulseItem` maps it to `PulseItem.metrics`.

- [ ] **Step 1: Write the migration** `supabase/migration_interrupt_metrics.sql`:

```sql
-- Project A: per-league win-probability metrics on interrupt Pulse items.
-- Consumed by components/InterruptStack.tsx via /api/pulse/interrupts.
ALTER TABLE pulse_items ADD COLUMN IF NOT EXISTS metrics_json jsonb;
```

- [ ] **Step 2: Extend `PulseItemRow` in `lib/pulse.ts`** — add after `affected_leagues_json`:

```ts
  metrics_json?: InterruptMetricRow[] | null
```
and add `InterruptMetricRow` to the `@/types` import at the top of `lib/pulse.ts`.

- [ ] **Step 3: Map it in `rowToPulseItem`** — add to the returned object (after `affectedLeagues`):

```ts
    metrics: row.metrics_json ?? undefined,
```

- [ ] **Step 4: Select the column in `app/api/pulse/interrupts/route.ts`** — add `metrics_json` to the `.select(...)` string (after `affected_leagues_json`). The existing `42703`/`PGRST204` error handler already degrades to `{ items: [] }` if the column isn't present pre-migration.

- [ ] **Step 5: Write test** `lib/pulse.test.ts` (create if absent; add `'lib/**/*.test.ts'` already covered by Task 1's include change):

```ts
import { describe, it, expect } from 'vitest'
import { rowToPulseItem, type PulseItemRow } from './pulse'

const baseRow: PulseItemRow = {
  id: '1', user_id: 'u', type: 'touchdown_swing', priority: 'info',
  headline: 'h', reasoning: 'r', affected_leagues_json: [],
  deadline: null, action_url: null, platform: 'sleeper', status: 'open', created_at: 't',
} as PulseItemRow

describe('rowToPulseItem metrics', () => {
  it('maps metrics_json onto metrics', () => {
    const item = rowToPulseItem({ ...baseRow, metrics_json: [{ leagueName: 'L', label: 'Win Prob', value: '62%', deltaPositive: true }] })
    expect(item.metrics).toHaveLength(1)
    expect(item.metrics![0].value).toBe('62%')
  })
  it('maps null/absent metrics_json to undefined', () => {
    expect(rowToPulseItem({ ...baseRow, metrics_json: null }).metrics).toBeUndefined()
    expect(rowToPulseItem(baseRow).metrics).toBeUndefined()
  })
})
```
(If `PulseItemRow` has required fields not in `baseRow`, add them per the interface so the test compiles.)

- [ ] **Step 6: Run** — `npm test -- pulse` → PASS. Then FULL `npm test` and `npm run build`.

- [ ] **Step 7: Commit**

```bash
git add supabase/migration_interrupt_metrics.sql lib/pulse.ts app/api/pulse/interrupts/route.ts lib/pulse.test.ts
git commit -m "feat(interrupts): persist + read metrics_json on pulse_items (migration)"
```

---

## Task 5: Compute + attach metrics in `detectTouchdownSwings` (Pro-gated)

**Files:**
- Modify: `lib/engagementTriggers.ts`

**Interfaces:**
- Consumes: `computeLeagueWinProbs` (`@/lib/liveWinProb`), `buildLiveRoster` (`@/lib/liveRoster`), `isFreePlan` (`@/lib/usageLimits`), `InterruptMetricRow` (`@/types`).

- [ ] **Step 1: Extend `insertPulseItem`** — add an optional `metrics` field to its `item` param and write `metrics_json`:

In the `item: { ... }` type, add after `affectedLeagues`:
```ts
    metrics?: InterruptMetricRow[]
```
In the `admin.from('pulse_items').insert({ ... })` object, add:
```ts
    metrics_json: item.metrics ?? null,
```
Add `InterruptMetricRow` to the `@/types` import at the top of the file.

- [ ] **Step 2: Read the touchdown insertion site.** In `detectTouchdownSwings`, find the per-user block that builds `headline`/`reasoning`/`affectedLeagues` and calls `insertPulseItem(admin, userId, { type: 'touchdown_swing', ..., affectedLeagues: info.leagues.map(...) , layer: 'interrupt' })`. (Around the `await insertPulseItem(...)` for `touchdown_swing`.)

- [ ] **Step 3: Compute Pro-gated metrics before that insert.** Immediately before the `await insertPulseItem(...)` call, add:

```ts
      let metrics: InterruptMetricRow[] | undefined
      if (!(await isFreePlan(admin, userId))) {
        try {
          const { matchups } = await buildLiveRoster(admin, userId)
          const affectedIds = new Set(info.leagues.map((l) => l.id))
          const rows = computeLeagueWinProbs(matchups, affectedIds)
          if (rows.length > 0) metrics = rows
        } catch {
          // Win-prob is a garnish on the card — a failed matchup fetch just
          // omits the rows, never blocks the touchdown interrupt.
        }
      }
```
Then pass `metrics` into the existing `insertPulseItem(admin, userId, { ... })` call (add `metrics,` to that object).

Add the imports at the top of `lib/engagementTriggers.ts`:
```ts
import { isFreePlan } from '@/lib/usageLimits'
import { buildLiveRoster } from '@/lib/liveRoster'
import { computeLeagueWinProbs } from '@/lib/liveWinProb'
import type { InterruptMetricRow } from '@/types'
```
(Note: `info.leagues` entries expose `.id` and `.league_name` per the existing `affectedLeagues: info.leagues.map((l) => ({ leagueId: l.id, ... }))` call — reuse `l.id`. Confirm the field name while editing.)

- [ ] **Step 4: Verify build/typecheck** — there is no unit test for the DB-side trigger (network/DB). Run `npm run build` (exit 0) and `npm test` (all still pass — no regressions). The trigger's correctness is covered by the pure `computeLeagueWinProbs` test (Task 3) + the manual SimulationPanel check (Task 6).

- [ ] **Step 5: Commit**

```bash
git add lib/engagementTriggers.ts
git commit -m "feat(gameday): compute Pro-gated per-league win-prob on touchdown swings"
```

---

## Task 6: Render on the live Interrupt card + verification

**Files:**
- Modify: `components/InterruptStack.tsx`
- Test: `components/interrupt/InterruptCardView.test.tsx` already covers the metrics render; add an InterruptStack forwarding assertion if practical.

- [ ] **Step 1: Pass metrics through in `components/InterruptStack.tsx`.** In the `return <InterruptCardView ... />` (the refactored render), add the prop:

```tsx
      metrics={current.metrics}
```
(`current` is the `PulseItem`; `metrics` is now optional on it. When absent — free users, or non-touchdown items — `InterruptCardView` renders exactly as today.)

- [ ] **Step 2: Run** — `npm test` (all pass; the `InterruptCardView` metrics-branch test already proves the rows render when `metrics` is provided) and `npm run build` (exit 0).

- [ ] **Step 3: Full gate** — `npm test && npm run build`. Expected: all pass; build exit 0.

- [ ] **Step 4: Manual integration verification (documented, not automated).** True end-to-end needs live data, so verify via the dev Simulation Panel:
  1. Apply the migration locally: run `supabase/migration_interrupt_metrics.sql` against the dev Supabase (or confirm it's applied).
  2. `npm run dev`, sign in as a **Pro** account with ≥1 connected Sleeper league that has a live-ish matchup.
  3. Use `components/admin/SimulationPanel.tsx` to trigger a `touchdown_swing` scenario for a team you roster.
  4. Confirm the Interrupt card appears with per-league **Win Prob %** rows; confirm a **free** account sees the same card with **no** metric rows.
  Record the outcome in the PR/commit notes. (If no live matchup data is available in dev, note that the pure pieces + build are green and the live render is pending a real Game Day / seeded matchup.)

- [ ] **Step 5: Commit**

```bash
git add components/InterruptStack.tsx
git commit -m "feat(gameday): show live per-league win-prob on the Interrupt card"
```

---

## Self-Review

**Spec coverage:**
- Graduate `winProb` to `lib/` → Task 1 ✅
- Shared `InterruptMetricRow` type + `PulseItem.metrics` → Task 2 ✅
- Honest per-league win-prob adapter → Task 3 ✅
- `metrics_json` column + read-path (row + route) → Task 4 ✅
- Pro-gated compute in `detectTouchdownSwings` → Task 5 ✅
- Render on live Interrupt card + verification path → Task 6 ✅
- Honesty (current win-prob, not delta) → Task 3 (label 'Win Prob', current %) ✅
- Pro-gating via `isFreePlan` → Task 5 ✅
- Safe pre-migration degradation → Task 4 (route's existing 42703 handler) ✅

**Placeholder scan:** none — every code step is complete. The only non-code steps are the exact edit sites in existing files (Task 2 Step 4 grep, Task 5 Step 2 locate insertion), which require reading the current file — flagged explicitly, not vague.

**Type consistency:** `InterruptMetricRow` single-sourced in `@/types` (Task 2), consumed by `InterruptCardView` (Task 2), `liveWinProb` (Task 3), `pulse.ts` (Task 4), `engagementTriggers` (Task 5). `winProb`/`WinProbInput` single-sourced in `lib/winProb` (Task 1), re-exported to demo. `LiveMatchupSummary` (existing) consumed by `liveWinProb` + the trigger. `computeLeagueWinProbs` (Task 3) called only in the trigger (Task 5).

**Verification honesty:** the DB-side trigger has no unit test (network/DB); correctness rests on the pure `computeLeagueWinProbs` tests + typecheck/build + the documented SimulationPanel manual check. Stated plainly in Task 5/6.
