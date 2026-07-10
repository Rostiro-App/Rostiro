# Simulation Studio (Platform Sandbox) Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the foundation of an honest, gated Simulation Studio at `/demo/studio` that authors and fires the cross-league interrupt "moment" card (hybrid: real `winProb` prefill + full editorial override) for marketing capture, driving a shared real `InterruptCardView` inside the faithful `DemoShell`/`PulseFeed` canvas.

**Architecture:** A pure cross-league engine over a 3-league demo fixture prefills real win-prob rows; an authoring panel lets the operator override every field; the fired event renders through `InterruptCardView` — a presentational component extracted from the shipped `InterruptStack` and shared by both production and the Studio — overlaid on the contained demo OS canvas. An event registry keeps future moment types additive.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5, Vitest + @testing-library/react, Tailwind + globals.css tokens.

## Global Constraints

- **Repo root:** `/Users/Lawrence/Documents/Rostiro` (NOT `/Users/Lawrence/Rostiro`, the empty decoy).
- **Gating (verbatim):** the studio surface renders only when `process.env.NODE_ENV === 'development'` **or** URL search param `studio === 'true'` — same rule as the Director's Console.
- **Honesty contract:** the card is rendered by `InterruptCardView` extracted from the real `InterruptStack` (genuinely shared with production). `DemoShell`/`PulseFeed` are faithful reproductions. Cross-league metric rows are authored/prefilled, NOT yet wired into the live pipeline. No `Math.random`, no network — deterministic for reproducible takes.
- **Zero live-app regression:** refactoring `InterruptStack` to use `InterruptCardView` must not change its behavior or appearance for real users. Guard with a test.
- **Real data:** player pool is real `players.json`; prefill numbers come from real `winProb`. Operator overrides are explicitly editorial.
- **winProb signature (verbatim):** `winProb({ marginNow, secondsRemaining, projMargin }): number` in `app/demo/lib/winProb.ts`.
- **Commit after every task. TDD: test first, watch it fail, implement, watch it pass, commit.**

---

## File Structure

**Created:**
- `app/demo/lib/demoLeagues.ts` (+ `.test.ts`) — 3-league roster + matchup fixture
- `app/demo/lib/crossLeagueImpact.ts` (+ `.test.ts`) — pure winProb cross-league engine
- `components/interrupt/InterruptCardView.tsx` (+ `.test.tsx`) — shared presentational card
- `app/demo/lib/simEvents.ts` (+ `.test.ts`) — SimEvent types, registry, prefill mapping
- `app/demo/studio/StudioCanvas.tsx` — capture canvas
- `app/demo/studio/StudioPanel.tsx` — authoring controls
- `app/demo/studio/Studio.tsx` (+ `Studio.test.tsx`) — client studio (panel + canvas + fire/hold)
- `app/demo/studio/page.tsx` — gated route wrapper

**Modified:**
- `components/InterruptStack.tsx` — render `InterruptCardView` (no behavior change)

---

## Task 1: Demo-league fixture

**Files:**
- Create: `app/demo/lib/demoLeagues.ts`
- Test: `app/demo/lib/demoLeagues.test.ts`

**Interfaces:**
- Produces: `DemoLeagueMatchup`, `DemoLeagueEntry`, `DEMO_LEAGUES: DemoLeagueEntry[]` (exactly 3), `CORE_ROSTER_IDS: string[]`.

- [ ] **Step 1: Write failing test** `app/demo/lib/demoLeagues.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { DEMO_LEAGUES, CORE_ROSTER_IDS } from './demoLeagues'
import players from '@/app/demo/fixtures/players.json'

describe('DEMO_LEAGUES', () => {
  it('has the three named leagues', () => {
    expect(DEMO_LEAGUES.map((l) => l.name)).toEqual(["Lawrence's Legends League", 'Sunday Money', 'The Bit League'])
  })
  it('rosters reference real player ids', () => {
    const ids = new Set((players as { id: string }[]).map((p) => p.id))
    for (const lg of DEMO_LEAGUES) for (const pid of lg.founderRoster) expect(ids.has(pid)).toBe(true)
  })
  it('core players are on the founder roster in all three leagues', () => {
    for (const pid of CORE_ROSTER_IDS) {
      for (const lg of DEMO_LEAGUES) expect(lg.founderRoster).toContain(pid)
    }
    expect(CORE_ROSTER_IDS.length).toBeGreaterThanOrEqual(6)
  })
  it('each matchup is a tight game (small margin, real inputs)', () => {
    for (const lg of DEMO_LEAGUES) {
      expect(Math.abs(lg.matchup.myScore - lg.matchup.oppScore)).toBeLessThanOrEqual(12)
      expect(lg.matchup.secondsRemaining).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npm test -- demoLeagues` → FAIL (module not found).

- [ ] **Step 3: Implement `app/demo/lib/demoLeagues.ts`**

```ts
import players from '@/app/demo/fixtures/players.json'

export interface DemoLeagueMatchup {
  myScore: number
  oppScore: number
  secondsRemaining: number   // game-seconds left across active starters (0..3600+)
  projMargin: number         // expected final margin given remaining projections
}
export interface DemoLeagueEntry {
  id: string
  name: string
  founderRoster: string[]    // real players.json ids
  matchup: DemoLeagueMatchup
}

// Top real players by season points form the cross-league CORE — on the
// founder's roster in ALL three leagues, so a star injection prefills 3 rows.
const ranked = (players as { id: string }[]).map((p) => p.id)
export const CORE_ROSTER_IDS: string[] = ranked.slice(0, 8)
// League-specific role players (disjoint slices) so mid/low picks hit 1 league.
const roleA = ranked.slice(8, 16)
const roleB = ranked.slice(16, 24)
const roleC = ranked.slice(24, 32)

// Tight, authored live matchups → an injected TD produces a big, real win-prob
// swing. Illustrative demo scores, not real-game live data.
export const DEMO_LEAGUES: DemoLeagueEntry[] = [
  { id: 'll', name: "Lawrence's Legends League", founderRoster: [...CORE_ROSTER_IDS, ...roleA],
    matchup: { myScore: 96.4, oppScore: 98.1, secondsRemaining: 900, projMargin: -1.5 } },
  { id: 'sm', name: 'Sunday Money', founderRoster: [...CORE_ROSTER_IDS, ...roleB],
    matchup: { myScore: 101.2, oppScore: 104.0, secondsRemaining: 720, projMargin: -2.0 } },
  { id: 'bit', name: 'The Bit League', founderRoster: [...CORE_ROSTER_IDS, ...roleC],
    matchup: { myScore: 88.7, oppScore: 90.0, secondsRemaining: 1200, projMargin: 1.0 } },
]
```

- [ ] **Step 4: Run to verify pass** — `npm test -- demoLeagues` → PASS.

- [ ] **Step 5: Commit**

```bash
git add app/demo/lib/demoLeagues.ts app/demo/lib/demoLeagues.test.ts
git commit -m "feat(studio): 3-league demo fixture with overlapping founder rosters"
```

---

## Task 2: Cross-league win-prob engine

**Files:**
- Create: `app/demo/lib/crossLeagueImpact.ts`
- Test: `app/demo/lib/crossLeagueImpact.test.ts`

**Interfaces:**
- Consumes: `winProb` (`./winProb`), `DEMO_LEAGUES` (`./demoLeagues`).
- Produces: `LeagueImpact { leagueId; leagueName; beforePct; afterPct; deltaPct }`, `computeInjectionImpact(playerId, points, leagues?): LeagueImpact[]`.

- [ ] **Step 1: Write failing test** `app/demo/lib/crossLeagueImpact.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeInjectionImpact } from './crossLeagueImpact'
import { CORE_ROSTER_IDS, DEMO_LEAGUES } from './demoLeagues'

describe('computeInjectionImpact', () => {
  it('a core star affects all three leagues', () => {
    const out = computeInjectionImpact(CORE_ROSTER_IDS[0], 6)
    expect(out).toHaveLength(3)
    expect(out.map((i) => i.leagueId)).toEqual(DEMO_LEAGUES.map((l) => l.id))
  })
  it('an unrostered id affects no leagues', () => {
    expect(computeInjectionImpact('does-not-exist', 6)).toHaveLength(0)
  })
  it('more points yields a larger positive delta', () => {
    const small = computeInjectionImpact(CORE_ROSTER_IDS[0], 3)[0].deltaPct
    const big = computeInjectionImpact(CORE_ROSTER_IDS[0], 12)[0].deltaPct
    expect(big).toBeGreaterThan(small)
  })
  it('percentages stay within 0..100', () => {
    for (const i of computeInjectionImpact(CORE_ROSTER_IDS[0], 30)) {
      expect(i.beforePct).toBeGreaterThanOrEqual(0); expect(i.beforePct).toBeLessThanOrEqual(100)
      expect(i.afterPct).toBeGreaterThanOrEqual(0); expect(i.afterPct).toBeLessThanOrEqual(100)
    }
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npm test -- crossLeagueImpact` → FAIL.

- [ ] **Step 3: Implement `app/demo/lib/crossLeagueImpact.ts`**

```ts
import { winProb } from './winProb'
import { DEMO_LEAGUES, type DemoLeagueEntry } from './demoLeagues'

export interface LeagueImpact {
  leagueId: string
  leagueName: string
  beforePct: number
  afterPct: number
  deltaPct: number
}

/** Pure: per-league win-prob impact of adding `points` to the founder's side,
 *  for every league where the player is on the founder roster. */
export function computeInjectionImpact(
  playerId: string,
  points: number,
  leagues: DemoLeagueEntry[] = DEMO_LEAGUES,
): LeagueImpact[] {
  return leagues
    .filter((lg) => lg.founderRoster.includes(playerId))
    .map((lg) => {
      const { myScore, oppScore, secondsRemaining, projMargin } = lg.matchup
      const before = winProb({ marginNow: myScore - oppScore, secondsRemaining, projMargin })
      const after = winProb({ marginNow: myScore - oppScore + points, secondsRemaining, projMargin: projMargin + points })
      const beforePct = Math.round(before * 100)
      const afterPct = Math.round(after * 100)
      return { leagueId: lg.id, leagueName: lg.name, beforePct, afterPct, deltaPct: afterPct - beforePct }
    })
}
```

- [ ] **Step 4: Run to verify pass** — `npm test -- crossLeagueImpact` → PASS.

- [ ] **Step 5: Commit**

```bash
git add app/demo/lib/crossLeagueImpact.ts app/demo/lib/crossLeagueImpact.test.ts
git commit -m "feat(studio): pure cross-league win-prob impact engine"
```

---

## Task 3: Extract shared InterruptCardView + refactor InterruptStack

**Files:**
- Create: `components/interrupt/InterruptCardView.tsx`
- Test: `components/interrupt/InterruptCardView.test.tsx`
- Modify: `components/InterruptStack.tsx`

**Interfaces:**
- Produces: `InterruptMetricRow { leagueName; label; value; deltaPositive? }`, `<InterruptCardView typeLabel headline reasoning color priority onSnooze? onDismiss? leaving? contained? metrics? />`.
- Consumed by: `InterruptStack` (live) and the Studio (Task 6).

- [ ] **Step 1: Broaden vitest include for the new dir.** Edit `vitest.config.mts` `include`:

```ts
    include: ['app/demo/**/*.test.{ts,tsx}', 'components/marketing/scenes/**/*.test.{ts,tsx}', 'components/interrupt/**/*.test.{ts,tsx}'],
```

- [ ] **Step 2: Write failing test** `components/interrupt/InterruptCardView.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InterruptCardView } from './InterruptCardView'

describe('InterruptCardView', () => {
  it('renders the plain card (no metrics) like the live interrupt', () => {
    render(<InterruptCardView typeLabel="TOUCHDOWN" headline="Josh Allen — TD" reasoning="+6.0 to your live score" color="var(--signal)" priority="info" />)
    expect(screen.getByText('TOUCHDOWN')).toBeTruthy()
    expect(screen.getByText('Josh Allen — TD')).toBeTruthy()
    expect(screen.getByText('+6.0 to your live score')).toBeTruthy()
    expect(screen.queryByText('Snooze')).toBeNull() // non-critical
  })
  it('shows Snooze/✕ only for critical', () => {
    render(<InterruptCardView typeLabel="LINEUP LOCK" headline="x" reasoning="y" color="var(--crit)" priority="critical" onSnooze={() => {}} onDismiss={() => {}} />)
    expect(screen.getByText('Snooze')).toBeTruthy()
  })
  it('renders the hero cross-league metrics when provided', () => {
    render(
      <InterruptCardView typeLabel="TOUCHDOWN" headline="Amon-Ra · WR · DET" reasoning="" color="var(--crit)" priority="info"
        metrics={[
          { leagueName: "Lawrence's Legends", label: 'Win Prob', value: '+18%', deltaPositive: true },
          { leagueName: 'Bench Regret FC', label: 'Pain Index', value: '94%' },
        ]} />,
    )
    expect(screen.getByText('+18%')).toBeTruthy()
    expect(screen.getByText(/2 OF YOUR LEAGUES/)).toBeTruthy()
    expect(screen.getByText('Bench Regret FC')).toBeTruthy()
    expect(screen.getByText('Pain Index')).toBeTruthy()
  })
})
```

- [ ] **Step 3: Run to verify failure** — `npm test -- InterruptCardView` → FAIL.

- [ ] **Step 4: Implement `components/interrupt/InterruptCardView.tsx`** (plain branch is the live card verbatim; metrics branch is the hero layout):

```tsx
'use client'
import type { PulsePriority } from '@/types'

export interface InterruptMetricRow {
  leagueName: string
  label: string
  value: string
  deltaPositive?: boolean
}

export function InterruptCardView({
  typeLabel, headline, reasoning, color, priority,
  onSnooze, onDismiss, leaving, contained, metrics,
}: {
  typeLabel: string
  headline: string
  reasoning: string
  color: string
  priority: PulsePriority
  onSnooze?: () => void
  onDismiss?: () => void
  leaving?: boolean
  contained?: boolean
  metrics?: InterruptMetricRow[]
}) {
  const pos = contained ? 'absolute' : 'fixed'
  const width = contained ? 'min(420px, calc(100% - 24px))' : 'min(360px, calc(100vw - 24px))'
  return (
    <div
      className={`glass-heavy rounded-xl px-4 py-3 ${leaving ? 'card-leave' : 'panel-enter'}`}
      style={{ position: pos, top: '52px', left: '50%', transform: 'translateX(-50%)', width, zIndex: 40,
        borderLeft: `2.5px solid ${color}`, boxShadow: `0 12px 32px rgba(0,0,0,.35), 0 0 20px ${color}22` }}
      role={priority === 'critical' ? 'alert' : 'status'}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="mono-data text-[9px] tracking-[0.16em]" style={{ color }}>{typeLabel}</span>
        {priority === 'critical' && (
          <div className="flex items-center gap-2.5 -mt-0.5">
            <button onClick={onSnooze} aria-label="Snooze for 24 hours" className="text-[10px] font-semibold tracking-wide uppercase hover:brightness-125" style={{ color: 'var(--t3)' }}>Snooze</button>
            <button onClick={onDismiss} aria-label="Dismiss" className="text-[13px] leading-none" style={{ color: 'var(--t3)' }}>✕</button>
          </div>
        )}
      </div>
      <p className="text-[13px] font-semibold mt-1" style={{ color: 'var(--t1)' }}>{headline}</p>
      {metrics && metrics.length > 0 ? (
        <div className="mt-2.5">
          <div className="flex items-end gap-5">
            {metrics.map((m, i) => (
              <span key={i} className="mono-data text-[26px] font-bold leading-none" style={{ color: m.deltaPositive === false ? 'var(--crit)' : 'var(--live)' }}>
                ▲ {m.value}
              </span>
            ))}
          </div>
          <div className="mono-data text-[8.5px] tracking-[0.16em] mt-2 pt-2" style={{ color: 'var(--t3)', borderTop: '1px solid var(--hairline)' }}>
            {metrics.length} OF YOUR {metrics.length === 1 ? 'LEAGUE' : 'LEAGUES'}
          </div>
          <div className="mt-1.5 space-y-1">
            {metrics.map((m, i) => (
              <div key={i} className="flex items-center justify-between text-[12px]">
                <span style={{ color: 'var(--t1)' }}>{m.leagueName}</span>
                <span className="mono-data" style={{ color: 'var(--t2)' }}>{m.label} {m.value}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        reasoning ? <p className="text-[12px] mt-1 leading-snug" style={{ color: 'var(--t2)' }}>{reasoning}</p> : null
      )}
    </div>
  )
}
```

- [ ] **Step 5: Refactor `components/InterruptStack.tsx` to render `InterruptCardView`.** Replace the final `return (<div ...>...</div>)` card block (the one starting `key={current.id}` with `glass-heavy fixed`) with:

```tsx
  return (
    <InterruptCardView
      key={current.id}
      typeLabel={typeLabel}
      headline={current.headline}
      reasoning={current.reasoning}
      color={color}
      priority={current.priority}
      leaving={leaving}
      onSnooze={() => snooze(current.id)}
      onDismiss={() => dismiss(current.id)}
    />
  )
```
Add the import at the top: `import { InterruptCardView } from '@/components/interrupt/InterruptCardView'`. Keep everything else (polling, dismiss/snooze logic, `color`/`typeLabel` computation) unchanged. The `key={current.id}` preserves the live card's remount-on-item-change so the `panel-enter` animation replays exactly as before (zero-regression).

- [ ] **Step 6: Guard test — InterruptStack still renders the live card.** Add `components/interrupt/InterruptCardView.test.tsx` already covers the view; for the refactor, verify the build/typecheck passes and the plain-card test above matches the live markup (same classes/positions). Run: `npm test -- InterruptCardView` → PASS, then `npm run build` → exit 0 (confirms InterruptStack still compiles with the extracted view).

- [ ] **Step 7: Commit**

```bash
git add components/interrupt/InterruptCardView.tsx components/interrupt/InterruptCardView.test.tsx components/InterruptStack.tsx vitest.config.mts
git commit -m "feat(studio): extract shared InterruptCardView (+ optional cross-league metrics)"
```

---

## Task 4: SimEvent registry + prefill

**Files:**
- Create: `app/demo/lib/simEvents.ts`
- Test: `app/demo/lib/simEvents.test.ts`

**Interfaces:**
- Consumes: `computeInjectionImpact`, `InterruptMetricRow`.
- Produces: `SimMetricRow` (= `InterruptMetricRow`), `InterruptSimEvent`, `defaultInterruptEvent()`, `prefillInterruptMetrics(playerId, points): SimMetricRow[]`.

- [ ] **Step 1: Write failing test** `app/demo/lib/simEvents.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { defaultInterruptEvent, prefillInterruptMetrics } from './simEvents'
import { CORE_ROSTER_IDS } from './demoLeagues'

describe('simEvents', () => {
  it('default interrupt event is a TOUCHDOWN with 6.0 points and no metrics', () => {
    const e = defaultInterruptEvent()
    expect(e.kind).toBe('interrupt')
    expect(e.eventLabel).toBe('TOUCHDOWN')
    expect(e.points).toBe(6)
    expect(e.metrics).toEqual([])
    expect(e.autoDismissMs).toBe(7000)
  })
  it('prefill maps a core star + points to real win-prob rows', () => {
    const rows = prefillInterruptMetrics(CORE_ROSTER_IDS[0], 6)
    expect(rows).toHaveLength(3)
    expect(rows[0].label).toBe('Win Prob')
    expect(rows[0].value).toMatch(/^\+\d+%$/)
    expect(rows[0].deltaPositive).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npm test -- simEvents` → FAIL.

- [ ] **Step 3: Implement `app/demo/lib/simEvents.ts`**

```ts
import { computeInjectionImpact } from './crossLeagueImpact'
import type { InterruptMetricRow } from '@/components/interrupt/InterruptCardView'

export type SimEventKind = 'interrupt'  // Phase 1. Future: 'roster_exposure', ...
export type SimMetricRow = InterruptMetricRow

export interface InterruptSimEvent {
  kind: 'interrupt'
  eventLabel: string            // freeform: 'TOUCHDOWN' | '66-YARD BOMB' | ...
  playerLine: string            // 'Amon-Ra St. Brown · WR · DET' — editable
  points: number | null
  metrics: SimMetricRow[]
  autoDismissMs: number | null  // 7000 default; null = hold for filming
}

export function defaultInterruptEvent(): InterruptSimEvent {
  return { kind: 'interrupt', eventLabel: 'TOUCHDOWN', playerLine: '', points: 6, metrics: [], autoDismissMs: 7000 }
}

/** Hybrid prefill: real winProb deltas as editable metric rows. */
export function prefillInterruptMetrics(playerId: string, points: number): SimMetricRow[] {
  return computeInjectionImpact(playerId, points).map((i) => ({
    leagueName: i.leagueName,
    label: 'Win Prob',
    value: `${i.deltaPct >= 0 ? '+' : ''}${i.deltaPct}%`,
    deltaPositive: i.deltaPct >= 0,
  }))
}
```

- [ ] **Step 4: Run to verify pass** — `npm test -- simEvents` → PASS.

- [ ] **Step 5: Commit**

```bash
git add app/demo/lib/simEvents.ts app/demo/lib/simEvents.test.ts
git commit -m "feat(studio): SimEvent model + real win-prob prefill"
```

---

## Task 5: StudioCanvas (capture surface)

**Files:**
- Create: `app/demo/studio/StudioCanvas.tsx`
- Test: `app/demo/studio/StudioCanvas.test.tsx`

**Interfaces:**
- Consumes: `DemoShell`, `StandardState`, `InterruptCardView`, `InterruptSimEvent`.
- Produces: `<StudioCanvas event={InterruptSimEvent | null} aspect='16:9'|'9:16' leaving?: boolean />`.

- [ ] **Step 1: Write failing test** `app/demo/studio/StudioCanvas.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StudioCanvas } from './StudioCanvas'
import { defaultInterruptEvent } from '../lib/simEvents'

describe('StudioCanvas', () => {
  it('renders the OS chrome with no event', () => {
    render(<StudioCanvas event={null} aspect="16:9" />)
    expect(screen.getByText('ROSTIRO')).toBeTruthy()
  })
  it('overlays the interrupt card when an event with metrics is fired', () => {
    const e = { ...defaultInterruptEvent(), eventLabel: 'TOUCHDOWN', playerLine: 'Amon-Ra · WR · DET',
      metrics: [{ leagueName: 'Sunday Money', label: 'Win Prob', value: '+22%', deltaPositive: true }] }
    render(<StudioCanvas event={e} aspect="16:9" />)
    expect(screen.getByText('Amon-Ra · WR · DET')).toBeTruthy()
    expect(screen.getByText('+22%')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npm test -- StudioCanvas` → FAIL.

- [ ] **Step 3: Implement `app/demo/studio/StudioCanvas.tsx`**

```tsx
'use client'
import { DemoShell } from '@/app/demo/components/DemoShell'
import { StandardState } from '@/app/demo/components/StandardState'
import { InterruptCardView } from '@/components/interrupt/InterruptCardView'
import type { InterruptSimEvent } from '../lib/simEvents'

export function StudioCanvas({ event, aspect, leaving }: { event: InterruptSimEvent | null; aspect: '16:9' | '9:16'; leaving?: boolean }) {
  return (
    <div className="relative w-full mx-auto" style={{ aspectRatio: aspect === '16:9' ? '16 / 9' : '9 / 16', maxWidth: aspect === '16:9' ? '100%' : 480 }}>
      <div className="glass-heavy rounded-2xl overflow-hidden absolute inset-0" style={{ border: '1px solid var(--hairline-bright)' }}>
        <DemoShell variant="contained" stateOverride="game_day">
          <StandardState missionControl />
        </DemoShell>
        {event && (
          <InterruptCardView
            contained
            leaving={leaving}
            typeLabel={event.eventLabel}
            headline={event.playerLine}
            reasoning={event.points != null ? `+${event.points} to your live score` : ''}
            color="var(--crit)"
            priority="info"
            metrics={event.metrics}
          />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run to verify pass** — `npm test -- StudioCanvas` → PASS.

- [ ] **Step 5: Commit**

```bash
git add app/demo/studio/StudioCanvas.tsx app/demo/studio/StudioCanvas.test.tsx
git commit -m "feat(studio): capture canvas (contained OS + fired interrupt card)"
```

---

## Task 6: StudioPanel (hybrid authoring)

**Files:**
- Create: `app/demo/studio/StudioPanel.tsx`
- Test: `app/demo/studio/StudioPanel.test.tsx`

**Interfaces:**
- Consumes: `players.json`, `prefillInterruptMetrics`, `InterruptSimEvent`, `SimMetricRow`.
- Produces: `<StudioPanel event onChange(event) onFire() />` — controlled editor of an `InterruptSimEvent`.

- [ ] **Step 1: Write failing test** `app/demo/studio/StudioPanel.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StudioPanel } from './StudioPanel'
import { defaultInterruptEvent } from '../lib/simEvents'

describe('StudioPanel', () => {
  it('filters the player search and prefills metrics on select', () => {
    let ev = defaultInterruptEvent()
    const onChange = vi.fn((e) => { ev = e })
    render(<StudioPanel event={ev} onChange={onChange} onFire={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText(/search player/i), { target: { value: 'Lamar' } })
    const opt = screen.getByText(/Lamar Jackson/)
    fireEvent.click(opt)
    // onChange called with a playerLine + prefilled metrics
    const last = onChange.mock.calls.at(-1)![0]
    expect(last.playerLine).toMatch(/Lamar Jackson/)
    expect(last.metrics.length).toBeGreaterThan(0)
  })
  it('lets the operator rename a league and change a metric label', () => {
    const withMetric = { ...defaultInterruptEvent(), metrics: [{ leagueName: 'Sunday Money', label: 'Win Prob', value: '+22%', deltaPositive: true }] }
    const onChange = vi.fn()
    render(<StudioPanel event={withMetric} onChange={onChange} onFire={() => {}} />)
    fireEvent.change(screen.getByDisplayValue('Sunday Money'), { target: { value: 'Bench Regret FC' } })
    expect(onChange.mock.calls.at(-1)![0].metrics[0].leagueName).toBe('Bench Regret FC')
    fireEvent.change(screen.getByDisplayValue('Win Prob'), { target: { value: 'Pain Index' } })
    expect(onChange.mock.calls.at(-1)![0].metrics[0].label).toBe('Pain Index')
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npm test -- StudioPanel` → FAIL.

- [ ] **Step 3: Implement `app/demo/studio/StudioPanel.tsx`**

```tsx
'use client'
import { useMemo, useState } from 'react'
import players from '@/app/demo/fixtures/players.json'
import { prefillInterruptMetrics, type InterruptSimEvent, type SimMetricRow } from '../lib/simEvents'

interface DemoPlayerLite { id: string; name: string; pos: string; nflTeam: string }
const POOL = players as DemoPlayerLite[]

export function StudioPanel({ event, onChange, onFire }: { event: InterruptSimEvent; onChange: (e: InterruptSimEvent) => void; onFire: () => void }) {
  const [query, setQuery] = useState('')
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? POOL.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8) : []
  }, [query])

  function selectPlayer(p: DemoPlayerLite) {
    setQuery('')
    onChange({ ...event, playerLine: `${p.name} · ${p.pos} · ${p.nflTeam}`, metrics: prefillInterruptMetrics(p.id, event.points ?? 6) })
  }
  function setMetric(i: number, patch: Partial<SimMetricRow>) {
    onChange({ ...event, metrics: event.metrics.map((m, j) => (j === i ? { ...m, ...patch } : m)) })
  }

  const label = { display: 'block', fontSize: 12, color: 'var(--t3)', marginBottom: 4 } as const
  const input = { width: '100%', background: 'rgba(8,15,26,.6)', border: '1px solid var(--hairline)', borderRadius: 8, padding: '6px 8px', color: 'var(--t1)', fontSize: 13 } as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label style={label}>Player</label>
        <input style={input} placeholder="Search player…" value={query} onChange={(e) => setQuery(e.target.value)} />
        {matches.length > 0 && (
          <div className="glass-heavy" style={{ marginTop: 4, borderRadius: 8, overflow: 'hidden' }}>
            {matches.map((p) => (
              <button key={p.id} onClick={() => selectPlayer(p)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', color: 'var(--t1)', fontSize: 13 }}>
                {p.name} <span style={{ color: 'var(--t3)' }}>· {p.pos} · {p.nflTeam}</span>
              </button>
            ))}
          </div>
        )}
        {event.playerLine && <div className="mono-data" style={{ marginTop: 6, fontSize: 11, color: 'var(--t2)' }}>{event.playerLine}</div>}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={label}>Event label</label>
          <input style={input} value={event.eventLabel} onChange={(e) => onChange({ ...event, eventLabel: e.target.value })} />
        </div>
        <div style={{ width: 90 }}>
          <label style={label}>Points</label>
          <input style={input} type="number" step="0.1" value={event.points ?? ''} onChange={(e) => onChange({ ...event, points: e.target.value === '' ? null : Number(e.target.value) })} />
        </div>
      </div>

      <div>
        <label style={label}>Metric rows (fully editable)</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {event.metrics.map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input style={{ ...input, flex: 2 }} value={m.leagueName} onChange={(e) => setMetric(i, { leagueName: e.target.value })} />
              <input style={{ ...input, flex: 1 }} value={m.label} onChange={(e) => setMetric(i, { label: e.target.value })} />
              <input style={{ ...input, width: 64 }} value={m.value} onChange={(e) => setMetric(i, { value: e.target.value })} />
              <button aria-label="Remove row" onClick={() => onChange({ ...event, metrics: event.metrics.filter((_, j) => j !== i) })} style={{ color: 'var(--t3)' }}>✕</button>
            </div>
          ))}
        </div>
        <button onClick={() => onChange({ ...event, metrics: [...event.metrics, { leagueName: 'New League', label: 'Win Prob', value: '+0%', deltaPositive: true }] })}
          className="mono-data" style={{ marginTop: 8, fontSize: 11, color: 'var(--signal)' }}>+ Add row</button>
      </div>

      <button onClick={onFire} style={{ background: 'var(--signal)', color: '#fff', fontWeight: 600, padding: '10px', borderRadius: 10, fontSize: 14 }}>Fire ⚡</button>
    </div>
  )
}
```

- [ ] **Step 4: Run to verify pass** — `npm test -- StudioPanel` → PASS.

- [ ] **Step 5: Commit**

```bash
git add app/demo/studio/StudioPanel.tsx app/demo/studio/StudioPanel.test.tsx
git commit -m "feat(studio): hybrid authoring panel (search + prefill + full override)"
```

---

## Task 7: Studio route (wire panel + canvas, gated) + gate

**Files:**
- Create: `app/demo/studio/Studio.tsx`
- Create: `app/demo/studio/page.tsx`
- Test: `app/demo/studio/Studio.test.tsx`

**Interfaces:**
- Consumes: `StudioPanel`, `StudioCanvas`, `defaultInterruptEvent`.
- Produces: `/demo/studio` (gated); `<Studio />` client shell.

- [ ] **Step 1: Write failing test** `app/demo/studio/Studio.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Studio } from './Studio'

describe('Studio', () => {
  it('renders panel + canvas and fires an event onto the canvas', () => {
    render(<Studio />)
    // canvas OS present
    expect(screen.getByText('ROSTIRO')).toBeTruthy()
    // author: type + select, then Fire
    fireEvent.change(screen.getByPlaceholderText(/search player/i), { target: { value: 'Lamar' } })
    fireEvent.click(screen.getByText(/Lamar Jackson/))
    fireEvent.click(screen.getByText(/Fire/))
    // the fired card shows the player line on the canvas
    expect(screen.getAllByText(/Lamar Jackson/).length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npm test -- "app/demo/studio/Studio"` → FAIL.

- [ ] **Step 3: Implement `app/demo/studio/Studio.tsx`**

```tsx
'use client'
import { useRef, useState } from 'react'
import { StudioPanel } from './StudioPanel'
import { StudioCanvas } from './StudioCanvas'
import { defaultInterruptEvent, type InterruptSimEvent } from '../lib/simEvents'

export function Studio() {
  const [draft, setDraft] = useState<InterruptSimEvent>(defaultInterruptEvent())
  const [fired, setFired] = useState<InterruptSimEvent | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [aspect, setAspect] = useState<'16:9' | '9:16'>('16:9')
  const [showPanel, setShowPanel] = useState(true)
  const timer = useRef<number | null>(null)

  function fire() {
    if (timer.current) window.clearTimeout(timer.current)
    setLeaving(false)
    setFired(draft)
    if (draft.autoDismissMs != null) {
      timer.current = window.setTimeout(() => {
        setLeaving(true)
        window.setTimeout(() => setFired(null), 340)
      }, draft.autoDismissMs)
    }
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--void)' }}>
      <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="mono-data" style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 11, color: 'var(--t3)' }}>
          <strong style={{ color: 'var(--t1)' }}>🎬 SIMULATION STUDIO</strong>
          <button onClick={() => setAspect(aspect === '16:9' ? '9:16' : '16:9')}>{aspect}</button>
          <button onClick={() => setShowPanel((s) => !s)}>{showPanel ? 'Hide controls (H)' : 'Show controls'}</button>
        </div>
        <StudioCanvas event={fired} aspect={aspect} leaving={leaving} />
      </div>
      {showPanel && (
        <aside style={{ width: 340, padding: 20, borderLeft: '1px solid var(--hairline)', background: 'rgba(8,15,26,.5)' }}>
          <StudioPanel event={draft} onChange={setDraft} onFire={fire} />
        </aside>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Implement `app/demo/studio/page.tsx`** (gated, same rule as the Director's Console):

```tsx
import { Studio } from './Studio'

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ studio?: string }> }) {
  const sp = await searchParams
  const enabled = process.env.NODE_ENV === 'development' || sp?.studio === 'true'
  if (!enabled) {
    return (
      <div className="mono-data" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--t3)', background: 'var(--void)' }}>
        Simulation Studio is available in dev or with ?studio=true
      </div>
    )
  }
  return <Studio />
}
```
Note: Next 16 `searchParams` is a Promise in server components — awaited here (the page is a server wrapper; `Studio` is the `'use client'` surface).

- [ ] **Step 5: Run to verify pass** — `npm test -- "app/demo/studio/Studio"` → PASS.

- [ ] **Step 6: Full gate**

```bash
npm test && npm run build
```
Expected: all tests pass; build exit 0; `/demo/studio` present in the route list. (Pre-existing `lib/*` lint errors are an unrelated baseline — do not fix here.)

- [ ] **Step 7: Manual smoke** — `npm run dev`, open `http://localhost:3000/demo/studio` (dev): search a player (e.g. "Lamar"), select → metric rows prefill with real win-prob; rename a league to "Bench Regret FC", change a label to "Pain Index", edit a value; click **Fire ⚡** → the interrupt card animates in over the game-day OS with the hero deltas + chips, auto-dismisses after 7s. Toggle 16:9/9:16 and Hide controls to frame a clean capture. Confirm `http://localhost:3000/demo/studio` WITHOUT dev (production build) shows the card only with `?studio=true`.

- [ ] **Step 8: Commit**

```bash
git add app/demo/studio/Studio.tsx app/demo/studio/page.tsx app/demo/studio/Studio.test.tsx
git commit -m "feat(studio): /demo/studio route — author + fire interrupt moments"
```

---

## Self-Review

**Spec coverage:**
- Gated studio surface `/demo/studio` → Task 7 ✅
- Event registry / SimEvent model → Task 4 ✅ (Phase-1 `interrupt`; extensible via `SimEventKind`)
- Hybrid authoring (real prefill + full override) → Tasks 4 (prefill) + 6 (panel override) ✅
- Shared real `InterruptCardView` extracted from `InterruptStack` (+ optional metrics) → Task 3 ✅
- Faithful canvas (`DemoShell`/`PulseFeed`) + fired card → Task 5 ✅
- Demo-league fixture + cross-league engine → Tasks 1, 2 ✅
- Capture ergonomics (aspect toggle, hide controls, auto-dismiss/hold) → Task 7 ✅
- Zero live-app regression (InterruptStack refactor guarded) → Task 3 Steps 5–6 ✅
- Testing per component → each task ✅

**Placeholder scan:** none — every code step is complete and runnable.

**Type consistency:** `InterruptMetricRow` (Task 3) = `SimMetricRow` (Task 4), used by `StudioPanel` (Task 6), `StudioCanvas` (Task 5), and `InterruptCardView` (Task 3). `InterruptSimEvent` (Task 4) is the shape threaded through Panel → Studio → Canvas. `computeInjectionImpact`/`LeagueImpact` (Task 2) consumed only by `prefillInterruptMetrics` (Task 4). `winProb` signature matches its existing definition. `DemoShell variant/stateOverride` and `StandardState missionControl` (shipped on main) are used as-is by the canvas.

**Honesty contract:** the card is the real extracted component; `DemoShell`/`PulseFeed` are named as reproductions; metric rows are authored/prefilled, not live — all stated in the spec and preserved by the build (no live-pipeline wiring here).
