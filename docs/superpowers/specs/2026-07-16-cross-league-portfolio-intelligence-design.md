# Cross-League Portfolio Intelligence UX — Favoriting, Critical Alerts, Free-Agent Search

**Date:** 2026-07-16 (revised same day after a second-opinion review caught real bugs and scope issues in v1)
**Status:** Approved design (v2) → ready for implementation plan
**Context:** Triggered by two real-world events the same week — (1) Yahoo confirmed read-only API access, meaning **no platform grants Rostiro write access to any league**, closing off "auto-set your lineup" as a viable feature; (2) a competitive scan found FantasyPros' My Playbook already ships cross-league free-agent search and an auto-pilot lineup feature. This spec answers both: it locks in the honesty rule ("never show guessed or transformed data — deadlines and facts are as-is; exposure/portfolio synthesis is where Rostiro adds value") and designs the UX that scales from a 2-league casual user to a 9+-league power user without either drowning them or silently hiding something that costs them a championship.

**What changed in v2:** a second-opinion review of v1 found two real bugs (a favoriting-persistence bug and an authorization hole in the favorites API), a self-contradiction on Critical push gating, an incomplete dedup design, and — most importantly — two places where v1 itself violated the founder's own "never show guessed data as fact" rule (calling a depth-chart position a confirmed handcuff; calling a static ADP gap a confident weekly start/sit signal). All are fixed below. A new prerequisite component (Canonical Player Identity) was also added — v1 quietly assumed Sleeper/ESPN/Yahoo player IDs were comparable, which they aren't.

**Supersedes** `2026-07-16-cross-league-portfolio-intelligence-design.md` v1 (same file, same date — this is a same-day correction, not a new spec). **Extends** `Rostiro_Growth_Execution_Jul2026.md`'s honesty contract into product UX, and builds directly on the existing System Bar (§6.7 W1), Pulse (§6.1, §6.7 W3), Health Score (§6.2), Start/Sit Engine (§6.4), Experience Layer hint system (§6.8 E1), and Game Day Engagement System (§6.12) in `Rostiro_PRD_v5.md`.

**Explicitly deferred, not in this spec:**
- **Player Intelligence Card in a multi-league/portfolio context** — a genuinely separate surface (§6.11), needs its own brainstorming pass.
- **Proactive advisory lineup pushes** — v1 scoped this as a new proactive push using the existing ADP-gap Start/Sit engine. That engine is a fine *on-demand, user-requested* tool (unchanged, already shipped) but ADP is a static preseason draft-value metric, not a weekly matchup/health-adjusted confidence signal — using it to justify an unprompted "start X over Y" push overstates its own confidence. This needs real weekly projections (ESPN already has real per-league scored ones, §5.7) before it can proactively push anything. Out of scope until that data foundation exists.
- **Actual marketing copy drafts** (social posts, landing page copy) — the "Honesty & marketing guardrails" section below locks the claimable/not-claimable language every future copy draft must derive from, but writing the copy itself happens after these features ship, against the real built UI, not a moving spec.

---

## Locked decisions (founder, 2026-07-16, revised)

1. **No data transformation, ever, on facts.** Deadlines, lineup locks, and any real-world timestamp render exactly as sourced per league. No merged/averaged/estimated deadline. Where per-league divergence isn't yet modeled (see Known Gap below), the UI must say so rather than show a number that looks precise but isn't.
2. **No data transformation, ever, on inferred facts either — this is the v2 correction.** A depth-chart position is a sourced fact; "this specific player is the confirmed replacement" is a domain inference. Both must be labeled for what they are. Same standard applies to any future "who benefits" logic — sourced inputs are fine to lean on hard, but the leap from input to conclusion must be disclosed, never asserted as certain.
3. **Portfolio/exposure synthesis is the differentiation layer**, and it's allowed to be "smart" (aggregated, ranked, Claude-narrated) because it's synthesizing real per-league facts into a new true statement ("you're exposed to X in 3 leagues"), not guessing at an uncertain one.
4. **No auto-pilot / no write-access framing anywhere in this feature set.** Every "what should I do" surface ends in a deep-link to the platform, not an in-app action that pretends to execute it.
5. **A Critical alert tier exists and bypasses the Focused-mode 5-card display cap and Component 2's truncation** for high-stakes cross-league opportunities. It does **not** bypass any user notification preference — see Locked Decision 7 (v2 correction).
6. **League favoriting scopes Pulse and Game Day**, not visibility elsewhere — a non-favorited league still appears on the Leagues page and in Health Score, it just doesn't interrupt. Critical items ignore favorite status (stakes override attention preference) but never override notification settings.
7. **Push notification gating, corrected in v2: `users.push_enabled = false` is always respected, no exceptions, for any alert type including Critical.** v1 proposed Critical bypassing quiet-hours/rate-limits; that conflated two different things. The correct, final rule: **in-app Critical cards are free and bypass the display cap; Critical push notifications are Pro-gated exactly like every other push type and fully respect `push_enabled`.** Rostiro never overrides a user's explicit opt-out, regardless of how high-stakes the alert is.
8. **Every new card type gets a Simulation Studio registry entry** at build time, not bolted on later — filming/marketing capture is a first-class requirement of this spec, not a follow-up task.

---

## Known gaps this spec does NOT fix (called out, not silently absorbed)

- Per `Rostiro_UX_Behavior_Spec.md`: **true per-league waiver-cutoff divergence is unbuilt** — onboarding doesn't yet capture each league's actual commissioner-set cutoff time, so today's "next deadline" data may be using a default/assumed time rather than each league's real one. Per Locked Decision 1, the UI must not paper over this — see Component 2.
- **Cross-platform player identity is only partially built.** A `player_mappings` table already exists in the codebase but is confirmed unseeded (found in a `lib/yahoo.ts` comment during v1 research); Sleeper's player cache already carries a real `gsis_id` field (the standard nflverse cross-platform join key), and a prior feature already solved a similar "nflverse has no Sleeper id" join-chain gap once (PRD changelog). Component 0 below finishes this, it doesn't start it from zero — but it is real, unstarted-for-this-purpose work, not a given.

---

## Component 0 — Canonical Player Identity (NEW in v2, prerequisite for Components 3 and 5)

**The problem:** Sleeper, ESPN, and Yahoo do not share player IDs. Without a join layer, "is the Sleeper-identified handcuff a free agent in a Yahoo league" (Component 3) and "show me every league this player is available in" (Component 5) cannot be answered correctly — v1 grouped free-agent search results by raw per-platform `playerId`, which would silently produce duplicate/incorrect groupings for the same real person.

**What already exists (confirmed during v1 research, not new information):** a `player_mappings` table referenced in `lib/yahoo.ts` (currently unseeded), and `gsis_id` already present on Sleeper's cached player records (`SleeperCachePlayer.gsisId`). GSIS ID is the standard cross-platform join key used elsewhere in this codebase's data pipeline (nflverse joins).

**Scope for this spec:** build (or finish/seed, whichever the implementation plan finds is actually true of `player_mappings`) a canonical identity resolution with this shape:
```ts
export interface CanonicalPlayer {
  canonicalPlayerId: string  // stable, Rostiro-owned id
  gsisId: string | null
  sleeperPlayerId: string | null
  espnPlayerId: string | null
  yahooPlayerId: string | null
  name: string
  team: string | null
  position: string
}
```
Resolution priority: match on `gsis_id` where available (most reliable); fall back to name+team+position fuzzy match only where GSIS isn't populated on one side, and flag any fuzzy-matched row for manual review rather than silently trusting it — a wrong join here corrupts both Component 3 (wrong handcuff-availability check) and Component 5 (wrong or duplicated search results), so this is not a place to guess.

**This is the seam Component 3 and Component 5 both depend on** — neither should ship using raw per-platform IDs for cross-platform comparison, per Locked Decision 1/2.

---

## Component 1 — League Favoriting (schema corrected in v2)

**v1 bug, fixed:** the original design ("no rows = all favorited, unfavorite deletes the row") cannot represent "favorited everything except league A" when starting from zero rows — deleting a row that was never inserted is a no-op, so the unfavorite silently doesn't persist. Corrected schema:

```
league_preferences
  user_id       uuid
  league_id     uuid
  is_favorited  boolean
```
**Missing row = favorited (true) by default.** Favoriting/unfavoriting always **upserts an explicit row** with `is_favorited` set to the real value — never a delete. This makes every state (all-favorited-by-default, explicitly-favorited, explicitly-unfavorited) representable and persistent.

**Surface:** a star toggle on each league card (Leagues page, and the onboarding "confirm your leagues" step). Instant, no confirmation modal.

**Effect:**
- Pulse generation (`buildPulseItemsForUser`) filters to favorited leagues only, **except Critical items (Component 3), which always include every league regardless of favorite status.**
- Game Day live panel (§6.12) scopes to favorited leagues.
- Leagues page, Health Score, and free-agent search (Component 5) remain unscoped — favoriting narrows what interrupts you, not what you can see.
- System Bar's per-league health dots keep showing all leagues (small, ambient, non-interrupting) — only interrupting surfaces are scoped.

**Security requirement (v2 addition — closes a real authorization hole found in v1):** the favorites API must verify `connected_leagues.id = requested leagueId AND connected_leagues.user_id = authenticated user` **before** writing any preference change. v1's route accepted any `leagueId` from the request body and wrote it via the service-role client (which bypasses RLS) with no ownership check — a real IDOR vulnerability, not a style issue. This check is non-negotiable for this component to ship.

---

## Component 2 — Deadline display at scale (unchanged from v1 — this component held up under review)

**The rule from Locked Decision 1, applied concretely:** the deadline shown is always a real per-league value. What changes with league count is *how many are shown at once* and *how they're labeled when confidence is incomplete*.

**Ranking (deterministic, not AI):**
- Sort all upcoming deadlines (waiver cutoffs, lineup locks) across favorited leagues by real time-remaining.
- **2-3 leagues:** show all, full detail, no truncation needed.
- **4-9 leagues:** show top 3 by time-remaining as full cards; remaining shown as a single "+N more today →" row that expands to the complete honest list on tap. Nothing is hidden permanently.
- **9+ leagues:** same mechanism, only the count behind "+N more" grows.

**The honesty flag:** any deadline sourced from a default/assumed cutoff rather than a confirmed per-league commissioner setting renders with a visible `~` prefix and a tooltip: *"Estimated — this league's exact waiver time isn't confirmed yet."* A confirmed cutoff renders with no `~`.

---

## Component 3 — Critical alert tier (rescoped in v2: RB-only, confidence-labeled, fingerprint-deduped, push gating fixed)

**Trigger condition, both computed from real data:**
1. A rostered **starter** receives a high-confidence scratch/injury signal (reuses `player_scratches` + `classifyScratch`, unchanged from the existing 2026-07-11 spec).
2. **Restricted to running backs only in v1** (v2 correction — see below for why). The player's next-listed RB on the same real NFL team's depth chart is resolved via Component 0's canonical identity + real depth-chart data — and **is a real free agent, on-waivers, or availability-unconfirmed** (never asserted as a clean free agent unless the platform actually confirms it — see Component 5) in one or more of the user's connected leagues.

**Why RB-only, and why "next listed RB" instead of "the handcuff" (v2 correction):** depth-chart order is a real, sourced fact; *which specific player actually absorbs an injured starter's touches* is a football judgment call, not a database lookup — true for every position, but especially unreliable for committee backfields, WR corps (usage often reshuffles across multiple players, not a strict next-in-line), and TE (often no clear backup logic at all). Restricting v1 to RB (where next-in-line succession is the most reliable proxy for real workload transfer, though still not certain) and using disclosed language ("next listed RB on the depth chart" rather than "the confirmed replacement") keeps this feature inside Locked Decision 1/2's honesty rule instead of quietly violating it. Expand to other positions later, after observing real accuracy — not before.

**No Claude anywhere in this detection path.** Pure deterministic lookups: injury classification (existing `classifyClassifier.ts`), depth-chart position comparison, and free-agent/waiver status (Component 5's typed availability check). Add a `confidence`/`provenance` field to the resulting item so the UI can show its own reasoning: *"Next listed RB on Atlanta's depth chart — not a confirmed replacement."*

**Persistence and dedup (v2 correction — this was underspecified in v1):** the resulting Pulse item is **fingerprint-based**, not `engagement_log`-one-shot-based — this is the same reconciliation pattern `lib/pulse.ts` already uses for every other Pulse card (reversal-safe, no-resurrect, re-evaluated on each build), and it's the right fit here because the underlying facts (injury status, free-agent availability) can change hour to hour and the card should track that, not fire once and go stale. No separate `cross_league_opportunities` table is created — the signal is computed live at generation time from `player_scratches` (existing) + Component 0's identity layer + Component 5's availability check, and the Pulse item itself, under its own fingerprint, is the only persisted record.

**Display behavior:**
- Distinct visual treatment (red/urgent accent, per §6.13's State-driven accent language).
- **Never counted against Focused mode's 5-card cap, never included in Component 2's truncation** — a separate, always-visible lane.
- Cross-league framing in the copy: *"{Injured starter} questionable — {Next-listed RB} is available in {N} of your leagues: {League A} (free agent), {League B} (on waivers)."* Each league deep-links to that league's waiver page.

**Push gating (v2 correction, resolves a direct self-contradiction in v1):**
- **In-app card: free tier, always shown, bypasses the display cap.**
- **Push notification: Pro-gated, exactly like every other push type in this codebase — no exception.**
- **`users.push_enabled = false` is always respected.** No alert type, including Critical, ever overrides a user's explicit opt-out. If a founder-level "always notify me of critical opportunities regardless of my other settings" toggle is wanted later, that's an explicit, separately-consented preference to add — not a default behavior this spec assumes.

---

## Component 4 — Advisory lineup calls: **on-demand only in this spec, proactive push deferred (major v2 rescope)**

v1 proposed extending the existing Start/Sit engine into a *proactive* push. **This is removed from scope.** The existing Start/Sit engine (§6.4) stays exactly as it is today — on-demand, ADP-gap-based, user-initiated, already shipped, free tier 3/week cap unchanged.

**Why the rescope:** ADP is a static, preseason draft-value ranking. A 40-spot ADP gap between two players says something about their draft-day perceived value, not about which one is the better *start this specific week* given current health, role, matchup, and scoring format. Using it to justify an *unprompted* push ("Start X over Y") gives that recommendation false authority — the user asked for exactly this level of confidence when they open Start/Sit themselves (it's a lightweight, self-selected tool), but a proactive push implies Rostiro is confident enough to interrupt them, which ADP alone doesn't earn. This is the same honesty standard as Locked Decision 1/2, just applied to a recommendation instead of a fact.

**What would need to be true before this becomes proactive (future work, not this spec):** a real weekly, matchup- and health-adjusted projection per player. ESPN already returns real per-league-scored weekly projections natively (§5.7) — that's a plausible foundation for an ESPN-only proactive version later. Sleeper/Yahoo equivalents are unverified. Revisit as a separate spec once that data exists and the confidence question has a real answer.

---

## Component 5 — Cross-league free-agent/waiver search (v2: performance-hardened, honest availability states, depends on Component 0)

**The gap this closes:** FantasyPros' Multi-League Assistant lets a user search free agents across every connected league at once; Rostiro doesn't have this today.

**Availability states — honest, not binary (v2 correction):** v1 labeled every unrostered player a "free agent," which is wrong — a dropped/available player can be mid-waiver-period and not actually pickable yet. Correct model:
```ts
type AvailabilityStatus = 'rostered' | 'free_agent' | 'waivers' | 'pending_transaction' | 'unconfirmed'
```
ESPN's own API already exposes `FREEAGENT` vs `WAIVERS` as distinct filter values — that platform can be reported accurately. Sleeper (and Yahoo, unverified) may not cleanly expose waiver-period state from a simple roster diff; where the platform can't confirm which of `free_agent`/`waivers` applies, show **`unconfirmed`** with honest copy ("availability unconfirmed — check the platform directly") rather than defaulting to the more exciting-sounding `free_agent`. This directly serves Locked Decision 1.

**Cross-platform grouping uses Component 0's canonical identity**, not raw per-platform IDs — this is what prevents three separate "Tyler Allgeier" rows or a missed match between a Sleeper-sourced query and Yahoo-side availability.

**Performance requirements (v2 addition — v1's design would have hammered platform APIs):**
- **300-500ms debounce** on the search input; no request fires on every keystroke.
- **Minimum 3-character query** before any network call.
- **Cancel stale in-flight requests** when a newer query supersedes them (AbortController).
- **Never call live per-platform APIs synchronously inside a user-facing search request.** Sleeper's full player pool is already cached via the existing cron-populated `players_cache` table (confirmed to already exist in this codebase) — query that, don't call `getSleeperPlayers()` live per keystroke. ESPN/Yahoo waiver data should be fetched with bounded parallelism across a user's leagues (not unbounded sequential loops) and cached server-side with a short TTL, not re-fetched live on every search.
- **Rate-limit handling**: a failed/throttled per-league fetch degrades that one league's results to `unconfirmed` rather than failing the whole search.

**This also feeds Component 3's handcuff-availability check** — same underlying typed availability function, automated instead of user-initiated.

---

## Component 6 — Tooltips (unchanged, reuses existing infrastructure)

Every new interactive surface registers into the existing `HintAnchor`/`HintProvider` system (`lib/hints.ts`, `components/hints/`) — no new component, no new persistence model. Hints for: favoriting star, the Critical alert card (explaining why it bypassed the card limit and what "next listed RB" means), and free-agent search.

---

## Component 7 — Simulation Studio integration (v2: dropped the now-deferred Component 4 entry)

| New card | Extracted presentational component | Studio registration path |
|---|---|---|
| Critical alert (Component 3) | `CriticalOpportunityCardView` | special-case branch alongside the existing `game_day` pattern (not the generic `StatePack<T>` registry — see implementation plan for why) |
| League favoriting | `FavoritingFullSurface`/`FocalCard` | generic `StatePack<T>` registry entry |
| Free-agent search result (Component 5) | `CrossLeagueSearchResultView` | generic `StatePack<T>` registry entry |

Advisory-lineup-call Studio support is dropped along with Component 4's proactive-push deferral — nothing new to film there since the feature itself isn't shipping in this pass.

Each pack gets an author form (pick players/leagues, override names/values freely — same hybrid real-prefill + editorial-override model as the existing Studio work) so the founder can film a realistic version of each moment without needing a real injury to happen first. Zero behavior change to the live app — same presentational-extraction, snapshot-tested guarantee as the existing Studio work.

---

## Honesty & marketing guardrails (must ship with the feature, revised for v2's honesty corrections)

- **✅ Claimable:** *"Rostiro watches every league you're in for the running backs most likely to see a real opportunity when a starter goes down — across every platform, in one place."* (Note: scoped to "most likely," not "the confirmed replacement" — matches the RB-only, disclosed-confidence design.)
- **✅ Claimable:** *"See every free agent available to you, across every league, in one search — instead of checking Sleeper, then ESPN, then Yahoo."*
- **❌ Not claimable, v2 additions:** "the handcuff" or any language asserting a confirmed replacement (it's a disclosed inference, not a fact); "auto-sets your lineup" (still true from v1); "never miss a waiver" (still true from v1 — the estimated-deadline gap); anything implying Rostiro proactively tells you who to start (Component 4 is on-demand only in this spec); "free agent" for any player whose status the platform couldn't actually confirm (must say "unconfirmed").
- **Estimated-deadline and unconfirmed-availability disclosure are both usable as trust-building copy**, consistent with the founder's instinct that honesty is a differentiator — *"We'll always tell you when we're not sure, never guess and call it a fact"* covers both v1 and v2's corrections under one claim.

---

## Tradeoffs recorded (decided, v2)

- **Critical bypasses favoriting but never notification settings** — stakes override attention preference (a UI convenience), never override an explicit opt-out (a trust commitment). These are different categories and v1 conflated them.
- **RB-only for Critical in v1** — a deliberately smaller, honest launch surface over a broader but less defensible one. Revisit once real accuracy is observed.
- **Component 4 cut down to on-demand-only** — ships nothing new this pass beyond what already exists, in exchange for not overstating confidence in a proactive push. The right trade given the founder's explicit priority on trust over feature breadth.
- **Component 0 (canonical identity) added as a hard prerequisite** rather than letting Components 3/5 ship against raw per-platform IDs — more upfront work, but the alternative is silently wrong cross-league data, which is the exact failure mode this whole spec exists to prevent.

## Error handling

Same posture as every trigger in this codebase: best-effort, wrapped in `.catch(() => {})` at the cron/detector call site, per-user/per-league failures `continue` rather than abort. A failed free-agent lookup for one league degrades to `unconfirmed` for that league only (Component 5), never blocks the rest of the search.

## Testing (vitest, pure-function-first where possible)

- Component 0's identity resolution: GSIS-matched pairs resolve correctly; fuzzy-matched pairs are flagged, not silently trusted; ambiguous matches never crash the resolver.
- Component 1's favorite persistence: explicit-false row survives a resolver call even when it's the only row for that user (regression test for the v1 bug).
- Component 1's API: a request for a `leagueId` not owned by the authenticated user is rejected (regression test for the v1 IDOR).
- Component 2's ranking/truncation: unchanged from v1, still valid.
- Component 3's detector: RB-only filter excludes other positions even with valid depth-chart data; fingerprint changes correctly on a status change (open → resolved → re-opened) rather than firing repeatedly on an unchanged state (regression test for the v1 dedup gap); push respects `push_enabled=false` even for a Critical item.
- Component 5's search: debounce suppresses intermediate keystrokes; a throttled platform call degrades that league to `unconfirmed` without failing the whole search; results group correctly across platforms via Component 0's identity layer, not raw IDs.

## Effort

Medium-High, larger than v1's estimate once Component 0 is counted as a real prerequisite. Components 1 (now includes the schema fix + ownership check), 5, and 6 are moderate. Component 3 is the highest-effort, highest-value piece, now correctly scoped smaller (RB-only) than v1's implied broader claim. Component 4 is effectively zero net-new engineering this pass (explicitly deferred). Component 7 is additive, sequenced after each corresponding feature ships.
