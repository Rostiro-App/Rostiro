# Studio Push Moment Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Push" surface to the Simulation Studio that renders a realistic, authorable iOS lock-screen push notification (9:16), so the News Desk can capture the hero visual of T-163 and any other push moment.

**Architecture:** A third special render path (`state === 'push'`) alongside the existing `game_day`/`live` special-casing — NOT a `StatePack` (a lock-screen has no `DemoShell` app chrome and is inherently 9:16). One generic `PushMoment` content model covers any push type; real-data prefill + full override; composition with the in-app follow-up happens in editing, not the Studio.

**Tech Stack:** Next.js/React client components under `app/demo/**`, TypeScript, Vitest + React Testing Library (matching the existing Studio surface tests), brand CSS tokens.

## Global Constraints

- **Route isolation:** nothing under `app/demo/**` may import `lib/supabase`/`lib/sleeper`/`lib/espn`/`lib/yahoo` or DB/live-API modules (enforced by ESLint — the build fails otherwise). This pack is pure/in-memory; keep formatting helpers local to `app/demo`, do not import product code like `lib/scratchAlerts`.
- **Deterministic, props-only render** — no polling, no DB, no network; same discipline as `InterruptCardView` and the other Studio surfaces (so it's screen-recordable and re-shootable).
- **9:16-native** — the lock-screen is portrait. When the global aspect toggle is `16:9`, center the 9:16 phone on a neutral backdrop; never break.
- **iOS styling only** (v1). No Android.
- **Lock-screen hero, full-bleed** — the captured clip IS the phone screen; no device bezel.
- **Generic across push types** — `PushMoment` fields (title/body/timeLabel/clock/date) author a touchdown, lineup-lock, or scratch push identically.
- **Honesty:** the Studio clip is an editorial mockup; it carries no user-facing claim. Marketing copy stays bounded by the real feature (for scratch: ~15-min, high-confidence, Pro).
- **Fixtures:** prefill pulls real data — `DEMO_LEAGUES` (`app/demo/lib/demoLeagues`, entries `{ id, name, founderRoster }`) and `players.json` (`app/demo/fixtures/players.json`, entries `{ id, name, pos, nflTeam, ... }`).

---

### Task 1: PushMoment model + prefill

**Files:**
- Create: `app/demo/lib/pushMoment.ts`
- Test: `app/demo/lib/pushMoment.test.ts`

**Interfaces:**
- Produces:
```ts
export interface PushMoment {
  appName: string
  title: string
  body: string
  timeLabel: string
  clockTime: string
  dateLabel: string
}
export function defaultPushMoment(): PushMoment
export function prefillPushMoment(): PushMoment
export function formatLeagueLine(leagueNames: string[]): string
```

- [ ] **Step 1: Write the failing test**

Create `app/demo/lib/pushMoment.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { defaultPushMoment, prefillPushMoment, formatLeagueLine } from './pushMoment'

describe('formatLeagueLine', () => {
  it('single league', () => {
    expect(formatLeagueLine(["Lawrence's Legends League"])).toBe("Lawrence's Legends League")
  })
  it('two leagues uses +1 other (singular)', () => {
    expect(formatLeagueLine(['A', 'B'])).toBe('A +1 other')
  })
  it('three+ leagues uses +N others (plural)', () => {
    expect(formatLeagueLine(['A', 'B', 'C'])).toBe('A +2 others')
  })
})

describe('defaultPushMoment', () => {
  it('returns a fully-populated scratch example', () => {
    const m = defaultPushMoment()
    expect(m.appName).toBe('Rostiro')
    expect(m.title.length).toBeGreaterThan(0)
    expect(m.body.length).toBeGreaterThan(0)
    expect(m.timeLabel).toBe('now')
    expect(m.clockTime).toMatch(/^\d{1,2}:\d{2}$/)
    expect(m.dateLabel.length).toBeGreaterThan(0)
  })
})

describe('prefillPushMoment', () => {
  it('uses a real fixture player name and real demo league names', () => {
    const m = prefillPushMoment()
    // body references a real DEMO_LEAGUES name
    expect(m.body).toContain("Lawrence's Legends League")
    // title carries the ruled-out framing
    expect(m.title.toLowerCase()).toContain('ruled out')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/demo/lib/pushMoment.test.ts`
Expected: FAIL ("Cannot find module './pushMoment'").

- [ ] **Step 3: Write the implementation**

Create `app/demo/lib/pushMoment.ts`:

```ts
// T-163 companion / Studio Push Moment pack: an authorable iOS lock-screen
// push. Generic across push types (touchdown/lineup_lock/scratch). Pure,
// in-memory, route-isolated (no product-code imports).
import { DEMO_LEAGUES } from './demoLeagues'
import players from '@/app/demo/fixtures/players.json'

export interface PushMoment {
  appName: string
  title: string
  body: string
  timeLabel: string
  clockTime: string
  dateLabel: string
}

type DemoPlayerLite = { id: string; name: string; pos: string; nflTeam: string }

export function formatLeagueLine(leagueNames: string[]): string {
  const first = leagueNames[0] ?? ''
  const extra = leagueNames.length - 1
  return extra > 0 ? `${first} +${extra} ${extra === 1 ? 'other' : 'others'}` : first
}

export function defaultPushMoment(): PushMoment {
  return {
    appName: 'Rostiro',
    title: 'Josh Allen — ruled OUT',
    body: "Josh Allen ruled out. Starting in Lawrence's Legends League +2 others.",
    timeLabel: 'now',
    clockTime: '12:47',
    dateLabel: 'Sunday, September 14',
  }
}

// Real-data prefill: a real fixture player + the real demo league names.
export function prefillPushMoment(): PushMoment {
  const pool = players as DemoPlayerLite[]
  const player = pool[0] // deterministic; the author can swap via the form
  const leagueNames = DEMO_LEAGUES.map((l) => l.name)
  return {
    appName: 'Rostiro',
    title: `${player.name} — ruled OUT`,
    body: `${player.name} ruled out. Starting in ${formatLeagueLine(leagueNames)}.`,
    timeLabel: 'now',
    clockTime: '12:47',
    dateLabel: 'Sunday, September 14',
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/demo/lib/pushMoment.test.ts`
Expected: PASS. (If `players[0]` is not Lamar Jackson-or-similar with a stable name, the `prefillPushMoment` test only asserts the league name + "ruled out", both of which are independent of which player is first.)

- [ ] **Step 5: Commit**

```bash
git add app/demo/lib/pushMoment.ts app/demo/lib/pushMoment.test.ts
git commit -m "feat(studio): PushMoment model + real-data prefill"
```

---

### Task 2: PushLockScreen render component

**Files:**
- Create: `app/demo/studio/push/PushLockScreen.tsx`
- Test: `app/demo/studio/push/PushLockScreen.test.tsx`

**Interfaces:**
- Consumes: `PushMoment` (Task 1).
- Produces: `export function PushLockScreen({ content, aspect }: { content: PushMoment; aspect: '16:9' | '9:16' }): JSX.Element`

- [ ] **Step 1: Write the failing test**

Create `app/demo/studio/push/PushLockScreen.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PushLockScreen } from './PushLockScreen'
import { defaultPushMoment } from '@/app/demo/lib/pushMoment'

describe('PushLockScreen', () => {
  it('renders the notification title, body, app name, and clock', () => {
    const m = defaultPushMoment()
    render(<PushLockScreen content={m} aspect="9:16" />)
    expect(screen.getByText(m.title)).toBeTruthy()
    expect(screen.getByText(m.body)).toBeTruthy()
    expect(screen.getByText(m.clockTime)).toBeTruthy()
    expect(screen.getByText(/ROSTIRO/i)).toBeTruthy()
  })
  it('renders without crashing in 16:9 (centered phone)', () => {
    render(<PushLockScreen content={defaultPushMoment()} aspect="16:9" />)
    expect(screen.getByText(defaultPushMoment().title)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/demo/studio/push/PushLockScreen.test.tsx`
Expected: FAIL ("Cannot find module './PushLockScreen'").

- [ ] **Step 3: Write the implementation**

Create `app/demo/studio/push/PushLockScreen.tsx`:

```tsx
'use client'
import type { PushMoment } from '@/app/demo/lib/pushMoment'

// Full-bleed 9:16 iOS lock-screen. The captured clip IS the phone screen
// (no device bezel). Deterministic, props-only. In 16:9, the phone is
// centered on a neutral backdrop so the aspect toggle never breaks.
export function PushLockScreen({ content, aspect }: { content: PushMoment; aspect: '16:9' | '9:16' }) {
  const phone = (
    <div
      className="relative overflow-hidden"
      style={{
        width: '100%', height: '100%', maxWidth: aspect === '16:9' ? 320 : undefined,
        aspectRatio: '9 / 16', margin: '0 auto', borderRadius: 28,
        background: 'radial-gradient(120% 90% at 50% 0%, #0a1626 0%, #03070d 70%)',
      }}
    >
      {/* status bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 pt-3 text-white" style={{ fontSize: 12, opacity: 0.9 }}>
        <span>{content.clockTime}</span>
        <span style={{ letterSpacing: 1 }}>▪▪▪ ▪ ▮</span>
      </div>

      {/* big clock + date */}
      <div className="absolute left-0 right-0 text-center text-white" style={{ top: '11%' }}>
        <div style={{ fontSize: 20, opacity: 0.85 }}>{content.dateLabel}</div>
        <div style={{ fontSize: 76, fontWeight: 300, lineHeight: 1.05 }}>{content.clockTime}</div>
      </div>

      {/* notification card */}
      <div className="absolute left-3 right-3" style={{ top: '40%' }}>
        <div
          className="glass-heavy"
          style={{ borderRadius: 18, padding: '12px 14px', border: '1px solid var(--hairline-bright)' }}
        >
          <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--signal)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700 }}>R</div>
            <span className="mono-data" style={{ fontSize: 11, letterSpacing: 1, color: 'var(--t2)' }}>{content.appName.toUpperCase()}</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--t3)' }}>{content.timeLabel}</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--t1)', marginBottom: 3 }}>{content.title}</div>
          <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.35 }}>{content.body}</div>
        </div>
      </div>

      {/* bottom affordances */}
      <div className="absolute left-0 right-0 flex items-center justify-between px-8 text-white" style={{ bottom: '5%', opacity: 0.7 }}>
        <span style={{ fontSize: 18 }}>🔦</span>
        <span style={{ fontSize: 18 }}>📷</span>
      </div>
    </div>
  )

  return (
    <div className="relative w-full mx-auto" style={{ aspectRatio: aspect === '16:9' ? '16 / 9' : '9 / 16', maxWidth: aspect === '16:9' ? '100%' : 480 }}>
      <div className="absolute inset-0 flex items-center justify-center" style={{ background: aspect === '16:9' ? 'var(--void)' : 'transparent' }}>
        <div style={{ height: aspect === '16:9' ? '92%' : '100%' }}>{phone}</div>
      </div>
    </div>
  )
}
```

> The app icon here is a simple branded "R" tile using `--signal`; if a real Rostiro app-icon asset is preferred, swap the tile for that image (a `<img>`/inline SVG) — same slot, no layout change.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/demo/studio/push/PushLockScreen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/demo/studio/push/PushLockScreen.tsx app/demo/studio/push/PushLockScreen.test.tsx
git commit -m "feat(studio): iOS lock-screen PushLockScreen render (9:16, 16:9-safe)"
```

---

### Task 3: PushAuthorForm

**Files:**
- Create: `app/demo/studio/push/PushAuthorForm.tsx`

**Interfaces:**
- Consumes: `PushMoment` (Task 1), `defaultPushMoment`, `prefillPushMoment`.
- Produces: `export function PushAuthorForm({ content, onChange }: { content: PushMoment; onChange: (c: PushMoment) => void }): JSX.Element`

- [ ] **Step 1: Write the implementation** (UI-only; verified by the wiring task's manual check and tsc)

Create `app/demo/studio/push/PushAuthorForm.tsx`:

```tsx
'use client'
import type { PushMoment } from '@/app/demo/lib/pushMoment'
import { prefillPushMoment } from '@/app/demo/lib/pushMoment'

const input = { width: '100%', background: 'rgba(8,15,26,.6)', border: '1px solid var(--hairline)', borderRadius: 8, padding: '6px 8px', color: 'var(--t1)', fontSize: 13 } as const
const label = { display: 'block', fontSize: 12, color: 'var(--t3)', marginBottom: 4 } as const

export function PushAuthorForm({ content, onChange }: { content: PushMoment; onChange: (c: PushMoment) => void }) {
  function set<K extends keyof PushMoment>(key: K, value: PushMoment[K]) {
    onChange({ ...content, [key]: value })
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button onClick={() => onChange(prefillPushMoment())} className="mono-data" style={{ fontSize: 11, color: 'var(--signal)', textAlign: 'left' }}>↻ Reset to real-data prefill</button>

      <div><label className="mono-data" style={label}>Title</label>
        <input style={input} value={content.title} onChange={(e) => set('title', e.target.value)} /></div>
      <div><label className="mono-data" style={label}>Body (the "why you got this" line)</label>
        <textarea style={{ ...input, minHeight: 56, resize: 'vertical' }} value={content.body} onChange={(e) => set('body', e.target.value)} /></div>

      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><label className="mono-data" style={label}>App name</label>
          <input style={input} value={content.appName} onChange={(e) => set('appName', e.target.value)} /></div>
        <div style={{ width: 90 }}><label className="mono-data" style={label}>Time</label>
          <input style={input} value={content.timeLabel} onChange={(e) => set('timeLabel', e.target.value)} /></div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ width: 90 }}><label className="mono-data" style={label}>Clock</label>
          <input style={input} value={content.clockTime} onChange={(e) => set('clockTime', e.target.value)} /></div>
        <div style={{ flex: 1 }}><label className="mono-data" style={label}>Date</label>
          <input style={input} value={content.dateLabel} onChange={(e) => set('dateLabel', e.target.value)} /></div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/demo/studio/push/PushAuthorForm.tsx
git commit -m "feat(studio): PushAuthorForm (hybrid: prefill + full override)"
```

---

### Task 4: Wire "Push" into the Studio (three coupled edits)

**Files:**
- Modify: `app/demo/studio/Studio.tsx`
- Modify: `app/demo/studio/StudioCanvas.tsx`
- Modify: `app/demo/studio/StudioPanel.tsx`

**Interfaces:**
- Consumes: `PushLockScreen` (Task 2), `PushAuthorForm` (Task 3), `prefillPushMoment` (Task 1), `PushMoment`.

> These three edits must land together — adding the state without the canvas branch renders nothing; adding the panel button without the canvas branch selects a dead state. One task, one commit.

- [ ] **Step 1: Studio.tsx — add `'push'` to `PanelState` and prefill on select**

In `app/demo/studio/Studio.tsx`:
- Add the import: `import { prefillPushMoment } from '../lib/pushMoment'`
- Change: `type PanelState = StudioStateKind | 'game_day' | 'live'` → `type PanelState = StudioStateKind | 'game_day' | 'live' | 'push'`
- In `selectState`, extend the prefill branch:

```ts
  function selectState(s: PanelState) {
    setState(s); setFired(null); clearTimers()
    if (s === 'live') setPackContent(prefillLiveScenario())
    else if (s === 'push') setPackContent(prefillPushMoment())
    else if (s !== 'game_day') setPackContent(SURFACE_PACKS[s]!.prefill())
  }
```

- [ ] **Step 2: StudioCanvas.tsx — add the `push` render branch**

In `app/demo/studio/StudioCanvas.tsx`:
- Add imports: `import { PushLockScreen } from './push/PushLockScreen'` and `import type { PushMoment } from '@/app/demo/lib/pushMoment'`
- Change: `type CanvasState = StudioStateKind | 'game_day' | 'live'` → add `| 'push'`
- Immediately after the existing `if (state === 'live') { ... }` early return, add:

```tsx
  if (state === 'push') {
    return <PushLockScreen content={content as PushMoment} aspect={aspect} />
  }
```

- [ ] **Step 3: StudioPanel.tsx — add the selector button + form dispatch**

In `app/demo/studio/StudioPanel.tsx`:
- Add import: `import { PushAuthorForm } from './push/PushAuthorForm'` and `import type { PushMoment } from '@/app/demo/lib/pushMoment'`
- Change: `type PanelState = StudioStateKind | 'game_day' | 'live'` → add `| 'push'`
- Add to the `STATES` array: `{ key: 'push', label: 'Push' }`
- Fix the `pack` guard so `push` is excluded from `SURFACE_PACKS`:

```ts
  const pack = state !== 'game_day' && state !== 'live' && state !== 'push' ? SURFACE_PACKS[state] : undefined
```

- Add a `push` branch to the form dispatch. Change the tail `... : state === 'live' ? (<LiveAuthorForm .../>) : pack ? (...) : null` to include push first:

```tsx
      ) : state === 'live' ? (
        <LiveAuthorForm content={packContent as LiveScenario} onChange={onPackChange as (s: LiveScenario) => void} />
      ) : state === 'push' ? (
        <PushAuthorForm content={packContent as PushMoment} onChange={onPackChange as (c: PushMoment) => void} />
      ) : pack ? (
```

- [ ] **Step 4: Verify it compiles + lints**

Run: `npx tsc --noEmit && npx eslint app/demo/studio/Studio.tsx app/demo/studio/StudioCanvas.tsx app/demo/studio/StudioPanel.tsx`
Expected: PASS — including the `app/demo/**` route-isolation rule (no restricted imports were added).

- [ ] **Step 5: Manual verification**

Run the app, open `/demo/studio?studio=true`, click **Push**. Expected: a convincing iOS lock-screen with the prefilled scratch notification; editing the form fields updates the render live; the 16:9/9:16 toggle keeps the phone intact.

- [ ] **Step 6: Commit**

```bash
git add app/demo/studio/Studio.tsx app/demo/studio/StudioCanvas.tsx app/demo/studio/StudioPanel.tsx
git commit -m "feat(studio): wire the Push lock-screen moment into the Studio"
```

---

### Task 5: Final verification + task log

- [ ] **Step 1: Full type + lint + test + build**

Run: `npx tsc --noEmit && npx eslint . && npx vitest run && npm run build`
Expected: all PASS.

- [ ] **Step 2: Log the pack in the PRD**

Add a task row (next id after T-163 — **T-164**) noting: Studio Push Moment pack shipped — iOS lock-screen render, generic across push types, `/demo/studio` → "Push" state; the reusable capture surface for T-163 scratch alerts and any push moment; registry-generalization refactor logged as future cleanup. Add a v5.9→v5.10 changelog line.

- [ ] **Step 3: Commit**

```bash
git add Rostiro_PRD_v5.md
git commit -m "docs: T-164 Studio Push Moment pack shipped (PRD v5.10)"
```

---

## Self-Review

**Spec coverage:**
- Lock-screen render (own path, not StatePack) → Tasks 2 + 4. ✅
- Generic `PushMoment` content model + real-data prefill + override → Tasks 1 + 3. ✅
- Wiring mirrors game_day/live (three edits) → Task 4. ✅
- 9:16-native, 16:9-safe → Task 2 (component) + test. ✅
- iOS styling, full-bleed, no bezel → Task 2. ✅
- Registry generalization deferred (no registry change) → confirmed: Task 4 adds a special path, touches no registry. ✅
- Honesty (editorial mockup, no in-clip claim) → nothing renders a claim; noted in PRD log (Task 5). ✅
- Route isolation (no product-code imports) → Global Constraints + local `formatLeagueLine` (Task 1) instead of importing `lib/scratchAlerts`. ✅

**Placeholder scan:** every code step has complete code; the only optional swap (real app-icon asset vs. the "R" tile) is explicitly a same-slot no-layout-change substitution, not a placeholder.

**Type consistency:** `PushMoment` (Task 1) is consumed unchanged in Tasks 2, 3, 4. `PushLockScreen({ content, aspect })` (Task 2) matches its call in Task 4 Step 2. `PushAuthorForm({ content, onChange })` (Task 3) matches its call in Task 4 Step 3. `prefillPushMoment()` (Task 1) matches Task 4 Step 1. `'push'` added consistently to `PanelState` (Studio.tsx, StudioPanel.tsx) and `CanvasState` (StudioCanvas.tsx). ✅
