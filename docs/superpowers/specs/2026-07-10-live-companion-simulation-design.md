# LIVE Second-Screen Companion Simulation (Phase 1) — Design Spec

**Date:** 2026-07-10
**Status:** Approved design → ready for implementation plan
**Builds on:** the Simulation Studio (state selector + canvas + aspect toggle), `SceneStage` frame clock, `DemoShell` contained OS, and the 2024 anchor-week fixtures (`week.json`, `demoLeagues`, `players.json`).

**Scope:** A self-playing, capture-ready simulation of Rostiro's **LIVE second-screen companion tab**, added as a new **"Live" state** in the Simulation Studio. It replays 2024 anchor-week 8 as a compressed ~20–30s Sunday: the OS transforms (calm → kickoff sweep → LIVE opens), then the founder's rostered players' points **tick up** from real box scores, TDs flash, and matchup scores swing. Loops; renders in 16:9 and 9:16 for social capture. **The scene is driven by an authorable `LiveScenario` object** (hybrid: prefilled from real 2024, then fully editable via a basic override form — custom names, final scores, captions), so the operator can compose custom-narrative clips. This is a marquee Sunday-marketing asset showcasing how versatile the OS is and how good the live companion feels.

**Authoring boundary (deliberate):** overrides set the *targets the animation ramps toward* (a player's final points, the opponent's final, names, captions) — the clock still animates to whatever you type. **Per-frame / keyframe control** ("at 0:14 the score is exactly X" / scrubbing to hand-place values) is explicitly OUT of Phase 1 — that's a mini video-editor and would blow the timeline. Architecting the engine to take a `LiveScenario` now is what keeps the override form cheap and avoids a costly retrofit later.

## Goal

In `/demo/studio`, selecting **Live** plays a deterministic ~25s highlight loop: the Game-Day OS sweeps into `MISSION CONTROL`, the LIVE tab unlocks, and a faithful LIVE companion fills with real-2024 players whose points ramp up, with TD ring-flashes and swinging matchup scores — hands-off, loopable, capturable.

## What is real vs. simulated (honesty)

- **Real:** every player's identity + **final week-8 points and stat line** (`week.json`, 189 box scores), matchup opponents/league names (`demoLeagues`), player headshots (`players.json`).
- **Simulated (editorial):** the *intra-game timing* — how points accrue across the compressed clock and when each TD "fires" — because the box-score feed has no play-by-play. Same editorial-timing posture as the rest of the studio. Final numbers are real; the pacing is dramatized (fast highlight reel).

## Architecture

```
app/demo/lib/liveScenario.ts       # LiveScenario type + prefillLiveScenario() from real 2024 (+ test)
app/demo/lib/liveSim.ts            # pure scoring engine: liveSimAt(t, scenario) (+ test)
app/demo/studio/live/LiveCompanion.tsx   # faithful LIVE-tab surface (props: LiveSimFrame)
app/demo/studio/live/LiveScene.tsx       # full-arc self-playing scene (SceneStage clock, takes scenario)
app/demo/studio/live/LiveAuthorForm.tsx  # basic override form editing a LiveScenario
app/demo/studio/StudioCanvas.tsx   # + 'live' branch renders LiveScene from scenario
app/demo/studio/StudioPanel.tsx    # + 'Live' in selector; renders LiveAuthorForm
app/demo/studio/Studio.tsx         # + 'live' state wiring (holds the scenario as packContent)
```

### 1. Authorable scenario — `app/demo/lib/liveScenario.ts`
The single source the whole scene reads. Prefilled from real 2024, then fully editable by the override form.
```ts
export interface ScenarioGame { id: string; away: string; home: string }
export interface ScenarioPlayer {
  playerId: string; name: string; pos: string; nflTeam: string
  finalPoints: number            // the target the ramp animates TO (real week-8 by default; editable)
  tdCount: number                // # of TD flashes distributed across the clock (real from stat line; editable)
  eventLabel: string             // flash label, default 'TD' (editable — e.g. 'HOUSE CALL')
  gameId: string                 // which ScenarioGame this row lives under
  starting: boolean              // starter vs bench chip on the founder's league
}
export interface ScenarioMatchup { leagueName: string; oppFinal: number; oppProjected: number }
export interface LiveScenario {
  featuredLeagueName: string
  games: ScenarioGame[]
  players: ScenarioPlayer[]      // ~6–9 featured players across the games
  matchups: ScenarioMatchup[]
}

/** Prefill from real fixtures: founder roster ∩ week.json, grouped into ~2–3 marquee wk8 games,
 *  finalPoints/tdCount/name/team from real data; opponent finals authored for a dramatic late win. */
export function prefillLiveScenario(): LiveScenario
```
All player identities/points prefill from real 2024 (`players.json` + `week.json`, founder roster from `demoLeagues[0]`); game groupings + opponent finals are authored for drama. Deterministic (no `Math.random`).

### 2. Live-scoring engine — `app/demo/lib/liveSim.ts` (pure, tested)
```ts
export interface LivePlayerFrame {
  playerId: string; name: string; pos: string; nflTeam: string
  points: number; projected: number
  event: string | null          // the eventLabel flashing at this clock, else null
  leagueChips: { leagueName: string; starting: boolean }[]
}
export interface LiveMatchupFrame { leagueName: string; myScore: number; oppScore: number; myProjected: number; oppProjected: number }
export interface LiveGameFrame { away: string; home: string; awayScore: number; homeScore: number; period: number; clock: string; players: LivePlayerFrame[] }
export interface LiveSimFrame { games: LiveGameFrame[]; matchups: LiveMatchupFrame[] }

export function liveSimAt(t: number, scenario: LiveScenario): LiveSimFrame   // t in [0,1] = playing-window fraction
```
- **Points ramp:** `points = round(finalPoints * clamp(t,0,1), 1)`; `projected = finalPoints` (the "proj" a live tab shows).
- **Event moments:** distribute `tdCount` flashes across `t` (at `k/(tdCount+1)`); `event = eventLabel` is active within a small window around each moment (drives the ring flash + `+{delta} {eventLabel}` label). `tdCount = 0` → never flashes.
- **Matchup:** `myScore` = sum of the featured league's **starting** players' current `points`; `oppScore = round(oppFinal * t, 1)`; `myProjected` = sum of starters' `finalPoints`, `oppProjected = oppFinal`.
- **Game clock:** `period = min(4, floor(t*4)+1)`; `clock` = a formatted countdown within the quarter; `awayScore/homeScore` = illustrative NFL scores ramping with `t`.
- Pure/deterministic — reads ONLY the passed `scenario`, no fixtures, no `Math.random`, no network. Fully unit-tested.

### 2a. Override form — `app/demo/studio/live/LiveAuthorForm.tsx`
A basic controlled form editing the `LiveScenario` (the same pattern as the Waiver/Film author forms): per featured player — editable `name`, `nflTeam`, `finalPoints`, `tdCount`, `eventLabel`, `starting`; per matchup — editable `leagueName`, `oppFinal`; add/remove a featured player. No timeline/keyframe UI (out of scope). Prefilled via `prefillLiveScenario()`; every field overridable for custom-narrative clips.

### 3. `LiveCompanion` surface — `app/demo/studio/live/LiveCompanion.tsx`
Faithful reproduction of the real `app/(dashboard)/live/page.tsx` LIVE view, props-driven from a `LiveSimFrame`:
- Header `LIVE NOW`; games as bordered groups with `AWAY {s} – HOME {s} · Q{period} {clock}`.
- Per-player row: headshot with **event ring** (`var(--live)` on active TD, else transparent, `transition: border-color 1s`), name, `{pos} · {team}`, league chips (starting = signal border, bench = hairline), right-aligned **points** with `score-tick-up` class when they changed this frame, `proj {projected}`, and a `+6.0 TD` flash when `event`.
- **"Your matchups"** rail: per league `myScore` (live-green, `score-tick-up`) vs `oppScore`, + `proj`.
- Reuses the real CSS animations (`score-tick-up`/`score-tick-down`) and tokens verbatim.

### 4. `LiveScene` — the full arc — `app/demo/studio/live/LiveScene.tsx`
Props: `{ scenario: LiveScenario; aspect: '16:9'|'9:16'; frame?: number }`. Drives the ~25s loop over a `SceneStage` frame clock (30fps, ~750 frames), rendering inside `DemoShell variant="contained"`:
| Beat | Frames (~) | What |
|---|---|---|
| Calm Game-Day OS | 0–90 | resting `MISSION CONTROL` / pre-kick |
| Kickoff sweep | 90–144 | blue→red sweep + `MISSION CONTROL` flicker (reuse `kickoff-sweep`) |
| LIVE opens | 144–240 | live-unlock reveal; `LiveCompanion` mounts at `t≈0` (0 points) |
| Playing | 240–690 | `LiveCompanion content={liveSimAt(t, scenario)}` with `t = (frame-240)/450`; points ramp, events flash, scores swing |
| Hold + loop | 690–750 | final state, then loop |

Exposes an optional `frame?` override (deterministic tests + capture), same pattern as the feature scenes. Renders a compact focal framing at 9:16 (a single featured game + matchup) and the full companion at 16:9.

### 5. Studio integration
- `StudioPanel`: add **Live** to the state selector. For `live`, the panel renders `<LiveAuthorForm content={scenario} onChange={...} />` (editing the scenario). Play/pause is inherent to the loop.
- `StudioCanvas`: add a `state === 'live'` branch rendering `<LiveScene scenario={content} aspect={aspect} />` inside the canvas frame (its own clock; the aspect toggle picks full vs focal layout).
- `Studio`: register `live` in the selector state; selecting it loads `prefillLiveScenario()` into `packContent` (reusing the existing `packContent`/`onPackChange` plumbing the Waiver/Film packs already use). Edits flow scenario → `LiveScene` live.

## Fidelity anchors (verified against `app/(dashboard)/live/page.tsx`)
- Game group header `{away} {score} – {home} {score} · Q{period} {clock}`.
- Player row: headshot ring (TD = `var(--live)`, `transition: border-color 1s`), `score-tick-up` on the points `<p>`, `proj {n}` in `var(--t4)`, event flash `+{delta} TD` in `var(--live)`.
- Matchup rail: `myScore` in `var(--live)` with `score-tick-up`, `oppScore` in `var(--t3)`, `proj` line in `var(--t4)`, `minWidth: 150`.
- League chips: starting = `var(--signal)` + `var(--signal-dim)`; bench = `var(--t3)` + hairline.

## Capture ergonomics
- Aspect toggle: 16:9 shows the full companion (games + matchup rail); 9:16 shows a focal layout (one featured game + the matchup) centered.
- Hide-controls (existing) frames a clean canvas; deterministic loop → reproducible takes.

## Testing
- `liveScenario.test.ts`: `prefillLiveScenario()` — featured player ids exist in `players.json`/`week.json`; `finalPoints`/`tdCount` derive from real data; games reference real teams; ≥6 players.
- `liveSim.test.ts`: given a scenario, `points` is 0 at `t=0`, `finalPoints` at `t=1`, monotonic non-decreasing; a player with `tdCount:2` has exactly 2 event windows across `t`; matchup `myScore` = summed starting players' points at `t`; `oppScore` ramps 0→`oppFinal`; a **custom `eventLabel`** ('HOUSE CALL') surfaces as the frame's `event`; an override (custom `finalPoints`) is reflected in the ramp — proving the engine reads only the scenario.
- `LiveCompanion.test.tsx`: given a `LiveSimFrame`, renders `LIVE NOW`, a game header, a player row with points, and the matchup rail; an active `event` renders the `+ {label}` flash.
- `LiveAuthorForm.test.tsx`: editing a player's `name`/`finalPoints` and a matchup's `oppFinal` propagates via `onChange` (controlled, immutable).
- `LiveScene.test.tsx`: at a post-open frame shows the companion (a player name + `LIVE NOW`) from the passed scenario; at an early frame shows the calm/sweep OS.
- Studio wiring: selecting **Live** renders the scene (a `LIVE NOW` assertion) with the prefilled scenario; a custom player name typed in the form appears on the canvas.

## Out of scope (fast-follows)
- **Per-frame / keyframe authoring**: hand-placing a value at a specific clock time, scrubbing, speed toggle — the mini-video-editor path. (Basic *target* overrides ARE in Phase 1; keyframes are not.)
- Interactivity: tap-a-player → Player Intelligence Card, live box-score drawer.
- The `CLAUDE RECAP` card and the "Player updates" section of the real LIVE tab.
- Wake-lock / idle-dim second-screen behaviors (real-tab only).
- A standalone `/demo/live` route (Phase 1 lives inside the Studio "Live" state).
