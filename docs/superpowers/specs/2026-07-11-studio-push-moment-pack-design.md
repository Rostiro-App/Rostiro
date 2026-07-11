# Simulation Studio — Push Moment Pack (Lock-Screen) — Design Spec

**Date:** 2026-07-11
**Status:** Approved design → ready for implementation plan
**Builds on:** the Simulation Studio (T-159/T-160/T-161) — `app/demo/studio/*`, the `StatePack`/`SURFACE_PACKS` registry (`app/demo/lib/studioPacks.tsx`), `StudioCanvas`, `StudioPanel`, `DemoShell`.
**Relates to:** T-163 (Starter Scratch Alerts) — the first content type through this pack; and Marketing System v2's News Desk pillar.

**Scope:** Add a **Push Moment** surface to the Simulation Studio that renders a realistic **iOS lock-screen push notification** — the hero visual the Studio cannot produce today (every existing pack renders an *in-app* surface via `DemoShell`; there is no phone/lock-screen anywhere). Built **generically across push types** (touchdown, lineup_lock, starter_scratch, and any future push), authorable with real-data prefill + full editorial override, and captured in 9:16 for IG/TikTok/Shorts. Composition with the in-app follow-up ("then a cut into the app") is done in editing, not in the Studio.

**Explicitly out of scope (v1):** Android styling; a banner-over-app presentation; a scripted in-Studio push→app transition/timeline; stacked/multiple notifications; the registry refactor discussed below.

---

## Locked decisions (founder, 2026-07-11)

1. **Lock-screen hero** — phone locked: wallpaper, clock, date, and the notification card. (Not banner-over-app; not both.)
2. **Separate captures + edit** — the pack renders the lock-screen statically (authorable); the "cut into the app" beat is a second capture stitched in editing. No scripted transition in v1.
3. **iOS styling** — more iconic and cheaper to fake convincingly than fragmented Android. Android is a later add.
4. **Own render path, not a `StatePack`** — see architecture below.
5. **Generic across push types** — one pack authors any push; the content model is push-type-agnostic.

---

## Architecture finding: why this is NOT a `StatePack`

The `SURFACE_PACKS` registry (`standard`, `waiver_day`, `film_room`) assumes every pack:
- renders its `FullSurface`/`FocalCard` **inside `<DemoShell variant="contained">`** (the Rostiro app chrome), and
- maps the **16:9/9:16** duality to `FullSurface`/`FocalCard`.

A lock-screen breaks both: it is a **phone frame with no app shell**, and it is **inherently 9:16** (a 16:9 lock-screen is meaningless). Forcing it into `StatePack` would corrupt the contract.

**This is already a solved pattern in the Studio:** `game_day` and `live` are **not** in `SURFACE_PACKS` — they are special render paths in `Studio.tsx` (the `PanelState` union) and `StudioCanvas.tsx` (explicit branches). **The Push Moment becomes the third such special path** (`state === 'push'`), consistent with the existing design.

### Registry generalization — flagged, deliberately deferred
The clean long-term shape is "each pack declares **how** it renders (its own canvas renderer), not just its content," which would fold `game_day`/`live`/`push` back into one uniform registry and collapse the growing `StudioCanvas` branch pile. **We are not doing that now (YAGNI):** it's a refactor of working code, and three special paths don't yet justify it. **Logged as a future cleanup** — revisit when a 4th special path appears. Adding `push` as a special path is the correct incremental move today.

---

## Content model (generic across push types)

`app/demo/lib/pushMoment.ts`:
```ts
export interface PushMoment {
  appName: string      // 'Rostiro' (default)
  title: string        // notification bold line, e.g. 'Josh Allen — ruled OUT'
  body: string         // 'Josh Allen ruled out. Starting in Lawrence's Legends +3 others.'
  timeLabel: string    // right-aligned in the notification, e.g. 'now'
  clockTime: string    // lock-screen big clock, e.g. '12:47'
  dateLabel: string    // lock-screen date, e.g. 'Sunday, September 14'
}
```
Push-type-agnostic by construction: a touchdown push (`title: 'Touchdown!'`), a lineup-lock push (`title: 'Kickoff in 30 min'`), or a scratch push all populate the same fields. `defaultPushMoment()` returns a scratch example (the driving use case); `prefillPushMoment()` fills `title`/`body` from **real demo fixtures** (a real rostered player + real overlapping league names from `demoLeagues`/`players.json`, exactly how the live/waiver packs prefill), then every field is editable (hybrid model). Optional convenience in the author form: "Load example → scratch / touchdown / lineup-lock" buttons that repopulate from real data; the core remains freeform fields.

---

## Rendering — `PushLockScreen`

`app/demo/studio/push/PushLockScreen.tsx` — a **full-bleed 9:16 iOS lock-screen** (the captured clip *is* the phone screen; no device bezel — cleanest and most convincingly real). Composition, top to bottom:
- **Wallpaper:** a tasteful dark, brand-adjacent gradient (real brand tokens — `--void`/`--signal`), so it reads as a real phone without being a literal Rostiro screenshot.
- **Status bar:** time-left, signal/wifi/battery glyphs (static, iconic).
- **Large clock + date:** `clockTime` (SF-style large numerals) + `dateLabel`.
- **Notification card:** frosted rounded-rect (iOS style) — app icon (reuse the real Rostiro brand mark used in `DemoShell`'s system bar) + `appName` (uppercased small) + `timeLabel` (right-aligned) on the top row; `title` (semibold) and `body` (secondary) below.
- **Bottom affordances:** flashlight/camera glyphs + swipe hint (static), for realism.

Props-only, deterministic, self-contained (no polling, no DB) — same discipline as `InterruptCardView`/the other Studio surfaces, so it's screen-recordable and re-shootable.

### Aspect handling
Push is **9:16-native.** In `StudioCanvas`, the `push` branch renders the 9:16 lock-screen. If the global aspect toggle is set to `16:9`, render the **9:16 phone centered on a neutral backdrop** (so the toggle never breaks and a landscape "phone on a desk" framing is still possible). The toggle is effectively a no-op for the lock-screen content itself.

---

## Wiring (the three touch points, mirroring `game_day`/`live`)

1. **`app/demo/studio/Studio.tsx`** — `PanelState` already is `StudioStateKind | 'game_day' | 'live'`; add `'push'`. In `selectState`, when `s === 'push'`, `setPackContent(prefillPushMoment())` (same shape as the `live` branch's `prefillLiveScenario()`).
2. **`app/demo/studio/StudioCanvas.tsx`** — add a branch: `if (state === 'push') return <PushLockScreen content={content as PushMoment} aspect={aspect} />` (mirrors the `live` early-return for `LiveScene`).
3. **`app/demo/studio/StudioPanel.tsx`** — add `Push` to the state selector, and when selected render `PushAuthorForm` (mirrors how the panel renders `LiveAuthorForm`/pack `AuthorForm`s).

`PushAuthorForm` (`app/demo/studio/push/PushAuthorForm.tsx`): plain labeled inputs for each `PushMoment` field (`appName`, `title`, `body`, `timeLabel`, `clockTime`, `dateLabel`) + the optional example-loader buttons. Same author-form conventions as the waiver/film/live forms.

---

## Files

- **Create:** `app/demo/lib/pushMoment.ts` (type, `defaultPushMoment`, `prefillPushMoment`), `app/demo/lib/pushMoment.test.ts`, `app/demo/studio/push/PushLockScreen.tsx`, `app/demo/studio/push/PushAuthorForm.tsx`.
- **Modify:** `app/demo/studio/Studio.tsx`, `app/demo/studio/StudioCanvas.tsx`, `app/demo/studio/StudioPanel.tsx`.
- **Optionally reuse:** the existing Rostiro brand-mark asset/component rendered in `DemoShell`'s system bar for the notification app icon.

## Honesty contract (inherited)
A Push Moment clip is an **editorial mockup**, same as every Studio pack — any player, league, or wording is authored, not live. The **marketing claim** it supports stays bounded by the real feature it depicts: for scratch alerts, T-163's real behavior is **~15-min latency, high-confidence-only, Pro-gated**. Show a dramatized ping in the Studio; never claim "instant/real-time" in copy. The Studio surface itself carries no user-facing claim.

## Testing
- `pushMoment.ts`: `defaultPushMoment` returns valid fields; `prefillPushMoment` pulls a real fixture player + real league names and formats the "+N others" body correctly. Pure, vitest.
- `PushLockScreen`: a render smoke test (mounts with a sample `PushMoment`, asserts title/body/clock present) — matching the existing Studio surface test pattern (e.g. `StudioCanvas.test.tsx`).
- Manual: open `/demo/studio?studio=true`, select **Push**, verify prefill renders a convincing lock-screen, override fields, capture 9:16.

## Effort
Low–Medium; contained. One new render component + one type/prefill module + one author form + three small wiring edits. No registry change, no timeline, no new dependencies. Reuses brand tokens and the demo fixtures.
