# LIVE Second-Screen Companion Simulation (Phase 1) — Design Spec

**Date:** 2026-07-10
**Status:** Approved design → ready for implementation plan
**Builds on:** the Simulation Studio (state selector + canvas + aspect toggle), `SceneStage` frame clock, `DemoShell` contained OS, and the 2024 anchor-week fixtures (`week.json`, `demoLeagues`, `players.json`).

**Scope:** A self-playing, capture-ready simulation of Rostiro's **LIVE second-screen companion tab**, added as a new **"Live" state** in the Simulation Studio. It replays 2024 anchor-week 8 as a compressed ~20–30s Sunday: the OS transforms (calm → kickoff sweep → LIVE opens), then the founder's rostered players' points **tick up** from real box scores, TDs flash, and matchup scores swing. Loops; renders in 16:9 and 9:16 for social capture. This is a marquee Sunday-marketing asset showcasing how versatile the OS is and how good the live companion feels.

## Goal

In `/demo/studio`, selecting **Live** plays a deterministic ~25s highlight loop: the Game-Day OS sweeps into `MISSION CONTROL`, the LIVE tab unlocks, and a faithful LIVE companion fills with real-2024 players whose points ramp up, with TD ring-flashes and swinging matchup scores — hands-off, loopable, capturable.

## What is real vs. simulated (honesty)

- **Real:** every player's identity + **final week-8 points and stat line** (`week.json`, 189 box scores), matchup opponents/league names (`demoLeagues`), player headshots (`players.json`).
- **Simulated (editorial):** the *intra-game timing* — how points accrue across the compressed clock and when each TD "fires" — because the box-score feed has no play-by-play. Same editorial-timing posture as the rest of the studio. Final numbers are real; the pacing is dramatized (fast highlight reel).

## Architecture

```
app/demo/lib/liveSim.ts            # pure scoring engine over a 0..1 clock (+ test)
app/demo/lib/liveGames.ts          # featured games + roster grouping fixture (2024 wk8)
app/demo/studio/live/LiveCompanion.tsx   # faithful LIVE-tab surface (props: LiveSimFrame)
app/demo/studio/live/LiveScene.tsx       # full-arc self-playing scene (SceneStage clock)
app/demo/studio/StudioCanvas.tsx   # + 'live' branch renders LiveScene
app/demo/studio/StudioPanel.tsx    # + 'Live' in selector; light controls (feature league, play/pause)
app/demo/studio/Studio.tsx         # + 'live' state wiring
```

### 1. Live-scoring engine — `app/demo/lib/liveSim.ts` (pure, tested)
```ts
export interface LivePlayerFrame {
  playerId: string; name: string; pos: string; nflTeam: string
  points: number; projected: number
  event: 'TD' | null            // an event flash is active at this clock
  leagueChips: { leagueName: string; starting: boolean }[]
}
export interface LiveMatchupFrame { leagueName: string; myScore: number; oppScore: number; myProjected: number; oppProjected: number }
export interface LiveGameFrame { away: string; home: string; awayScore: number; homeScore: number; period: number; clock: string; players: LivePlayerFrame[] }
export interface LiveSimFrame { games: LiveGameFrame[]; matchups: LiveMatchupFrame[] }

export function liveSimAt(t: number): LiveSimFrame   // t in [0,1] = fraction of the "playing" window
```
- Uses `liveGames` (which featured players are in which game) + `week.json` finals + `players.json` identity + `demoLeagues` matchups.
- **Points ramp:** `points = round(final * clamp(t,0,1), 1)`; `projected` = the real final (the "proj" a live tab shows).
- **TD moments:** parse the real stat line for TD count (`/(\d+)\s*TD/`), distribute that many event moments across `t` (e.g. at `k/(N+1)`); `event: 'TD'` is active within a small window around each moment (drives the ring flash + `+6.0 TD` label).
- **Matchup:** `myScore` = sum of the founder's starters' current `points`; `oppScore = round(oppFinal * t, 1)` (oppFinal baked in `demoLeagues`/`liveGames` for a dramatic late win); projections = finals.
- **Game clock:** `period = min(4, floor(t*4)+1)`; `clock` = a formatted countdown within the quarter; `awayScore/homeScore` = illustrative NFL scores ramping with `t`.
- Pure/deterministic — no `Math.random`, no network. Fully unit-tested.

### 2. Featured-games fixture — `app/demo/lib/liveGames.ts`
Author ~2–3 marquee NFL games for anchor week 8, each with the home/away team codes and the subset of the **founder's rostered players** who play in them (~6–9 players total, drawn from `demoLeagues[0].founderRoster` ∩ `week.json`), plus each league's opponent final for the matchup rail. Names/teams/points all trace to real fixtures; groupings + opponent finals are authored for drama. Deterministic.

### 3. `LiveCompanion` surface — `app/demo/studio/live/LiveCompanion.tsx`
Faithful reproduction of the real `app/(dashboard)/live/page.tsx` LIVE view, props-driven from a `LiveSimFrame`:
- Header `LIVE NOW`; games as bordered groups with `AWAY {s} – HOME {s} · Q{period} {clock}`.
- Per-player row: headshot with **event ring** (`var(--live)` on active TD, else transparent, `transition: border-color 1s`), name, `{pos} · {team}`, league chips (starting = signal border, bench = hairline), right-aligned **points** with `score-tick-up` class when they changed this frame, `proj {projected}`, and a `+6.0 TD` flash when `event`.
- **"Your matchups"** rail: per league `myScore` (live-green, `score-tick-up`) vs `oppScore`, + `proj`.
- Reuses the real CSS animations (`score-tick-up`/`score-tick-down`) and tokens verbatim.

### 4. `LiveScene` — the full arc — `app/demo/studio/live/LiveScene.tsx`
Drives the ~25s loop over a `SceneStage` frame clock (30fps, ~750 frames), rendering inside `DemoShell variant="contained"`:
| Beat | Frames (~) | What |
|---|---|---|
| Calm Game-Day OS | 0–90 | resting `MISSION CONTROL` / pre-kick |
| Kickoff sweep | 90–144 | blue→red sweep + `MISSION CONTROL` flicker (reuse `kickoff-sweep`) |
| LIVE opens | 144–240 | live-unlock reveal; `LiveCompanion` mounts at `t≈0` (0 points) |
| Playing | 240–690 | `LiveCompanion content={liveSimAt(t)}` with `t = (frame-240)/450`; points ramp, TDs flash, scores swing |
| Hold + loop | 690–750 | final state, then loop |

Exposes an optional `frame?` override (deterministic tests + capture), same pattern as the feature scenes. Renders `FocalCard`-style compact framing at 9:16 (a single featured game + matchup) and the full companion at 16:9.

### 5. Studio integration
- `StudioPanel`: add **Live** to the state selector. For `live`, the panel shows light controls (feature-league picker; play/pause is inherent to the loop) — no compose form.
- `StudioCanvas`: add a `state === 'live'` branch rendering `<LiveScene aspect={aspect} />` inside the canvas frame (its own clock; the aspect toggle picks full vs focal layout).
- `Studio`: register `live` in the selector state; no `packContent` needed (self-playing).

## Fidelity anchors (verified against `app/(dashboard)/live/page.tsx`)
- Game group header `{away} {score} – {home} {score} · Q{period} {clock}`.
- Player row: headshot ring (TD = `var(--live)`, `transition: border-color 1s`), `score-tick-up` on the points `<p>`, `proj {n}` in `var(--t4)`, event flash `+{delta} TD` in `var(--live)`.
- Matchup rail: `myScore` in `var(--live)` with `score-tick-up`, `oppScore` in `var(--t3)`, `proj` line in `var(--t4)`, `minWidth: 150`.
- League chips: starting = `var(--signal)` + `var(--signal-dim)`; bench = `var(--t3)` + hairline.

## Capture ergonomics
- Aspect toggle: 16:9 shows the full companion (games + matchup rail); 9:16 shows a focal layout (one featured game + the matchup) centered.
- Hide-controls (existing) frames a clean canvas; deterministic loop → reproducible takes.

## Testing
- `liveSim.test.ts`: `points` is 0 at `t=0`, the real final at `t=1`, monotonic non-decreasing; a player with "2 TD" in the line has exactly 2 TD event windows across `t`; matchup `myScore` equals the summed starters' points at a given `t`; `oppScore` ramps 0→oppFinal.
- `liveGames.test.ts`: featured player ids all exist in `players.json`/`week.json`; games reference real teams.
- `LiveCompanion.test.tsx`: given a `LiveSimFrame`, renders `LIVE NOW`, a game header, a player row with points, and the matchup rail; an active `event` renders the `+ TD` flash.
- `LiveScene.test.tsx`: at a post-open frame shows the companion (a player name + `LIVE NOW`); at an early frame shows the calm/sweep OS.
- Studio wiring: selecting **Live** renders the scene (a `LIVE NOW` assertion). Aspect 9:16 renders the focal layout.

## Out of scope (fast-follows)
- Interactivity: tap-a-player → Player Intelligence Card, live box-score drawer, clock scrubbing, speed toggle.
- The `CLAUDE RECAP` card and the "Player updates" section of the real LIVE tab.
- Wake-lock / idle-dim second-screen behaviors (real-tab only).
- A standalone `/demo/live` route (Phase 1 lives inside the Studio "Live" state).
