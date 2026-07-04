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
| **Which players/leagues are behind that score** | **Not shown, at any tier.** The badge only ever shows team codes and the raw score — never "Hurts, Barkley (2 leagues)" | `gameLabel()` has no player/league params | **Gap — see Known Gaps #1** |
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
| **Player/league attribution** | **Not shown** — same gap character as System Bar, but arguably not a gap here (see Known Gaps #1's ticker note) | — | Deliberate (ticker) / relates to Gap #1 (ambient surfaces generally) |

## Surface: Pulse — ambient "Live Now" card (`app/(dashboard)/pulse/page.tsx`)

| Scenario | What renders | Source | Status |
|---|---|---|---|
| Game Day, no roster-relevant live games | Card doesn't render | `liveGames.length > 0` guard | Built |
| Game Day, 1+ roster-relevant live games | One row per game: `AWAY score – HOME score`, `Qn clock` underneath a "LIVE NOW" label | Live Now card JSX | Built |
| Free plan | Score row blurred + "Unlock live scores with Pro" caption | `scoresGated` | Built |
| Persistent "Mission Control" header badge | Shows whenever `rostiroState === 'game_day'`; flickers in via `.value-tick` only the first time that day | `isMissionControl`, `kickoffSweeping` | Built |
| **Which of your players are in that game, which leagues** | **Not shown** on the ambient card itself | Live Now card JSX has no player/league fields | **Gap — see Known Gaps #1** |

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

### Gap #1 — Ambient displays don't carry player/league attribution (2026-07-04)
System Bar's live badge, the ticker's live segments, and Pulse's "Live Now" card all show a bare team score. Only the event-driven `touchdown_swing` card names players and leagues, and only at the instant of a scoring play. Someone glancing at the System Bar mid-game with no new score change has no way to see *why* a game is marked relevant to them.

**Recommendation: fix this.** The data already exists — `/api/system/status` already computes `rosterRelevant: boolean` per game; it would just need to also carry *which* players/leagues made it relevant, not collapse that down to a boolean. Cheap relative to its clarity payoff. Proposed shape: add `relevantPlayers: { name: string; leagueNames: string[] }[]` to `LiveGameScore`, surfaced as a small subtext line — e.g. `PHI 24 – NYG 17 · Q3 · Hurts, Barkley (2 leagues)` — on the System Bar badge and Pulse Live Now card. **Ticker excluded on purpose:** it's a public, unfiltered crawl by design (matches its existing ADP-movers character), so per-viewer personalization there would be a bigger, different change — the ticker doesn't currently know or care who's watching it beyond the blur gate.

Status: not yet built, pending a go/no-go.

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
