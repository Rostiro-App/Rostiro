# LIVE Second-Screen Companion Simulation (Phase 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a self-playing, capture-ready **LIVE second-screen companion** simulation as a new "Live" state in the Simulation Studio — the OS sweeps into Game Day, LIVE opens, and real-2024 players' points tick up with TD flashes and swinging matchup scores — driven by an authorable `LiveScenario` (prefilled from real data, editable via a basic override form).

**Architecture:** A pure `LiveScenario` (prefilled from real fixtures) feeds a pure `liveSimAt(t, scenario)` engine; `LiveCompanion` renders a `LiveSimFrame` as the faithful LIVE tab; `LiveScene` drives the full arc over a `SceneStage` frame clock; `LiveAuthorForm` edits the scenario; the Studio gets a `'live'` state wired exactly like the existing special `'game_day'` state.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Vitest + @testing-library/react.

## Global Constraints

- **Repo root:** `/Users/Lawrence/Documents/Rostiro` (NOT `/Users/Lawrence/Rostiro`).
- **Honesty:** player identities + `finalPoints`/`tdCount` prefill from real 2024 (`players.json`, `week.json`); only intra-game *timing* is simulated. Overrides set *targets* the ramp animates toward — NO per-frame/keyframe control.
- **Purity:** `liveSimAt` reads ONLY its `scenario` arg — no fixtures, no `Math.random`, no network. `prefillLiveScenario` is deterministic.
- **Fidelity:** reproduce the real `app/(dashboard)/live/page.tsx` markup + reuse `score-tick-up`/`score-tick-down` CSS verbatim.
- **No regression:** the existing Studio states (Standard/Waiver/Game Day/Film Room) and the game-day interrupt flow are untouched; `'live'` is added like the special `'game_day'` branch.
- **fps = 30**; scene ~750 frames (~25s); `frame?` override on the scene for deterministic tests.
- **Commit after every task. TDD.**

---

## File Structure

**Created:**
- `app/demo/lib/liveScenario.ts` (+ `.test.ts`)
- `app/demo/lib/liveSim.ts` (+ `.test.ts`)
- `app/demo/studio/live/LiveCompanion.tsx` (+ `.test.tsx`)
- `app/demo/studio/live/LiveAuthorForm.tsx` (+ `.test.tsx`)
- `app/demo/studio/live/LiveScene.tsx` (+ `.test.tsx`)

**Modified:**
- `app/demo/studio/StudioPanel.tsx`, `app/demo/studio/StudioCanvas.tsx`, `app/demo/studio/Studio.tsx` (+ `Studio.test.tsx`)

---

## Task 1: `LiveScenario` + prefill

**Files:** Create `app/demo/lib/liveScenario.ts`, `app/demo/lib/liveScenario.test.ts`

**Interfaces:** Produces `ScenarioGame`, `ScenarioPlayer`, `ScenarioMatchup`, `LiveScenario`, `prefillLiveScenario()`.

- [ ] **Step 1: Write failing test** `app/demo/lib/liveScenario.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { prefillLiveScenario } from './liveScenario'
import players from '@/app/demo/fixtures/players.json'
import week from '@/app/demo/fixtures/week.json'

describe('prefillLiveScenario', () => {
  const sc = prefillLiveScenario()
  it('features at least 6 real rostered players with real finals', () => {
    expect(sc.players.length).toBeGreaterThanOrEqual(6)
    const ids = new Set((players as { id: string }[]).map((p) => p.id))
    const box = (week as { boxScores: Record<string, { points: number }> }).boxScores
    for (const p of sc.players) {
      expect(ids.has(p.playerId)).toBe(true)
      expect(box[p.playerId].points).toBe(p.finalPoints)
      expect(p.gameId).toBeTruthy()
    }
  })
  it('groups players into 2-3 games that reference real team codes', () => {
    expect(sc.games.length).toBeGreaterThanOrEqual(2)
    expect(sc.games.length).toBeLessThanOrEqual(3)
    for (const p of sc.players) expect(sc.games.some((g) => g.id === p.gameId)).toBe(true)
  })
  it('has matchups with authored opponent finals', () => {
    expect(sc.matchups.length).toBeGreaterThanOrEqual(1)
    for (const m of sc.matchups) expect(m.oppFinal).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npm test -- liveScenario` → FAIL.

- [ ] **Step 3: Implement `app/demo/lib/liveScenario.ts`**

```ts
import players from '@/app/demo/fixtures/players.json'
import week from '@/app/demo/fixtures/week.json'
import { DEMO_LEAGUES } from './demoLeagues'

export interface ScenarioGame { id: string; away: string; home: string }
export interface ScenarioPlayer {
  playerId: string; name: string; pos: string; nflTeam: string; headshotUrl: string | null
  finalPoints: number; tdCount: number; eventLabel: string; gameId: string; starting: boolean
}
export interface ScenarioMatchup { leagueName: string; oppFinal: number; oppProjected: number }
export interface LiveScenario {
  featuredLeagueName: string
  games: ScenarioGame[]
  players: ScenarioPlayer[]
  matchups: ScenarioMatchup[]
}

interface P { id: string; name: string; pos: string; nflTeam: string; headshotUrl: string | null }
const POOL = new Map((players as P[]).map((p) => [p.id, p]))
const BOX = (week as { boxScores: Record<string, { playerId: string; points: number; line: string }> }).boxScores

const tdCountFrom = (line: string): number => {
  const m = line.match(/(\d+)\s*TD/)
  return m ? Number(m[1]) : 0
}

/** Real founder-roster players who have a box score this week, top by points. */
export function prefillLiveScenario(): LiveScenario {
  const founder = DEMO_LEAGUES[0]
  const featured = founder.founderRoster
    .map((id) => ({ p: POOL.get(id), box: BOX[id] }))
    .filter((x): x is { p: P; box: { playerId: string; points: number; line: string } } => !!x.p && !!x.box)
    .sort((a, b) => b.box.points - a.box.points)
    .slice(0, 8)

  // Group into 3 games of ~3; each game's teams drawn from its players (deduped, padded).
  const games: ScenarioGame[] = []
  const scPlayers: ScenarioPlayer[] = []
  const per = Math.ceil(featured.length / 3)
  for (let gi = 0; gi * per < featured.length; gi++) {
    const chunk = featured.slice(gi * per, gi * per + per)
    const teams = [...new Set(chunk.map((c) => c.p.nflTeam))]
    const away = teams[0] ?? 'AFC'
    const home = teams[1] ?? (teams[0] === 'NFC' ? 'AFC' : 'NFC')
    const id = `g${gi}`
    games.push({ id, away, home })
    chunk.forEach((c, i) => scPlayers.push({
      playerId: c.p.id, name: c.p.name, pos: c.p.pos, nflTeam: c.p.nflTeam, headshotUrl: c.p.headshotUrl,
      finalPoints: c.box.points, tdCount: tdCountFrom(c.box.line), eventLabel: 'TD', gameId: id,
      starting: gi * per + i < 6, // top 6 start
    }))
  }

  const myProjected = scPlayers.filter((p) => p.starting).reduce((s, p) => s + p.finalPoints, 0)
  const matchups: ScenarioMatchup[] = DEMO_LEAGUES.slice(0, 3).map((lg, i) => ({
    leagueName: lg.name,
    oppFinal: Math.round((myProjected - [3.4, 6.1, 1.8][i]) * 10) / 10, // authored: a close late win
    oppProjected: Math.round((myProjected - [3.4, 6.1, 1.8][i]) * 10) / 10,
  }))

  return { featuredLeagueName: founder.name, games, players: scPlayers, matchups }
}
```

- [ ] **Step 4: Run to verify pass** — `npm test -- liveScenario` → PASS.

- [ ] **Step 5: Commit**
```bash
git add app/demo/lib/liveScenario.ts app/demo/lib/liveScenario.test.ts
git commit -m "feat(live): authorable LiveScenario prefilled from real 2024 week 8"
```

---

## Task 2: `liveSimAt` engine

**Files:** Create `app/demo/lib/liveSim.ts`, `app/demo/lib/liveSim.test.ts`

**Interfaces:** Consumes `LiveScenario`. Produces `LivePlayerFrame`, `LiveMatchupFrame`, `LiveGameFrame`, `LiveSimFrame`, `liveSimAt(t, scenario)`.

- [ ] **Step 1: Write failing test** `app/demo/lib/liveSim.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { liveSimAt } from './liveSim'
import type { LiveScenario } from './liveScenario'

const scenario: LiveScenario = {
  featuredLeagueName: 'Test League',
  games: [{ id: 'g0', away: 'BUF', home: 'MIA' }],
  players: [
    { playerId: 'a', name: 'Star RB', pos: 'RB', nflTeam: 'BUF', headshotUrl: null, finalPoints: 24, tdCount: 2, eventLabel: 'TD', gameId: 'g0', starting: true },
    { playerId: 'b', name: 'Bench WR', pos: 'WR', nflTeam: 'MIA', headshotUrl: null, finalPoints: 10, tdCount: 0, eventLabel: 'TD', gameId: 'g0', starting: false },
  ],
  matchups: [{ leagueName: 'Test League', oppFinal: 20, oppProjected: 20 }],
}

describe('liveSimAt', () => {
  it('points are 0 at t=0 and the final at t=1, monotonic', () => {
    expect(liveSimAt(0, scenario).games[0].players[0].points).toBe(0)
    expect(liveSimAt(1, scenario).games[0].players[0].points).toBe(24)
    expect(liveSimAt(0.5, scenario).games[0].players[0].points).toBe(12)
  })
  it('matchup myScore sums only STARTING players; oppScore ramps to oppFinal', () => {
    const f = liveSimAt(1, scenario)
    expect(f.matchups[0].myScore).toBe(24)   // only the starter
    expect(f.matchups[0].oppScore).toBe(20)
    expect(liveSimAt(0, scenario).matchups[0].oppScore).toBe(0)
  })
  it('a tdCount:2 player has exactly 2 event windows across t (custom label surfaces)', () => {
    const withLabel = { ...scenario, players: [{ ...scenario.players[0], eventLabel: 'HOUSE CALL' }, scenario.players[1]] }
    const labels = new Set<string>()
    let windows = 0
    let prev = false
    for (let i = 0; i <= 100; i++) {
      const ev = liveSimAt(i / 100, withLabel).games[0].players[0].event
      if (ev) { labels.add(ev); if (!prev) windows++; prev = true } else prev = false
    }
    expect(windows).toBe(2)
    expect(labels.has('HOUSE CALL')).toBe(true)
  })
  it('reads only the scenario — a custom finalPoints override is reflected', () => {
    const s2 = { ...scenario, players: [{ ...scenario.players[0], finalPoints: 40 }, scenario.players[1]] }
    expect(liveSimAt(1, s2).games[0].players[0].points).toBe(40)
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npm test -- liveSim` → FAIL.

- [ ] **Step 3: Implement `app/demo/lib/liveSim.ts`**

```ts
import type { LiveScenario, ScenarioPlayer } from './liveScenario'

export interface LivePlayerFrame {
  playerId: string; name: string; pos: string; nflTeam: string; headshotUrl: string | null
  points: number; projected: number; event: string | null
  leagueChips: { leagueName: string; starting: boolean }[]
}
export interface LiveMatchupFrame { leagueName: string; myScore: number; oppScore: number; myProjected: number; oppProjected: number }
export interface LiveGameFrame { away: string; home: string; awayScore: number; homeScore: number; period: number; clock: string; players: LivePlayerFrame[] }
export interface LiveSimFrame { games: LiveGameFrame[]; matchups: LiveMatchupFrame[] }

const clamp01 = (t: number) => Math.max(0, Math.min(1, t))
const round1 = (n: number) => Math.round(n * 10) / 10
const EVENT_HALF_WINDOW = 0.02 // ± around each event moment

function activeEvent(p: ScenarioPlayer, t: number): string | null {
  if (p.tdCount <= 0) return null
  for (let k = 1; k <= p.tdCount; k++) {
    const moment = k / (p.tdCount + 1)
    if (Math.abs(t - moment) <= EVENT_HALF_WINDOW) return p.eventLabel
  }
  return null
}

/** Pure: the live frame at clock fraction t (0..1), reading ONLY the scenario. */
export function liveSimAt(t: number, scenario: LiveScenario): LiveSimFrame {
  const tt = clamp01(t)
  const framePlayer = (p: ScenarioPlayer): LivePlayerFrame => ({
    playerId: p.playerId, name: p.name, pos: p.pos, nflTeam: p.nflTeam, headshotUrl: p.headshotUrl,
    points: round1(p.finalPoints * tt), projected: p.finalPoints, event: activeEvent(p, tt),
    leagueChips: [{ leagueName: scenario.featuredLeagueName, starting: p.starting }],
  })

  const games: LiveGameFrame[] = scenario.games.map((g, gi) => {
    const gp = scenario.players.filter((p) => p.gameId === g.id)
    return {
      away: g.away, home: g.home,
      awayScore: Math.round((7 + gi * 3) * tt), homeScore: Math.round((10 + gi * 2) * tt),
      period: Math.min(4, Math.floor(tt * 4) + 1),
      clock: `${14 - Math.floor((tt * 4 % 1) * 14)}:00`,
      players: gp.map(framePlayer),
    }
  })

  const starters = scenario.players.filter((p) => p.starting)
  const myScore = round1(starters.reduce((s, p) => s + p.finalPoints * tt, 0))
  const myProjected = round1(starters.reduce((s, p) => s + p.finalPoints, 0))
  const matchups: LiveMatchupFrame[] = scenario.matchups.map((m) => ({
    leagueName: m.leagueName, myScore, myProjected,
    oppScore: round1(m.oppFinal * tt), oppProjected: m.oppProjected,
  }))

  return { games, matchups }
}
```

- [ ] **Step 4: Run to verify pass** — `npm test -- liveSim` → PASS.

- [ ] **Step 5: Commit**
```bash
git add app/demo/lib/liveSim.ts app/demo/lib/liveSim.test.ts
git commit -m "feat(live): pure liveSimAt engine (scenario-driven, ramps + event flashes)"
```

---

## Task 3: `LiveCompanion` surface

**Files:** Create `app/demo/studio/live/LiveCompanion.tsx`, `app/demo/studio/live/LiveCompanion.test.tsx`

**Interfaces:** `<LiveCompanion frame={LiveSimFrame} />` — faithful LIVE tab.

- [ ] **Step 1: Write failing test** `app/demo/studio/live/LiveCompanion.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LiveCompanion } from './LiveCompanion'
import type { LiveSimFrame } from '@/app/demo/lib/liveSim'

const frame: LiveSimFrame = {
  games: [{ away: 'BUF', home: 'MIA', awayScore: 14, homeScore: 10, period: 3, clock: '8:00', players: [
    { playerId: 'a', name: 'Star RB', pos: 'RB', nflTeam: 'BUF', headshotUrl: null, points: 18.4, projected: 24, event: 'TD', leagueChips: [{ leagueName: "Lawrence's Legends", starting: true }] },
  ] }],
  matchups: [{ leagueName: "Lawrence's Legends", myScore: 92.1, oppScore: 88.0, myProjected: 118, oppProjected: 114 }],
}

describe('LiveCompanion', () => {
  it('renders LIVE NOW, a game header, a player row, and the matchup rail', () => {
    render(<LiveCompanion frame={frame} />)
    expect(screen.getByText('LIVE NOW')).toBeTruthy()
    expect(screen.getByText(/BUF 14 – MIA 10 · Q3 8:00/)).toBeTruthy()
    expect(screen.getByText('Star RB')).toBeTruthy()
    expect(screen.getByText('18.4')).toBeTruthy()
    expect(screen.getByText(/Your matchups/i)).toBeTruthy()
    expect(screen.getByText('92.1')).toBeTruthy()
  })
  it('shows the event flash when a player has an active event', () => {
    render(<LiveCompanion frame={frame} />)
    expect(screen.getByText(/TD/)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npm test -- LiveCompanion` → FAIL.

- [ ] **Step 3: Implement `app/demo/studio/live/LiveCompanion.tsx`** (faithful to `app/(dashboard)/live/page.tsx`):

```tsx
'use client'
import type { LiveSimFrame, LivePlayerFrame } from '@/app/demo/lib/liveSim'

function PlayerRow({ p }: { p: LivePlayerFrame }) {
  const ring = p.event ? 'var(--live)' : 'transparent'
  return (
    <div className="w-full flex items-center gap-3 px-3 py-2.5 text-left" style={{ borderTop: '1px solid var(--hairline)', backgroundColor: 'rgba(8,15,26,0.6)' }}>
      <img src={p.headshotUrl ?? ''} alt={p.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0"
        style={{ backgroundColor: 'var(--glass-solid)', border: `2px solid ${ring}`, transition: 'border-color 1s' }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }} />
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium text-white truncate block">{p.name}</span>
        <p className="text-xs" style={{ color: 'var(--t3)' }}>{p.pos} · {p.nflTeam}</p>
        <div className="flex flex-wrap gap-1 mt-1">
          {p.leagueChips.map((l, i) => (
            <span key={i} className="mono-data text-[8.5px] font-semibold px-1.5 py-0.5 rounded-full"
              style={l.starting ? { color: 'var(--signal)', border: '1px solid rgba(75,163,245,.4)', backgroundColor: 'var(--signal-dim)' } : { color: 'var(--t3)', border: '1px solid var(--hairline)' }}>
              {l.leagueName}
            </span>
          ))}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p key={`p:${p.playerId}:${p.points}`} className="mono-data text-lg font-bold score-tick-up" style={{ color: 'var(--t1)' }}>{p.points.toFixed(1)}</p>
        <p className="mono-data text-[9.5px]" style={{ color: 'var(--t4)' }}>proj {p.projected.toFixed(1)}</p>
        {p.event && <p className="mono-data text-[9.5px] font-semibold tracking-wide mt-0.5" style={{ color: 'var(--live)' }}>+6.0 {p.event}</p>}
      </div>
    </div>
  )
}

export function LiveCompanion({ frame }: { frame: LiveSimFrame }) {
  return (
    <div className="max-w-2xl mx-auto px-5 md:px-6 pt-6 pb-10">
      <p className="mono-data text-[10px] tracking-widest uppercase mb-2" style={{ color: 'var(--t3)' }}>Live now</p>
      <div className="grid gap-3 md:grid-cols-2 mb-6">
        {frame.games.map((g, i) => (
          <div key={i} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--hairline)' }}>
            <p className="mono-data text-[10px] px-3 py-1.5" style={{ color: 'var(--t3)', backgroundColor: 'rgba(6,11,19,0.5)' }}>
              {g.away} {g.awayScore} – {g.home} {g.homeScore} · Q{g.period} {g.clock}
            </p>
            {g.players.map((p) => <PlayerRow key={p.playerId} p={p} />)}
          </div>
        ))}
      </div>
      <p className="mono-data text-[10px] tracking-widest uppercase mb-2" style={{ color: 'var(--t3)' }}>Your matchups</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {frame.matchups.map((m, i) => (
          <div key={i} className="rounded-lg px-3 py-2 flex-shrink-0" style={{ border: '1px solid var(--hairline)', minWidth: 150 }}>
            <p className="mono-data text-[9px] uppercase" style={{ color: 'var(--t3)' }}>{m.leagueName}</p>
            <div className="flex items-baseline justify-between mt-1">
              <span key={`me:${m.myScore}`} className="mono-data text-sm font-bold score-tick-up" style={{ color: 'var(--live)' }}>{m.myScore.toFixed(1)}</span>
              <span className="mono-data text-[9px]" style={{ color: 'var(--t4)' }}>vs</span>
              <span className="mono-data text-sm" style={{ color: 'var(--t3)' }}>{m.oppScore.toFixed(1)}</span>
            </div>
            <div className="flex items-baseline justify-between mt-0.5">
              <span className="mono-data text-[9px]" style={{ color: 'var(--t4)' }}>proj {m.myProjected.toFixed(1)}</span>
              <span className="mono-data text-[9px]" style={{ color: 'var(--t4)' }}>proj {m.oppProjected.toFixed(1)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run to verify pass** — `npm test -- LiveCompanion` → PASS.

- [ ] **Step 5: Commit**
```bash
git add app/demo/studio/live/LiveCompanion.tsx app/demo/studio/live/LiveCompanion.test.tsx
git commit -m "feat(live): faithful LIVE-tab companion surface"
```

---

## Task 4: `LiveScene` — the full arc

**Files:** Create `app/demo/studio/live/LiveScene.tsx`, `app/demo/studio/live/LiveScene.test.tsx`

**Interfaces:** `<LiveScene scenario aspect frame? />`. Consumes `SceneStage`, `DemoShell`, `StandardState`, `LiveCompanion`, `liveSimAt`.

- [ ] **Step 1: Write failing test** `app/demo/studio/live/LiveScene.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LiveScene } from './LiveScene'
import { prefillLiveScenario } from '@/app/demo/lib/liveScenario'

describe('LiveScene', () => {
  const scenario = prefillLiveScenario()
  it('shows the calm/sweep OS early (MISSION CONTROL, no LIVE NOW yet)', () => {
    render(<LiveScene scenario={scenario} aspect="16:9" frame={30} />)
    expect(screen.getByText('MISSION CONTROL')).toBeTruthy()
    expect(screen.queryByText('Live now')).toBeNull()
  })
  it('shows the LIVE companion after it opens', () => {
    render(<LiveScene scenario={scenario} aspect="16:9" frame={400} />)
    expect(screen.getByText('Live now')).toBeTruthy()
    expect(screen.getByText(scenario.players[0].name)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npm test -- LiveScene` → FAIL.

- [ ] **Step 3: Implement `app/demo/studio/live/LiveScene.tsx`**

```tsx
'use client'
import { SceneStage } from '@/components/marketing/scenes/SceneStage'
import { DemoShell } from '@/app/demo/components/DemoShell'
import { StandardState } from '@/app/demo/components/StandardState'
import { LiveCompanion } from './LiveCompanion'
import { liveSimAt } from '@/app/demo/lib/liveSim'
import type { LiveScenario } from '@/app/demo/lib/liveScenario'

const DURATION = 750
const SWEEP_START = 90, SWEEP_END = 144, OPEN_END = 240

export function LiveScene({ scenario, aspect, frame }: { scenario: LiveScenario; aspect: '16:9' | '9:16'; frame?: number }) {
  return (
    <SceneStage durationFrames={DURATION} caption="Rostiro LIVE — your second-screen companion." staticFrame={500} frame={frame}>
      {(f) => {
        const sweeping = f >= SWEEP_START && f < SWEEP_END
        const live = f >= OPEN_END
        const t = live ? Math.min(1, (f - OPEN_END) / (DURATION - OPEN_END - 60)) : 0
        return (
          <DemoShell variant="contained" stateOverride="game_day" sweeping={sweeping}>
            {live
              ? <LiveCompanion frame={liveSimAt(t, scenario)} />
              : <StandardState missionControl sweeping={sweeping} />}
          </DemoShell>
        )
      }}
    </SceneStage>
  )
}
```

- [ ] **Step 4: Run to verify pass** — `npm test -- LiveScene` → PASS.

- [ ] **Step 5: Commit**
```bash
git add app/demo/studio/live/LiveScene.tsx app/demo/studio/live/LiveScene.test.tsx
git commit -m "feat(live): full-arc LiveScene (calm -> sweep -> LIVE opens -> playing)"
```

---

## Task 5: `LiveAuthorForm` (override form)

**Files:** Create `app/demo/studio/live/LiveAuthorForm.tsx`, `app/demo/studio/live/LiveAuthorForm.test.tsx`

**Interfaces:** `<LiveAuthorForm content={LiveScenario} onChange={(s)=>void} />` — controlled, immutable.

- [ ] **Step 1: Write failing test** `app/demo/studio/live/LiveAuthorForm.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LiveAuthorForm } from './LiveAuthorForm'
import { prefillLiveScenario } from '@/app/demo/lib/liveScenario'

describe('LiveAuthorForm', () => {
  it('editing a player name and a matchup oppFinal propagates via onChange', () => {
    const sc = prefillLiveScenario()
    const onChange = vi.fn()
    render(<LiveAuthorForm content={sc} onChange={onChange} />)
    fireEvent.change(screen.getByDisplayValue(sc.players[0].name), { target: { value: 'Custom Star' } })
    expect(onChange.mock.calls.at(-1)![0].players[0].name).toBe('Custom Star')
    fireEvent.change(screen.getByDisplayValue(String(sc.matchups[0].oppFinal)), { target: { value: '99' } })
    expect(onChange.mock.calls.at(-1)![0].matchups[0].oppFinal).toBe(99)
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npm test -- LiveAuthorForm` → FAIL.

- [ ] **Step 3: Implement `app/demo/studio/live/LiveAuthorForm.tsx`**

```tsx
'use client'
import type { LiveScenario } from '@/app/demo/lib/liveScenario'

const input = { width: '100%', background: 'rgba(8,15,26,.6)', border: '1px solid var(--hairline)', borderRadius: 8, padding: '6px 8px', color: 'var(--t1)', fontSize: 13 } as const
const lbl = { fontSize: 11, color: 'var(--t3)' } as const

export function LiveAuthorForm({ content, onChange }: { content: LiveScenario; onChange: (s: LiveScenario) => void }) {
  const setP = (i: number, patch: Partial<LiveScenario['players'][number]>) =>
    onChange({ ...content, players: content.players.map((p, j) => (j === i ? { ...p, ...patch } : p)) })
  const setM = (i: number, patch: Partial<LiveScenario['matchups'][number]>) =>
    onChange({ ...content, matchups: content.matchups.map((m, j) => (j === i ? { ...m, ...patch } : m)) })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label className="mono-data" style={lbl}>Featured players (editable)</label>
      {content.players.map((p, i) => (
        <div key={p.playerId} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input style={{ ...input, flex: 2 }} value={p.name} onChange={(e) => setP(i, { name: e.target.value })} />
          <input style={{ ...input, width: 48 }} value={p.nflTeam} onChange={(e) => setP(i, { nflTeam: e.target.value })} />
          <input style={{ ...input, width: 58 }} type="number" step="0.1" value={p.finalPoints} onChange={(e) => setP(i, { finalPoints: Number(e.target.value) })} />
          <input style={{ ...input, width: 40 }} type="number" value={p.tdCount} onChange={(e) => setP(i, { tdCount: Number(e.target.value) })} />
          <input style={{ ...input, width: 80 }} value={p.eventLabel} onChange={(e) => setP(i, { eventLabel: e.target.value })} />
          <button aria-label="Remove" onClick={() => onChange({ ...content, players: content.players.filter((_, j) => j !== i) })} style={{ color: 'var(--t3)' }}>✕</button>
        </div>
      ))}
      <label className="mono-data" style={lbl}>Matchups (opponent final)</label>
      {content.matchups.map((m, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input style={{ ...input, flex: 2 }} value={m.leagueName} onChange={(e) => setM(i, { leagueName: e.target.value })} />
          <input style={{ ...input, width: 70 }} type="number" step="0.1" value={m.oppFinal} onChange={(e) => setM(i, { oppFinal: Number(e.target.value), oppProjected: Number(e.target.value) })} />
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run to verify pass** — `npm test -- LiveAuthorForm` → PASS.

- [ ] **Step 5: Commit**
```bash
git add app/demo/studio/live/LiveAuthorForm.tsx app/demo/studio/live/LiveAuthorForm.test.tsx
git commit -m "feat(live): LiveScenario override form (target-based, no keyframes)"
```

---

## Task 6: Studio wiring + gate + smoke

**Files:** Modify `app/demo/studio/StudioPanel.tsx`, `app/demo/studio/StudioCanvas.tsx`, `app/demo/studio/Studio.tsx`, `app/demo/studio/Studio.test.tsx`

- [ ] **Step 1: `StudioPanel.tsx`** — add `'live'` to `PanelState` and the `STATES` array (`{ key: 'live', label: 'Live' }`, after Film Room). Import `LiveAuthorForm` + `LiveScenario`. Add a branch: when `state === 'live'`, render `<LiveAuthorForm content={packContent as LiveScenario} onChange={onPackChange as (s: LiveScenario) => void} />` (instead of the `pack.AuthorForm`). Keep `game_day` + surface-pack branches unchanged.

- [ ] **Step 2: `StudioCanvas.tsx`** — add `'live'` to `CanvasState`. Import `LiveScene` + `LiveScenario`. Add a branch BEFORE the surface-pack branches: when `state === 'live'`, render `<LiveScene scenario={content as LiveScenario} aspect={aspect} />` inside the canvas frame div (the `aspectRatio`/`maxWidth` wrapper already there). Keep `game_day` + pack branches unchanged.

- [ ] **Step 3: `Studio.tsx`** — add `'live'` to `PanelState`. Import `prefillLiveScenario`. In `selectState(s)`: when `s === 'live'`, `setPackContent(prefillLiveScenario())` (alongside the existing `SURFACE_PACKS[s].prefill()` path for surface states — `live` is special like `game_day`, so branch it explicitly). Pass `content={packContent}` to `StudioCanvas` (already passed).

- [ ] **Step 4: Extend `Studio.test.tsx`**:

```tsx
  it('switching to Live plays the companion scene with the prefilled scenario', () => {
    render(<Studio />)
    fireEvent.click(screen.getByText('Live'))
    // The LiveScene mounts; at its static frame the companion is visible.
    expect(screen.getByText('Live now')).toBeTruthy()
  })
```
(Keep existing Studio tests. Note: SceneStage's static frame default renders a representative live frame, so `Live now` shows without a running clock.)

- [ ] **Step 5: Run** — `npm test -- "app/demo/studio/Studio"` → PASS. Then FULL `npm test` (all 6 new suites + existing green).

- [ ] **Step 6: Full gate** — `npm test && npm run build` → all pass; build exit 0; `/demo/studio` in route list.

- [ ] **Step 7: Manual smoke** — `npm run dev`, open `http://localhost:3000/demo/studio`, select **Live**: the OS sweeps into Game Day, LIVE opens, players' points tick up with TD flashes, matchup rail swings; edit a player's name/finalPoints and a matchup oppFinal in the panel → reflected live; toggle 16:9/9:16.

- [ ] **Step 8: Commit**
```bash
git add app/demo/studio/StudioPanel.tsx app/demo/studio/StudioCanvas.tsx app/demo/studio/Studio.tsx app/demo/studio/Studio.test.tsx
git commit -m "feat(live): wire the Live companion into the Simulation Studio"
```

---

## Self-Review

**Spec coverage:** authorable `LiveScenario` + prefill → Task 1 ✅ · pure `liveSimAt(t,scenario)` → Task 2 ✅ · faithful `LiveCompanion` → Task 3 ✅ · full-arc `LiveScene` → Task 4 ✅ · override form → Task 5 ✅ · Studio `'live'` state → Task 6 ✅ · all 6 test suites → one per task ✅ · keyframe/scrubbing excluded (engine is target-based only) ✅.

**Placeholder scan:** none — complete code throughout; the only "read the file" steps are the Task-6 wiring edits (locate the existing `game_day` branch and mirror it), flagged explicitly.

**Type consistency:** `LiveScenario`/`ScenarioPlayer` (Task 1) consumed by `liveSimAt` (Task 2), `LiveScene`/`LiveAuthorForm` (Tasks 4/5), and the Studio (Task 6). `LiveSimFrame` (Task 2) consumed by `LiveCompanion` (Task 3) + `LiveScene` (Task 4). `DemoShell variant/stateOverride/sweeping` + `StandardState missionControl/sweeping` (shipped) reused by `LiveScene`. `SceneStage frame/staticFrame` (shipped) reused. `packContent` plumbing (shipped, Waiver/Film) reused for the scenario.

**Honesty:** identities + finals prefill from real 2024; overrides are target-based; timing is dramatized and named. No `Math.random`/network in engine or prefill.
