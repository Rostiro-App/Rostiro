# Rostiro Behavior Wiring Plan

**Companion to `Rostiro_PRD_v5.md` and `Rostiro_UX_Behavior_Spec.md` — this is the forward-looking one.**
The Behavior Spec documents what's built, strictly. This document is the opposite: what isn't built yet, why it matters, what it would take, and in what order to tackle it. Written July 4, 2026, at the point where Game Day (T-79/T-81/T-90/T-92/T-93) went from spec to real, working code in one session — which is exactly what exposed how much of the *rest* of the product's behavior system (Mode, Plan gating, AI voice, the other four States) hasn't had the same treatment yet.

**Why this exists:** the product's actual differentiation isn't any single feature — it's that the whole OS visibly reconfigures itself around four independent signals (which day/state it is, how much detail you want, what you've paid for, what just happened). That's a real, unusual amount of cross-cutting behavior for a fantasy app to have, and it's exactly the kind of thing that's easy to build inconsistently — one surface gets it, the next three don't, and nobody notices until a user does. This plan exists to make the gaps visible before that happens, not after.

---

## Part 1 — The four behavior axes

Every piece of UI in Rostiro can vary along up to four independent signals. Keeping them conceptually separate matters — conflating "what State are we in" with "how much detail to show" is exactly the kind of bug that's invisible until a user hits the specific combination that breaks it.

| Axis | Question it answers | Computed | Source |
|---|---|---|---|
| **State** | What day/context is it? | Server-side, deterministic | `lib/rostiroState.ts` — Draft / Standard / Waiver Day / Game Day / Film Room |
| **Mode** | How much do you want to see? | Client-side, user-chosen, persisted | `components/nav/AppShell.tsx` — Focused / Balanced / Savant |
| **Plan** | What have you paid for? | Server-side, from `users.plan` | Free / Pro / Founder tiers (Section 9) |
| **Trigger** | Did something just happen that demands attention? | Server-side, event-driven | `lib/engagementTriggers.ts` — touchdown/lineup-lock/mission-complete today |

A fully "wired" surface answers all four questions correctly for its content. Most surfaces today answer zero or one.

---

## Part 2 — Full surface × axis matrix (audited against real code, not intent)

| Surface | State-aware | Mode-aware | Plan-gated | Trigger-aware | Notes |
|---|---|---|---|---|---|
| System Bar | ✅ built today | — (mode *switcher* lives here, but the bar's own chrome doesn't vary by mode) | ✅ score blur | ✅ lineup-lock ramp | Most complete surface in the app |
| Ticker | ✅ built today | — | ✅ score blur | — | Deliberately public/unfiltered |
| Pulse page | ✅ built today | ✅ card density (`useMode`) | ✅ score blur | ⚠️ renders trigger cards, but in the wrong interaction model — see Part 3 | |
| Leagues page | ❌ | ❌ | ❌ | ❌ (no trade-offer badge — trigger doesn't exist anyway) | Health score rings are static regardless of Mode/State |
| Draft Kit (`/draft`) | ❌ | ✅ | ❌ | — | Ironic: the page literally called "Draft" doesn't respond to Draft State |
| Live draft session (`/draft/session/[id]`) | ❌ | ❌ | ❌ | — | Zero `useMode`/`rostiroState` references at all — the actual live-draft experience is fully static |
| Lineup (Start/Sit) | ❌ | ✅ | ❌ — **own code comment admits it:** "No weekly free/paid quota yet" | — | A real, already-flagged gap, not new news |
| Trades (Trade Analyzer) | ❌ | ❌ | ❌ (same missing quota) | — | |
| Settings | — (N/A) | ✅ | — (N/A) | — | Fine as-is |
| Command Palette | ❌ | ❌ | ❌ | ❌ | Doesn't reprioritize commands by State the way 6.7 W4 implies it eventually should |
| Sidebar / BottomNav | ❌ | ❌ | ❌ | ❌ no badges anywhere | "Badge bounce on Leagues nav" (6.12's trade-offer trigger) has nowhere to render even if the trigger existed |
| Claude prompts (`lib/claude.ts`) | — | ❌ | — | — | PRD 3: "Savant... AI advisory not directive" vs Focused's directive tone — **zero mode-awareness in any prompt today** |
| Onboarding | N/A | ✅ (Step 1 mode selection) | N/A | N/A | Solid |

**Reading this table straight:** the Game Day workstream (today's session) built a genuinely complete vertical slice — State, Mode-adjacent, Plan, and Trigger all threading through System Bar/Ticker/Pulse correctly. Almost nothing else in the app has that. Draft State and Standard State — the two states the PRD says must ship for the 8/1 launch — currently drive *no* surface's presentation at all outside of the ambient chrome built today.

---

## Part 3 — Finding: Trigger events are in the wrong interaction model

Worth its own callout before the fence, because it changes how much new infrastructure this actually needs.

PRD 7.1 defines four attention layers — **Ambient** (never interrupts), **Glance** (raises salience, no action), **Interrupt** (time-sensitive, auto-dismiss except P0), **Action** (routed to Pulse, requires a decision). Section 7.1 explicitly classifies "Your player's TD" as **P1 → Interrupt layer**: "in-app card, optional sound, auto-dismiss." Lineup-lock is **P0 → persistent until seen**, which is closer to Action-layer treatment.

What's actually built (this session, T-93): all three trigger types — `touchdown_swing`, `lineup_lock`, `mission_complete` — insert into `pulse_items` and render through the exact same `PulseCard` component as a waiver decision, complete with Done/Snooze/Dismiss buttons. That's the Action-layer/decision-queue treatment, applied to events the PRD explicitly says belong in a different, transient, auto-dismissing layer. It works — the events do reach the user — but "mark this touchdown as Done" is the wrong verb for what happened, and there's no actual Interrupt-layer component anywhere in the codebase (no toast, no overlay, nothing implementing 7.1's "one persistent interrupt slot at a time" rule).

This isn't a bug to patch — it's a real, not-yet-built piece of infrastructure (an Interrupt Stack), scoped in Part 5.

---

## Part 4 — MVP Fence, August Window, Expansion

Boundaries drawn from the PRD's own phasing (6.10: "Draft State and Standard State ship for the 8/1 launch... Waiver Day, Game Day, and Film Room States target end of August 2026") plus what today's session already pulled forward ahead of schedule.

### MVP Fence — needed for 8/1 launch

The two states the PRD requires at launch, *fully* wired — not just computed, but actually driving every surface's presentation — plus Mode and Plan gating threaded everywhere, since those aren't state-dependent and have no excuse to lag:

1. **Draft State driving the actual Draft surfaces.** Right now Draft State exists as a computed value nobody reads outside `/api/system/status`. The Draft Kit and live draft session need to visibly become "Draft State" — accent, framing, prioritized content — the same way Pulse became "Mission Control" today.
2. **Standard State driving Leagues/Trades/Lineup framing.** Currently these pages render identically regardless of State. At minimum, System Bar/Pulse/Ticker's existing State-driven chrome should feel consistent with what these pages show, even if their content doesn't reorder.
3. **Mode threaded into every remaining surface** — Leagues, Trades, live draft session, Command Palette. Currently 3 of 9 real pages read `useMode` at all.
4. **Mode-aware AI voice** — PRD 3's Focused/Savant distinction ("directive" vs "advisory, never directive") doesn't exist in `lib/claude.ts` at all today. This is a launch-relevant credibility gap, not a polish item — a Focused user paying for "just tell me what to do" and getting the same hedged Savant-tone explanation as everyone else undermines the entire persona pitch.
5. **Plan gating actually enforced.** Two specific, already-promised limits are unenforced right now: **1 league cap for Free** (nothing stops a free user from connecting unlimited leagues), and **3 start/sit + 3 trade analyses per week for Free** (the Lineup page's own code comment already admits this: "No weekly free/paid quota yet"). This is real revenue leakage from day one if it ships unenforced.

### August Window — per PRD's own timeline, follows launch

6. **Waiver Day State UI (T-94/T-98)** — today it's a badge + reorder in Pulse. Needs the "Mission Briefing" card layout, FAAB budget context, projected roster-health delta.
7. **Film Room State UI (T-95)** — doesn't exist at all. Needs the recap card component, real per-platform matchup win/loss data (item 4 from the disregarded session brief was actually a reasonable ask — just premature, since the card it wanted wired doesn't exist yet).
8. **Per-league waiver-cutoff config (onboarding Step 4)** — prerequisite for Waiver Day State to know a league's *real* cutoff instead of the current global Tue/Wed default. Blocks true multi-league Waiver Day accuracy (flagged already in `Rostiro_UX_Behavior_Spec.md`'s conflict scoping).
9. **The Interrupt Stack** (Part 3's finding) — if Game Day's trigger system is going to keep expanding (Opportunity Surge, injury-live, once their data pipelines exist), it should land in the right interaction model before more trigger types pile onto the wrong one.

### Expansion — real, but not now

- T-101 (Live Fantasy Matchup Scoring) — already scoped separately, standalone multi-day build.
- Opportunity Surge, injury-during-play, trade-offer-received — blocked on data pipelines that don't exist (T-87 nflverse ingestion, a live injury feed, per-platform incoming-trade polling).
- Player Intelligence Card (T-89) — doesn't exist; building state-aware tab defaults is premature until the card itself exists.
- Boot sequence + coach-mark registry (T-72) — real, referenced by other features' comments, but a genuinely separate build.
- Nav badges (unread Pulse count, trade-offer bounce) — small, but blocked on trigger types that don't exist yet for the trade-offer case.
- Command Palette State-reprioritization.

---

## Part 5 — New infrastructure this actually requires, planned before building

For every MVP-fence and August-window item above that needs genuinely new code (not just reusing an existing pattern), here's the shape of it:

### 5.1 — Usage quota enforcement (MVP fence)
- **New table:** `usage_counters (user_id, feature text, week_start date, count int, unique(user_id, feature, week_start))`.
- **New helper:** `lib/usageLimits.ts` — `checkAndIncrementUsage(admin, userId, feature, limit): Promise<{ allowed: boolean; remaining: number }>`. Atomic upsert-and-check, not read-then-write (race condition risk otherwise under concurrent requests).
- **Call sites:** `/api/lineup/sleeper` (start/sit) and `/api/trades/analyze`, both gated before the Claude call — never spend the AI cost on a request you're about to reject.
- **League-count cap:** simpler — no new table, just a count check (`connected_leagues` rows for this user) in `/api/leagues/sleeper`, `/api/leagues/espn`, and the Yahoo equivalent, before insert.

### 5.2 — Mode-aware AI voice (MVP fence)
- **Thread `mode` through, not around:** every route that currently calls into `lib/claude.ts` (start/sit, trade analysis, draft recommendations, Pulse item reasoning) needs `mode` added to its request body/params — it's already known client-side via `useMode()`, it just isn't being sent.
- **`lib/claude.ts` change:** each prompt-builder function takes `mode: Mode` and selects a tone instruction block: Focused = "state the verdict first, one sentence of why, no hedging"; Balanced = current default; Savant = "advisory only — present the data and reasoning, let the user reach their own call, never phrase it as an instruction."
- **Not a new API** — a parameter threaded through existing ones. Smallest infrastructure item on this list, arguably the best ratio of impact to effort.

### 5.3 — Draft State / Standard State surface wiring (MVP fence)
- **No new APIs** — `/api/system/status` already returns `rostiroState`; the Draft Kit, live draft session, Leagues, and Trades pages just need to fetch it (same one-shot pattern Pulse already uses) and apply `STATE_CONFIG`-driven accent/framing, the same visual language 6.13 already specifies for Draft State (opportunity green, sharp forward-leaning borders, queue items sliding in on ADP movement).
- **Real design question, not just engineering:** what does "Standard State" actually change on Leagues/Trades, concretely? Today's session didn't need to answer this for Game Day because 6.13 already specified it in detail. Standard State's surface-level treatment is comparatively under-specified in the PRD — this needs a short design pass, not just wiring, before it's built.

### 5.4 — The Interrupt Stack (August window, but worth scoping now while T-93 is fresh)
- **New shared component:** `components/InterruptStack.tsx`, mounted once in `AppShell` (visible on every page, not just Pulse) — the actual home for 7.1's "one persistent interrupt slot at a time" rule.
- **Data shape decision needed:** either (a) add a `layer: 'action' | 'interrupt'` column to `pulse_items` and have the stack query `status='open' AND layer='interrupt' AND NOT seen`, or (b) keep interrupts out of `pulse_items` entirely and give them their own lightweight ledger. **(a) is less schema churn and keeps one source of truth for "things that happened"; (b) is cleaner separation of an ambient/transient concern from a persistent decision queue.** Recommend (a) given how new (b) would be, but this is a real fork worth a decision, not a default.
- **Auto-dismiss timing:** P1 events auto-dismiss (per 7.1, no specific duration stated in the PRD — needs a number, e.g. 6–8s, chosen and documented, not left implicit); P0 (lineup-lock) persists until acknowledged.
- **Retrofit, not rebuild:** once this exists, `detectTouchdownSwings`/`detectMissionComplete` (P1/P2) route through it instead of a plain `pulse_items` insert; `detectLineupLockUrgency` (P0) keeps its persistent treatment, which the Interrupt Stack should support natively.

### 5.5 — Per-league waiver-cutoff config (August window)
- **New column:** `connected_leagues.waiver_cutoff_day` / `waiver_cutoff_hour` (or a single `waiver_cutoff_cron`-style field — worth a quick design decision on shape).
- **New onboarding step / settings field:** surfaced at connection time (PRD 4's Step 4 already describes "Waiver system: FAAB / Rolling / Snake / Free agent" as a planned onboarding field — this extends it to also capture *when*).
- **`lib/rostiroState.ts` change:** `computeState` gains an optional per-league cutoff input, falling back to today's global Tue/Wed default when a league hasn't configured one — additive, not a rewrite (the file's own comments already anticipated this exact extension point).

### 5.6 — Film Room State UI + real matchup data (August window)
- **New component:** a Film Room recap card, following the same pattern as Pulse's Live Now / Mission Briefing cards — desaturated palette per 6.13, "what happened" framing, never "what you missed."
- **New per-platform matchup fetch:** Yahoo scoreboard endpoint, Sleeper matchups-by-week endpoint, ESPN's unofficial matchup endpoint — three new thin wrappers, likely in their respective `lib/{platform}.ts` files, following the exact pattern `getSleeperRosters` already establishes.
- **Explicitly excluded from this build** (per the disregarded brief's correct instinct, even though its premise about existing code was wrong): snap-count deltas, injury flags, Buy Low/Sell High tags — all genuinely blocked on T-87's nflverse pipeline, which doesn't exist. Render the card without those sections when the data isn't there — honest-empty, not fake data, matching every other degradation pattern already established this session.

---

## Part 6 — Recommended build sequence

Ordered by dependency and leverage, not just fence position:

1. **Mode-aware AI voice (5.2)** — smallest, highest-leverage, no schema changes, directly serves the core persona pitch that's currently unfulfilled everywhere except card density.
2. **Usage quota enforcement (5.1)** — one new table, two call sites, closes a real revenue gap before any more users arrive.
3. **Draft State / Standard State surface wiring (5.3)** — the actual MVP-fence blocker; needs a short design pass on "what Standard State changes" before writing code.
4. **Mode threaded into remaining surfaces** (Leagues, Trades, live draft session, Command Palette) — mechanical once the pattern from (1) and (3) is established.
5. **The Interrupt Stack (5.4)** — do this before Waiver Day/Film Room add more trigger types on top of the wrong interaction model.
6. **Per-league waiver cutoff (5.5) → Waiver Day State UI** — in that order, since the UI is more accurate once the data exists.
7. **Film Room State UI + matchup data (5.6)**.

Everything in Part 4's "Expansion" section stays explicitly out of scope until this sequence clears — consistent with the standing rule this whole session: don't build ahead of the question that's actually in front of us.

---

## Part 7 — Status tracker (kept current, not a changelog)

Unlike the changelog rows in `Rostiro_PRD_v5.md` (append-only, dated), this section reflects **current** state — update in place, don't just add more rows.

### Sequence progress
| # | Item | Status |
|---|---|---|
| 1 | Mode-aware AI voice (T-102) | ✓ Done |
| 2 | Usage quota enforcement (T-103) | ✓ Done |
| 3 | Draft/Standard State surface wiring (T-104) | ✓ Done |
| 4 | Mode threaded into remaining surfaces (T-105) | ✓ Done |
| 5 | The Interrupt Stack (T-106) | ✓ Done |
| 6 | Per-league waiver cutoff (T-107) | ✓ Done |
| 7 | Waiver Day State UI + Film Room State UI + matchup data (T-108) | **Next up** |

### Explicitly deferred — not forgotten, just not now
| Item | Why deferred | Where it's tracked |
|---|---|---|
| Full Founder recognition — priority feedback access, early feature previews | Neither is mechanically defined yet (support channel? beta-flag gate?) — a product decision, not an engineering default | T-111, PRD task table |
| Marketing copy acknowledging Founders | Marketing surfaces are untouched pending a designer pass (standing since the v5.0 changelog) — waits on that regardless of this item | T-111, PRD task table |
| Tooltip/tutorial UX fork — mandatory walkthrough vs. the originally-spec'd skippable boot sequence | Real UX-philosophy decision (forced completion vs. skippable), not something to silently resolve either way | T-72 open question, PRD task table (6.8) |
| T-101 — Live Fantasy Matchup Scoring | Standalone, multi-day build; needs its own design pass (data source, scoring engine, refresh cadence) | T-101, PRD task table |
| Opportunity Surge, injury-during-play, trade-offer-received triggers | Each blocked on a data pipeline that doesn't exist (T-87 nflverse ingestion, a live injury feed, per-platform incoming-trade polling) | `lib/engagementTriggers.ts` header, PRD 6.12 |
| Player Intelligence Card (T-89) | Doesn't exist at all yet — building state-aware tabs for it is premature | PRD task table |
| ESPN league lifecycle/activity messaging (e.g. "league not open for 2026 yet") | Real gap (found via user testing), but deliberately scoped down to the honest static explanation already shipped (T-109) rather than building live ESPN draft/season-activity detection | `Rostiro_UX_Behavior_Spec.md` Leagues surface section |
