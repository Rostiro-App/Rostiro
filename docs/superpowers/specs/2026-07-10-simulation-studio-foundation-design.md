# Simulation Studio (Platform Sandbox) — Foundation Design Spec

**Date:** 2026-07-10
**Status:** Approved design → ready for implementation plan
**Supersedes:** `2026-07-10-cross-league-td-injector-design.md` (its engine, demo-league fixtures, and card carry forward, reframed under the Studio).

**Scope:** Build the foundation of a **Simulation Studio** inside Rostiro — an honest, gated Platform Sandbox that lets the operator author and fire simulated Rostiro OS "moments" (starting with the cross-league touchdown/interrupt card) for screen-capture, using a **hybrid authoring model** (real-prefill + full editorial override). Purpose: produce unlimited website-demo / social / pre-season marketing content that showcases the real product surfaces. Phase 1 delivers the studio shell + the interrupt "moment" card fully; the architecture is an extensible event registry so big plays, roster-exposure, and other card types are additive later.

## What is real vs. simulated (honesty contract)

This sandbox must be honest about what it is, because its output is marketing.

- **Genuinely real (shared with production):** the interrupt card is rendered by `InterruptCardView`, a presentational component **extracted from the shipped `components/InterruptStack.tsx`** and used by both the live app and the Studio. Real `players.json` data. Real `winProb` math for the prefill.
- **Faithful reproductions (not the literal prod shell):** `DemoShell` and `PulseFeed` are the reproductions built in the demo work; the real shell (`AppShell`/`SystemBar`) is Supabase/live-API-coupled and cannot run in isolation. The Studio renders inside these faithful surfaces.
- **Simulated / authored (not yet live for real users):** cross-league win-probability metric rows on the interrupt card are authored/prefilled here but are **not yet wired into the live Game Day pipeline** (that is Project A, the fast-follow). Any operator override (custom league names like "Bench Regret FC", custom labels like "Pain Index", hand-edited numbers) is explicitly editorial and not computed.

The spec names this so marketing framing is a conscious choice, not an accident.

## Architecture

```
app/demo/studio/page.tsx                 # /demo/studio — gated authoring surface (canvas + panel)
app/demo/studio/StudioPanel.tsx          # authoring controls (right side, outside the capture frame)
app/demo/studio/StudioCanvas.tsx         # capture canvas: DemoShell + PulseFeed + fired moment
app/demo/lib/simEvents.ts                # SimEvent types + event registry (extensible)
app/demo/lib/demoLeagues.ts              # 3-league roster + live-matchup fixture (from seed spec)
app/demo/lib/crossLeagueImpact.ts        # pure winProb cross-league engine (from seed spec)
components/interrupt/InterruptCardView.tsx  # presentational card EXTRACTED from InterruptStack (shared)
components/InterruptStack.tsx             # refactor to render InterruptCardView (no behavior change)
```

### 1. Gated Studio surface — `/demo/studio`
- Gating identical to the Director's Console: render only when `process.env.NODE_ENV === 'development'` **or** `?studio=true`. (No new auth surface.)
- Layout: a **capture canvas** (left/center) showing the faithful OS (`DemoShell` + `PulseFeed`) with the fired moment overlaid, and an **authoring panel** (right) with the controls. The panel is visually separate and toggle-hideable (`H` key / a "Hide controls" button) so the operator can frame just the canvas when recording. Canvas has a clean, fixed aspect option (16:9 / 9:16 toggle for TikTok/Reels vs landscape).

### 2. Event model + registry — `app/demo/lib/simEvents.ts`
An extensible registry so Phase 1 ships the interrupt "moment" and later kinds slot in without rework:

```ts
export type SimEventKind = 'interrupt'   // Phase 1. Future: 'roster_exposure', ...
export interface SimMetricRow { leagueName: string; label: string; value: string; deltaPositive?: boolean }
export interface InterruptSimEvent {
  kind: 'interrupt'
  eventLabel: string           // freeform: 'TOUCHDOWN' (default), '66-YARD BOMB', 'INTERCEPTION'
  playerLine: string           // 'Amon-Ra St. Brown · WR · DET' — prefilled from player pick, editable
  points: number | null        // drives prefill; may be null for non-scoring moments
  metrics: SimMetricRow[]       // hybrid: prefilled from engine, fully editable/reorderable
  autoDismissMs: number | null  // 7000 default (real InterruptStack value); null = hold until cleared (filming)
}
export type SimEvent = InterruptSimEvent
```
The registry maps `kind → { defaultEvent, AuthorForm, render() }`. Phase 1 registers only `interrupt`.

### 3. Hybrid authoring (the core of Phase 1)
The interrupt author form:
- **Player search (real):** autocomplete over `players.json` by name substring → dropdown `{name · pos · team}`; selecting sets `playerLine`.
- **Event label (freeform):** text, default `TOUCHDOWN` (covers big plays: type `66-YARD BOMB`).
- **Points (real driver):** number, default `6.0`.
- **Prefill (real math):** on player+points, compute `computeInjectionImpact(playerId, points, DEMO_LEAGUES)` and populate `metrics` as real winProb rows (`{ leagueName, label: 'Win Prob', value: '+18%', deltaPositive: true }`) for each league the player is rostered in.
- **Full editorial override:** every `metrics` row is editable — rename `leagueName` to anything ("Bench Regret FC"), change `value` by hand, swap `label` ("Win Prob" → "Pain Index"), toggle `deltaPositive`, reorder, add a blank row, delete a row. The player line and event label are editable too.
- **Fire / Reset:** "Fire" sets the canvas's active event (animates the card in); "Reset" restores the last prefill. Auto-dismiss control: default 7000ms, or "Hold" for filming.

### 4. Shared real interrupt card — `components/interrupt/InterruptCardView.tsx`
- Extract the shipped `InterruptStack` card's presentational JSX into `InterruptCardView` (props-only, no polling/state). `components/InterruptStack.tsx` is refactored to render `InterruptCardView` with its existing data — **zero behavior/visual change to the live app** (verified by its existing rendering; a snapshot-style test guards it).
- `InterruptCardView` gains an **optional** `metrics?: SimMetricRow[]` prop. When absent (all current live usage), it renders exactly as today. When present (Studio, and later Project A), it renders the hero cross-league layout: big per-row `▲ {value}` deltas + `{label.toUpperCase()} · {N} OF YOUR LEAGUES` divider + per-league `{leagueName} — {value}` chips. Chosen "hero delta + league chips" layout (camera-first, punchy).
- The card keeps the real card's shell (`glass-heavy`, top-center, `panel-enter`/`card-leave`, priority accent). `autoDismissMs` drives the leave animation timing.

### 5. Canvas rendering — `StudioCanvas.tsx`
Renders `DemoShell variant="contained"` (game-day state for a live moment) wrapping `PulseFeed`, with `InterruptCardView` overlaid top-center when an event is fired. Fired event auto-dismisses per `autoDismissMs` (or holds). Deterministic and clean (no dev-only chrome inside the capture frame).

### 6. Fixtures + engine (carried from the seed spec, unchanged in intent)
- `app/demo/lib/demoLeagues.ts`: 3 leagues (`Lawrence's Legends League`, `Sunday Money`, `The Bit League`), founder rosters from real `players.json` ids with deliberate overlap (core stars on all 3 → a star injection prefills 3 rows), each with a baked tight live matchup `{ myScore, oppScore, secondsRemaining, projMargin }`.
- `app/demo/lib/crossLeagueImpact.ts`: pure `computeInjectionImpact(playerId, points, leagues)` → `LeagueImpact[]` using `winProb` before/after (`marginNow += points`, `projMargin += points`), only for leagues where the player is on the founder roster.

## Data flow
StudioPanel (pick player + points → real prefill via `computeInjectionImpact` → operator overrides names/labels/values freely) → **Fire** → StudioCanvas sets the active `InterruptSimEvent` → `InterruptCardView metrics={...}` animates in over `DemoShell`/`PulseFeed` → auto-dismiss per `autoDismissMs` (or hold for filming).

## Capture ergonomics (it's a filming tool)
- Controls panel hideable (`H`) and outside the capture frame; canvas has a 16:9 / 9:16 toggle.
- "Fire" is repeatable/instant; "Hold" keeps the card up indefinitely for framing; a "Replay" re-runs the enter animation.
- Everything deterministic — no `Math.random`, no live network — so a take is reproducible.

## Testing
- `crossLeagueImpact.test.ts` (pure): star → 3 impacts; single-league player → 1; unrostered → `[]`; larger points → larger delta; pct in `[0,100]`; order preserved.
- `InterruptCardView.test.tsx`: with no `metrics` prop, renders the current real card (label + headline + reasoning), no Snooze/✕ for non-critical; with `metrics`, renders each `▲ value`, the `N OF YOUR LEAGUES` divider, and per-league chips; custom `label` ("Pain Index") and custom `leagueName` ("Bench Regret FC") render verbatim.
- `InterruptStack` guard test: the refactor to use `InterruptCardView` renders identically for a representative live item (label/headline/reasoning present; critical item still shows Snooze/✕).
- `simEvents.ts` test: registry returns the `interrupt` default event; prefill maps a real player+points to real winProb rows; an override mutates only the targeted row.
- StudioPanel test: typing a surname filters the player dropdown; selecting + editing a league name + Fire yields a canvas card showing the edited name and the entered/overridden values.

## Out of scope (fast-follows, each its own spec)
- **Project A:** graduating `winProb` + cross-league impact into the **live Game Day pipeline** so real users see the metric rows on the real Interrupt card (`detectTouchdownSwings` already groups TDs cross-league; `LiveMatchupSummary` already provides the inputs). The shared `InterruptCardView` is built here specifically so A only wires real data into it.
- Additional `SimEventKind`s: `roster_exposure` ("started him in 4 of 5 leagues"), standalone big-play cards, Pulse-feed simulation, Game-Day sweep authoring. The registry is designed for them; Phase 1 does not build them.
- Saving/exporting authored presets, recording/export pipeline, 9:16 layout polish beyond the aspect toggle.
