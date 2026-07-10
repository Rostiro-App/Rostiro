# Feature-Page Live Demos (Choreographed) — Design Spec

**Date:** 2026-07-09
**Status:** Approved design → ready for implementation plan
**Scope:** Replace the 3 Remotion-placeholder videos on `/features` with 3 choreographed, self-playing **live** demos that run the real demo-mode UI. This is the first slice of a larger "full demo" ambition (live-mode demo, broader UX) — those are out of scope here and each get their own spec later.

## Goal

Three looping, in-page demos on `app/features/page.tsx`, each driven by a shared frame-based clock ("editing timeline") so every frame is deterministic and screen-recordable:

1. **Multi-league connect → unified Pulse** (Pillar 1)
2. **Kickoff transition** — Standard → Game Day sweep (Pillar 2)
3. **Interrupt Stack** — touchdown card enters, auto-dismisses (Pillar 3)

## Non-negotiable fidelity constraint

Every pixel and behavior shown MUST match what is actually programmed in the product today. Scenes reuse the real demo-mode components (`DemoShell`, `PulseFeed`, `PulseMark`, `ScriptedToast`) and the real brand tokens / timings. No invented UX. Specific real-code anchors verified 2026-07-09:

- **Connect screen** (`app/(auth)/onboarding/page.tsx`): header `ROSTIRO · Step 2 of 6`, `Connect your leagues`, sub `Connect at least one. Rostiro can't help until you do.` Three `PlatformCard`s in this order with these exact strings:
  - `Sleeper` — "No login needed, just your username."
  - `Yahoo` — "Connect with Yahoo OAuth. Full read + write."
  - `Unlock ESPN` — "Browser cookies. Read-only. Takes 2 minutes."
  - A connected card shows a green `Connected` pill (bg `#1A3D1A`, color `var(--live)`, border `#2A5A2A`). A `Continue →` button (bg `var(--signal)`) appears once ≥1 is connected. **There is no "N/3" counter** — do not add one.
- **Mission Control relabel** (`app/(dashboard)/pulse/page.tsx` ~L383): a `mono-data` pill reading `MISSION CONTROL`, `text-[9.5px] tracking-[0.16em]`, colored `STATE_CONFIG.game_day.color`. Shown only when `game_day` AND live games exist. On the once-per-day kickoff it flickers in via `value-tick`.
- **Kickoff sweep**: `useGameDayKickoffTransition(state, hasLiveGames)` → `kickoff-sweep` class on the System Bar; `SWEEP_DURATION_MS = 1800`. PulseMark switches to `STATE_CONFIG.game_day.color`.
- **Interrupt card** (`components/InterruptStack.tsx` ~L117): `glass-heavy fixed rounded-xl px-4 py-3`, `top: 52px`, centered, `width: min(360px, …)`, `borderLeft: 2.5px` priority color, `panel-enter` in / `card-leave` out. Content: mono `typeLabel` (`TOUCHDOWN` for `touchdown_swing`), `headline` (t1, 13px, semibold), `reasoning` (t2, 12px). Snooze/✕ only when `priority === 'critical'`. `AUTO_DISMISS_MS = 7000`, leave animation 340ms.

## Architecture (Approach A — shared SceneStage + scene scripts)

```
components/marketing/scenes/
  timeline.ts            # pure: interpolate / inRange / progress  (+ timeline.test.ts)
  SceneStage.tsx         # 16:9 frame + rAF clock (30fps) + loop + IO visibility + reduced-motion
  fixtures.ts            # scene-scoped: 2 extra league names + multiLeaguePulse feed
  ConnectPanel.tsx       # faithful reproduction of the onboarding connect screen
  DemoInterruptCard.tsx  # faithful reproduction of the InterruptStack card
  ConnectScene.tsx       # (+ ConnectScene.test.tsx)
  KickoffScene.tsx       # (+ KickoffScene.test.tsx)
  InterruptScene.tsx     # (+ InterruptScene.test.tsx)
```

Scenes live under `components/marketing/` (not `app/demo/`), so the `app/demo/**` isolation ESLint rule does not apply to them — but they stay fixture-fed and Supabase-free by construction. Importing `app/demo/*` demo components and fixtures *into* marketing is allowed (the isolation rule only restricts what `app/demo` files themselves import).

### `timeline.ts` (pure, tested)
- `interpolate(frame, [f0,f1], [v0,v1], { clamp = true }): number` — linear map, Remotion-style.
- `inRange(frame, start, end): boolean` — `start <= frame < end`.
- `progress(frame, start, end): number` — 0..1 eased position within a beat (clamped).
Deterministic; no time/DOM. Fully unit-tested.

### `SceneStage.tsx`
- Props: `{ durationFrames: number; fps?: number = 30; caption: string; children: (frame: number) => ReactNode; frame?: number /* test/capture override */; staticFrame?: number }`.
- Renders the existing 16:9 glass frame (reuse `ProductVideoDemo`'s styling: `glass-heavy rounded-2xl overflow-hidden`, `aspectRatio: 16/9`, `border: 1px var(--hairline-bright)`) with the scene absolutely filling it, caption below (`text-sm mt-3 text-center`, `var(--t3)`).
- Clock: `requestAnimationFrame` loop; `frame = Math.floor(elapsedSec * fps) % durationFrames`; loops seamlessly. Runs only while the frame is in-viewport (IntersectionObserver) to bound cost; pauses offscreen.
- Reduced motion: if `matchMedia('(prefers-reduced-motion: reduce)').matches`, hold `staticFrame` (default: a representative frame per scene) and never animate.
- `frame` prop, when provided, overrides the clock entirely → deterministic tests and a future capture harness.

### `contained` mode on `DemoShell`
Add `variant?: 'route' | 'contained'` (default `'route'`; `/demo` unchanged). `'contained'`:
- Outer wrapper `absolute inset-0 h-full w-full` instead of `h-screen`.
- Same SystemBar + dock + main + ticker, minor padding trims so all chrome reads inside a card.
- `overflow-hidden` so nothing escapes the 16:9 stage.

## Scene beat scripts (30fps)

Beats are declared as frame ranges via `inRange`/`interpolate`. Durations are targets; exact frame maps land in the plan.

### ConnectScene — ~13s (390 frames)
Renders `ConnectPanel` (faithful onboarding connect screen), then cross-fades to `DemoShell variant="contained"` showing the multi-league Pulse feed.
| Beat | Frames | What |
|---|---|---|
| Empty connect screen (3 cards, none connected) | 0–75 | reads the "Connect your leagues" ask |
| Sleeper → `Connected` pill in | 75–150 | pill fades in on the Sleeper card |
| Yahoo → `Connected` pill in | 150–225 | pill fades in on the Yahoo card |
| Unlock ESPN → `Connected` pill in; `Continue →` appears | 225–300 | all three connected |
| Cross-fade → contained Pulse feed (multi-league) | 300–360 | feed cards tagged to different leagues |
| Hold on unified feed | 360–390 | at least one card names a second league |

`ConnectPanel` reproduces the real `PlatformCard`s and strings verbatim; "connecting" is choreographed by the scene toggling each card's `connected` state on its beat (no real OAuth). Multi-league proof uses `fixtures.multiLeaguePulse`, whose cards carry `leagueName` across the 3 leagues (and one card labeled "2 leagues", matching the real `leagueLabel` "N leagues" behavior).

### KickoffScene — ~10s (300 frames)
Renders `DemoShell variant="contained"` with `PulseFeed`; drives `currentState` and the sweep.
| Beat | Frames | What |
|---|---|---|
| Standard OS — blue PulseMark, "Good evening" | 0–120 | calm resting state |
| Pre-kick beat (subtle) | 120–150 | hold before the sweep |
| Kickoff sweep — SystemBar `kickoff-sweep`, PulseMark→game_day red, `MISSION CONTROL` flickers in via `value-tick` | 150–204 (~1800ms) | the money moment, at real speed |
| Hold on Game Day / Mission Control | 204–300 | new state settles |

The scene sets `hasLiveGames = true` at the sweep so `MISSION CONTROL` is legitimately shown (matches the real gate). Sweep visuals reuse the real `kickoff-sweep` CSS and `STATE_CONFIG.game_day.color`.

### InterruptScene — ~12s (360 frames)
Renders contained Game-Day OS with a `DemoInterruptCard`.
| Beat | Frames | What |
|---|---|---|
| Calm Game Day, nothing interrupting | 0–90 | "before" reads calm |
| `DemoInterruptCard` slides in (`panel-enter`), `TOUCHDOWN`, real point delta | 90–110 | card enters top-center |
| Hold, untouched | 110–320 (~7s) | the auto-dismiss window |
| Auto-dismiss (`card-leave`, 340ms) at +7s | 320–330 | card clears itself |
| Empty hold before loop | 330–360 | back to calm |

`DemoInterruptCard` mirrors `InterruptStack`'s markup exactly (a non-critical `touchdown_swing` → no Snooze/✕, per real behavior). Headline/reasoning use a real player line from fixtures (e.g. the anchor-week TD from `week.json`).

## Fixtures (`scenes/fixtures.ts`)
- `demoLeagues`: the primary `Lawrence's Legends League` plus two mock names — **"Sunday Money"** and **"The Bit League"** (names only).
- `multiLeaguePulse: DemoPulseItem[]` — ~5 cards derived from real players (reuse `buildPulseFeed` output where possible), each `leagueName` set across the three leagues; one card set to the "2 leagues" label form. No invented stats.

## Features page integration (`app/features/page.tsx`)
- Replace the three `<ProductVideoDemo .../>` call sites (L136, L223, L320) with `<ConnectScene/>`, `<KickoffScene/>`, `<InterruptScene/>`.
- Captions become honest and footage-agnostic, e.g.:
  - Pillar 1: "One list, every league — interactive demo on real 2024 data."
  - Pillar 2: "The whole OS shifts at kickoff — interactive demo."
  - Pillar 3: "Only the important thing interrupts, then clears itself — interactive demo."
- Remove the stale surrounding code comments about "Remotion recreation / swap `src` for the real founder footage."

## Retirement (all now unused; verified 2026-07-09)
- Delete `remotion/compositions/{KickoffTransition,InterruptStackReveal,MultiLeagueConnectReenactment}.tsx` and their `remotion/Root.tsx` registrations.
- Delete `public/videos/{kickoff-transition,interrupt-stack-reveal,multi-league-connect-reenactment}.mp4`.
- Delete `components/marketing/ProductVideoDemo.tsx` (only these 3 slots used it).
- Update `Rostiro_Video_Shotlist.md`: mark all three clips **SOLVED via live in-page demos**; the deferred founder shoot for these three is retired (keep the doc as historical record with a clear resolution note at top).

## Testing
- `timeline.test.ts` — interpolate/inRange/progress math.
- One deterministic smoke test per scene, rendering via the `frame` override at representative frames:
  - Connect @ frame 330 → a card naming a second league is present; @ frame 40 → all three `PlatformCard`s with no `Connected` pill.
  - Kickoff @ frame 260 (post-sweep) → `MISSION CONTROL` present and PulseMark is game_day.
  - Interrupt @ frame 100 → `TOUCHDOWN` card present; @ frame 345 (post-dismiss) → card absent.
- Broaden `vitest.config.mts` `include` to `['app/demo/**/*.test.{ts,tsx}', 'components/marketing/scenes/**/*.test.{ts,tsx}']`. Reuse the existing `app/demo/test-setup.ts` matchMedia stub (add to `setupFiles` already covers all tests).

## Performance / accessibility
- Only one rAF loop per scene, and only while on-screen (IntersectionObserver). Three scenes never all animate at once unless all in view.
- `prefers-reduced-motion` → static representative frame, no rAF.
- Decorative motion is `aria-hidden` where appropriate; captions carry the meaning for AT.

## Out of scope (future specs)
- Broader "full demo for everything" / standalone live-mode demo experience.
- Draft, Waiver Day, Film Room scene vignettes.
- Any real OAuth or live data in the marketing demos.
