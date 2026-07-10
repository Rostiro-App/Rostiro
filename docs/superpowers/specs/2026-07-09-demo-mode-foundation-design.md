# DEMO_MODE — Foundation (Phase 0–1) Design

**Date:** 2026-07-09
**Status:** Approved for implementation
**Scope:** Phase 0 (real-2025 fixture prep) + Phase 1 (route-isolated demo foundation, timeline engine, Director's Console shell, Standard state). The Draft / Game Day / Waiver Day / Film Room engines are explicitly **out of scope** — each ships as its own follow-on spec that plugs into this foundation.
**Milestone:** Presentation surfaces stable by **2026-07-14**.

---

## 1. Purpose

Build a self-contained, in-memory demo of Rostiro that runs the app across its five OS states using **real 2025 NFL data** wrapped in one fictional 10-team league ("Lawrence's Legends"). It serves two audiences:

- **Public offseason visitors** — a self-playing, looping product tour.
- **The founder** — a hidden Director's Console for scripting pixel-perfect screen recordings.

This spec delivers the foundation both rely on, plus the **Standard** state fully working. The other four states are follow-on specs.

## 2. Non-negotiable constraints

1. **Zero production leak, enforced structurally.** Nothing under `app/demo/**` may import `lib/supabase`, `lib/sleeper`, `lib/espn`, `lib/yahoo`, or any DB/live-API-coupled module. Enforced by an ESLint `no-restricted-imports` rule scoped to `app/demo/**` so a violating import **fails the build**, not just review.
2. **In-memory only.** No Supabase reads/writes, no network calls, no background workers in the demo path.
3. **Real data, no fabrication.** Every player, stat, and ADP number is sourced from real 2025 NFL data (nflverse + a Sleeper ADP snapshot) and baked into static fixtures. Numbers must survive a viewer pausing the video.
4. **Hybrid engine fidelity.** Pure calculation engines (`computeLeagueHealth`, `computeStatlinePoints`) run for real on fixtures. Transient execution layers (push, game-day alerts) are scripted toast UI, not real workers.

## 3. Architecture

```
app/demo/
  layout.tsx              DemoProvider (virtual clock + timeline) + <DirectorConsole/>
  page.tsx                self-playing tour surface (renders current state)
  fixtures/               baked real-2025 JSON (see §5)
    players.json
    league.json
    week.json
    waivers.json
    chat.json
    timeline.json
    crest.tsx             inline SVG for Lawrence's Legends crest
  lib/
    DemoStateProvider.tsx  React context: { virtualClock, currentState, activeAlert, fixtures, controls }
    timeline.ts            timeline state machine (advance/seek/patch)
    winProb.ts             new pure win-probability fn (demo-scoped, graduation-ready)
    personaBots.ts         archetype→behavior mapping (stub in Phase 1; used by Draft/Waiver specs)
  components/
    StandardState.tsx      Standard-state dashboard, fed from context
    DirectorConsole.tsx    drawer overlay, dev-or-?studio=true gated
    (thin wrappers around existing presentational dashboard components)
```

**State flow.** The real app computes state server-side via `getRostiroState`. The demo does **not** call it. Instead `DemoStateProvider` holds the current state, driven by the timeline machine, and passes it to the same **presentational** dashboard components the real app uses. Where an existing component couples rendering to server data-fetching, we lift the pure presentational portion into a shared component both the real app and demo consume — a targeted extraction, not a broad refactor.

## 4. Isolation enforcement (Phase 1, first task)

- ESLint override block targeting `app/demo/**/*.{ts,tsx}` with `no-restricted-imports` patterns for: `@/lib/supabase`, `@/lib/supabase-browser`, `@/lib/sleeper`, `@/lib/espn*`, `@/lib/yahoo`, `@/lib/liveMatchupPoints`, `@/lib/pulse` (DB-coupled), and any `@/lib/*` module that transitively imports `createAdminClient`/`createClient`.
- **Allowed** shared imports: `@/lib/healthScore`, `@/lib/scoring`, `@/lib/brandTokens`, `@/types`, and other pure modules.
- A CI lint step (already present via `npm run lint`) fails on violation.
- Acceptance test: adding `import { createAdminClient } from '@/lib/supabase'` to any `app/demo` file must break `npm run lint`.

## 5. Fixture data model (Phase 0 output)

All baked as static JSON/TSX under `app/demo/fixtures/`. Built once by a Phase-0 data script (kept in `scripts/demo/`, **not** shipped in the app bundle).

| File | Contents | Source |
|------|----------|--------|
| `players.json` | Real 2025 players: `{ id, name, pos, nflTeam, headshotUrl, season: {…totals}, adp }` | nflverse weekly player stats + rosters; ADP from a Sleeper ADP snapshot |
| `league.json` | 10 managers (see §6), each `{ managerId, teamName, handle, archetype, roster: playerId[], record, seasonPoints }` | Authored personas over real player IDs |
| `week.json` | Anchor week: `{ week, matchups[], boxScores: { playerId → statline }, pbp: PbpBeat[] }` | nflverse play-by-play + player game stats |
| `waivers.json` | Anchor week's real breakout adds/drops + FAAB suggestions | nflverse usage/opportunity deltas |
| `chat.json` | Trash-talk / activity-feed lines keyed by `managerId` | Authored (voices per §6) |
| `timeline.json` | Tour beats: `TimelineBeat[]` (see §7) | Authored |
| `crest.tsx` | Inline SVG: dark-navy circular crest, Rostiro pulse mark, silver "LL" monogram | Authored |

**Anchor-week selection (Phase 0 task, not a placeholder):** the data script fetches the full 2025 regular season, ranks Sundays by on-camera drama (aggregate scoring, number of lead changes / large swings, star performances), and selects the top candidate. The chosen week number is recorded in the spec's implementation notes and baked into `week.json`. No stat is authored by hand.

**Headshots:** referenced by URL for display; if CSP/offline constraints require it, fall back to position-silhouette placeholders. No player stat depends on the image.

## 6. The league — "Lawrence's Legends" (locked)

| # | Manager | Team | Archetype | Voice |
|---|---------|------|-----------|-------|
| 1 | Lawrence T. | Lawrence's Legends | Founder-commish; sharp, obsessive, intense | "Rules are posted. Trade deadline is a deadline." |
| 2 | Marcus Devane | Regression to the Mean | Sweat — spreadsheet nerd | "My model had this at 61%. Variance, not skill." |
| 3 | Priya Nair | Priya's Process | Sweat — ruthless rebuilder | "Trust the process. I'm 2-6 on purpose." |
| 4 | Danny Okafor | Okafor It All | Sweat — compulsive trader | "You up? Got a deal that helps us both 👀" |
| 5 | Chad Beemer | Chad & the Sunshine Band | Casual — sets lineup at 12:58 | "wait he was on bye??" |
| 6 | Becks Lindqvist | Autodraft Anonymous | Casual — embraced the chaos | "I have never once opened this app and I'm 6-2." |
| 7 | Tony Marchetti | Marchetti's Meatballs | Casual — old-school loyalist | "I'm starting my guy. He's due." |
| 8 | Jamal Rivers | Waiver Wire Warriors | Flavor — FAAB gambler | "Spent 87% of budget in Week 3. No regrets." |
| 9 | Sophie Tran | Tran Sackers | Flavor — quiet assassin | *(rarely posts; quietly 8-0)* |
| 10 | Mike Osei | The Ocho | Flavor — all-talk trash-talker | "Scoreboard. Oh wait, don't look 😅" |

Founder team #1 renders with the approved LL crest (`crest.tsx`). Archetypes drive `personaBots.ts` behavior in later specs (Draft picks, Waiver bids); in Phase 1 they only inform standings, rosters, and chat flavor.

## 7. Timeline state machine + self-playing tour

```ts
interface TimelineBeat {
  timeOffset: number          // seconds from tour start
  state?: RostiroState        // switch OS state at this beat
  activeAlert?: ScriptedAlert // fire a scripted toast
  patch?: FixturePatch        // apply an in-memory fixture delta (e.g. live score change)
  label?: string              // human label for the Director's Console scrubber
}
```

`timeline.ts` owns a virtual clock. On `tick`, it applies all beats whose `timeOffset` has passed since the last tick: updates `currentState`, sets `activeAlert`, and applies `patch` deltas to an in-memory copy of the fixtures held in context. For public visitors the tour **auto-plays and loops**. The Sunday-compression ratio (real ~3h → 3–5 min on screen) is expressed purely as beat `timeOffset` spacing — no wall-clock coupling.

Phase 1 ships the machine plus a **Standard-state timeline** (a calm loop through the Standard dashboard). Game-day play-by-play beats exist in `week.json` from Phase 0 but are consumed by the Phase-2 spec.

## 8. Director's Console (shell in Phase 1)

- **Gating:** rendered only when `process.env.NODE_ENV === 'development'` **or** the URL has `?studio=true`. Never visible to public visitors.
- **Phase 1 controls:** play / pause / scrub (seek to any `timeOffset`) / speed multiplier / **jump-to-state** (instant Draft·Standard·Waiver·GameDay·FilmRoom).
- **Interrupt injectors** (inject touchdown, injury, trade offer, waiver claim) are stubbed with a registration API in Phase 1 and fully wired per state in the follow-on specs — the console shell exposes the buttons and the injection channel; each state spec supplies the concrete payloads.
- Implemented as a fixed drawer overlay using existing `components/ui` + `brandTokens`.

## 9. Engine wiring (hybrid)

- **Real:** `computeLeagueHealth(input)` powers the Standard-state Health Score off `league.json` + `players.json`. `computeStatlinePoints(...)` computes any points shown. Both are pure and imported directly (allowed by §4).
- **New pure fn:** `app/demo/lib/winProb.ts` — inputs `{ marginNow, secondsRemaining, projectedRemainingHome, projectedRemainingAway }`, returns a probability. Pure and side-effect-free so it can later graduate into `lib/` for the real app. Unit-tested. (Consumed live by the Game Day spec; defined here so the foundation owns it.)
- **Scripted:** alerts/push render via a toast component reading `activeAlert`. No workers, no OneSignal.

## 10. Testing

- **Isolation:** lint fails when a forbidden import is added to `app/demo` (§4 acceptance test).
- **Timeline machine:** unit tests for `advance`, `seek`, `patch` application, and loop wrap — deterministic given a fixed beat array.
- **winProb:** unit tests over known inputs (blowout ≈ 0/1, tie at kickoff ≈ 0.5, monotonic in margin).
- **Standard state:** renders from fixtures with a real, non-placeholder Health Score; no Supabase/network calls occur (assert via no forbidden imports + a render smoke test).
- **Console gating:** absent without `?studio=true` in a production-like build; present in dev.

## 11. Out of scope (follow-on specs)

Game Day live-replay engine · Draft bot-drafter · Waiver Day seeding · Film Room recaps. Each is a separate `docs/superpowers/specs/` document that consumes this foundation (fixtures, timeline machine, console injection API, winProb).

## 12. Build order

- **Phase 0** — `scripts/demo/` data pipeline: fetch 2025 nflverse + Sleeper ADP snapshot, select anchor week, bake all fixtures, hand-author personas/chat/crest/timeline.
- **Phase 1** — (1) ESLint isolation rule + acceptance test → (2) `DemoStateProvider` + `timeline.ts` + tests → (3) `winProb.ts` + tests → (4) Director's Console shell (gating + play/pause/scrub/jump/injection API) → (5) `StandardState` rendering off fixtures with real Health Score → (6) `app/demo/page.tsx` self-playing Standard loop.
