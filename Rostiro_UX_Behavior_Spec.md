# Rostiro UX Behavior Spec

**Companion to Rostiro_PRD_v5.md — living, scenario-by-scenario reference for what each surface actually renders.**
Started July 4, 2026, after a run of simple questions ("does the ticker show the Eagles score if I own Hurts?") turned out to have precise, non-obvious answers that took real code-reading to pin down. That's the reason this exists: the OS is genuinely complex now, complex enough that "what does surface X show in state Y" is no longer answerable from memory or intuition. This doc is where that answer lives instead.

**Ground rule: this documents what's built, not what's intended.** Every row below is checked against the actual code (file/function cited), not the PRD's narrative description of what a feature is "supposed to" do. Where the two differ, that's a gap, and it's called out as one.

## How to use / extend this doc

- One section per surface.
- Each section is a table: **Scenario → What actually renders → Source of truth → Status.**
- Status is one of: **Built** (matches intent), **Gap** (unintentional, worth fixing), **Deliberate** (intentional limitation/design choice, not a bug), **Planned** (roadmapped, not started).
- When a question surfaces a new scenario, add a row immediately — don't wait for a documentation pass. Nuance accumulates here as it's discovered, per the standing team agreement not to over-build ahead of real questions.

---

## Surface: System Bar (`components/nav/SystemBar.tsx`)

| Scenario | What renders | Source | Status |
|---|---|---|---|
| Standard/Waiver Day/Film Room/Draft State | Pulse mark in that state's color (brandTokens.ts `STATE_CONFIG`); no live-score badge | `PulseMark`, `STATE_CONFIG` | Built |
| Game Day, no roster-relevant game live yet | No live-score badge (silent, not a broken empty state) | `LiveScoreBadge` returns `null` when `live.length === 0` | Built |
| Game Day, exactly one roster-relevant game live | Badge shows `AWAY score – HOME score · Qn clock`, e.g. `NYJ 20 – TEN 27 · Q3 6:12` | `LiveScoreBadge` → `gameLabel()` | Built |
| Game Day, 2+ roster-relevant games live | Badge collapses to `N LIVE`; hover reveals each game's score line | `LiveScoreBadge` (`live.length > 1` branch) | Built |
| Free plan | Score text rendered with `filter: blur(4px)`, plus a small `PRO` tag | `scoresGated` from `/api/system/status` | Built |
| Which players/leagues are behind that score | Subtext next to the score (desktop only): "Hurts, Barkley (2 leagues)" — never blurred, even on free plan | `LiveScoreBadge`, `playerSummary()` | **Built 2026-07-04 (Gap #1 fix)** |
| Kickoff-transition sweep (first Game Day moment of the day) | ~1.8s inset glow sweep on the bar, once per ET calendar day | `useGameDayKickoffTransition`, `.kickoff-sweep` | Built |
| Lineup-lock deadline, >15 min out | Deadline chip in calm signal-blue | `lineupLockRampColor()` | Built |
| Lineup-lock deadline, 5–15 min out | Chip ramps to warm amber | `lineupLockRampColor()` | Built |
| Lineup-lock deadline, <5 min out | Chip turns urgent red + breathing pulse animation | `lineupLockRampColor()`, `.breathe` | Built |
| Draft/waiver deadline (non-lineup-lock) | Flat amber, no ramp — ramp is lineup-lock-specific | `deadline.kind !== 'lineup_lock'` branch | Deliberate |

## Surface: Bottom Ticker (`components/nav/TickerBar.tsx`)

| Scenario | What renders | Source | Status |
|---|---|---|---|
| Non-Game-Day, <7 days of ADP history | Top-of-board players, no deltas | `data.top` branch | Built |
| Non-Game-Day, ≥7 days of ADP history | Movers with ▲/▼ deltas | `data.movers` branch | Built |
| Game Day, any live games today | Crawls **every** live game today, regardless of ownership | `liveGames` filter (no `rosterRelevant` check) | Deliberate — matches the ticker's existing "public market data" character, same as ADP movers today |
| Game Day, no games have actually kicked off yet | Falls back to ADP-mode content (no fake pregame scores) | `gameDayActive = ...liveGames.length > 0` | Built |
| Free plan, Game Day | Each score segment blurred, plus a trailing "UNLOCK LIVE SCORES WITH PRO" segment | `scoresGated` | Built |
| First live segment appearance each day | Slides in from the right (`.ticker-slide-in`) once, then crawls normally | `useGameDayKickoffTransition` | Built |
| Player/league attribution | Not shown, and not planned — the ticker is a public, unfiltered crawl by design, unlike System Bar/Pulse (see Gap #1's resolution note) | — | Deliberate |

## Surface: Pulse — ambient "Live Now" card (`app/(dashboard)/pulse/page.tsx`)

| Scenario | What renders | Source | Status |
|---|---|---|---|
| Game Day, no roster-relevant live games | Card doesn't render | `liveGames.length > 0` guard | Built |
| Game Day, 1+ roster-relevant live games | One row per game: `AWAY score – HOME score`, `Qn clock` underneath a "LIVE NOW" label | Live Now card JSX | Built |
| Free plan | Score row blurred + "Unlock live scores with Pro" caption | `scoresGated` | Built |
| Persistent "Mission Control" header badge | Shows whenever `rostiroState === 'game_day'`; flickers in via `.value-tick` only the first time that day | `isMissionControl`, `kickoffSweeping` | Built |
| Which of your players are in that game, which leagues | A line under the score/clock: "Hurts, Barkley (2 leagues)" — never blurred | Live Now card JSX, `playerSummary()` | **Built 2026-07-04 (Gap #1 fix)** |

## Surface: Pulse — event-driven trigger cards (`lib/engagementTriggers.ts`)

These are real `pulse_items` rows, not ambient state — they only exist because a specific event fired. This is the **one place player/league naming already exists.**

| Scenario | What renders | Source | Status |
|---|---|---|---|
| Your team scores (touchdown_swing) | Headline names the team; reasoning names **every rostered player you own on that team, across every affected league, in one card** — e.g. "PHI scores — Hurts, Barkley in the mix" if you own both across 2 leagues | `detectTouchdownSwings` | Built |
| Same scoring event, 3 leagues all touched | **One** card/push naming all 3 leagues — never 3 separate ones | `byUser` aggregation keyed by `user_id` | Built |
| **Which specific player actually scored** | **Cannot say.** `live_scores` is a team-level score cache (T-81) with no play-by-play — the card names everyone you own on the scoring team, never the actual scorer | `detectTouchdownSwings` header comment | **Deliberate limitation — not fixable without a new data source (see Known Gaps #2 note)** |
| Lineup about to lock, flagged/empty starter | Names the specific player(s) and their status, minutes-to-kickoff | `detectLineupLockUrgency` | Built |
| All your relevant games end | Calm summary naming league count | `detectMissionComplete` | Built |
| Injury during live play, live fantasy lead-change, trade offer received, Opportunity Surge | **Don't exist** — no detection code at all | — | **Planned, blocked on new data pipelines (PRD 6.12, `lib/engagementTriggers.ts` header)** |

---

## Known Gaps (surfaced via product questions — log the date, keep this growing)

### Gap #1 — Ambient displays don't carry player/league attribution (2026-07-04, fixed same day)
System Bar's live badge and Pulse's "Live Now" card used to show a bare team score. Only the event-driven `touchdown_swing` card named players and leagues, and only at the instant of a scoring play — someone glancing at the System Bar mid-game with no new score change had no way to see *why* a game was marked relevant to them.

**Fixed:** `LiveGameScore.relevantPlayers` (`{ name, leagueNames }[]`) is now computed in `/api/system/status` from data that was already being fetched (rosters, `players_cache`), so no new queries — just carrying player identity through instead of collapsing it to a boolean. Surfaced as `Hurts, Barkley (2 leagues)` under/next to the score on both the System Bar badge and Pulse's Live Now card. Deliberately **never blurred**, even on free plan — it's "why this game is yours," not the score value itself, so 9's depth-gating doesn't apply to it. **Ticker excluded on purpose, still:** it's a public, unfiltered crawl by design (matches its ADP-movers character) — personalizing it would be a bigger, different change, since it doesn't otherwise know or care who's watching beyond the blur gate.

### Gap #2 — No live fantasy matchup scoring anywhere (2026-07-04)
Every live-score surface in the product shows real **NFL** game scores. Nothing computes or shows **fantasy** point totals — your team's live score, your opponent's live score, or who's winning your actual head-to-head matchup. This is the natural thing a user pictures when they hear "Game Day mode," and it doesn't exist. See **T-101** below — this is a real roadmap commitment now, not a deferred nice-to-have.

### Gap #3 — Team-code score matching doesn't verify the date (2026-07-04, found while testing T-93)
`fetchLiveScores` (T-81, `lib/liveScores.ts`) matches an ESPN scoreboard event to a `nfl_schedule` row by team codes only. During testing, a demo game between two real teams got silently overwritten with real (but unrelated — a future/different-date) ESPN data for the same two teams. Low real-world likelihood (rematches within a season are rare, and same-day-only matching would mostly self-correct), but it's a real correctness gap in the join, not a UX question. Not fixed yet — flagged for a decision on priority, separate from this document's scope.

---

## New task: T-101 — Live Fantasy Matchup Scoring

**What it needs, honestly scoped (this is a standalone build, not a T-81 extension):**
1. **A real per-player live stat feed.** T-81's ESPN scoreboard call is team-level only (home score, away score, period, clock). Live fantasy scoring needs a per-player box-score/play-by-play feed (ESPN's game-summary endpoint is the likely candidate, unconfirmed) — a new data source, not a richer read of the existing one.
2. **A scoring engine.** Maps live per-player stats to each league's actual scoring settings — the `ScoringSettings` type (`ppr`, `tePremium`, `qbTouchdownPoints`, per-yardage rates, etc.) already exists in `types/index.ts` and is populated per league; this would be new code consuming it, not new schema.
3. **Matchup pairing.** Needs to know who your opponent is *this week*, in each league — Sleeper exposes a matchups-by-week endpoint; not yet wired into anything in this codebase.
4. **Live aggregation.** Sum a roster's *active starters'* live fantasy points into a team total, on the same cadence as `live_scores`, for both sides of the matchup.

**Phasing recommendation:** this is a genuinely separate, substantial feature — closer in size to T-81's original backend build than to any single UI task. Don't fold it into the current Game Day MVP window; it deserves its own design pass (data source confirmation, scoring-engine architecture, refresh cadence/cost) before implementation starts. Logged here so it's a committed "yes, we're building this" rather than a maybe.

---

## Free/Pro Gating — Game Day (2026-07-04)

**The principle (user's framing, worth keeping verbatim):** gate the features that convert people, not so much that they can't smell what the rock is cooking. Section 9's existing table already drew most of this line — the pass below is checking every Game Day surface against it, not re-deciding from scratch.

| Feature | Existing decision (Section 9) | Actual behavior today | Status |
|---|---|---|---|
| Rostiro State itself (Mission Control framing, pulse mark accent, kickoff sweep) | "States are never paywalled, only depth within them is" (6.10) | Fully free, universal | Built, correct |
| Ticker / System Bar badge / Pulse Live Now — *that* a game is relevant, team names, clock/period | Not explicit, but consistent with "states universal" | Fully free, unblurred | Built, correct |
| Live score **numbers** (the actual score value) | "Full state depth (unblurred live scores)" = Pro | Blurred + PRO tag for free, everywhere | Built, correct |
| Player/league naming ("Hurts, Barkley (2 leagues)") | Not explicit | Free, never blurred (today's Gap #1 fix) | Built, correct — this is the tease: a free user knows *why* to care, not *what the score is* |
| touchdown_swing / lineup_lock / mission_complete — **in-app Pulse card** | Not explicit, closest analog is "Morning Pulse (basic)" = free | Created for every user regardless of plan | **Recommend: keep free.** This is the "smell it" layer — full headline and reasoning, no blur. Taking it away would gut the free ambient experience the whole States model is built to sell. |
| touchdown_swing / lineup_lock / mission_complete — **OS push notification** | "Push notifications" listed explicitly under Pro only | **Sent to every subscribed user regardless of plan — `lib/engagementTriggers.ts`'s `pushToUser` never checks plan.** | **Gap — real bug, fixed same day.** This is the actual lever: free users still get the moment the next time they open the app (via the Pulse card), but only Pro gets pinged on their phone the instant it happens. That immediacy gap — finding out live vs finding out later — is a legitimately compelling, already-decided upgrade reason that just wasn't wired up. |

**One structural note, not a gate:** Free is capped at 1 league (Section 9), so the "one push naming all 3 leagues" cross-league dedup magic in `touchdown_swing` is inherently something a free user can't fully see — not because it's blocked, but because they structurally can't have a 2-league event. That's a naturally-occurring upsell moment, not something to engineer further. (Whether the 1-league cap is actually *enforced* anywhere in code is a separate, unchecked question — flagged here, not investigated as part of this pass.)

---

## Multi-League Conflict Scenarios (2026-07-04)

**The real precedence order, as `computeState()` actually implements it today** (not per-league — one global state per user, computed in this check order):

1. **Any connected league has an incomplete draft → Draft State.** Wins over everything, unconditionally.
2. **Any NFL game is happening today, anywhere, regardless of whether the user has a rostered player in it → Game Day State.** Deliberate per PRD 6.14 — Game Day is ambient/universal, not per-user-relevance. A user with zero relevant players playing still gets the State; personalized surfaces (Live Now card, System Bar badge) just stay empty rather than showing an explicit "quiet" message (see note below).
3. **Otherwise, a fixed global day-of-week schedule** (Mon/Tue-AM = Film Room, Tue-PM/Wed-AM = Waiver Day, else Standard) — **the same schedule for every league**, regardless of that league's actual waiver-processing day.

**Scoped by likelihood — build for the first tier now, table the rest:**

**High likelihood, already built, just documenting the decision:**
- Draft (League A) + mid-season Standard/Waiver/Game Day (League B) — common during August preseason when leagues draft on different dates. Draft wins. Correct, matches "this is my year doesn't pause for a Tuesday waiver window."
- Game Day (any live game) + a user with no roster-relevant game that day — common on a normal Sunday if someone's roster happens to be all on bye-adjacent teams that week, or simply hasn't connected many leagues. Ambient State still activates; personalized surfaces stay quiet by omission.
- Multiple leagues all roster-relevant on the same Sunday (the normal case) — already works: Live Now card lists every relevant game, `touchdown_swing` already cross-league-dedups into one card/push.

**Medium likelihood, current behavior is probably fine, revisit if it ever actually bites:**
- A schedule irregularity (the PRD's own example: Week 1's Wednesday-night Australia game) lands on a day that would otherwise be a league's Waiver Day. Game Day wins by check order — a league's "Mission Briefing" framing gets pre-empted by "Mission Control" that day. Rare (a handful of times a season at most), and arguably the *correct* call anyway (a live game is a bigger deal than a waiver reminder). Not building anything special for this.

**Low likelihood / explicitly tabled — don't build yet:**
- **True per-league waiver-cutoff divergence** (League A's real cutoff is Monday night, League B's is Wednesday morning) — **can't be correctly resolved today at all**, because there's no per-league waiver-cutoff configuration anywhere (onboarding Step 4, referenced in `lib/rostiroState.ts`'s own comments, doesn't exist yet). The current fixed Tue/Wed window is a known, deliberate placeholder, not a bug to fix in isolation — it's blocked on that onboarding step existing first. Tabled until that prerequisite ships.
- **Fantasy playoff byes** (a league seed earning a first-round playoff bye, weeks 15+) — tabled per direct instruction; real scenario, but 15 weeks out and not urgent.
- Draft State (a live rookie/dynasty draft) overlapping a *different* league's real Game Day Sunday — technically possible (in-season dynasty startup drafts exist) but rare enough not to warrant special handling beyond the existing "Draft always wins" rule.

**Small gap worth a one-line note, not a build:** PRD 6.14 describes an explicit "watching the rest of the league" quiet framing for a user with no live game of their own during Game Day. Today that's implemented by *omission* (the badge/card just don't render) rather than an explicit message. Close enough in practice; worth a real copy/design pass only if it comes up as a real point of confusion.
