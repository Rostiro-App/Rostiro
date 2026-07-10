# Simulation Studio — Multi-State Marketing Expansion (Phase 2) Design Spec

**Date:** 2026-07-10
**Status:** Approved design → ready for implementation plan
**Builds on:** `2026-07-10-simulation-studio-foundation-design.md` (the gated `/demo/studio`, `SimEvent` registry, `DemoShell`/`PulseFeed` canvas, `InterruptCardView`, aspect toggle).

**Scope:** Generalize the Simulation Studio from a single game-day interrupt authoring tool into a **state-aware marketing simulation platform** that stages and captures faithful moments across Rostiro's states, and ship two new state "moment packs": **Waiver Day (Mission Briefing)** and **Film Room (weekly recap)**. Each pack renders **both** a full faithful state screen (for 16:9) and a focal moment card (for 9:16), driven by a hybrid authoring model (real prefill + full editorial override). Draft and roster-exposure packs are designed-for but deferred. The production cross-league win-prob feature ("Project A") is a separate, parallel, deferred track.

## Goal

In `/demo/studio`, the operator picks a **state** (Standard, Waiver Day, Game Day, Film Room; Draft later), authors that state's content with real-data prefill + total override, toggles **16:9 / 9:16**, and captures a clean video of the genuine product in that state.

## Architecture

### 1. State-aware Studio (the reusable generalization)
- Add a **state selector** to `StudioPanel` (segmented control: Standard / Waiver Day / Game Day / Film Room).
- Broaden the `SimEvent` model into a per-state **pack registry** (`app/demo/lib/studioPacks.ts`):

```ts
export type StudioStateKind = 'standard' | 'waiver_day' | 'game_day' | 'film_room' // 'draft' future
export interface StatePack<TContent> {
  state: StudioStateKind
  label: string
  defaultContent(): TContent
  prefill(): TContent                 // real-data prefill from fixtures
  AuthorForm: React.FC<{ content: TContent; onChange: (c: TContent) => void }>
  FullSurface: React.FC<{ content: TContent }>   // 16:9 faithful state screen
  FocalCard: React.FC<{ content: TContent }>     // 9:16 punchy card
}
export const STUDIO_PACKS: Record<StudioStateKind, StatePack<any>>
```
- The existing game-day interrupt keeps its fire/auto-dismiss overlay behavior (registered under `game_day`); the new packs are compose-and-capture (no auto-dismiss).

### 2. Aspect-aware canvas
`StudioCanvas` renders inside `DemoShell variant="contained" stateOverride={state}`:
- **16:9** → the pack's `FullSurface` (the whole state screen).
- **9:16** → the pack's `FocalCard` centered, with the OS softly behind (reduced chrome).
The aspect toggle already exists; the canvas selects `FullSurface` vs `FocalCard` from it.

### 3. Waiver Day pack (`app/demo/studio/packs/waiver/`)
Content: `{ targets: { name, pos, addPct, faabSuggestion }[] , leagueName }`.
- **Prefill:** real breakouts from `app/demo/fixtures/waivers.json` (already `{ playerId, name, pos, addPct, faabSuggestion }`).
- **FullSurface — `WaiverBriefing`:** reproduces the real Waiver Day pulse framing:
  - The **MISSION BRIEFING** pill — exact real markup: `mono-data inline-block text-[9.5px] tracking-[0.16em] px-2 py-0.5 rounded-full mb-2`, color/border `STATE_CONFIG.waiver_day.color`, bg `color-mix(in srgb, currentColor 12%, transparent)`.
  - Subhead: "**N priority waiver targets** across 1 league" (waiver-green bold count), matching the real reframed subhead.
  - `waiver_alert` cards (the real WAIVER-labelled Pulse card style, `var(--live)` green) — one per target, showing name · pos, add %, and FAAB bid.
- **FocalCard — `WaiverFocalCard`:** a single punchy card, e.g. "TOP WAIVER · {name} {pos}" / "{addPct}% adding · bid ${faab}", for 9:16.
- **AuthorForm:** edit each target (name, pos, addPct, faab), add/remove rows; edit league name. Full override.

### 4. Film Room pack (`app/demo/studio/packs/film/`)
Content: `{ leagueName, won: boolean|null, myScore, oppScore, recap: string, usage: { name, position, direction: 'buy_low'|'sell_high', deltaPct } | null }`.
- **Prefill:** from `demoLeagues` (per-league `matchup.myScore`/`oppScore` → result + scores) + a real player from `players.json` for the usage signal.
- **FullSurface — `FilmRecap`:** reproduces the real Film Room recap panel (understated, no glow): result line ("You won this week" / "Not your week" / "Even split — {league}"), `myScore.toFixed(1) – oppScore.toFixed(1)`, the recap sentence, and the usage signal line `↑/↓ {name} ({pos}) — snap share up/down {deltaPct}pts` (`↑` buy_low / `↓` sell_high), all in Film Room's quiet palette (`STATE_CONFIG.film_room.color`).
- **FocalCard — `FilmFocalCard`:** "YOU WON · {league}" / "{myScore}–{oppScore}" / "↑ Buy low: {name}", for 9:16.
- **AuthorForm:** edit league, result (won/lost/even), scores, recap text, usage player/direction/delta. Full override.

### 5. StudioPanel + Studio wiring
- `StudioPanel` renders the state selector, then the active pack's `AuthorForm` (via registry). Game Day keeps its player-search + fire flow.
- `Studio` holds `{ state, content, aspect, showPanel }`; switching state loads that pack's `prefill()` into `content`. The canvas renders the active pack's `FullSurface`/`FocalCard` per aspect. Game Day retains fire/auto-dismiss for the interrupt overlay.

## Fidelity anchors (verified against real code 2026-07-10)
- **Mission Briefing pill:** markup above, from `app/(dashboard)/pulse/page.tsx:366`.
- **Waiver subhead:** "N priority waiver targets across N leagues" (waiver-green count).
- **Film recap:** result/score/recap/usage-signal shape from `app/(dashboard)/pulse/page.tsx:569-623` (`FilmRoomLeagueResult` fields, `↑/↓` usage line).
- **WAIVER card:** the real `waiver_alert` Pulse card (`var(--live)`), matching the existing demo `PulseCard`.
All authored overrides are explicitly editorial; all prefill numbers come from real fixtures (no invented stats).

## Data flow
State selector → registry `prefill()` loads real content → `AuthorForm` edits (full override) → canvas renders `FullSurface` (16:9) or `FocalCard` (9:16) inside `DemoShell stateOverride={state}` → capture. Game Day additionally supports fire→interrupt-overlay→auto-dismiss.

## Testing
- `studioPacks.test.ts`: registry resolves each registered state to a pack with `AuthorForm`/`FullSurface`/`FocalCard`/`prefill`; `waiver_day` prefill yields ≥1 real target from `waivers.json`; `film_room` prefill yields a result consistent with `demoLeagues` scores (won iff myScore>oppScore).
- `WaiverBriefing.test.tsx`: renders the `MISSION BRIEFING` pill, the "N priority waiver targets" subhead, and a WAIVER card per target with the real add%/FAAB.
- `FilmRecap.test.tsx`: renders the result line, `myScore–oppScore`, and the `↑/↓` usage line; custom recap/league text renders verbatim.
- Focal cards: each renders the punchy one-line summary from content.
- `StudioPanel` test: selecting "Waiver Day" swaps in the waiver author form and prefilled targets; editing a target/league propagates via `onChange`.
- `StudioCanvas` test: 16:9 renders `FullSurface`; 9:16 renders `FocalCard`.

## Out of scope (future packs / tracks)
- **Draft pack** ("on the clock", best-available/ADP) and **roster-exposure** feature card — registry supports them; not built here.
- **Project A** (production cross-league win-prob on the live Interrupt card for real users) — separate parallel spec.
- Preset saving/export, recording pipeline, deeper 9:16 layout polish beyond centering the focal card.
- Any live network/OAuth — the studio stays deterministic and fixture-fed.
