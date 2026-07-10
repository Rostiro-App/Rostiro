# Simulation Studio — Multi-State Marketing Expansion (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generalize `/demo/studio` into a state-aware marketing simulation platform (state selector + per-state pack registry), and ship two new packs — Waiver Day (Mission Briefing) and Film Room (weekly recap) — each with a full faithful state screen (16:9) and a focal card (9:16), hybrid-authored from real fixtures. The existing Game-Day interrupt flow is preserved unchanged.

**Architecture:** A `StatePack` registry maps each surface state (`standard`/`waiver_day`/`film_room`) to `{ prefill, AuthorForm, FullSurface, FocalCard }`. `StudioCanvas` renders the active pack's `FullSurface` (16:9) or `FocalCard` (9:16) inside `DemoShell stateOverride={state}`; Game Day keeps its interrupt overlay + fire/auto-dismiss as a special case. `StudioPanel` gains a state selector routing to the active pack's author form (or the existing game-day fire form).

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Vitest + @testing-library/react, Tailwind + globals.css tokens.

## Global Constraints

- **Repo root:** `/Users/Lawrence/Documents/Rostiro` (NOT `/Users/Lawrence/Rostiro`).
- **Fidelity (verbatim):**
  - Mission Briefing pill: `mono-data inline-block text-[9.5px] tracking-[0.16em] px-2 py-0.5 rounded-full mb-2`, color/border `#1D9E75`, bg `color-mix(in srgb, currentColor 12%, transparent)`, text `MISSION BRIEFING`.
  - Waiver subhead: `<b style={{color:'#1D9E75',fontWeight:600}}>{N} priority waiver {target|targets}</b>{` across ${L} ${league|leagues}`}`.
  - Film Room accent color `#7F77DD` (`STATE_CONFIG.film_room.color`), understated (no glow). Result line "You won this week" / "Not your week" / "Even split", `myScore.toFixed(1) – oppScore.toFixed(1)`, usage line `↑`(buy_low)/`↓`(sell_high) `{name} ({position}) — snap share {up|down} {deltaPct}pts`.
  - WAIVER card label `var(--live)` green.
- **No live-app regression:** the Game-Day interrupt authoring/fire/overlay behavior must stay exactly as it is on `main`.
- **Real prefill, editorial override:** prefill comes from `waivers.json` / `demoLeagues` / `players.json`; every field is operator-editable. No `Math.random`, no network.
- **Aspect:** `16:9` → `FullSurface`; `9:16` → `FocalCard` centered (maxWidth 480). Toggle already exists.
- **Commit after every task. TDD.**

---

## File Structure

**Created:**
- `app/demo/lib/studioPacks.ts` (+ `.test.ts`) — pack registry, types, `standard` pack
- `app/demo/studio/packs/waiver/WaiverBriefing.tsx`, `WaiverFocalCard.tsx`, `WaiverAuthorForm.tsx`, `waiverPack.ts` (+ tests)
- `app/demo/studio/packs/film/FilmRecap.tsx`, `FilmFocalCard.tsx`, `FilmAuthorForm.tsx`, `filmPack.ts` (+ tests)

**Modified:**
- `app/demo/studio/StudioCanvas.tsx` — aspect-aware, pack-driven (game_day special-case preserved)
- `app/demo/studio/StudioPanel.tsx` — state selector + route to pack AuthorForm
- `app/demo/studio/Studio.tsx` — hold `{ state, content }`, load prefill on state change

---

## Task 1: Pack registry + Standard pack

**Files:**
- Create: `app/demo/lib/studioPacks.ts`, `app/demo/lib/studioPacks.test.ts`

**Interfaces:**
- Produces: `StudioStateKind`, `StatePack<T>`, `SURFACE_PACKS: Partial<Record<StudioStateKind, StatePack<any>>>` (registers `standard`).

- [ ] **Step 1: Write failing test** `app/demo/lib/studioPacks.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { SURFACE_PACKS } from './studioPacks'

describe('SURFACE_PACKS', () => {
  it('registers the standard pack with the required shape', () => {
    const p = SURFACE_PACKS.standard
    expect(p).toBeTruthy()
    expect(typeof p!.prefill).toBe('function')
    expect(p!.AuthorForm).toBeTruthy()
    expect(p!.FullSurface).toBeTruthy()
    expect(p!.FocalCard).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npm test -- studioPacks` → FAIL.

- [ ] **Step 3: Implement `app/demo/lib/studioPacks.ts`**

```tsx
import type { FC } from 'react'
import { StandardState } from '@/app/demo/components/StandardState'

export type StudioStateKind = 'standard' | 'waiver_day' | 'film_room' // 'draft' future; game_day handled specially

export interface StatePack<T> {
  state: StudioStateKind
  label: string
  defaultContent: () => T
  prefill: () => T
  AuthorForm: FC<{ content: T; onChange: (c: T) => void }>
  FullSurface: FC<{ content: T }>
  FocalCard: FC<{ content: T }>
}

// Standard is a pass-through of the existing feed (no authored content in Phase 2).
const StandardFull: FC<{ content: null }> = () => <StandardState />
const StandardFocal: FC<{ content: null }> = () => <StandardState />
const StandardForm: FC<{ content: null; onChange: (c: null) => void }> = () => (
  <p className="mono-data text-[11px]" style={{ color: 'var(--t3)' }}>Standard feed — no authored content in this pack.</p>
)

const standardPack: StatePack<null> = {
  state: 'standard', label: 'Standard',
  defaultContent: () => null, prefill: () => null,
  AuthorForm: StandardForm, FullSurface: StandardFull, FocalCard: StandardFocal,
}

export const SURFACE_PACKS: Partial<Record<StudioStateKind, StatePack<any>>> = {
  standard: standardPack,
}
```

- [ ] **Step 4: Run to verify pass** — `npm test -- studioPacks` → PASS.

- [ ] **Step 5: Commit**

```bash
git add app/demo/lib/studioPacks.ts app/demo/lib/studioPacks.test.ts
git commit -m "feat(studio): state pack registry + standard pack"
```

---

## Task 2: Waiver Day pack

**Files:**
- Create: `app/demo/studio/packs/waiver/{WaiverBriefing.tsx,WaiverFocalCard.tsx,WaiverAuthorForm.tsx,waiverPack.ts,waiverPack.test.tsx}`
- Modify: `app/demo/lib/studioPacks.ts` (register `waiver_day`)

**Interfaces:**
- Produces: `WaiverContent { leagueName: string; targets: WaiverTarget[] }`, `WaiverTarget { name; pos; addPct; faabSuggestion }`, `waiverPack: StatePack<WaiverContent>`.

- [ ] **Step 1: Implement `waiverPack.ts`** (content type + prefill from real `waivers.json`):

```ts
import waivers from '@/app/demo/fixtures/waivers.json'
import type { StatePack } from '@/app/demo/lib/studioPacks'
import { WaiverBriefing } from './WaiverBriefing'
import { WaiverFocalCard } from './WaiverFocalCard'
import { WaiverAuthorForm } from './WaiverAuthorForm'

export interface WaiverTarget { name: string; pos: string; addPct: number; faabSuggestion: number }
export interface WaiverContent { leagueName: string; targets: WaiverTarget[] }

const RAW = waivers as { name: string; pos: string; addPct: number; faabSuggestion: number }[]

export const waiverPack: StatePack<WaiverContent> = {
  state: 'waiver_day', label: 'Waiver Day',
  defaultContent: () => ({ leagueName: "Lawrence's Legends League", targets: [] }),
  prefill: () => ({
    leagueName: "Lawrence's Legends League",
    targets: RAW.slice(0, 4).map((w) => ({ name: w.name, pos: w.pos, addPct: w.addPct, faabSuggestion: w.faabSuggestion })),
  }),
  AuthorForm: WaiverAuthorForm, FullSurface: WaiverBriefing, FocalCard: WaiverFocalCard,
}
```

- [ ] **Step 2: Implement `WaiverBriefing.tsx`** (full faithful Mission Briefing surface):

```tsx
import type { WaiverContent } from './waiverPack'

const GREEN = '#1D9E75'

export function WaiverBriefing({ content }: { content: WaiverContent }) {
  return (
    <div className="max-w-2xl mx-auto px-5 md:px-6 pt-8 pb-10">
      <div className="mb-5">
        <span className="mono-data inline-block text-[9.5px] tracking-[0.16em] px-2 py-0.5 rounded-full mb-2"
          style={{ color: GREEN, border: `1px solid ${GREEN}`, backgroundColor: 'color-mix(in srgb, currentColor 12%, transparent)' }}>
          MISSION BRIEFING
        </span>
        <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: 'var(--t1)' }}>Good morning, Lawrence.</h1>
        <p className="text-[13px] mt-0.5" style={{ color: 'var(--t2)' }}>
          <b style={{ color: GREEN, fontWeight: 600 }}>{content.targets.length} priority waiver {content.targets.length === 1 ? 'target' : 'targets'}</b>
          {' across 1 league'}
        </p>
      </div>
      <div className="space-y-3">
        {content.targets.map((t, i) => (
          <article key={i} className="glass card-hover relative rounded-xl px-4 py-3 pl-[18px]">
            <span aria-hidden="true" className="absolute left-0 top-2.5 bottom-2.5 w-[2.5px] rounded-full" style={{ backgroundColor: 'var(--live)', boxShadow: '0 0 10px rgba(67,192,119,.6)' }} />
            <div className="flex items-start justify-between gap-2.5">
              <div className="min-w-0">
                <p className="font-semibold leading-tight text-[13.5px]" style={{ color: 'var(--t1)' }}>{t.name}</p>
                <p className="mono-data text-[10px] mt-1" style={{ color: 'var(--t3)' }}>{t.pos.toUpperCase()} · {content.leagueName.toUpperCase()}</p>
              </div>
              <span className="mono-data text-[8.5px] tracking-[0.16em] px-1.5 py-0.5 rounded flex-shrink-0" style={{ color: 'var(--live)', backgroundColor: 'color-mix(in srgb, currentColor 12%, transparent)' }}>WAIVER</span>
            </div>
            <p className="text-[12.5px] mt-2 leading-normal" style={{ color: 'var(--t2)' }}>
              Adding in <b style={{ color: 'var(--t1)' }}>{t.addPct}%</b> of leagues. Suggested bid: <b style={{ color: 'var(--t1)' }}>${t.faabSuggestion}</b> of your $100 FAAB.
            </p>
          </article>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Implement `WaiverFocalCard.tsx`** (9:16 punchy):

```tsx
import type { WaiverContent } from './waiverPack'

export function WaiverFocalCard({ content }: { content: WaiverContent }) {
  const t = content.targets[0]
  if (!t) return null
  return (
    <div className="glass-heavy rounded-2xl px-6 py-5 mx-auto" style={{ width: 'min(380px, calc(100% - 32px))', borderLeft: '3px solid var(--live)' }}>
      <div className="mono-data text-[10px] tracking-[0.18em]" style={{ color: 'var(--live)' }}>TOP WAIVER TARGET</div>
      <div className="text-[22px] font-bold mt-1" style={{ color: 'var(--t1)' }}>{t.name}</div>
      <div className="mono-data text-[12px]" style={{ color: 'var(--t3)' }}>{t.pos.toUpperCase()}</div>
      <div className="mono-data text-[15px] mt-3" style={{ color: 'var(--t1)' }}>▲ {t.addPct}% adding · bid ${t.faabSuggestion}</div>
    </div>
  )
}
```

- [ ] **Step 4: Implement `WaiverAuthorForm.tsx`** (full override):

```tsx
import type { WaiverContent } from './waiverPack'

const input = { width: '100%', background: 'rgba(8,15,26,.6)', border: '1px solid var(--hairline)', borderRadius: 8, padding: '6px 8px', color: 'var(--t1)', fontSize: 13 } as const

export function WaiverAuthorForm({ content, onChange }: { content: WaiverContent; onChange: (c: WaiverContent) => void }) {
  const setTarget = (i: number, patch: Partial<WaiverContent['targets'][number]>) =>
    onChange({ ...content, targets: content.targets.map((t, j) => (j === i ? { ...t, ...patch } : t)) })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label className="mono-data" style={{ display: 'block', fontSize: 11, color: 'var(--t3)', marginBottom: 4 }}>League</label>
        <input style={input} value={content.leagueName} onChange={(e) => onChange({ ...content, leagueName: e.target.value })} />
      </div>
      <label className="mono-data" style={{ fontSize: 11, color: 'var(--t3)' }}>Waiver targets (editable)</label>
      {content.targets.map((t, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input style={{ ...input, flex: 2 }} value={t.name} onChange={(e) => setTarget(i, { name: e.target.value })} />
          <input style={{ ...input, width: 54 }} value={t.pos} onChange={(e) => setTarget(i, { pos: e.target.value })} />
          <input style={{ ...input, width: 60 }} type="number" value={t.addPct} onChange={(e) => setTarget(i, { addPct: Number(e.target.value) })} />
          <input style={{ ...input, width: 60 }} type="number" value={t.faabSuggestion} onChange={(e) => setTarget(i, { faabSuggestion: Number(e.target.value) })} />
          <button aria-label="Remove" onClick={() => onChange({ ...content, targets: content.targets.filter((_, j) => j !== i) })} style={{ color: 'var(--t3)' }}>✕</button>
        </div>
      ))}
      <button className="mono-data" style={{ fontSize: 11, color: 'var(--signal)', textAlign: 'left' }}
        onClick={() => onChange({ ...content, targets: [...content.targets, { name: 'New Player', pos: 'RB', addPct: 40, faabSuggestion: 15 }] })}>+ Add target</button>
    </div>
  )
}
```

- [ ] **Step 5: Register in `studioPacks.ts`** — import `waiverPack` and add to `SURFACE_PACKS`:

```ts
import { waiverPack } from '@/app/demo/studio/packs/waiver/waiverPack'
// ...
export const SURFACE_PACKS: Partial<Record<StudioStateKind, StatePack<any>>> = {
  standard: standardPack,
  waiver_day: waiverPack,
}
```

- [ ] **Step 6: Write test** `app/demo/studio/packs/waiver/waiverPack.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { waiverPack } from './waiverPack'

describe('waiverPack', () => {
  it('prefills real waiver targets from the fixture', () => {
    const c = waiverPack.prefill()
    expect(c.targets.length).toBeGreaterThanOrEqual(1)
    expect(c.targets[0].name.length).toBeGreaterThan(0)
    expect(typeof c.targets[0].faabSuggestion).toBe('number')
  })
  it('FullSurface renders the Mission Briefing framing + a WAIVER card per target', () => {
    const c = waiverPack.prefill()
    render(<waiverPack.FullSurface content={c} />)
    expect(screen.getByText('MISSION BRIEFING')).toBeTruthy()
    expect(screen.getByText(/priority waiver target/)).toBeTruthy()
    expect(screen.getAllByText('WAIVER').length).toBe(c.targets.length)
  })
})
```

- [ ] **Step 7: Run** — `npm test -- waiverPack studioPacks` → PASS. Then FULL `npm test`.

- [ ] **Step 8: Commit**

```bash
git add app/demo/studio/packs/waiver app/demo/lib/studioPacks.ts
git commit -m "feat(studio): Waiver Day pack (Mission Briefing surface + focal card + author form)"
```

---

## Task 3: Film Room pack

**Files:**
- Create: `app/demo/studio/packs/film/{FilmRecap.tsx,FilmFocalCard.tsx,FilmAuthorForm.tsx,filmPack.ts,filmPack.test.tsx}`
- Modify: `app/demo/lib/studioPacks.ts` (register `film_room`)

**Interfaces:**
- Produces: `FilmUsage { name; position; direction: 'buy_low'|'sell_high'; deltaPct }`, `FilmContent { leagueName; won: boolean|null; myScore; oppScore; recap; usage: FilmUsage|null }`, `filmPack: StatePack<FilmContent>`.

- [ ] **Step 1: Implement `filmPack.ts`** (prefill from `demoLeagues` + a real player):

```ts
import type { StatePack } from '@/app/demo/lib/studioPacks'
import { DEMO_LEAGUES } from '@/app/demo/lib/demoLeagues'
import players from '@/app/demo/fixtures/players.json'
import { FilmRecap } from './FilmRecap'
import { FilmFocalCard } from './FilmFocalCard'
import { FilmAuthorForm } from './FilmAuthorForm'

export interface FilmUsage { name: string; position: string; direction: 'buy_low' | 'sell_high'; deltaPct: number }
export interface FilmContent { leagueName: string; won: boolean | null; myScore: number; oppScore: number; recap: string; usage: FilmUsage | null }

const P = players as { name: string; pos: string }[]

export const filmPack: StatePack<FilmContent> = {
  state: 'film_room', label: 'Film Room',
  defaultContent: () => ({ leagueName: "Lawrence's Legends League", won: true, myScore: 0, oppScore: 0, recap: '', usage: null }),
  prefill: () => {
    const lg = DEMO_LEAGUES[0]
    const p = P[20] // a real mid-tier player as the buy-low signal
    return {
      leagueName: lg.name,
      won: lg.matchup.myScore > lg.matchup.oppScore,
      myScore: lg.matchup.myScore,
      oppScore: lg.matchup.oppScore,
      recap: 'Came down to the last flex. Your RB core carried it.',
      usage: { name: p.name, position: p.pos, direction: 'buy_low', deltaPct: 15 },
    }
  },
  AuthorForm: FilmAuthorForm, FullSurface: FilmRecap, FocalCard: FilmFocalCard,
}
```
(`recap` and `usage.deltaPct` are authored/editorial defaults — the operator owns them, like the interrupt metric values; all player identities and scores are real fixtures.)

- [ ] **Step 2: Implement `FilmRecap.tsx`** (understated real Film Room panel):

```tsx
import type { FilmContent } from './filmPack'

const PURPLE = '#7F77DD'

export function FilmRecap({ content }: { content: FilmContent }) {
  const resultLine = content.won === true ? 'You won this week' : content.won === false ? 'Not your week' : 'Even split'
  return (
    <div className="max-w-2xl mx-auto px-5 md:px-6 pt-8 pb-10">
      <span className="mono-data inline-block text-[9.5px] tracking-[0.16em] px-2 py-0.5 rounded-full mb-3" style={{ color: PURPLE, border: `1px solid ${PURPLE}` }}>FILM ROOM</span>
      <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'rgba(8, 15, 26, 0.6)', border: '1px solid var(--hairline)', borderLeft: `2.5px solid ${PURPLE}` }}>
        <p className="text-[12.5px]" style={{ color: 'var(--t1)' }}>{resultLine} — {content.leagueName}</p>
        <p className="mono-data text-[11px] mt-0.5" style={{ color: 'var(--t2)' }}>{content.myScore.toFixed(1)} – {content.oppScore.toFixed(1)}</p>
        {content.recap && <p className="text-[12px] mt-1.5 leading-relaxed" style={{ color: 'var(--t2)' }}>{content.recap}</p>}
        {content.usage && (
          <p className="mono-data text-[10.5px] mt-1.5" style={{ color: 'var(--t3)' }}>
            {content.usage.direction === 'buy_low' ? '↑' : '↓'} {content.usage.name} ({content.usage.position}) — snap share {content.usage.direction === 'buy_low' ? 'up' : 'down'} {content.usage.deltaPct}pts
          </p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Implement `FilmFocalCard.tsx`**:

```tsx
import type { FilmContent } from './filmPack'
const PURPLE = '#7F77DD'
export function FilmFocalCard({ content }: { content: FilmContent }) {
  const line = content.won === true ? 'YOU WON' : content.won === false ? 'TOUGH LOSS' : 'EVEN SPLIT'
  return (
    <div className="glass-heavy rounded-2xl px-6 py-5 mx-auto" style={{ width: 'min(380px, calc(100% - 32px))', borderLeft: `3px solid ${PURPLE}` }}>
      <div className="mono-data text-[10px] tracking-[0.18em]" style={{ color: PURPLE }}>{line} · {content.leagueName.toUpperCase()}</div>
      <div className="text-[26px] font-bold mt-1" style={{ color: 'var(--t1)' }}>{content.myScore.toFixed(1)} – {content.oppScore.toFixed(1)}</div>
      {content.usage && <div className="mono-data text-[13px] mt-3" style={{ color: 'var(--t2)' }}>{content.usage.direction === 'buy_low' ? '↑ Buy low' : '↓ Sell high'}: {content.usage.name}</div>}
    </div>
  )
}
```

- [ ] **Step 4: Implement `FilmAuthorForm.tsx`** (full override — league, result, scores, recap, usage):

```tsx
import type { FilmContent } from './filmPack'
const input = { width: '100%', background: 'rgba(8,15,26,.6)', border: '1px solid var(--hairline)', borderRadius: 8, padding: '6px 8px', color: 'var(--t1)', fontSize: 13 } as const
const lbl = { display: 'block', fontSize: 11, color: 'var(--t3)', marginBottom: 4 } as const

export function FilmAuthorForm({ content, onChange }: { content: FilmContent; onChange: (c: FilmContent) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div><label className="mono-data" style={lbl}>League</label>
        <input style={input} value={content.leagueName} onChange={(e) => onChange({ ...content, leagueName: e.target.value })} /></div>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}><label className="mono-data" style={lbl}>Result</label>
          <select style={input} value={content.won === null ? 'even' : content.won ? 'won' : 'lost'}
            onChange={(e) => onChange({ ...content, won: e.target.value === 'even' ? null : e.target.value === 'won' })}>
            <option value="won">Won</option><option value="lost">Lost</option><option value="even">Even</option>
          </select></div>
        <div style={{ width: 80 }}><label className="mono-data" style={lbl}>My score</label>
          <input style={input} type="number" step="0.1" value={content.myScore} onChange={(e) => onChange({ ...content, myScore: Number(e.target.value) })} /></div>
        <div style={{ width: 80 }}><label className="mono-data" style={lbl}>Opp score</label>
          <input style={input} type="number" step="0.1" value={content.oppScore} onChange={(e) => onChange({ ...content, oppScore: Number(e.target.value) })} /></div>
      </div>
      <div><label className="mono-data" style={lbl}>Recap</label>
        <input style={input} value={content.recap} onChange={(e) => onChange({ ...content, recap: e.target.value })} /></div>
      {content.usage && (
        <div style={{ display: 'flex', gap: 6 }}>
          <input style={{ ...input, flex: 2 }} value={content.usage.name} onChange={(e) => onChange({ ...content, usage: { ...content.usage!, name: e.target.value } })} />
          <select style={{ ...input, width: 100 }} value={content.usage.direction} onChange={(e) => onChange({ ...content, usage: { ...content.usage!, direction: e.target.value as 'buy_low' | 'sell_high' } })}>
            <option value="buy_low">Buy low</option><option value="sell_high">Sell high</option>
          </select>
          <input style={{ ...input, width: 60 }} type="number" value={content.usage.deltaPct} onChange={(e) => onChange({ ...content, usage: { ...content.usage!, deltaPct: Number(e.target.value) } })} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Register in `studioPacks.ts`** — add `film_room: filmPack` to `SURFACE_PACKS` (import from `@/app/demo/studio/packs/film/filmPack`).

- [ ] **Step 6: Write test** `app/demo/studio/packs/film/filmPack.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { filmPack } from './filmPack'

describe('filmPack', () => {
  it('prefill result is consistent with demoLeagues scores', () => {
    const c = filmPack.prefill()
    expect(c.won).toBe(c.myScore > c.oppScore)
    expect(c.usage?.name.length).toBeGreaterThan(0)
  })
  it('FullSurface renders the FILM ROOM panel, score, and usage line', () => {
    const c = { ...filmPack.prefill(), leagueName: 'Bench Regret FC', won: true, usage: { name: 'Test Guy', position: 'WR', direction: 'buy_low' as const, deltaPct: 12 } }
    render(<filmPack.FullSurface content={c} />)
    expect(screen.getByText('FILM ROOM')).toBeTruthy()
    expect(screen.getByText(/You won this week — Bench Regret FC/)).toBeTruthy()
    expect(screen.getByText(/Test Guy \(WR\) — snap share up 12pts/)).toBeTruthy()
  })
})
```

- [ ] **Step 7: Run** — `npm test -- filmPack studioPacks` → PASS. Then FULL `npm test`.

- [ ] **Step 8: Commit**

```bash
git add app/demo/studio/packs/film app/demo/lib/studioPacks.ts
git commit -m "feat(studio): Film Room pack (recap surface + focal card + author form)"
```

---

## Task 4: Aspect-aware, pack-driven StudioCanvas

**Files:**
- Modify: `app/demo/studio/StudioCanvas.tsx`
- Test: `app/demo/studio/StudioCanvas.test.tsx` (extend)

**Interfaces:**
- Produces: `<StudioCanvas state aspect event? leaving? content? />` where `state: 'standard'|'waiver_day'|'game_day'|'film_room'`. Game Day keeps the interrupt overlay; surface states render pack surfaces.

- [ ] **Step 1: Write failing tests** — add to `app/demo/studio/StudioCanvas.test.tsx`:

Add this import at the top of the test file: `import { waiverPack } from './packs/waiver/waiverPack'`. Then add:
```tsx
  it('renders the Waiver pack full surface at 16:9', () => {
    render(<StudioCanvas state="waiver_day" aspect="16:9" content={waiverPack.prefill()} />)
    expect(screen.getByText('MISSION BRIEFING')).toBeTruthy()
  })
  it('renders the Waiver focal card at 9:16', () => {
    render(<StudioCanvas state="waiver_day" aspect="9:16" content={waiverPack.prefill()} />)
    expect(screen.getByText('TOP WAIVER TARGET')).toBeTruthy()
  })
```
(Keep the existing game-day interrupt tests unchanged.)

- [ ] **Step 2: Run to verify failure** — `npm test -- StudioCanvas` → FAIL (new props/branches).

- [ ] **Step 3: Rewrite `app/demo/studio/StudioCanvas.tsx`**

```tsx
'use client'
import { DemoShell } from '@/app/demo/components/DemoShell'
import { StandardState } from '@/app/demo/components/StandardState'
import { InterruptCardView } from '@/components/interrupt/InterruptCardView'
import type { InterruptSimEvent } from '../lib/simEvents'
import { SURFACE_PACKS, type StudioStateKind } from '../lib/studioPacks'
import type { RostiroState } from '@/types'

type CanvasState = StudioStateKind | 'game_day'

export function StudioCanvas({ state = 'game_day', aspect, event, leaving, content }: {
  state?: CanvasState
  aspect: '16:9' | '9:16'
  event?: InterruptSimEvent | null
  leaving?: boolean
  content?: unknown
}) {
  const pack = state !== 'game_day' ? SURFACE_PACKS[state] : undefined
  const stateOverride: RostiroState = state === 'game_day' ? 'game_day' : (state as RostiroState)

  return (
    <div className="relative w-full mx-auto" style={{ aspectRatio: aspect === '16:9' ? '16 / 9' : '9 / 16', maxWidth: aspect === '16:9' ? '100%' : 480 }}>
      <div className="glass-heavy rounded-2xl overflow-hidden absolute inset-0" style={{ border: '1px solid var(--hairline-bright)' }}>
        {state === 'game_day' ? (
          <>
            <DemoShell variant="contained" stateOverride="game_day"><StandardState missionControl /></DemoShell>
            {event && (
              <InterruptCardView contained leaving={leaving} typeLabel={event.eventLabel} headline={event.playerLine}
                reasoning={event.points != null ? `+${event.points} to your live score` : ''} color="var(--crit)" priority="info" metrics={event.metrics} />
            )}
          </>
        ) : pack && aspect === '16:9' ? (
          <DemoShell variant="contained" stateOverride={stateOverride}><pack.FullSurface content={content} /></DemoShell>
        ) : pack ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <DemoShell variant="contained" stateOverride={stateOverride}><span /></DemoShell>
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(3,7,13,.35)' }}>
              <pack.FocalCard content={content} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run to verify pass** — `npm test -- StudioCanvas` → PASS (old game-day tests + new surface tests). Then FULL `npm test`.

- [ ] **Step 5: Commit**

```bash
git add app/demo/studio/StudioCanvas.tsx app/demo/studio/StudioCanvas.test.tsx
git commit -m "feat(studio): aspect-aware pack-driven canvas (game-day overlay preserved)"
```

---

## Task 5: State selector in StudioPanel + Studio wiring + gate

**Files:**
- Modify: `app/demo/studio/StudioPanel.tsx`, `app/demo/studio/Studio.tsx`
- Test: `app/demo/studio/Studio.test.tsx` (extend)

**Interfaces:**
- `Studio` holds `state` + per-state `content`; selecting a surface state loads its `prefill()`; Game Day keeps the interrupt fire flow.

- [ ] **Step 1: Add a `stateSelector` to `StudioPanel.tsx`.** Change its props to `{ state, onState, event, onChange, onFire, packContent, onPackChange }` and render a segmented control at the top, then branch:
  - `state === 'game_day'` → the existing player-search + metric-rows + Fire UI (unchanged).
  - else → `const pack = SURFACE_PACKS[state]; <pack.AuthorForm content={packContent} onChange={onPackChange} />`.

Full new `StudioPanel.tsx` header/selector (keep the existing game-day body in the `game_day` branch):

```tsx
'use client'
import { useMemo, useState } from 'react'
import players from '@/app/demo/fixtures/players.json'
import { prefillInterruptMetrics, type InterruptSimEvent, type SimMetricRow } from '../lib/simEvents'
import { SURFACE_PACKS, type StudioStateKind } from '../lib/studioPacks'

type PanelState = StudioStateKind | 'game_day'
const STATES: { key: PanelState; label: string }[] = [
  { key: 'standard', label: 'Standard' }, { key: 'waiver_day', label: 'Waiver Day' },
  { key: 'game_day', label: 'Game Day' }, { key: 'film_room', label: 'Film Room' },
]
interface DemoPlayerLite { id: string; name: string; pos: string; nflTeam: string }
const POOL = players as DemoPlayerLite[]

export function StudioPanel({ state, onState, event, onChange, onFire, packContent, onPackChange }: {
  state: PanelState; onState: (s: PanelState) => void
  event: InterruptSimEvent; onChange: (e: InterruptSimEvent) => void; onFire: () => void
  packContent: unknown; onPackChange: (c: unknown) => void
}) {
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
  const input = { width: '100%', background: 'rgba(8,15,26,.6)', border: '1px solid var(--hairline)', borderRadius: 8, padding: '6px 8px', color: 'var(--t1)', fontSize: 13 } as const
  const pack = state !== 'game_day' ? SURFACE_PACKS[state] : undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="mono-data" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {STATES.map((s) => (
          <button key={s.key} onClick={() => onState(s.key)} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 6,
            color: state === s.key ? 'var(--signal)' : 'var(--t3)',
            background: state === s.key ? 'var(--signal-dim)' : 'transparent', border: `1px solid ${state === s.key ? 'var(--signal)' : 'var(--hairline)'}` }}>{s.label}</button>
        ))}
      </div>

      {state === 'game_day' ? (
        <>
          <div>
            <label className="mono-data" style={{ display: 'block', fontSize: 12, color: 'var(--t3)', marginBottom: 4 }}>Player</label>
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
            <div style={{ flex: 1 }}><label className="mono-data" style={{ display: 'block', fontSize: 12, color: 'var(--t3)', marginBottom: 4 }}>Event label</label>
              <input style={input} value={event.eventLabel} onChange={(e) => onChange({ ...event, eventLabel: e.target.value })} /></div>
            <div style={{ width: 90 }}><label className="mono-data" style={{ display: 'block', fontSize: 12, color: 'var(--t3)', marginBottom: 4 }}>Points</label>
              <input style={input} type="number" step="0.1" value={event.points ?? ''} onChange={(e) => onChange({ ...event, points: e.target.value === '' ? null : Number(e.target.value) })} /></div>
          </div>
          <div>
            <label className="mono-data" style={{ display: 'block', fontSize: 12, color: 'var(--t3)', marginBottom: 4 }}>Metric rows (fully editable)</label>
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
        </>
      ) : pack ? (
        <pack.AuthorForm content={packContent} onChange={onPackChange} />
      ) : null}
    </div>
  )
}
```

- [ ] **Step 2: Rewrite `Studio.tsx`** to hold `state` + `packContent` and load prefill on state change:

```tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { StudioPanel } from './StudioPanel'
import { StudioCanvas } from './StudioCanvas'
import { defaultInterruptEvent, type InterruptSimEvent } from '../lib/simEvents'
import { SURFACE_PACKS, type StudioStateKind } from '../lib/studioPacks'

type PanelState = StudioStateKind | 'game_day'

export function Studio() {
  const [state, setState] = useState<PanelState>('game_day')
  const [draft, setDraft] = useState<InterruptSimEvent>(defaultInterruptEvent())
  const [fired, setFired] = useState<InterruptSimEvent | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [aspect, setAspect] = useState<'16:9' | '9:16'>('16:9')
  const [showPanel, setShowPanel] = useState(true)
  const [packContent, setPackContent] = useState<unknown>(null)
  const timers = useRef<number[]>([])
  function clearTimers() { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = [] }

  function selectState(s: PanelState) {
    setState(s); setFired(null); clearTimers()
    if (s !== 'game_day') setPackContent(SURFACE_PACKS[s]!.prefill())
  }
  function fire() {
    clearTimers(); setLeaving(false); setFired(draft)
    if (draft.autoDismissMs != null) {
      const t1 = window.setTimeout(() => {
        setLeaving(true)
        const t2 = window.setTimeout(() => setFired(null), 340)
        timers.current.push(t2)
      }, draft.autoDismissMs)
      timers.current.push(t1)
    }
  }
  useEffect(() => () => clearTimers(), [])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--void)' }}>
      <div style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="mono-data" style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 11, color: 'var(--t3)' }}>
          <strong style={{ color: 'var(--t1)' }}>🎬 SIMULATION STUDIO</strong>
          <button onClick={() => setAspect(aspect === '16:9' ? '9:16' : '16:9')}>{aspect}</button>
          <button onClick={() => setShowPanel((s) => !s)}>{showPanel ? 'Hide controls (H)' : 'Show controls'}</button>
        </div>
        <StudioCanvas state={state} aspect={aspect} event={state === 'game_day' ? fired : null} leaving={leaving} content={packContent} />
      </div>
      {showPanel && (
        <aside style={{ width: 340, padding: 20, borderLeft: '1px solid var(--hairline)', background: 'rgba(8,15,26,.5)' }}>
          <StudioPanel state={state} onState={selectState} event={draft} onChange={setDraft} onFire={fire} packContent={packContent} onPackChange={setPackContent} />
        </aside>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Write test** — extend `app/demo/studio/Studio.test.tsx`:

```tsx
  it('switching to Waiver Day shows the Mission Briefing surface with prefilled targets', () => {
    render(<Studio />)
    fireEvent.click(screen.getByText('Waiver Day'))
    expect(screen.getByText('MISSION BRIEFING')).toBeTruthy()
    expect(screen.getAllByText('WAIVER').length).toBeGreaterThan(0)
  })
  it('switching to Film Room shows the recap surface', () => {
    render(<Studio />)
    fireEvent.click(screen.getByText('Film Room'))
    expect(screen.getByText('FILM ROOM')).toBeTruthy()
  })
```
(Keep the existing game-day fire test.)

- [ ] **Step 4: Run** — `npm test -- "app/demo/studio/Studio"` → PASS. Then FULL `npm test`.

- [ ] **Step 5: Full gate** — `npm test && npm run build` → all pass; build exit 0; `/demo/studio` in route list. (Pre-existing `lib/*` lint errors are an unrelated baseline.)

- [ ] **Step 6: Manual smoke** — `npm run dev`, open `http://localhost:3000/demo/studio`: the state selector shows Standard / Waiver Day / Game Day / Film Room. Select **Waiver Day** → the Mission Briefing feed renders with prefilled real targets; edit a target name/bid → it updates live; toggle **9:16** → the focal "TOP WAIVER TARGET" card. Select **Film Room** → the recap panel; flip Result to Won, edit the recap; 9:16 → the focal recap card. Game Day still fires the interrupt as before.

- [ ] **Step 7: Commit**

```bash
git add app/demo/studio/StudioPanel.tsx app/demo/studio/Studio.tsx app/demo/studio/Studio.test.tsx
git commit -m "feat(studio): state selector + Waiver/Film packs wired into the studio"
```

---

## Self-Review

**Spec coverage:**
- State-aware Studio (selector + registry) → Tasks 1, 5 ✅
- Aspect-aware canvas (FullSurface 16:9 / FocalCard 9:16; game-day overlay preserved) → Task 4 ✅
- Waiver Day pack (Mission Briefing surface + focal + author + real prefill) → Task 2 ✅
- Film Room pack (recap surface + focal + author + real prefill) → Task 3 ✅
- Fidelity anchors (Mission Briefing pill `#1D9E75`, waiver subhead, Film Room `#7F77DD`, WAIVER card, usage `↑/↓`) → Tasks 2, 3 ✅
- Hybrid authoring (prefill + full override) → Tasks 2, 3 author forms ✅
- No game-day regression → Task 4 keeps the interrupt branch; Task 5 keeps the fire flow ✅
- Testing per pack/surface/canvas/panel → each task ✅

**Placeholder scan:** none — all code complete.

**Type consistency:** `StatePack<T>` (Task 1) is implemented by `waiverPack` (Task 2) and `filmPack` (Task 3); `SURFACE_PACKS` keyed by `StudioStateKind`. `StudioCanvas` (Task 4) and `StudioPanel`/`Studio` (Task 5) consume `SURFACE_PACKS[state].{FullSurface,FocalCard,AuthorForm,prefill}`. `packContent` is threaded as `unknown` at the Studio boundary and typed inside each pack's own components — the registry uses `StatePack<any>` deliberately so heterogeneous packs share one map. `InterruptSimEvent`/`prefillInterruptMetrics` (existing) unchanged for the game-day branch.

**Fidelity:** every reproduced string/color/markup copied from real code (`#1D9E75`, `#7F77DD`, Mission Briefing pill, waiver subhead, Film Room recap/usage line). Authored defaults (`recap`, `usage.deltaPct`) are editorial and operator-owned; all player identities/scores/add%/FAAB come from real fixtures.
