# Cross-League Touchdown Injector (Director's Console) — Design Spec

**Date:** 2026-07-10
**Status:** SUPERSEDED by `2026-07-10-simulation-studio-foundation-design.md` — its engine (`crossLeagueImpact`), demo-league fixtures (`demoLeagues`), and card layout carry forward under the Simulation Studio. Kept as historical seed.
**Scope:** Upgrade the `/demo` Director's Console "Inject TD" button into a live, searchable touchdown injector: type any real NFL player from `players.json`, enter custom fantasy points, and instantly fire a `CrossLeagueInterruptCard` that flashes the win-probability impact across the founder's leagues. Purpose-built as a **marketing capture tool** for high-converting social-video (TikTok/Reels/X).

## Goal

From the Director's Console (studio/dev-gated), the operator can:
1. Search and select any real player from the baked `players.json` fixture via an autocomplete dropdown.
2. Enter a custom fantasy point value (default `6.0`).
3. Click Inject → the hybrid engine computes the cross-league win-probability impact and a `CrossLeagueInterruptCard` animates in top-center, holding ~7s then auto-dismissing — all deterministic and camera-ready.

## Deliberate fidelity deviation (named on purpose)

The shipped `components/InterruptStack.tsx` card is intentionally understated (label + headline + reasoning). This injector's card is a **marketing-enhanced variant** — a bold hero win-prob delta with per-league chips. That is a conscious deviation from the strict "UI must match shipped product" rule, justified because the injector is gated behind `?studio=true` / dev (`NODE_ENV==='development'`) and exists solely to produce marketing footage, never shown to end users. `winProb` was always specced to "graduate into lib/ for the real Live tab later," so the cross-league win-prob concept is plausible, not fabricated data.

## Architecture

```
app/demo/lib/demoLeagues.ts          # 3-league roster + live-matchup fixture (real player ids)
app/demo/lib/crossLeagueImpact.ts    # pure engine: computeInjectionImpact()  (+ test)
app/demo/components/CrossLeagueInterruptCard.tsx   # hero delta + league chips  (+ test)
app/demo/lib/DemoStateProvider.tsx   # + injectTouchdown() + activeInjection state
app/demo/components/DirectorConsole.tsx  # replace "Inject TD" with search + points + Inject
app/demo/page.tsx (DemoTour)         # render CrossLeagueInterruptCard when activeInjection set
```

### 1. Multi-league fixture — `app/demo/lib/demoLeagues.ts`
Typed data (not touching `league.json`, so existing single-league `/demo` and its tests are unchanged):

```ts
export interface DemoLeagueMatchup { myScore: number; oppScore: number; secondsRemaining: number; projMargin: number }
export interface DemoLeagueEntry { id: string; name: string; founderRoster: string[]; matchup: DemoLeagueMatchup }
export const DEMO_LEAGUES: DemoLeagueEntry[]  // exactly 3 entries
```
- Three leagues: `Lawrence's Legends League`, `Sunday Money`, `The Bit League`.
- `founderRoster` uses real `players.json` ids. Overlap is deliberate: a shared **core** of ~8 top players sits on the founder's roster in ALL three leagues; the rest are league-specific. So a star injection reports "Affects 3 of your leagues," a role player "Affects 1."
- Each `matchup` is baked to a **tight** game (small `myScore-oppScore` margin, low `secondsRemaining`, small `projMargin`) so an injected TD produces a large, camera-friendly win-prob swing while staying within `winProb`'s real math.
- Rosters/margins are authored deterministically (no `Math.random`); documented as illustrative demo matchups (not real-game live scores).

### 2. Pure engine — `app/demo/lib/crossLeagueImpact.ts`
```ts
import { winProb } from './winProb'
import { DEMO_LEAGUES, type DemoLeagueEntry } from './demoLeagues'

export interface LeagueImpact { leagueId: string; leagueName: string; beforePct: number; afterPct: number; deltaPct: number }

export function computeInjectionImpact(playerId: string, points: number, leagues = DEMO_LEAGUES): LeagueImpact[]
```
- For each league where `founderRoster.includes(playerId)`:
  - `before = winProb({ marginNow: myScore-oppScore, secondsRemaining, projMargin })`
  - `after  = winProb({ marginNow: (myScore-oppScore)+points, secondsRemaining, projMargin: projMargin+points })`
  - `beforePct = Math.round(before*100)`, `afterPct = Math.round(after*100)`, `deltaPct = afterPct-beforePct`.
- Returns only affected leagues (player on founder roster), in `DEMO_LEAGUES` order. Empty array if the player is on none.
- Pure, deterministic, side-effect-free — fully unit-tested (multi-league player → N impacts; unrostered player → []; larger points → larger delta; pct within 0–100).

### 3. Hero card — `app/demo/components/CrossLeagueInterruptCard.tsx`
Props: `{ player: { name: string; pos: string; team: string }; points: number; impacts: LeagueImpact[]; leaving?: boolean }`.
Layout (the approved "hero delta + league chips"):
- Top-center, `glass-heavy`, `panel-enter` in / `card-leave` when `leaving` (same animation grammar as `DemoInterruptCard`), game-day red accent (`#E24B4A` / `var(--crit)`) for the TD.
- Row 1: `⚡ TOUCHDOWN` + `+{points} PTS`.
- Row 2: `{player.name} · {player.pos} · {player.team}`.
- Hero: the per-league `▲ +{deltaPct}%` deltas rendered large, side by side.
- Divider label: `WIN PROBABILITY · {impacts.length} OF YOUR LEAGUES` (pluralize league/leagues).
- Chips: one row per impact — `{leagueName}   {beforePct}% → {afterPct}%`.
- Copy is punchy and readable at a glance (social-video sizing). If `impacts` is empty (player on no founder roster), the card still shows the TD with a muted "Not on your roster in any league" line rather than fake numbers.

### 4. Injection path — `DemoStateProvider`
- New state: `activeInjection: { player: DemoPlayer; points: number; impacts: LeagueImpact[] } | null`.
- New control: `injectTouchdown(playerId: string, points: number)` — looks the player up in `players.json` (via `loadFixtures`), runs `computeInjectionImpact`, sets `activeInjection`, and starts a `7000ms` (`AUTO_DISMISS_MS`) timer to clear it (mirrors the real `InterruptStack` auto-dismiss). A second injection replaces the first and resets the timer.
- Existing `inject(alert)` / `ScriptedToast` path is left intact (no regression to the timeline tour or Scene usage).

### 5. Director's Console UI — `DirectorConsole.tsx`
Replace the static `Inject TD` button with a compact cluster (still inside the studio-gated drawer):
- **Autocomplete search:** a text input filtering `players.json` by case-insensitive name substring; a dropdown lists up to ~8 matches as `{name} · {pos} · {team}`; clicking selects the player. Keyboard: Enter selects the top match.
- **Points input:** a `number` input, default `6.0`, step `0.1`.
- **Inject button:** enabled once a player is selected; calls `controls.injectTouchdown(selectedId, points)`.
- The rest of the console (play/pause/scrub/speed/jump-to-state) is unchanged.

### 6. Render — `DemoTour` (`app/demo/page.tsx`)
When `activeInjection` is set, render `<CrossLeagueInterruptCard player={...} points={...} impacts={...} />` (top-center overlay), alongside the existing `ScriptedToast` and `DirectorConsole`.

## Data flow
DirectorConsole (search → select player + points → Inject) → `controls.injectTouchdown(playerId, points)` → provider computes `impacts = computeInjectionImpact(...)` over `DEMO_LEAGUES` → sets `activeInjection` → `DemoTour` renders `CrossLeagueInterruptCard` (animated in) → 7s timer clears `activeInjection` (card animates out).

## Testing
- `crossLeagueImpact.test.ts` (pure): a core star returns 3 impacts; a single-league player returns 1; an unrostered player returns `[]`; higher `points` yields a larger `deltaPct` (monotonic); all pct values in `[0,100]`; impacts preserve `DEMO_LEAGUES` order.
- `CrossLeagueInterruptCard.test.tsx`: given 2 impacts, renders both `▲ +X%` deltas, the `2 OF YOUR LEAGUES` label, both league chips with `before% → after%`, and the player name; empty-impacts renders the muted no-roster line, not fake numbers.
- `DemoStateProvider` test: `injectTouchdown(coreStarId, 6)` sets `activeInjection` with non-empty `impacts`; with fake timers, it clears after 7000ms.
- `DirectorConsole` test: typing a known surname filters the dropdown to that player; selecting + Inject calls `injectTouchdown` with the selected id and the entered points (assert via a spy/probe within a `DemoStateProvider`).

## Out of scope (future)
- Persisting/looping injections, or a "record" button.
- Injecting non-touchdown event types (injury/trade) through the same search.
- Wiring cross-league win-prob into the real (non-demo) product Live tab.
- Changing the marketing-scene `DemoInterruptCard` (Scene 3) — it stays the understated shipped-faithful card.
