# Project A — Live Cross-League Win-Probability on the Interrupt Card — Design Spec

**Date:** 2026-07-10
**Status:** Approved design → ready for implementation plan
**Context:** The Simulation Studio (and marketing clips) depict a touchdown Interrupt card showing cross-league win-probability. The *shipped* product does not compute or show this yet — the marketing is ahead of the live product. This project closes that gap: real users on Game Day see per-league win-probability on the real touchdown Interrupt card, computed from real live matchup scores.

## Goal

When a real touchdown swing fires on Game Day, the live Interrupt card (`components/InterruptStack.tsx` → the shared `InterruptCardView`) shows the user's **current win probability in each affected league** (e.g. `Sunday Money — Win Prob 62%`), computed from real live matchup scores, **Pro-gated** consistent with live scores.

## Product decisions (locked)

- **Metric = current per-league win probability**, not a per-TD delta. Rationale (honesty): the live scoreboard feed is **team-level only** — `detectTouchdownSwings` explicitly cannot attribute the exact scoring player, so the user's fantasy-point gain from a given TD is unknown and a "+X%" delta cannot be computed truthfully. The current win-prob (from real live matchup scores) is honest and available. The Simulation Studio keeps its dramatized "+X%" framing for marketing; production ships the honest version.
- **Pro-gated**, consistent with live scores: win-prob is derived from live scores (already Pro-only). Free users still get the touchdown card, just without the win-prob rows. Gated with the existing `isFreePlan(admin, userId)` helper.

## Architecture

### 1. Graduate `winProb` to production — `lib/winProb.ts`
Move the pure implementation from `app/demo/lib/winProb.ts` to `lib/winProb.ts` (identical logic + `WinProbInput`). `app/demo/lib/winProb.ts` becomes `export * from '@/lib/winProb'` so the demo/studio keep working from a single source. Existing demo tests continue to pass (add a `lib/winProb.test.ts` mirroring them).

### 2. Live win-prob adapter — `lib/liveWinProb.ts`
```ts
import { winProb } from './winProb'
import type { LiveMatchupSummary } from './liveRoster'
import type { InterruptMetricRow } from '@/types'

export function computeLeagueWinProbs(
  matchups: LiveMatchupSummary[],
  affectedLeagueIds: Set<string>,
): InterruptMetricRow[]
```
- For each matchup whose `leagueId ∈ affectedLeagueIds`:
  - `marginNow = myScore - opponentScore`.
  - `projMargin = (myProjectedScore ?? myScore) - (opponentProjectedScore ?? opponentScore)`.
  - No per-matchup game clock exists, so estimate remaining game from the projection gap: `remainingPts = max(0, (myProjectedScore - myScore) + (opponentProjectedScore - opponentScore))` (0 when projections absent/complete), mapped to `secondsRemaining` via a fixed scale (e.g. `min(3600, remainingPts / EXPECTED_REMAINING_PTS * 3600)`, `EXPECTED_REMAINING_PTS ≈ 120`). This makes late/complete games trust the current margin and early games lean on projection — the same behavior `winProb` already models.
  - `pct = Math.round(winProb({ marginNow, secondsRemaining, projMargin }) * 100)`.
  - Emit `{ leagueName, label: 'Win Prob', value: `${pct}%`, deltaPositive: pct >= 50 }`.
- Pure, deterministic, unit-tested.

### 3. Shared type — `InterruptMetricRow` moves to `types/index.ts`
Currently defined in `components/interrupt/InterruptCardView.tsx`. Move the interface to `types/index.ts` (so `lib/*` can reference it without importing from a component), and have `InterruptCardView` import it from `@/types`. Add `metrics?: InterruptMetricRow[]` to `PulseItem` in `types/index.ts`.

### 4. Trigger wiring — `lib/engagementTriggers.ts` (`detectTouchdownSwings`)
- The handler already resolves the affected leagues per user (`info.leagues`). Add, per user with a swing:
  - `const isFree = await isFreePlan(admin, userId)` (import from `@/lib/usageLimits`).
  - If not free: `const { matchups } = await buildLiveRoster(admin, userId)` (from `@/lib/liveRoster`), then `const metrics = computeLeagueWinProbs(matchups, new Set(info.leagues.map((l) => l.id)))`.
  - Pass `metrics` (or `undefined` for free) into `insertPulseItem`.
- `insertPulseItem` gains an optional `metrics?: InterruptMetricRow[]` field and writes it to `metrics_json`.
- `buildLiveRoster` is the same call the LIVE tab already makes; calling it once per user with a swing is acceptable and resilient (wrap in try/catch — a failed matchup fetch just yields no metric rows, never blocks the card).

### 5. DB migration — `supabase/migration_interrupt_metrics.sql`
```sql
ALTER TABLE pulse_items ADD COLUMN IF NOT EXISTS metrics_json jsonb;
```
Prerequisite for the read path (same pattern as `migration_interrupt_layer.sql`). Must be applied to Supabase as a deploy step.

### 6. Read path — `lib/pulse.ts` + `/api/pulse/interrupts`
- `PulseItemRow` gains `metrics_json?: InterruptMetricRow[] | null`; `rowToPulseItem` maps `metrics: row.metrics_json ?? undefined`.
- `/api/pulse/interrupts` adds `metrics_json` to its `.select(...)`. (The route's existing `42703`/`PGRST204` handler already degrades to an empty stack if a column is missing pre-migration.)

### 7. Render — `components/InterruptStack.tsx`
Pass `metrics={current.metrics}` to `InterruptCardView` (the metrics branch already exists — this is the last wire). No card-markup change.

## Data flow
Score-delta poll → `detectTouchdownSwings` → affected leagues resolved → (Pro only) `buildLiveRoster` matchups → `computeLeagueWinProbs` → `metrics` stored on the `pulse_items` row → `/api/pulse/interrupts` returns it → `InterruptStack` renders `InterruptCardView metrics={...}` → real user sees per-league win-prob on the touchdown card.

## Honesty & labeling
- Rows read "Win Prob {pct}%" — a current-state probability from real scores, never a fabricated delta.
- Free users: no metric rows (the card is unchanged from today). Pro users: the rows appear. No blur needed since rows are simply absent for free.

## Testing
- `lib/winProb.test.ts` — the graduated pure function (mirror the demo tests; tie/lead/deficit/monotonic/bounds).
- `lib/liveWinProb.test.ts` — `computeLeagueWinProbs`: only affected leagues emit rows; a clearly-leading matchup → `pct > 50` & `deltaPositive`; a trailing matchup → `pct < 50`; complete-game (no projection gap) trusts current margin; empty affected set → `[]`.
- `lib/pulse` mapping test — `rowToPulseItem` maps `metrics_json` → `metrics` (and `null` → `undefined`).
- `InterruptStack`/`InterruptCardView` — passing `metrics` renders the rows (the existing `InterruptCardView` metrics test already covers the render; add a small InterruptStack-level test that a metrics-bearing item forwards them).
- **Integration (manual)** — the dev `components/admin/SimulationPanel.tsx` can drive a `touchdown_swing` scenario through the real `detectTouchdownSwings`; on a Pro account with connected Sleeper leagues this shows the real card with win-prob rows. Documented as the end-to-end check (can't be unit-tested without live data).

## Rollout / caveats
- **Migration first:** `migration_interrupt_metrics.sql` must be applied before the read path expects the column (route degrades safely if not).
- **Model honesty:** `winProb` is a heuristic logistic model (directional, like a broadcast win-prob), now user-facing. Acceptable as a directional signal; not represented as a guarantee.
- **Not a marketing change:** the Simulation Studio and its "+X%" dramatization are untouched; this only makes the *live* product perform what the marketing depicts.

## Out of scope
- Per-TD win-prob *delta* (needs play-by-play player attribution the feed doesn't provide).
- Win-prob anywhere but the touchdown Interrupt card (e.g. the LIVE tab, Pulse feed) — future.
- Backfilling metrics onto already-created interrupt items.
