# Cross-League Portfolio Intelligence UX — Favoriting, Critical Alerts, Free-Agent Search, Advisory Lineup Calls

**Date:** 2026-07-16
**Status:** Approved design → ready for implementation plan
**Context:** Triggered by two real-world events the same week — (1) Yahoo confirmed read-only API access, meaning **no platform grants Rostiro write access to any league**, closing off "auto-set your lineup" as a viable feature; (2) a competitive scan found FantasyPros' My Playbook already ships cross-league free-agent search and an auto-pilot lineup feature. This spec answers both: it locks in the honesty rule ("never show guessed or transformed data — deadlines and facts are as-is; exposure/portfolio synthesis is where Rostiro adds value") and designs the UX that scales from a 2-league casual user to a 9+-league power user without either drowning them or silently hiding something that costs them a championship.

**Supersedes nothing; extends** `Rostiro_Growth_Execution_Jul2026.md`'s honesty contract into product UX, and builds directly on the existing System Bar (§6.7 W1), Pulse (§6.1, §6.7 W3), Health Score (§6.2), Start/Sit Engine (§6.4), Experience Layer hint system (§6.8 E1), and Game Day Engagement System (§6.12) in `Rostiro_PRD_v5.md`.

**Explicitly deferred, not in this spec:**
- **Player Intelligence Card in a multi-league/portfolio context** — a genuinely separate surface (§6.11), needs its own brainstorming pass.
- **Actual marketing copy drafts** (social posts, landing page copy) — the "Honesty & marketing guardrails" section below locks the claimable/not-claimable language every future copy draft must derive from, but writing the copy itself happens after these features ship, against the real built UI, not a moving spec.

---

## Locked decisions (founder, 2026-07-16)

1. **No data transformation, ever, on facts.** Deadlines, lineup locks, and any real-world timestamp render exactly as sourced per league. No merged/averaged/estimated deadline. Where per-league divergence isn't yet modeled (see Known Gap below), the UI must say so rather than show a number that looks precise but isn't.
2. **Portfolio/exposure synthesis is the differentiation layer**, and it's allowed to be "smart" (aggregated, ranked, Claude-narrated) because it's synthesizing real per-league facts into a new true statement ("you're exposed to X in 3 leagues"), not guessing at an uncertain one.
3. **No auto-pilot / no write-access framing anywhere in this feature set.** Every "what should I do" surface ends in a deep-link to the platform, not an in-app action that pretends to execute it.
4. **A Critical alert tier exists and bypasses every compaction mechanism** (Focused mode's 5-card cap, triage truncation, push quiet-hours/rate-limits). This is the direct answer to "we must not miss the handcuff-behind-the-injured-starter case" — stakes-based urgency, not deadline-proximity urgency.
5. **League favoriting scopes Pulse and Game Day**, not visibility elsewhere — a non-favorited league still appears on the Leagues page and in Health Score, it just doesn't interrupt.
6. **Every new card type gets a Simulation Studio registry entry** at build time, not bolted on later — filming/marketing capture is a first-class requirement of this spec, not a follow-up task.

---

## Known gap this spec does NOT fix (called out, not silently absorbed)

Per `Rostiro_UX_Behavior_Spec.md`: **true per-league waiver-cutoff divergence is unbuilt** — onboarding doesn't yet capture each league's actual commissioner-set cutoff time, so today's "next deadline" data may be using a default/assumed time rather than each league's real one. Per decision #1, the UI must not paper over this. See Component 2 below for how this spec handles it honestly without solving the underlying onboarding gap (that's separately scoped work, not this spec).

---

## Reusable vs. net-new

**Reusable (do not reinvent):**
- System Bar's `next-hard-deadline` computation (§6.7 W1) — becomes the input to Component 2's ranking, not replaced.
- Pulse item architecture: `pulse_items` table, fingerprinting, Done/Snooze/Dismiss (§6.7 W3).
- Health Score's per-league weighted computation (§6.2, `lib/healthScore.ts`) — exposure/portfolio synthesis reuses this pattern, not a new scoring system.
- Start/Sit Engine (§6.4) — Component 4 (advisory lineup calls) is this engine's output pushed proactively, not a new recommendation model.
- Engagement trigger + push infrastructure, rate-limiting, and the `engagement_log` dedup pattern (§6.12, and the `starter_scratch` precedent in `2026-07-11-starter-scratch-alerts-design.md`) — Component 3's Critical tier reuses this exactly, adding a bypass flag rather than new plumbing.
- Experience Layer's `<Hint>` component, hint registry, and `seen_hints` persistence (§6.8 E1) — tooltips for every feature in this spec register into this existing system.
- Simulation Studio's event registry + presentational-component-extraction pattern (`2026-07-10-simulation-studio-foundation-design.md`) — every new card type follows the same `InterruptCardView`-style extraction.

**Net-new:**
- `league_favorites` table + Leagues page / onboarding toggle.
- Deadline-list ranking/truncation component with an honesty-flagged "estimated" state for unconfirmed per-league cutoffs.
- `player_scratches`-style **opportunity signal**: cross-references an injury/scratch against real free-agent/waiver availability across the user's leagues (the "handcuff" detector).
- Critical Pulse item class + bypass flags on the existing cap/rate-limit logic.
- Cross-league free-agent search UI + API route.
- `lineup_decision` proactive push variant (Start/Sit engine already computes the recommendation; this adds the proactive/cross-league push path).
- Four new Studio registry entries.
- Hint registry entries for the above (uses existing infra, no new component).

---

## Component 1 — League Favoriting

**Data:** `league_favorites (user_id, league_id, favorited_at)`, simple join table. No favorites = all leagues treated as favorited (no empty state by default; opt-in reduction, not opt-in inclusion).

**Surface:** a star toggle on each league card (Leagues page, and the onboarding "confirm your leagues" step). Favoriting/unfavoriting is instant, no confirmation modal.

**Effect:**
- Pulse generation (`buildPulseItemsForUser`) filters to favorited leagues only, **except Critical items (Component 3), which always include every league regardless of favorite status** — a Critical alert is stakes-based, not attention-preference-based, and hiding a championship-deciding handcuff because a league wasn't starred defeats the point.
- Game Day live panel (§6.12) scopes to favorited leagues.
- Leagues page, Health Score, and free-agent search (Component 5) remain unscoped — favoriting narrows what interrupts you, not what you can see.
- System Bar's per-league health dots keep showing all leagues (small, ambient, non-interrupting by nature) — only the interrupting surfaces are scoped.

**Default state:** all leagues favorited at connect time — a user has to opt down, never opt up from zero. Avoids the empty-Pulse first-run problem.

---

## Component 2 — Deadline display at scale (honest ranking, not synthesis)

**The rule from decision #1, applied concretely:** the deadline shown is always a real per-league value. What changes with league count is *how many are shown at once* and *how they're labeled when confidence is incomplete*.

**Ranking (deterministic, not AI):**
- Sort all upcoming deadlines (waiver cutoffs, lineup locks) across favorited leagues by real time-remaining.
- **2-3 leagues:** show all, full detail, no truncation needed.
- **4-9 leagues:** show top 3 by time-remaining as full cards; remaining shown as a single "+N more today →" row that expands to the complete honest list on tap. Nothing is hidden permanently — everything is one tap away, always.
- **9+ leagues:** same mechanism; the truncation point doesn't change, only how many leagues sit behind the "+N more."

**The honesty flag (addresses the Known Gap above):** any deadline sourced from a default/assumed cutoff rather than a confirmed per-league commissioner setting renders with a visible `~` prefix and a tooltip: *"Estimated — this league's exact waiver time isn't confirmed yet."* This is the concrete, shippable answer to "don't show guessed data as if it were certain" without having to first build the full per-league-cutoff onboarding capture (separate, larger scope). A confirmed cutoff (if `lib/yahoo.ts`/`lib/espn.ts`/`lib/sleeper.ts` can source it directly from league settings — worth checking per-platform in the implementation plan) renders with no `~`.

---

## Component 3 — Critical alert tier (the handcuff case)

**Trigger condition (both must be true, both computed from real data, no guessing):**
1. A rostered **starter** (any favorited or non-favorited league — see Component 1) receives a high-confidence scratch/injury signal (reuses `player_scratches` + `classifyScratch` from the 2026-07-11 spec, unchanged).
2. The player's direct real-world replacement (handcuff) — resolved via a real depth-chart/backfield mapping, not inferred by Claude — **is a free agent or on waivers in one or more of the user's connected leagues**, checked against real per-league roster data already fetched for the free-agent search (Component 5).

**New signal:** `cross_league_opportunities` — one row per (scratched player, replacement player), computed in the same news-cron pass as the existing scratch detector, cross-referenced against each user's real league rosters at push time (not stored per-user — computed at delivery, same pattern as `detectStarterScratches`' `byUser` map).

**Behavior — this is the load-bearing part of the spec:**
- Renders as a distinct visual treatment (red/urgent accent, per the System Bar's existing State-driven accent language in §6.13) — visually different from a normal Pulse card, not just sorted first.
- **Never counted against Focused mode's 5-card cap.** It's an addition, not a replacement of another card.
- **Never included in Component 2's "+N more" truncation logic** — it doesn't compete with deadlines for a slot, it's a separate always-visible lane.
- **Bypasses push quiet-hours/rate-limiting** (extends the gate logic in `pushToUser`/`detectStarterScratches`) — this is the one alert type allowed to interrupt regardless of time-of-day settings, mirroring how the existing scratch-alert spec already treats high-confidence pushes as urgent-but-restrained; Critical goes one step further because the *action* (claim the handcuff before someone else does) has a real, short window.
- **Cross-league framing in the copy itself:** one card, not N — *"{Injured player} questionable — {Handcuff} is a free agent in {N} of your leagues: {League A}, {League B}, {League C}."* Each league name deep-links to that league's waiver claim page.
- Free tier still gets the in-app card (consistent with existing scratch-alert precedent: card is free, push is Pro-gated).

**Why this doesn't fight Component 1's favoriting:** stakes override attention preference. A user who de-prioritized a league by not favoriting it still gets told their championship is on the line in it — that's the one case where Rostiro overrides the user's own filter, and it's disclosed as such in onboarding copy ("Critical alerts always show, even for leagues you haven't starred — a real injury+opportunity is too high-stakes to filter out").

---

## Component 4 — Advisory lineup calls in Pulse (the honest Auto-Pilot answer)

**What it is:** the existing Start/Sit Engine (§6.4) already computes start/sit recommendations on demand. This component makes a meaningful recommendation **proactive** — a new `lineup_decision` Pulse item fires when the engine's confidence gap between two rostered players crosses a real threshold (implementation detail: reuse whatever gap metric Start/Sit already surfaces, don't invent a new one).

**Cross-league collapse:** if the same start/sit call applies in multiple leagues (same two players rostered similarly), one card lists all affected leagues — same `byUser`-style grouping pattern used throughout this codebase, not a new pattern.

**The explicit non-claim:** the card states the recommendation and links to each platform's own lineup page (deep-link, per the existing "deep-link, don't replace" philosophy, §5.1/6.3). Copy pattern: *"Start {Player A} over {Player B} — {reasoning}. Affects: {League 1}, {League 2}."* → tap opens the platform's lineup page directly, pre-scrolled if the platform supports a deep anchor (implementation detail, best-effort).

**Gating:** free tier keeps the existing 3/week Start/Sit cap (§6.4) applied to how many *proactive* cards can fire, not just on-demand queries — otherwise proactive pushes become a way to bypass the paywall. Pro: unlimited, consistent with existing tiering.

---

## Component 5 — Cross-league free-agent/waiver search

**The gap this closes:** FantasyPros' Multi-League Assistant lets a user search free agents across every connected league at once. Rostiro doesn't have this today (`waiver_alert` is per-league, passive).

**UI:** one search box (Leagues page or a new dedicated surface — recommend Leagues page, avoids a new nav item per the "OS not program" principle in §6.7). Player name search returns real per-league availability: for each league the user's in, is this player rostered, on waivers, or a free agent right now — grouped by player, not by league, so a power user sees "is Tyler Allgeier available anywhere I need him" in one glance instead of checking 9 leagues.

**Data:** reuses each platform client's existing roster/free-agent fetch (`lib/sleeper.ts`, `lib/espn.ts`, `lib/yahoo.ts` — read-only, already built) — no new platform integration, just a new query shape (search-across-leagues instead of list-one-league).

**This also feeds Component 3** directly — the handcuff detector's "is the replacement available" check is the same underlying query, just automated instead of user-initiated.

---

## Component 6 — Tooltips (reuses existing infrastructure, no new build)

Every new interactive surface above registers into the existing `<Hint>` system (§6.8 E1) — no new component, no new persistence model:
- Favoriting star → first-use hint: *"Star your important leagues — Pulse and Game Day will focus on these."*
- Critical alert card, first time one fires → hint explaining why it bypassed the normal card limit.
- Free-agent search → first-use hint on the search box.
- Advisory lineup card → first-use hint distinguishing it from a normal Pulse item ("Rostiro tells you the move, you make it on {platform}").

All dismissed-forever via the existing `seen_hints` jsonb column, "replay tour" already available from Settings/command palette per the existing spec — nothing new to build for the persistence layer, only registry entries.

---

## Component 7 — Simulation Studio integration (per decision #6)

Each new card type gets its presentational component extracted and registered, following the `InterruptCardView` precedent exactly:

| New card | Extracted presentational component | Studio registry `kind` |
|---|---|---|
| Critical alert (Component 3) | `CriticalOpportunityCardView` (props-only, no polling) | `critical-opportunity` |
| Advisory lineup call (Component 4) | `LineupDecisionCardView` | `lineup-decision` |
| League favoriting star + favorited-leagues Pulse view | `FavoritedLeaguesBadgeView` (for showing the "focused on 3 of 9" framing) | `favoriting-demo` |
| Free-agent search result (Component 5) | `CrossLeagueSearchResultView` | `free-agent-search` |

Each gets a `StudioPanel` author form (pick players/leagues, override names/values freely — same hybrid real-prefill + editorial-override model as the existing interrupt-card Studio work) so the founder can fire a realistic-looking version of each moment for recording, without needing a live injury to actually happen first. This directly serves the "get Product Hunt / marketing content ready" goal — these are exactly the kind of feature-highlight clips a PH launch or a content calendar slot needs.

**Zero behavior change to the live app** from this integration — same guarantee as the existing Studio work (presentational extraction, snapshot-tested, live components render identically with the Studio-only optional props absent).

---

## Honesty & marketing guardrails (must ship with the feature, and is the seed for future copy)

- **✅ Claimable:** *"Rostiro watches every league you're in for the one alert that actually matters — like a handcuff opening up the moment your starter goes down, across every platform, in one place."*
- **✅ Claimable:** *"See every free agent available to you, across every league, in one search — instead of checking Sleeper, then ESPN, then Yahoo."*
- **✅ Claimable:** *"Rostiro tells you the exact lineup move — you tap through and make it in two seconds."*
- **❌ Not claimable:** "auto-sets your lineup," "manages your team for you," "never miss a waiver" (the per-league-cutoff estimation gap means this specific absolute can't be said honestly yet), "real-time" for anything running through the 15-minute ESPN RSS-derived scratch pipeline (same constraint as the existing scratch-alert spec).
- **Estimated-deadline disclosure is a feature, not a caveat to hide:** *"We'll always tell you when we're not 100% sure of a league's exact cutoff time — no guessing, ever"* is itself usable as trust-building copy, consistent with the founder's own instinct that honesty is a differentiator against apps that quietly get things wrong.

---

## Tradeoffs recorded (decided)

- **Critical bypasses favoriting** — a deliberate, disclosed exception to an otherwise-clean rule (favoriting = attention control). Accepted because stakes-based information (a real championship-deciding opportunity) outranks a UI preference; the alternative (silently respecting the filter) is the exact failure mode the founder flagged as unacceptable.
- **Estimated-deadline flag ships before the full per-league-cutoff-capture fix** — an honest partial fix now beats a silent wrong number while waiting for the larger onboarding-config project. Revisit removing the `~` flag once that separate project lands.
- **Advisory lineup calls reuse the Free tier's existing 3/week cap** rather than introducing a separate proactive-push quota — simpler, and prevents the paywall being trivially bypassed by making everything "proactive."

## Error handling

Same posture as every trigger in this codebase (§ scratch-alert precedent): best-effort, wrapped in `.catch(() => {})` at the cron/detector call site, per-user/per-league failures `continue` rather than abort. A failed free-agent lookup for one league doesn't block results from the other leagues in Component 5's search.

## Testing (vitest, pure-function-first where possible)

- Component 2's ranking/truncation function: 2, 5, 9, 15-league inputs produce correct top-3 + count; estimated-flag renders only on unconfirmed-cutoff leagues.
- Component 3's opportunity detector: scratch + real free-agent cross-reference produces correct `byUser` grouping; a scratch with no available handcuff produces no Critical item (not a false trigger); Critical item is excluded from the 5-card cap and from Component 2's truncation in a combined-surface test.
- Component 4's cross-league collapse: same recommendation across 3 leagues → one card, all 3 named; free-tier weekly cap correctly counts proactive fires.
- Component 5's search: player rostered in league A, free agent in league B → correct per-league grouping in one result row.
- Studio registry entries: each new `kind` fires with real-prefill defaults and accepts full editorial override, matching the existing `interrupt` kind's test pattern.

## Effort

Medium–High. Components 1, 5, and 6 are individually low-effort (mostly UI + existing-data queries). Component 3 is the highest-effort and highest-value piece — it's a new cross-reference (injury × real-time free-agent availability) layered onto existing signal infrastructure, not a new signal type from scratch. Component 7 (Studio) is additive and can be sequenced after each corresponding feature ships, not a blocking dependency.
