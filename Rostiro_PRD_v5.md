# ROSTIRO — Product Requirements Document v5.8
**Run Every League.**
The operating system for fantasy sports.
rostiro.com | July 2026 | Pass directly to Claude Code

---

## Changelog from v5.7 → v5.8

| Change | Rationale |
|---|---|
| T-156 added, shipped — pre-launch billing/security hardening | Auditing the auth + Stripe surfaces before launch surfaced three real gaps: account deletion didn't cancel the Stripe subscription first (a deleted Pro user kept getting billed); `signup`/`forgot-password` were un-throttled and login called Supabase straight from the client with no server route; and `invoice.payment_failed` was unhandled. All three closed — new `app/api/auth/login/route.ts` with rate limits, subscription-cancel-before-delete, and a payment-failed decline email (downgrade still flows through the existing `customer.subscription.deleted` handler). |
| T-157 → T-161 added, shipped — the marketing-content build-out (July 9–10) | Fulfills the long-standing "state-simulation tool" founder brainstorm. **T-157** DEMO_MODE foundation: a route-isolated, in-memory `app/demo/**` running the OS on real box-score data, with a hidden Director's Console for pixel-perfect recordings; zero production leak enforced by a build-failing ESLint rule; Vitest added. **T-158** three choreographed self-playing **live** demos on `/features`, replacing the Remotion placeholders/mp4s, every frame verified pixel-faithful to shipped code. **T-159** the gated **Simulation Studio** (`/demo/studio`) — hybrid authoring (real prefill + full editorial override) that fires simulated OS moments for unlimited marketing capture, on a shared `InterruptCardView` extracted from the real `InterruptStack`. **T-160** generalized it into a state-aware platform with Waiver Day + Film Room packs (16:9 full surface + 9:16 focal card each). **T-161** a self-playing **LIVE second-screen companion** sim driven by an authorable `LiveScenario`. Honesty contract stated throughout: real identities/data + real math for prefill, dramatized only where labeled (editorial overrides, intra-game timing), because the output is marketing. Open item: demo fixtures are on real **2024** data pending a **2025** swap. |
| 🚩 T-162 added — **PRIORITY, pre-Week-1 blocker** (migration + live-verify pending) — Project A: real cross-league win-prob on the Interrupt card | The Simulation Studio *depicted* cross-league win-prob before production computed it — the marketing was ahead of the product. This closes the gap for real users: real touchdown swings now show honest **current per-league win probability** (not a fabricated per-TD delta — the scoreboard feed is team-level only), Pro-gated. Pure `winProb` graduated to `lib/winProb.ts` (single source shared with the demo); `lib/liveWinProb.ts` adapter; persisted to a new `metrics_json` column. **`supabase/migration_interrupt_metrics.sql` must be applied on deploy**; not yet click-through-verified (needs live in-season games). |

## Changelog from v5.6 → v5.7

| Change | Rationale |
|---|---|
| T-152 added, shipped, verified live — Branded Email Suite | Extends the T-135 Resend foundation (previously just signup confirmation + password reset) with 9 new branded transactional emails covering the full billing and account lifecycle: welcome (post-signup-confirmation), 3 purchase confirmations (Rostiro Pro, Founder Season Pass, Founding 500 — the last with a gold accent and a "★ FOUNDER" mark, per the brand kit's playoffs/gold token), subscription-canceled, Season-Pass expiring-soon (one-shot, 6-8 days out) + expired, account-deletion confirmation, and founder-feedback (member confirmation + founder notification, the latter HTML-escaped since it carries user-typed text). New `lib/resend.ts` send functions, `supabase/migration_email_suite.sql` (adds `season_pass_expiry_warned_at`), hooked into `app/api/auth/callback/route.ts`, `app/api/stripe/webhook/route.ts`, `app/api/cron/season-pass-expiry/route.ts`, `app/api/settings/delete-account/route.ts`, and `app/api/founder/feedback/route.ts` — every send wrapped in try/catch so a Resend outage can never block the underlying action (payment, deletion, feedback). Built via `superpowers:subagent-driven-development`, then verified live end-to-end (not just build-clean): real signup, real Stripe test-mode checkouts across all 3 paid tiers, real cron triggers against real Supabase data, a real account deletion, and a real feedback submission including an intentional `<b>test</b>` XSS-escaping check — all 9 emails confirmed delivered, correctly branded, and correctly escaped in a real inbox. Two email-specific rendering bugs found and fixed during this live pass: `emailShell()`'s card content (heading, body text, CTA button) and its logo image were never actually centered — only the top logo/wordmark block was, by the original T-135 template; and the Founding 500 email's new "★ FOUNDER" mark initially caused an ugly line-wrap orphaning the founding number onto its own line, reworked into a small label on its own line above the heading instead. |
| T-153 added, shipped, verified live — signup/password-reset confirmation links were silently broken (found during T-152's live verification) | `admin.generateLink()` (used by both `app/api/auth/signup/route.ts` and `app/api/auth/forgot-password/route.ts` since T-135, to route confirmation content through Resend instead of Supabase's own unbranded sender) is a server-to-server admin API call with no client `code_verifier`, so it can structurally never produce a PKCE `code` — Supabase's hosted `action_link` could only ever redirect back with an implicit-flow token in the URL fragment, which `app/api/auth/callback/route.ts`'s `exchangeCodeForSession(code)` can never read (fragments are never sent to a server). Practical effect: every signup confirmation and password-reset link has been silently landing on `/login?error=auth_callback_failed` instead of `/onboarding` or `/reset-password` since T-135 shipped — a foundational bug that predates this session and was never caught because it had never been exercised with a real click-through until T-152's live verification forced one. Fixed by switching both routes to email their own callback URL with `token_hash` + `type` instead of Supabase's `action_link`, and the callback route to verify via `supabase.auth.verifyOtp({ token_hash, type })` when no `code` is present — the correct, documented pattern for admin-generated confirmation links. Verified live: fresh signup → real confirmation email → correct landing on `/onboarding`, logged in → welcome email (T-152) arrived; password reset → correct landing on `/reset-password`. |
| T-154 added, shipped — `founder_feedback` was missing its RLS policy and grant entirely (found during T-152's Task 7 verification) | `public.founder_feedback` (T-111) had row-level security enabled — likely via Supabase's dashboard Security Advisor at some point — with zero policies attached, which is deny-all, and was never added to `grants.sql` either. Every other table in this codebase follows an enable-RLS + policy + grant pattern (see `supabase/schema.sql`); this was the one table missing it. Practical effect: every real Founding 500 member's feedback submission has been failing with a silent permission-denied 500 since T-111 shipped, not just in this session's testing. Fixed live in the database and committed into `supabase/migration_founder_recognition.sql` (idempotent, safe to re-run) so the fix is in version control, not just a one-off manual DB change. |
| T-155 added, shipped — Technical SEO + LLM crawlability | Closes the gap between what `Rostiro_Marketing_System_v1.md` §15 recommends and what actually existed: no sitemap, no robots.txt, no structured data, no OG image, no `llms.txt`, and the homepage itself had no dedicated metadata. New `app/sitemap.ts` (the 9 real public routes) and `app/robots.ts` (disallows every private app route; explicitly allows both AI training bots — GPTBot, CCBot, Google-Extended, ClaudeBot — and AI answer/citation bots — OAI-SearchBot, ChatGPT-User, PerplexityBot — per founder's explicit call to maximize pre-launch AI-assistant discoverability, not left to default-allow). Homepage given its own `metadata` export for the first time (previously silently inherited the generic root-layout copy on the single highest-value page); `metadataBase` + `alternates.canonical` added site-wide, consistently on the `https://www.rostiro.com` `www` form (T-85 already paid for the lesson that the bare apex 308-redirects and crawlers/webhooks won't follow that). New code-generated OG/Twitter card image (`app/opengraph-image.tsx`, via Next's `ImageResponse`) — no screenshot, built from real brand tokens, same discipline as `/features`. New dedicated `/pricing` page — `PricingSection` extracted out of the homepage into `components/marketing/PricingSection.tsx`, one shared source of truth rendered on both `/` and `/pricing`. Structured data (`lib/seoSchema.ts`): `SoftwareApplication` (on `/pricing` and `/features`), `FAQPage` (on `/faq` — required adding a plain-text `answerText` field alongside the existing JSX `answer` for all 13 FAQ items), `Organization` (site-wide, root layout) — real fields only, no fabricated ratings/review counts, and deliberately no `sameAs` social links since the marketing plan's X/TikTok/Instagram/YouTube handles are still unclaimed. New `app/llms.txt/route.ts` (the emerging llms.txt convention), real facts only, explicitly states Rostiro does not replace ESPN/Yahoo/Sleeper. Explicitly out of scope, not forgotten: a blog (needs a real content system), Google Search Console verification (needs an external verification code first), social `sameAs` links (add once accounts are actually claimed), comparison/"how it works" pages. |

## Changelog from v5.5 → v5.6

| Change | Rationale |
|---|---|
| New companion docs: `Rostiro_Marketing_Brief.md` + `Rostiro_Marketing_System_v1.md` | Founder's own detailed marketing brief (external social/launch marketing system, pre-season awareness/trust/beta-signup goal, not a conversion push — NFL season ~1.5 months out) saved verbatim in the first file; the second is the full deliverable built from it (channel strategies, account setup, bios, content calendar, X/TikTok/Instagram content banks, Reddit/Discord/Product Hunt/newsletter plans, brand asset checklist, SEO/AI-search plan, launch directories, repurposing workflow, founder voice guide, action plan) — audited against this PRD and the brand kit so nothing promises a feature that isn't real. Deliberately kept out of this PRD, which is a product requirements document, not a marketing plan. |
| New companion doc: `Rostiro_UX_Behavior_Spec.md` | T-90/T-92/T-93 shipping real Game Day surfaces this session turned "what does the ticker show if I own a player in that game" from an obvious question into one that took real code-reading to answer precisely. Rather than let that knowledge stay tribal, it's now a living scenario-by-scenario reference (surface × state × condition → what actually renders, checked against code, not intent), started from three specific gaps a founder's simple question surfaced today: ambient surfaces (System Bar badge, Pulse Live Now) don't name players/leagues the way the event-driven touchdown card does; there's no live fantasy matchup scoring anywhere; and T-81's score matching doesn't verify event date. Grows by adding a row per newly-discovered scenario, not via periodic documentation passes. |
| T-101 added — Live Fantasy Matchup Scoring | Confirmed as a real roadmap commitment, not a deferred maybe: every live-score surface today shows real NFL scores, never fantasy point totals or who's winning your actual matchup. Honestly scoped in the new companion doc as a standalone build (new per-player live stat feed + scoring engine against the existing `ScoringSettings` type + matchup pairing + live aggregation) — comparable in size to T-81's original backend, not a small addition to it. Deserves its own design pass before implementation. |
| T-90/T-92/T-93 shipped this session | Game Day live-score UI wiring (Pulse/System Bar/ticker, roster-relevant filtering, free/Pro gating), the kickoff-triggered transition animation, and the Engagement System's 3 buildable triggers (touchdown_swing at team level, lineup_lock, mission_complete) — all verified against real 2026 schedule data. See `Rostiro_UX_Behavior_Spec.md` for exactly what each surface renders. |
| Gap #1 fix — player/league naming on ambient Game Day surfaces | System Bar's live badge and Pulse's Live Now card now show "Hurts, Barkley (2 leagues)," not just a bare score — the data already existed, it just wasn't being carried through. Deliberately never blurred on free plan (it's "why this game is yours," not the score value). |
| Free/Pro gating pass on Game Day (`Rostiro_UX_Behavior_Spec.md`) | Checked every Game Day surface against Section 9's existing pricing table rather than re-deciding it. Found one real bug: push notifications were being sent to every user regardless of plan, despite Section 9 already listing them as Pro-only — fixed in `lib/engagementTriggers.ts`. In-app Pulse cards for touchdown/lineup-lock/mission-complete stay free by design (the "smell what's cooking" layer); only the proactive push is the Pro lever. |
| Multi-league conflict scenarios scoped (`Rostiro_UX_Behavior_Spec.md`) | Documented the real precedence order `computeState()` already implements (Draft > universal Game Day > fixed day-of-week fallback), and sorted conflict scenarios by likelihood per direct instruction not to build ahead of real usage. Tabled: true per-league waiver-cutoff divergence (blocked on onboarding's per-league config, which doesn't exist yet) and fantasy playoff byes (weeks 15+, not urgent). |
| New companion doc: `Rostiro_Behavior_Wiring_Plan.md` | Full audit of all four behavior axes (State/Mode/Plan/Trigger) against every surface in the app, not just Game Day's. Finding: today's Game Day work is the one genuinely complete vertical slice — almost nothing else responds to Mode or the two states (Draft, Standard) the PRD requires for the 8/1 launch. Also surfaces a real architecture gap: T-93's trigger events (touchdown/lineup-lock/mission-complete) render through the Action-layer Pulse queue (Done/Snooze/Dismiss) when 7.1 classifies them as Interrupt-layer (transient, auto-dismiss) — works today, but not the intended interaction model. Draws an MVP fence, an August window, and an explicit expansion list, plus T-102–T-108 below as the recommended build sequence. |
| T-102–T-106 shipped this session | Mode-aware AI voice (`lib/claude.ts`), Free/Pro usage quota enforcement (3/week + 1-league cap, `lib/usageLimits.ts`), Draft/Standard State surface wiring, Mode threaded into remaining surfaces, and the Interrupt Stack (`components/InterruptStack.tsx`, the real implementation of 7.1's "one persistent interrupt slot" rule). Two real bugs found and fixed along the way: `syncPulseItems`' daily rebuild was silently deleting open touchdown/lineup-lock cards (a fingerprint collision across two independent code paths), and push notifications were reaching every plan despite Section 9 already gating them to Pro. |
| T-109 added and shipped — league integration gap | Found by direct user testing, not a report: `/onboarding` was the only path to connect a league anywhere in the app, with no way back to it once already onboarded — Pulse, Lineup, Leagues, and Settings each only offered a connect CTA in the fully-empty state. New `/leagues/add` (reuses the existing platform connectors, returns to `/leagues` instead of restarting onboarding) plus persistent "Add league" affordances on Leagues/Settings regardless of current count. Also fixed a related honesty gap: Pulse/Lineup's `leagueCount` is Sleeper-only, so an ESPN/Yahoo-only account saw "no leagues connected" despite having one — both now distinguish "zero leagues" from "leagues, just not Sleeper." Same pass fixed a false "Connected" state after a plan-blocked add, and gave ESPN/Yahoo leagues an honest "unknown status" explanation instead of a bare "NO DATA YET." |
| T-110 shipped, T-111 added, T-72 refined | System Bar now shows a real plan badge (T-110) — gold PRO/STARTER/FOUNDER, Founder visibly distinct (filled + star), Free gets none on purpose. Full Founder recognition (Section 9's "priority feedback access, early feature previews") logged separately as T-111 — those aren't mechanically defined yet, a product decision, not an engineering default. T-72 (boot sequence/coach marks) gets an open question flagged: the founder now wants a *mandatory* tooltip tour, a real UX-philosophy fork from the originally-spec'd skippable version — not silently resolved either way, needs a decision before it's built. |
| §12 restructured into a phased build order | Every remaining task (T-73 onward) now sits in exactly one of Phase 1–4 or the deferred list, sequenced by what MVP functionality genuinely needs early vs. what has runway — this replaces ad-hoc "what's next" discussion as the standing deferral/prioritization mechanism going forward. |
| T-112 added — marketing landing page overhaul | Founder review: the post-auth product (OS design tokens — void/glass/signal, mono tabular-nums) has visibly outpaced `app/page.tsx`'s generic navy SaaS look, last touched at T-66/T-74. Also caught a real 3-way pricing mismatch: shipped code (`free/starter/pro/commissioner`), the landing page's displayed plans (Scout/Starter/Pro/Commissioner), and the PRD's own §9 target model were all different. Confirmed with the founder: **Free / Rostiro Pro ($9.99/mo) / Founder Season Pass ($59) / Founding 500 ($149 lifetime, capped at 500)** is the real target — this is what T-85 and T-112 both build toward. |
| T-85 Stripe status confirmed | No Stripe account exists yet (confirmed with founder, July 4, 2026) — real billing is blocked on that account existing, same category of external blocker as Yahoo OAuth. Schema, plan-gating logic, and webhook-handler shape can be built against Stripe's documented API now; live checkout can't be verified until real test-mode keys exist. |
| T-75/T-76/T-78 shipped, Phase 1 down to T-85 only | Contrast audit confirmed `--t3`/`--t4` genuinely failed WCAG AA (fixed at the token level, one change instead of ~24 file edits); focus traps added to both full-screen modals (neither trapped Tab or restored focus); ticker given an `aria-hidden` + `sr-only` split (T-75). Security headers (CSP/HSTS/etc.) shipped, plus a real open cost vector found and fixed: the unauthenticated Draft Kit recommend route called Claude with zero rate limit (T-76). Privacy policy, data export, and account deletion shipped — verifying the export route against the live database caught `usage_counters` missing from production entirely, flagged and confirmed re-run by the founder (T-78). |
| Phase 2 shipped in full | T-87's real join-chain gap (nflverse has no Sleeper id) solved and verified against live data; T-94/T-95 built on top of it (buy-low/sell-high signal + Claude recap, verified against the real Anthropic API across all 3 modes); T-97 found and fixed a real cross-component bug (kickoff-sweep firing 3h early); T-73's "pending" gating decision turned out to already be shipped, just undocumented. Confirmed with the founder: knocking out all account-free work now, Stripe/T-85 gets its own dedicated pass once the account exists. |
| T-72 boot sequence: two real bugs found via the founder's own live testing | Every login now plays a boot animation, but the first version had two real bugs, both caught live, not by me proactively: (1) clicks were dead across the whole app once the sequence ended naturally — a `[phase]`-keyed effect was clearing its own still-pending sibling timer; (2) the real UI still flashed before the overlay appeared even after an initial `useLayoutEffect` fix, because the actual gap was earlier — the server has no `sessionStorage`, so its HTML always painted the real content first. Both fixed and reverified against faithful reproductions, not just spot-checked. |
| Pulse detail drawer overlapping the System Bar — real bug, found via a screenshot | Root cause was a genuine CSS gotcha: the drawer rendered inside an ancestor with its own `z-10`, which creates a stacking context — `position: fixed` escapes layout flow but not a stacking context, so the drawer's `z-40` was only ever evaluated inside that ancestor, capping it below the System Bar's root-level `z-20`. Fixed with a React portal to `document.body`; reproduced the exact bug in isolation first to confirm the diagnosis before shipping the fix. |
| Phase 3 shipped in full (T-84, T-86) | T-84: feature flags and staggered crons were already done; added the two real gaps (per-platform circuit breakers + API observability), deliberately excluding 401/403/404 from tripping the breaker since those are per-user issues, not a platform outage. T-86: flagged a real ambiguity rather than guessing — "roster grade" isn't defined anywhere in the PRD the way Health Score is, and this data is stored historically, so a wrong guess would be expensive to fix later. Confirmed with the founder: reuse Health Score rather than invent a new formula. |
| Founder brainstorm: state-simulation tool + event-trigger animations | ✓ **Built out July 9–10, 2026** — this became the DEMO_MODE foundation + Director's Console (T-157), the choreographed feature-page demos (T-158), and the state-aware **Simulation Studio** (T-159/T-160) with a LIVE second-screen companion sim (T-161); its dramatized cross-league win-prob card also drove the real production feature in T-162. Founder can now author/capture any Rostiro State on demand for marketing stills/video. |
| Draft Copilot join gap — found live, minutes before the founder's own real draft | Pulse's draft deadline reminder linked straight to Sleeper's site instead of into Rostiro's own Draft Copilot; fixed to link to `/draft/join`. Founder's live follow-up — "why should I have to re-enter that information if I already connected sleeper as a league" — led to a real one-click join path: a new `/api/draft/session` POST variant resolves the draft and the user's roster slot directly from a connected league's `league_id`/`team_id`, zero manual entry. Two real bugs caught and fixed before shipping: Zod's `discriminatedUnion` throws at parse time on a duplicate discriminant value (switched to `z.union`), and Sleeper's list endpoint never includes `slot_to_roster_id` (only the single-draft endpoint does) — a real API inconsistency, not a pre-draft-vs-started difference. Verified end-to-end against the founder's real connected league and real draft before pushing. |

## Changelog from v5.4 → v5.5

| Change | Rationale |
|---|---|
| Emotional Experience deepened into a real priority model (7, 7.1, 7.2 — new) | Closes the gap between Section 7's emotion labels and actual build behavior. Adds: a widened Game Day pregame ramp instead of an on/off switch at kickoff; Waiver Day session-mode (resumable, real FAAB/roster-health math, not just reordering); a P0–P3 priority + Ambient/Glance/Interrupt/Action hierarchy for every alert in the product; and a formal Pulse-vs-Game-Day interaction-model split (action queue vs. glanceable ambient), so Game Day's two intensities (single game vs. concurrent slate) are a behavior mode within the existing State, not a new top-level State. |
| Externally validated (7 preamble) | An independently commissioned research pass ("Rostiro Emotional Calendar Report," July 4 2026 — platform product-language survey, fantasy-forum discourse, attention/notification research) converged on the same architecture already committed here without having seen it: a stateful calendar-aware OS, Pulse/Console as two interaction models rather than one, and a portfolio-relevance filter for what deserves interruption. Cited where it sharpens rather than repeats what's already here. |
| Game Day Engagement System (6.12) gets a 7th trigger: Opportunity Surge | The positive mirror to the injury-panic trigger — a rostered bench/stash player's usage or projection spiking week-over-week (reuses the existing nflverse usage cache, T-87 — no new data source). Independently corroborated by the external research's "Breakout surprise / FOMO" event, named without prompting. |
| Handpicked event taxonomy, not the full research list | The research names ~19 distinct emotional events across a season. Building all of them now is the overengineering risk already flagged this session — 7.1 names which ones actually earn a place in MVP and why, deferring the rest explicitly rather than silently. |
| Tasks T-97–T-100 added (14) | Pregame ramp, Waiver Day session-mode, Opportunity Surge trigger, and Console/Pulse engagement telemetry. |

## Changelog from v5.3 → v5.4

| Change | Rationale |
|---|---|
| Seasonal & Intensity Variation added (6.14 — new) | Closes the gap between 6.12/6.13's Game Day triggers (specified once, in the abstract) and how the season actually feels week to week: concurrent-game intensity tiers (Thu/Mon full-detail vs. Sunday multi-game terse-and-rate-limited vs. bye-week quiet framing), trade-deadline-week amplification, and playoffs/championship amplification tied directly to the existing 6.10 theming layer instead of left generic. No new architecture — all read from data 10.2/6.10 already computes. |
| New task T-96 added (14) | Seasonal/intensity variation copy and threshold work, layered onto T-93 (engagement triggers) once that ships. |

## Changelog from v5.2 → v5.3

| Change | Rationale |
|---|---|
| Game Day live-score backend built and verified (10.2, T-81) | `live_scores` table + `lib/liveScores.ts` + a per-minute cron (`app/api/cron/live-scores`) with a cheap early-exit — only calls ESPN's scoreboard when a game is actually inside its live window right now, everything else is one lightweight `nfl_schedule` check. Matched all 16 real Week 1 2026 games correctly against ESPN's live scoreboard, including catching and correctly normalizing the two team-code mismatches between nflverse and ESPN (Rams: `LA`→`LAR`, Washington: `WAS`→`WSH`) that would have silently broken the join if unchecked. This is the hard, novel part of 10.2's architecture — backend only, no UI yet (see below). |
| Game Day Engagement System added (6.12 — new) | Scopes the retention/dopamine layer explicitly requested this session: touchdown/lead-change/trade-offer/injury/lineup-lock notification triggers, rate-limiting and mode-tied density so it never reads as spam, and the pulsing/glow visual language — all built on the fan-out pattern already specified in 10.3, not a new subsystem. |
| Per-State Visual & Motion Language added (6.13 — new) | Closes the "needs a design pass" flag left in 6.10 — one concrete accent/motion/ticker-voice spec per State, plus the kickoff-triggered transition animation sequence. Identifies `PulseMark.tsx` (brand kit component, not yet built) as a shared prerequisite for both the kickoff transition and the existing boot sequence (6.8/T-72). |
| Task list updated (14) | T-81 split into backend (done) and UI/animation (not started) pieces; T-79 marked done. New tasks T-90–T-95 added for the Game Day UI surfacing, PulseMark.tsx, kickoff animation, engagement/notification triggers, and Waiver Day / Film Room State UI — all scoped today, none built yet. Yahoo remains the only open external blocker (application still in review as of July 3, 2026; no new information since v5.2). |

## Changelog from v5.1 → v5.2

| Change | Rationale |
|---|---|
| Yahoo status updated: application submitted, in review (5.3, 5.6) | Root cause from v5.1 refined: Fantasy Sports API access is a separate gated application (organization/product/use-case submission + Yahoo review), not a self-serve permission toggle — confirmed by reading Yahoo's own developer documentation. Application submitted July 1, 2026; in review as of this writing, turnaround unknown. Not a launch blocker — Sleeper + ESPN carry marketing and MVP launch; Yahoo write-back ships as a fast-follow the moment access is granted, no additional engineering lead time since `lib/yahoo.ts` is already built. Added note that Yahoo's attribution requirement includes their logo, not just text, wherever the integration is shown publicly. |
| Stats, Projections & Commentary Data Sources added (5.7 — new) | Closed a real gap: 6.10 named what Film Room and the Player Intelligence Card need to show (usage, snap counts, projections, context) without ever specifying where the data comes from. nflverse specified for snap counts/usage (same cron-cache pattern as ADP/injury snapshots). Projections confirmed platform-native for ESPN (real per-league-scored projections via `statSourceId`, verified live against a free agent with zero rostered status) — no separate projections provider needed for ESPN. Qualitative "what experts are saying" explicitly scoped as a live-Claude-reasoning task, not a RAG-ingestion task, absent a licensed content source. |
| Player Intelligence Card added (6.11 — new) | ⌘K player search (6.7 W4) becomes a decision-intelligence surface: cross-league availability, usage, snap count, projection, and trend for any player, with Claude adding only the explanatory context — same deterministic-then-explained pattern as Start/Sit and Draft Copilot. Reprioritizes its own content by the active Rostiro State (6.10), extending "components rearrange by day" down to the individual-player level. |

## Changelog from v5.0 → v5.1

| Change | Rationale |
|---|---|
| ESPN confirmed viable end-to-end (5.2, 5.6) | Live-tested against a real connected private league, not just read from code: rosters, matchups/live scoring, waivers/free agents, and league records (historical seasons) all confirmed with real HTTP 200 responses and correctly-shaped data. Live draft tracking (`mDraftDetail`) confirmed reachable with correct real-time state transitions; pick-by-pick population strongly supported but not directly witnessed in one session (mock room auto-deleted right after completion). Two lib-layer bugs found and fixed along the way: an onboarding error-reset loop, and Yahoo's OAuth scope malformation (see below) — neither ESPN-specific, found while testing the connect flow generally. |
| Yahoo blocked, root cause isolated (5.6) | Two real bugs found and fixed in code: a malformed combined OAuth scope (`fspt-r fspt-w`) that Yahoo rejected outright, and an onboarding page that silently reset to step 1 on any connect failure instead of showing an error. Fixing both did not resolve the underlying issue — Yahoo still rejects every Fantasy Sports scope value while accepting requests with no scope at all, proving the app itself has never been granted Fantasy Sports permission in Yahoo Developer Network. This is an account-configuration blocker, not a code problem — action item for the account owner. |

## Changelog from v4.5 → v5.0

| Change | Rationale |
|---|---|
| Rostiro States added (6.10), separated from persona Modes | Modes (Focused/Balanced/Savant, Section 3) are a user's chosen density — what they want to see. States (Draft/Standard/Waiver Day/Game Day/Film Room) are what the OS decides — what week and day it is. Conflating them flattened the OS into a settings toggle. States are automatic, schedule-driven, and universal — every user on every tier feels the Sunday 1pm transformation, since that ritual moment is the emotional core of the product. |
| Scalability & Operational Architecture added (Section 10) | Rostiro is engineered for 1,000 → 10,000 → 100,000+ paying users from day one, not retrofitted later. Deterministic-first, cache-first, centralized-sync engineering philosophy is now a top-level, non-negotiable section, with per-subsystem scalability notes and a dedicated Game Day architecture for the day every user is looking at the app at once. |
| Emotional Experience & Product Philosophy added (Section 7) | Rostiro is a companion through the emotional arc of a season, not fantasy football software. Every day of the week now maps to a named emotion the product is designed to serve, and every feature passes a two-question filter alongside the existing North Star Pulse test. |
| Monetization replaced (Section 9) | Four-tier pricing (Scout/Starter/Pro/Commissioner + Intelligence add-on) replaced with Free / Rostiro Pro ($9.99/mo) / 2026 Founder Season Pass ($59) / Founding 500 lifetime ($149). Sells the enhanced-season experience, not a feature count. Resolves a prior contradiction where Savant mode (meant to be a free identity choice) was partly paywalled behind the Intelligence add-on. |
| Portfolio deprioritized out of MVP | Full roster-grade sharing product (graphics, animated reveals, social distribution) pushed to fast-follow. Underlying weekly grade/exposure data still computed and stored from launch so the eventual feature isn't cold-starting on history it could have had since day one. |
| Social sharing deferred post-launch | Confirmed growth mechanism, not an 8/1 launch or marketing dependency. |
| Data model reframed sport-agnostic (10.1) | No NFL-specific assumptions in core schema, even though only NFL ships for 2026. Building other sports stays out of scope (13); the schema simply doesn't foreclose it. |
| Ahead-of-schedule status noted (12) | As of July 3, 2026, build is ahead of the original Week 3–7 plan. That room is what allowed States and the Scalability baseline to move into MVP instead of being deferred past launch. |

## Changelog from v4.4 → v4.5

| Change | Rationale |
|---|---|
| Native-OS visual redesign shipped (3, 6.7) | The approved mockup (July 2026) is implemented: token system on CSS custom properties, glass surfaces over an ambient ground, icon dock, glowing signal accents, mono live values, panel-style route transitions, detail drawer, bottom ticker strip. Marketing surfaces deliberately untouched pending designs. |
| Experience Layer added (6.8) | Signup and every login should feel like an experience, not a form. Boot sequence, coach-mark hint registry, ticker seasonal roadmap (the ticker + Pulse are the bread and butter), features page. |
| Product Foundations added (6.9) | Accessibility, security hardening, Daylight (light) theme, and privacy policy + data controls are now first-class build targets with acceptance criteria — not launch-week afterthoughts. |
| Tasks T-72 through T-78 added (12) | The Experience Layer and Product Foundations workstreams. |
| Open decisions flagged (6.8, 6.9) | Four decisions recorded with recommended defaults: meaning of "locked" in-game scores, first-run style, light-mode timing, features-page timing. Defaults apply unless overridden. |

## Changelog from v4.3 → v4.4

| Change | Rationale |
|---|---|
| Rostiro OS Shell added (6.7) | Full PRD-vs-codebase audit found the UI reads as disconnected pages ("a program"), not an operating system. The shell adds ambient state (system bar), a Leagues page with Health Score (closing T-52), persistent actionable Pulse, a command palette, and mode persistence. Approved from interactive mockup July 2026. |
| Navigation updated (7) | Leagues added to sidebar and bottom nav — it was specified in v4 but never present in the built nav. |
| Tasks T-67 through T-71 added (12) | The five OS Shell workstreams, sequenced so each ships independently. |

## Changelog from v4.2 → v4.3

| Change | Rationale |
|---|---|
| Draft Copilot platform research added (5.6) | Researched whether Yahoo/ESPN/CBS/NFL/Fantrax/MFL can support live draft tracking like Sleeper. Yahoo confirmed viable (official API, already has an unused `getYahooDraftResults` function). CBS and NFL Fantasy ruled out — no viable API surface. MFL and Fantrax confirmed viable, no OAuth needed. ESPN's `mDraftDetail` lead from v3 was never actually tested for read-only tracking — re-opened, not ruled out. |
| MyFantasyLeague pulled forward in priority (5.5) | Turns out to have one of the most open fantasy APIs in the industry, live-draft-capable with no OAuth — easier to build than CBS/NFL, worth prioritizing above them in Phase 2. |

## Changelog from v4.1 → v4.2

| Change | Rationale |
|---|---|
| Draft Copilot added to Draft Kit (6.3.1) | The real drafting pain isn't pre-draft rankings — it's the mid-draft panic moment when a run starts, your target gets sniped, and the clock hits single digits. Live tracking + pre-fetched recommendations turn that panic moment into a solved problem instead of a scramble. |
| Draft Kit reframed as companion, not draft room | Sleeper/ESPN/Yahoo have no draft-submission write API — confirmed in 5.1. Rostiro tracks and advises in real time; the user still clicks the pick on the platform's own site. Deep-link, don't replace. |

## Changelog from v4.0 → v4.1

| Change | Rationale |
|---|---|
| "Most popular" badge removed from Focused mode | No user data to support this claim pre-launch. Replaced with "Quick & clean." |
| Step 4 league variables collapsed to 3 upfront | Full 10-variable form causes drop-off. Show scoring format, roster type, waiver system. Rest behind "Advanced settings." |
| iOS push friction surfaced before permission prompt | "Add to Home Screen" requirement for Safari iOS must be shown before user taps — not discovered after failure. |
| Blue-tinted dark theme confirmed as design standard | `#0D1B2A` / `#0A1520` chosen over zinc-gray — sports data terminal aesthetic, more distinctive than generic dark SaaS. |
| Step 6 completion toast added | Closes the loop. "Rostiro is running. You'll get your first alert Saturday at 11pm." Sets a specific expectation. |
| Three modes confirmed: Focused / Balanced / Savant | Balanced covers the largest real user cohort — wants context, makes own decision. |
| Mode selection moved to Step 1, before account creation | Configuring an OS before committing > signing up for a tool. |

## Changelog from v3 → v4.0

| Change | Rationale |
|---|---|
| ESPN onboarding repositioned as "unlock" step, not peer platform | Cookie friction causes first-session drop-off |
| Focused/Savant is now a first-run choice, not a toggle | Mode should shape the entire experience, not be a buried setting |
| Design philosophy updated to mobile-first, premium dark | Saturday night push → users are on phones in bed |
| Pulse empty state spec added | Empty inbox post-onboarding feels broken |
| League Health Score added as always-on dashboard signal | Gives the dashboard value even with no urgent actions |
| Season updated to 2026 throughout | Building for 2026 NFL season |
| Stack updated to Next.js 16 | Scaffolded with 16.x |

---

## 1. Vision, Positioning & Core Philosophy

Rostiro is not a fantasy football assistant. It is not an AI chatbot with rankings. It is the **operating system for fantasy sports** — confirmed by competitive research showing the Pulse/inbox column (PI) is empty across every major competitor in the market.

Fantasy managers playing in 3-5 leagues across ESPN, Yahoo, and Sleeper are switching between apps constantly — checking injuries, setting lineups, processing waivers, analyzing trades — in 3 different UIs with 3 different notification systems and zero shared intelligence. Rostiro ends that.

| Field | Value |
|---|---|
| Product name | Rostiro |
| Domain | rostiro.com |
| Tagline | Run Every League. |
| Category | The Operating System for Fantasy Sports |
| Target user | Fantasy managers in 2+ leagues across ESPN, Yahoo, and/or Sleeper |
| Target persona | The savant who manages 3-5 leagues and feels the platform-switching pain daily |
| Launch target | August 1–10, 2026 — before first major fantasy drafts |
| Platform | Web app, mobile-first responsive. No native app for MVP. |
| Stack | Next.js 16 · TypeScript · Supabase · Tailwind CSS · Claude API (claude-sonnet-4-6) · Stripe · Resend · OneSignal |
| Hosting | Vercel |

### The North Star Experience

Every product and build decision must be evaluated against one question: **does this make the morning Pulse screen better or worse?** If it does not improve the morning screen, it does not ship in MVP.

```
ROSTIRO PULSE — Good morning, Lawrence.
5 decisions across 3 leagues. Est. completion: 2 minutes.

[CRITICAL]   Bench Stefon Diggs in 2 leagues — 31 mph winds in Buffalo at kickoff.
[IMPORTANT]  Claim Jaylen Warren (Yahoo, League 2) — waiver cutoff 3:00 PM today.
[REVIEW]     Trade pending — your Kupp for their Ekeler. Lean accept. Addresses RB2 gap.
[WATCH]      Joe Mixon questionable. Monitor until 12:30 PM. Pivot: Zach Moss.
[INTEL]      Opponent likely streaming a QB. Your defense matchup is favorable.

[ Set lineups -> ]     [ Claim waiver -> ]     [ Review trade -> ]
```

### Enhancing, Not Replacing (v5.0 — new)

We are not replacing ESPN, Yahoo, or Sleeper. We are enhancing the fantasy football journey that already exists on top of them. Rostiro is designed to enhance the emotional experience users already have throughout a season — not to showcase AI (see Section 7 for the full emotional philosophy).

Alongside the North Star Pulse test above, every feature also passes a second filter:

> **1. Does this improve the user's fantasy experience? 2. Does this enhance the emotion they are already feeling right now?**

If the answer to either is no, it does not belong in Rostiro.

### Core Philosophy — Non-Negotiable

- **AI is infrastructure, not the headline.** Never market "AI." Market the outcome: fewer missed decisions, more wins.
- **Surface actions, not information.** Every feature must produce something the user can act on.
- **Cross-league before single-league.** Every intelligence call considers all connected leagues simultaneously.
- **Explainable by default.** Every recommendation shows 2-3 sentences of reasoning. No black-box scores.
- **Deep-link is a feature.** "Rostiro tells you exactly what to do and takes you there in one tap."
- **Mode is identity, not a setting.** Focused and Savant are not toggles — they are the user's declared relationship with the product. Set once at onboarding, changeable anytime. **Distinct from States (6.10)** — Modes are chosen by the user; States are decided by the OS based on what day it is.
- **Mobile is the primary surface.** Saturday night at 11pm when the push fires, users are on their phone. Design for that moment first.
- **Deterministic first, AI second (10.1).** Claude reasons; it never calculates.

> **COMPETITIVE VALIDATION:** ChatGPT deep research across 18 competitors confirms the PI (Pulse/inbox) column is empty across the entire market. No competitor has built a true cross-platform action center. This is the white space.

---

## 2. Product Architecture

| Layer | Purpose |
|---|---|
| Rostiro | The consumer brand and web product at rostiro.com |
| Rostiro OS | Core engine. Sync, normalization, intelligence, prioritization, orchestration. Users never see it — they feel it. |
| Rostiro Draft Kit | FREE preseason acquisition product. Standalone at rostiro.com/draft. No account required to start. Funnel into Rostiro Pro. |
| Rostiro Pulse | The daily command center and prioritized action inbox. The morning screen. The retention engine. |
| Rostiro Intelligence | Premium reasoning layer. Natural-language queries. "Why this move, why this league, why now." Savant mode. |
| **Rostiro States** *(v5.0 — new)* | Automatic weekly/seasonal cockpit reconfiguration — Draft / Standard / Waiver Day / Game Day / Film Room (6.10). Not a plan tier and not a user setting: every connected user moves through the same States on the same schedule. |

> **Modes vs. States, in one line:** Modes are what the user chooses to see (Focused/Balanced/Savant, Section 3). States are what the OS decides it is (6.10). Both apply at once, independently.

---

## 3. Design Philosophy (v4 — Updated)

### Premium Dark-First

Rostiro should feel like a Bloomberg terminal built for fantasy sports — not ESPN, not Yahoo, not generic dark SaaS. The design language is:
- **Blue-tinted dark backgrounds** — `#0D1B2A` (page), `#0A1520` (topbar/nav), `#0F2235` (cards). Not pure black, not zinc-gray. The blue tint makes it feel like a domain-specific tool, not a generic dashboard.
- **Subtle borders** (`#1A3050`) — structure without weight
- **`#378ADD` as the primary accent** — used for progress, selection state, active items, and links
- **White as the CTA color** — primary buttons are white text on `#185FA5` or white on dark
- **One destructive accent only** — `#E24B4A` (red) for CRITICAL priority items. Nothing else uses red.
- **Muted text: `#4A6580`** — secondary labels, timestamps, helper text
- **Typography: Geist** — already in the stack, feels native to the product category
- **No gradients on content** — gradients only on hero/marketing surfaces

### Information Density as Identity

The product serves three distinct users. These are not modes — they are personalities:

| Persona | Tagline | What they want |
|---|---|---|
| **Focused** ⚡ | "Tell me what to do." | 5 max actions, verdict before reasoning, one-tap execution, stats hidden by default |
| **Balanced** ⚖️ | "Show me the key stuff." | Decisions + most relevant supporting data inline, expandable to full detail |
| **Savant** 🧠 | "Give me everything." | Full data layer always visible, nothing hidden, AI advisory not directive |

The density choice is made at onboarding Step 1 — before account creation — and persists across every session. It is always changeable from the sidebar. It shapes the entire interface: card density, data visible by default, AI voice, and Pulse item count.

**Focused** — verdict shown before reasoning. Stats hidden, tap "why" to expand. Session time estimate always shown. One-tap actions, no confirmation screens.

**Balanced** — matchup difficulty, injury status, weather always visible inline. Tap any item to expand to full Savant view. Trade and waiver reasoning visible by default.

**Savant** — full data layer: Vegas totals, target share, snap count, usage trends, raw projection numbers, confidence intervals, opponent tendency modeling. AI recommendations shown as advisory, never directive.

### Mobile-First Rules

- **Minimum tap target: 44px** — no exceptions
- **Bottom navigation on mobile** — thumb-reachable: Pulse / Leagues / Draft / More
- **Top navigation on desktop** — standard left sidebar or top bar
- **Cards stack vertically on mobile**, grid on desktop (≥768px)
- **Push notification open → 2 taps to action** — the critical path on mobile must be under 2 taps from notification to completed action
- **375px is the design target**, not an audit step

---

## 4. Onboarding Flow (v4 — Redesigned)

### Philosophy

The onboarding must deliver value before asking for anything. The sequence is:
**value hint → mode selection → lowest-friction connection → first value moment → upgrade prompt**

### Step-by-Step Onboarding Flow — 6 Steps

```
STEP 1 — MODE SELECTION (before account creation)
First interaction. No email asked yet.
"How do you run your leagues?"
Three radio cards: Focused / Balanced / Savant
Each card shows a live preview of how that mode renders the same Pulse item.
CTA: "Continue →"
Stored in localStorage until account is created, then persisted to users table.

  Badges:
  - Focused:  "Quick & clean"       ← NOT "Most popular" — no data to support pre-launch
  - Balanced: "Recommended"
  - Savant:   "Data heavy"

STEP 2 — CREATE ACCOUNT
Email + password. (Magic link removed from login, T-132 — founder decision, not used.)
Headline: "Your Rostiro OS is ready."
Sub-headline: "Create your account to save it."
Never say "Sign up." Never say "Register."
7-day full Rostiro Pro trial begins automatically on confirm.

STEP 3 — CONNECT YOUR LEAGUES
"Connect your first league. Rostiro can't help until you do."
Skip is available but honest — not guilt-free.

  [Sleeper]  Username field visible immediately. Lead with this.
  [Yahoo]    "Connect with Yahoo →" or "Coming soon — join early access"
  [ESPN]     "Unlock ESPN →" or "Coming soon — join early access"

  Yahoo and ESPN show "Coming soon" until integrations are fully approved.
  Early access emails are captured and become the first paid conversion list.

STEP 4 — LEAGUE CONFIGURATION
Per-league card for each connected league.
Show only 3 variables upfront:
  - Scoring format (Standard / Half PPR / Full PPR / TE Premium / Custom)
  - Roster type (Standard / Superflex / 2QB / Custom)
  - Waiver system (FAAB / Rolling / Snake / Free agent)
All other variables (waiver cutoff, playoff weeks, trade deadline, FAAB budget,
scoring modifiers) are behind "Advanced settings ↓" — collapsed by default.
Yahoo and Sleeper: auto-fetch all values pre-filled. Show as "Looks right?" not a blank form.
ESPN: manual input until auth is live.
Never make a variable required if it can be reasonably inferred.

STEP 5 — PUSH NOTIFICATIONS
Headline: "The Saturday night advantage."
Sub-headline: "Injury reports drop at 11pm Saturday. Rostiro alerts you instantly
— before your opponents even check their apps."
Show the actual notification example FIRST, then ask permission:

  ┌─────────────────────────────────────────────┐
  │ Rostiro · now                               │
  │ Joe Mixon is OUT. Affects 2 leagues.        │
  │ Zach Moss is your pivot — tap to act.       │
  └─────────────────────────────────────────────┘

  🚨 Injury reports — the moment they drop
  🌩️ Weather alerts — 30mph winds changes everything
  ⏰ Waiver deadlines — never miss a cutoff
  📅 Sunday morning lineup checklist

iOS detection: if user agent is Safari iOS, show BEFORE the permission button:
  "On iPhone? Tap Share → Add to Home Screen first for full alert support."
  Do not hide this. Do not show it after failure. Show it proactively.

CTA: "Enable alerts 🔔"
Skip: "Skip — I'll check manually"
Denied: email fallback via Resend, no blocking.

STEP 6 — SYNC ANIMATION → LAND ON PULSE
Animated sync screen (2-3 seconds minimum even if sync is faster):
  "Syncing your leagues..."
  "Analyzing rosters..."
  "Building your first Pulse..."

Lands directly on Pulse dashboard — never a settings page, never an empty screen.

Completion toast (shown for 4 seconds after Pulse loads):
  "Rostiro is running. You'll get your first alert Saturday at 11pm."
  This closes the loop and sets a specific, concrete expectation.

If offseason / no urgent items: show Draft Kit card as first Pulse item.
```

### ESPN Onboarding — "Unlock ESPN"

ESPN is not a peer to Sleeper and Yahoo in the connect flow. It is an unlock:
- Label: **"Unlock ESPN"** — never "Connect ESPN"
- Position: Third, collapsed by default in step 3
- 4-step animated cookie guide (DevTools → Application → Cookies → copy espn_s2 + SWID)
- If skipped: dashboard shows a subtle "Unlock ESPN" prompt card, never blocking
- Copy: "ESPN doesn't have an official API — we use your browser cookies. Takes 2 minutes. Read-only."

Users who complete it feel like they've done something — not jumped through a hoop.

---

## 5. Platform Integration Architecture

> **READ FIRST:** The integration approach for each platform drives the entire product architecture. Read this section before writing any data-fetching code. Build each client in its own file: `/lib/espn.ts`, `/lib/yahoo.ts`, `/lib/sleeper.ts`.

### 5.1 Read / Write / Deep-Link Framework

| Platform | Access level | Notes |
|---|---|---|
| ESPN | Read only | Unofficial v3 endpoints + espn_s2/SWID cookie auth. No write API. Deep-link to all action pages. |
| Yahoo | Read + Write | Official REST API, OAuth 2.0. Full read + write: lineup submission, waiver claims, trade proposals. Lead all write features here. |
| Sleeper | Read only | Public REST API, no auth. Username lookup. Full read. No official write. Deep-link for actions. |

### 5.2 ESPN

> **STATUS:** No official API. Unofficial v3 endpoints. ESPN tightened access Aug 1, 2025 — espn_s2 cookie now required for all private leagues. Build behind a typed service layer with graceful degradation.
>
> **VERIFIED LIVE (July 3, 2026), against a real connected private league:** cookie auth (`espn_s2`/SWID) returns genuine data, not just a validation handshake. Confirmed with real HTTP 200 responses and correctly-shaped data — not from reading the code, from actually calling ESPN's API:
> - **League settings** (`mSettings`) — real league name returned, matches ESPN's own site.
> - **Rosters** (`mRoster`) — returns real team roster data.
> - **Matchups/live scoring** (`mMatchup`, `mMatchupScore`) — returns real schedule + scoring data.
> - **Waivers/free agents** (`kona_player_info`) — returns real player pool data.
> - **League records/history** — the exact same endpoint works unchanged for past seasons by swapping the season number in the URL (confirmed against 2020, 2023, 2025, 2026 on the same league, each returning that season's real, distinct league name). This means historical league records are reachable — `SEASON` just needs to become a parameter instead of the hardcoded `2026` constant it is today in `lib/espn.ts`.
> - **Live draft tracking** (`mDraftDetail`) — confirmed the endpoint is reachable and correctly reflects a draft going live in real time (`inProgress` flipped from `false` to `true` at the exact scheduled kickoff, polling a live public ESPN mock draft). Did not directly witness the `picks` array populating pick-by-pick in that same session — the mock room completed and was auto-deleted (ESPN tears mock leagues down right after they finish) before a clean re-poll could confirm it. Reachability and real-time state transition are proven; pick-by-pick population is likely but wants one more clean confirmation before Draft Copilot depends on it for ESPN.
>
> **Engineering note:** `getEspnRosters`, `getEspnMatchup`, `getEspnWaivers`, and `getEspnDraftDetail` already exist in `lib/espn.ts` and work when called directly, but as of this verification none of them are wired to an API route yet — only `validateEspnCredentials` (via `mSettings`, at connect time) is. The remaining work is wiring, not discovery.

**Base URL:** `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/2026/segments/0/leagues/{LEAGUE_ID}` — `2026` should become a parameter to unlock league-records access (see above).

**Authentication:** espn_s2 + SWID cookies. Stored AES-256 encrypted in Supabase. See onboarding guide in Section 4.

**Deep-link strategy:**
- Button text: "Set lineup on ESPN →", "Claim on ESPN →", "Propose trade on ESPN →". Never "Go to ESPN."

### 5.3 Yahoo

> **STATUS:** Official REST API with OAuth 2.0. Full read and write. Attribution required: "Fantasy data provided by Yahoo Fantasy" plus the official Yahoo Fantasy logo — Yahoo's API Access and Use Agreement requires the logo specifically wherever the integration is shown on a third-party site, not just the text attribution.
>
> **Access status (as of July 3, 2026):** Fantasy Sports API access is a separate, gated application process from basic app registration — confirmed by reading Yahoo's own developer documentation. It is not a checkbox on the app's settings page (which is why the app shows up in the developer console with nothing flagged as blocked); it requires submitting an application describing organization, product, and use case, followed by a Yahoo review. **Application submitted July 1, 2026; currently in Yahoo's review queue (day 3 as of this writing), turnaround time unknown.** This does not block MVP launch: Sleeper and ESPN alone are sufficient to market and launch on August 1 (see 5.2, 5.4). Yahoo write-back ships as a fast-follow the moment access is granted, whether that's days or weeks out — the codebase is already built and waiting (`lib/yahoo.ts`), so there's no additional engineering lead time once approval lands, only the wait itself.

**Write operations available (Phase 1):**
- Submit lineup changes
- Add/drop players
- Propose trades

### 5.4 Sleeper

> **STATUS:** Public REST API. No auth required. Username lookup only. Lead platform for onboarding — zero friction.

**Live draft endpoint:** `GET https://api.sleeper.app/v1/draft/{draft_id}/picks` — poll every 10 seconds.

### 5.5 Phase 2 Platform Connectors

| Platform | Priority | Draft Copilot viability (researched July 2026) |
|---|---|---|
| CBS Sports Commissioner | Phase 2 | **Not viable.** Legacy fantasy developer API is deprecated — `developer.cbssports.com` no longer resolves. Would need a different, unofficial approach if revisited. |
| NFL Fantasy | Phase 2 | **Not viable.** No discoverable stable public API. Long-standing known gap in the fantasy-dev community — NFL.com has always been the hardest platform to pull data from programmatically. |
| Fantrax | Phase 2 | **Viable.** Unofficial but well-documented `fxea` endpoints (`fantrax.com/fxea/general/getDraftPicks?leagueId=...`, `getTeamRosters`), no authentication required. Docs explicitly note results "can be retrieved live during a draft." |
| MyFantasyLeague (MFL) | Phase 2 — **pull forward** | **Viable, arguably the easiest of the four.** MFL's official "Developer's Open API" is one of the most open in the industry — long-time favorite of fantasy-nerd tooling. Explicitly supports live draft polling, down to auction-in-progress detection ("if a player has been nominated but no winning bid specified, the auction is currently underway"). No OAuth. Recommend pulling this ahead of CBS/NFL given how little friction it'd take.

### 5.6 Draft Copilot Platform Support (research findings, July 2026)

> Context: v4.2 added Draft Copilot (6.3.1) — live tracking + pre-fetched recommendations during an actual draft. This section tracks which platforms can support it and why.

| Platform | Status | Notes |
|---|---|---|
| Sleeper | **Shipped** | `GET /draft/{draft_id}/picks`, public, no auth, poll every 10s. See 5.4. |
| Yahoo | **Pending Yahoo review (submitted July 1, 2026)** | Official API already has `getYahooDraftResults()` (`/league/{leagueKey}/draft/results`) in `lib/yahoo.ts`, unused until now. Yahoo's own docs: "If called during the draft, it includes the players that have been drafted thus far" — confirmed live-capable, not just post-draft, on paper. Live end-to-end test surfaced that Fantasy Sports API access is a separate gated application, not a self-serve permission toggle (see 5.3) — application already submitted July 1, in Yahoo's review queue as of this writing, turnaround unknown. A combined-scope encoding bug (`fspt-r fspt-w`) was found and fixed in the same investigation but was not the root blocker. No code work remains on this — `lib/yahoo.ts` is ready and waiting on Yahoo's approval. |
| ESPN | **Confirmed viable (verified July 3, 2026)** | Live-tested against a real connected private league (see 5.2): `mDraftDetail` is reachable and correctly reflected a real mock draft going live (`inProgress` flipped exactly at scheduled kickoff). Did not directly witness the `picks` array populating pick-by-pick — the mock room was auto-deleted right after completing, before a clean re-poll. Reachability and real-time state transition are proven; recommend one more clean confirmation pass before Draft Copilot depends on this for ESPN, but no reason at this point to expect it won't work. |
| MyFantasyLeague (MFL) | **Recommended next after Yahoo** | See 5.5 — no OAuth, confirmed live-capable including auction state. |
| Fantrax | **Candidate** | See 5.5 — no-auth endpoints, documented as live-capable. |
| CBS Sports / NFL Fantasy | **Ruled out** | See 5.5 — no viable API surface for either. |

### 5.7 Stats, Projections & Commentary Data Sources (v5.1 — new)

> Closes a real gap: 6.10 names what Film Room and the Player Intelligence Card (6.11) need to show — usage, snap counts, projections, context — without ever specifying where that data comes from. This section is that specification.

**Snap counts and usage trends — nflverse.** Open source, free, no API key, community-maintained, weekly-updated during the season (static files published to GitHub releases). This is the standard source the fantasy tooling community already relies on for exactly this data. Ingest the same way ADP and injury snapshots already work (6.8 E2, 10.3): a cron job pulls the weekly file into a Supabase cache table. Deterministic, cheap, no new architectural pattern — just a new source feeding the existing pattern.

**Projections — platform-native, not an external feed.** Confirmed July 3, 2026: ESPN's API returns real per-player projections (`statSourceId: 1` in the `stats` array, alongside `statSourceId: 0` for actuals) for *any* player, rostered or free agent, both per-week and full-season — and critically, already scored against that specific league's scoring settings, not a generic average. Verified live against a real league: a free agent with zero rostered status still returned a Week 1 2026 projection and a full-season 2026 projection, both computed correctly. This means Rostiro doesn't need a separate projections provider for ESPN leagues — the number is already sitting in data Rostiro is already pulling for rosters/waivers. Yahoo's API is understood to expose the equivalent (unverified — pending the access review in 5.3); Sleeper's equivalent is unverified and should be checked before assuming parity. Where a platform's native projection isn't available, fall back to an external feed rather than blocking the feature — same resilience posture as everything else in Section 10.

**"What industry experts are saying" — not a data-ingestion problem.** No open, free structured API exists for qualitative fantasy commentary/analysis — that's a fundamentally different kind of data (text/sentiment, not stats) than snap counts or projections. Two real options: (a) license a commercial fantasy-content API (not free/open), or (b) let Claude do live web-grounded research at generation time when writing Film Room recaps or Player Intelligence context lines, rather than pre-ingesting a corpus. Option (b) fits the product's own Deterministic-First rule (10.1) better — synthesizing scattered sentiment into a takeaway is reasoning, which is Claude's job, not a fact to fetch and cache. Do not build a RAG pipeline for this without a licensed source to legally ingest — RAG solves *retrieval* over a corpus you already have the right to hold, it doesn't solve *not having* one.

---

## 6. Feature Specifications

### 6.1 Rostiro Pulse — Daily Command Center

> **RETENTION ENGINE:** Pulse is the product. Build Pulse after the data layer is solid.

**Pulse item types:** lineup_decision, injury_alert, weather_alert, waiver_alert, trade_opportunity, opponent_intel, deadline_reminder, exposure_flag

**Pulse generation flow:**
1. Triggered on login, on demand, and on schedule (cron)
2. Fetch fresh roster data from all connected leagues
3. Fetch injury report, weather forecasts, waiver targets
4. Single Claude API call → returns prioritized PulseItem array
5. Store in pulse_items table, serve to client

**View modes (v4):**
- **Focused:** 5 cards max. Clean. One action per card. Completion % shown. For users who chose Focused mode.
- **Savant:** Full portfolio intelligence. All rosters, exposure bars, weather overlays, Vegas totals. For users who chose Savant mode.

**Pulse empty state (v4 — new):**

The empty state is not a blank screen. It shows:
```
ROSTIRO PULSE
Your Pulse is ready for the season.

┌─────────────────────────────────────────┐
│ Preseason intel active                  │
│                                         │
│ • Training camp injury watch: 3 players │
│   on your roster flagged                │
│ • ADP movers: 2 players you own have    │
│   moved +10 spots this week             │
│ • Week 1 schedule: your matchups load   │
│   August 28                             │
└─────────────────────────────────────────┘

Push notifications: ON  ← prompt if not set
```
Never show a blank inbox. In the offseason, show preseason intel, ADP movers, and training camp updates.

### 6.2 League Health Score (v4 — new)

Every league card on the dashboard shows a **Health Score: 0–100**.

Factors:
| Factor | Weight |
|---|---|
| Starter injury risk (% of starters questionable/out) | 30% |
| Bye week exposure this week | 20% |
| Waiver opportunity (top available player value) | 20% |
| Matchup difficulty (opponent projected score vs. league avg) | 20% |
| Roster depth (bench quality relative to starters) | 10% |

Display:
- **80–100:** Green — "Healthy"
- **60–79:** Yellow — "Monitor"
- **0–59:** Red — "Action needed"

This gives the dashboard a reason to exist even when there's no urgent Pulse item. Users open the app to check their health score, not just to react to alerts.

### 6.3 Draft Kit — Free Acquisition Product

> **ACQUISITION FUNNEL:** Free. No account required to start.

User flow unchanged from v3. Key addition: Sleeper auto-sync is the default demo path in all marketing — zero friction, best technical sync.

### 6.3.1 Draft Copilot — Live Panic-Proofing (v4.2 — new)

> **THE PROBLEM:** Pre-draft rankings solve the wrong moment. The moment that actually costs a manager their draft is mid-draft: a run starts, three picks go off-plan, a targeted player gets sniped, and the clock drops under 10 seconds while the manager re-derives "okay, given what's gone, who do I actually take" from scratch. That's the moment Rostiro needs to have already solved.

**Access constraint (see 5.1):** no platform exposes a draft-submission write API. Rostiro tracks the draft in real time and advises — the manager still makes the pick on the platform's own site. Sleeper's live draft picks endpoint (`GET /draft/{draft_id}/picks`) is polled every 10 seconds per 5.4; no manual refresh.

**Four pieces, shipped together as v1 — they solve one problem, not four separate ones:**

1. **Always-current board.** The full player pool is cached locally (`players_cache`); a pick landing on the next poll removes that player from "available" instantly. No per-view API call — this is a local filter over already-cached data, updated on every 10-second poll.
2. **Turn prediction.** From snake draft position + team count + current pick number, Rostiro computes every future pick number that belongs to the manager (`myNextPickNumbers`) and therefore how many picks remain until their turn.
3. **Pre-fetched recommendations.** When the manager is within ~3 picks of their turn, Rostiro generates Claude's reasoning for the top best-available-by-need candidates *before* the clock starts — never during it. The explanation is already rendered the instant the panic moment arrives. A live Claude call during a sub-10-second window is the wrong architecture; a call two picks earlier, during calm time, is the right one.
4. **Run + snipe alerts.** Three or more picks at one position within a short window surfaces a "position run in progress" flag, unprompted. If a manager has queued (starred) a target player and someone else takes them, Rostiro surfaces the next-best option immediately instead of waiting for the manager to notice and re-scan.

**What Claude does and doesn't decide, consistent with 6.4/6.5:** best-available filtering and turn prediction are deterministic (ADP + roster need + draft position math). Claude only writes the explanation for candidates the deterministic layer already surfaced — it is never the thing deciding who's recommended.

### 6.4 Start/Sit Engine

Recommendations across all leagues simultaneously. Free: 3/week. Pro: unlimited.

### 6.5 Trade Analyzer

Win / Lose / Roughly Even verdict + reasoning. Free: 3/week. Pro: unlimited.

### 6.6 Web Push Notifications

**Primary channel.** Saturday night at 11pm injury report push is the core retention mechanic.

Provider: OneSignal. Permission prompt fires after first league connected — highest-intent moment.

### 6.7 Rostiro OS Shell (v4.4 — new)

> **THE PROBLEM:** The built UI is a set of well-made but disconnected pages — the user navigates to a tool and operates it. That's a program. An OS holds ambient state about all leagues, interrupts only with decisions, and brings actions to the user. Three absences cause the "program" feel: no ambient state visible anywhere, no cross-cutting surface that follows the user between screens, and actions that live inside tools instead of on the intelligence that surfaced them.

Approved from an interactive mockup (July 2026). Five workstreams, sequenced so each ships independently:

**W1 — System Bar (T-67).** Persistent chrome on every authenticated screen. Contains: live sync status ("Synced 12s ago", ticking), per-league health dots with hover tooltips, next-hard-deadline countdown (nearest waiver cutoff / lineup lock across all leagues, ticking), mode chip, ⌘K affordance. Mobile variant condenses to dots + countdown. Backed by one `/api/system/status` endpoint (last sync, health scores, next deadline), polled on an interval. This is the single biggest "OS not program" change. *v5.0: the System Bar's accent tone also shifts with the active Rostiro State (6.10) — see 6.10 design language note.*

**W2 — Leagues Page + Health Score (T-68).** The nav item specified in v4 but never built, plus League Health Score (6.2, closing T-52). `lib/healthScore.ts` computes the five weighted factors deterministically from Sleeper rosters + `players_cache` — no Claude call. Preseason degradation is honest: matchup/bye factors show "loads Week 1," never fake numbers. Health ring + factor bars + top flag per league card, linking to that league's Pulse items. Same computation feeds the system bar dots.

**W3 — Persistent, Actionable Pulse (T-69).** Pulse items persist to the existing `pulse_items` table with a content fingerprint (dismissed items don't resurrect on regeneration). Done / Dismiss / Snooze on every card. Morning header: "Good morning, {name}. N decisions across M leagues · Est. completion X min" + progress bar. Cron generation so Pulse is pre-built before the user opens the app. Two new item types with no new data sources: `deadline_reminder` (from W1's deadline detection) and `lineup_decision` (reuses the Start/Sit ADP-gap engine). Daily ADP snapshot added to the players cron now — cheap today, impossible to backfill later — so the empty-state "ADP movers" card ships once a week of data exists.

**W4 — Command Palette (T-70).** ⌘K on desktop, floating action button on mobile. Three command sources: static navigation, live Pulse actions (open items become commands — "Bench Diggs" jumps to the card/deep link), and player search (reuses `/api/draft/players`). Registry pattern so future features register commands without touching the palette.

**W5 — Identity + Polish (T-71).** Mode persists to `users` table (closing T-51); localStorage remains the pre-signup cache. Real Settings page: account, mode, connected leagues with disconnect, notification prefs (UI ready for push). Terminal visual pass: `tabular-nums` on all data, tick animation on live-value updates, denser Savant layouts.

**Explicitly out of scope for the shell** (separate tracks): push/OneSignal, Stripe + quota enforcement, onboarding steps 4–6, weather data, ESPN/Yahoo Pulse merge. The shell is their landing spot — notification prefs UI, deadline countdown, and Pulse actions are where they slot in.

### 6.8 Experience Layer (v4.5 — new)

> **THE THESIS:** The ticker and Pulse are the bread and butter. Signing up and every login should feel like stepping into a running system, not opening a website. An OS doesn't make you watch a tutorial video — it teaches through its chrome.

**E1 — Boot sequence + coach marks (T-72).** First login only: a ~5-second skippable boot moment — system bar comes alive, ticker types out, Pulse panels land in sequence. Then progressive, dismissable coach marks anchored to the crucial instruments: health dots, ⌘K, Pulse actions (Done/Snooze), the ticker, the mode chip. Contextual hints appear on first *use* of a surface (Draft Copilot hint on first draft join), not all on day one. Infrastructure: one `<Hint>` component with a registry (mirroring the palette's command registry), dismissed-forever state persisted per user (`seen_hints` jsonb on `users`), "replay tour" available from Settings and the command palette. Every-login experience stays light: morning header + greeting (built), ticker warm-up on load — no repeated tutorials, daily friction kills retention.
*Open decision (default: boot + coach marks, no modal step-by-step tour).*

**E2 — Ticker seasonal roadmap (T-73).** The bottom strip's data source rotates with the season; the response shape stays fixed so the component never changes:
- **Pre-draft (built):** ADP movement over a 7-day window from `adp_snapshots`; honest "DAY N OF 7" fallback while history accumulates.
- **Post-draft / in-season:** top waiver claims of the week from each connected league's transactions (Sleeper `/league/{id}/transactions` — *your leagues'* actual claims, not generic trends) + injury news from designation *changes*. Prerequisite shipped early: daily injury-status snapshots start now (same "cheap today, impossible to backfill" logic as ADP).
- **Game day:** live scores. Surfaced in the ticker and as Pulse items.
*Open decision on "locked" in-game scores (default: premium-gated — free users see them blurred with an upgrade prompt). To be confirmed before build.*
*v5.0: this rotation is now driven by the same Rostiro States engine (6.10, `lib/rostiroState.ts`) rather than a parallel date check — one source of truth for "what week is it."*

**E3 — Features page (T-74).** Marketing page telling the OS story: what Rostiro does (ambient monitoring, the decision queue, Draft Copilot, Health Score, modes) and how it's different (deterministic numbers, Claude only explains; actions come to you; one system for every league). Embeds the *real living components* — an actual ticking ticker, a live demo Pulse card — never screenshots.
*Open decision (default: build after the incoming marketing designs land, in one pass with the rest of the marketing surface).*

### 6.9 Product Foundations (v4.5 — new)

Genuine build targets with acceptance criteria — not launch-week afterthoughts.

**F1 — Accessibility (T-75).** Acceptance criteria: WCAG AA contrast on all text (known issue: `--t3` dim text at small sizes needs an audit pass), visible focus states on every interactive element, full keyboard operability (palette ✓, drawer focus-trap needed, cards ✓), `prefers-reduced-motion` honored everywhere (✓), ticker marked `aria-hidden` with a static screen-reader alternative, `aria-live` regions for value updates kept polite/off where noisy, semantic landmarks per screen. Audit + fix pass, then a11y checks added to the pre-launch checklist.

**F2 — Security hardening (T-76).** Pre-launch pass: security headers in `next.config` (CSP, HSTS, X-Frame-Options, Referrer-Policy), rate limiting on API routes (especially Claude-backed ones), dependency audit, full `/security-review` run with findings triaged. Already in place and staying: RLS on every table, Zod on every body, encrypted OAuth tokens, CRON_SECRET on crons, service-role keys server-only.

**F3 — Daylight theme (T-77).** Light mode as designed work, not inversion — the glow-and-glass identity needs light equivalents (white translucency + soft tinted shadows instead of glows). Structurally cheap: every color is already a CSS custom property, so the theme is a `:root` swap behind a toggle in Settings + system-preference detection (`prefers-color-scheme`), persisted alongside mode on `users`.
*Open decision (default: post-launch fast-follow — launch is dark-first, it's the brand identity).*

**F4 — Privacy policy + data controls (T-78).** Quietly launch-critical: Yahoo OAuth app review requires a public privacy-policy URL; Stripe expects one. Public `/privacy` page (drafted for review, plain language) covering: what's collected, platform credentials handling (encrypted, never logged), AI processing disclosure (league data sent to Claude for explanations), retention, contact. Backed by real controls in Settings: export my data (JSON), delete my account (cascade — schema already cascades on `users.id`), disconnect leagues (✓ built). Analytics opt-out lands here if/when analytics are added.

### 6.10 Rostiro States — Adaptive Weekly & Seasonal Cockpit (v5.0 — new)

> **THE PROBLEM THIS SOLVES:** Not "Rostiro should change pages." Rostiro should transform its cockpit through the week and the season, automatically, for every user, regardless of plan. Sundays already feel different because of football; rooting for multiple fantasy teams makes it feel more different still. Rostiro attaches itself to that feeling. At 1pm ET on Sunday — the moment there's nothing left to do but watch — the OS should visibly become a different instrument than it was at 8am.

**Distinct from Modes.** Focused / Balanced / Savant (Section 3) are personas the user chooses — how much they want to see. Rostiro States are what the OS decides — what week and day it is. A Savant user in Draft State sees dense data about drafting; a Focused user in the same State sees the single most important draft decision. The two axes are independent and both apply simultaneously.

**Five states:**

1. **Draft State.** Preseason through the user's last draft completes. Emotion: "This is my year." Prioritizes: Draft Copilot, ADP, sleepers, queue. Ticker: ADP movement, position runs (E2 pre-draft source, unchanged). Motion: opportunity, forward momentum.
   - **v5.5 note:** this State has a dormant early phase (deep offseason, Feb–Jul — low-frequency Pulse, no urgency) that ramps into an active phase at training camp (late Jul, beat reports/depth charts — already carried by the existing preseason Pulse empty-state, 6.1) before becoming the high-action board itself. These are depth differences within Draft State, not separate States (7).

2. **Standard State.** Wednesday through Saturday. Emotion: preparation, planning. Close to the dashboard already built — the resting state. Prioritizes: trade discussion, roster optimization, upcoming matchup prep.

3. **Waiver Day State.** The day each user's connected leagues actually process waivers — for most leagues that's Tuesday night into Wednesday morning; Rostiro detects the specific cutoff per league rather than assuming one universal day (see Multi-League Alignment below). Emotion: "Mission Briefing" — opportunity, preparation. Prioritizes: priority waiver targets, recommended drops, projected roster-health improvement, FAAB budget context.

4. **Game Day State.** Any day with a live NFL game involving a roster the user owns a player on: Thursday night (lower intensity), Sunday (full intensity — the signature moment), Monday night (lower intensity). Emotion: Mission Control — anticipation shifting to suspense as kickoff nears. Prioritizes: Pulse, live matchups, injuries, weather, lineup-lock countdowns, live scores in the ticker. Visual language: cockpit, telemetry, mission status. This is the state the product is emotionally built around — see 10.2 Game Day Architecture for how it's served without a polling storm.
   - **v5.5 — pregame ramp (T-97).** The state now activates on a window starting a few hours before the day's earliest kickoff, not only once a game has actually started — closing the gap where the real 11:45am-Sunday "did I set my lineup" scramble (7) fell inside Standard State by the letter of the original trigger.
   - **v5.5 — two interaction intensities within one State, not two States (7.2).** Concurrency of live games (already computable from `todaysKickoffs`) selects how the live phase behaves: one live game (Thu/Mon/SNF) runs every 6.12 trigger at full, unhurried detail; several concurrent games (Sunday windows) leans on P0–P3 tiering and cross-league de-duplication (6.14) so it stays glanceable instead of becoming a wall of cards. No new top-level State, no gating UI — see 7.2 for why that split was deliberately not built as "GameDay Console"/"Primetime Mode" as separate States.

5. **Film Room State.** Monday night through Tuesday morning, before Waiver Day takes over. Emotion: "What happened?" Prioritizes: injuries, usage/snap counts, waiver trends, buy-low/sell-high signals, AI weekly recap. Visual language: review, analysis.

**Playoffs and Championship Week are not additional States** — they're a theming layer applied on top of whichever State is active during weeks 15–17: heightened-stakes visual treatment (more saturated accents, "stakes" framing in copy), without changing which components are prioritized. A Tuesday in Week 16 is still Waiver Day mechanically; it just carries more weight emotionally.

**Trigger mechanics — deterministic, not AI-decided (ties to 10.1: Deterministic First).** State is computed from: (a) day of week / time of day in the user's local timezone, cross-referenced against (b) the NFL schedule (kickoff times for Thu/Sun/Mon games, bye weeks, holiday-schedule irregularities like the Thanksgiving slate and international early-window games), and (c) each connected league's actual waiver-processing cutoff. No Claude call. A lightweight `lib/rostiroState.ts` service computes the active state; the client re-checks only near known transition boundaries (e.g., every 60s in the 10-minute window around a scheduled kickoff or waiver cutoff), never continuously polling all day — this keeps the "living system" feeling without a background timer running full-time for every user.

**Multi-league alignment.** A user's leagues may not agree — one league's waivers clear Tuesday night, another's Wednesday morning; one league has a Thursday-night game affecting a roster, another doesn't. Global chrome (System Bar, Ticker, Pulse ordering) reflects the earliest/broadest applicable transition across the user's connected leagues — if any connected league is in a live game right now, the user is in Game Day State — while individual League cards still show that league's specific status underneath.

**Universal, not paywalled.** Every user, free or paid, feels the State transformation — this is deliberately not a Pro-gated feature, it's the retention/growth hook (9 Monetization: "States are universal, depth is the paywall"). What's gated is depth within a state — e.g., a free user's Game Day still visibly becomes Mission Control at 1pm, but live-score detail may be blurred per E2's existing gating default; a free user's Film Room still shows the "what happened" framing, but deep usage analytics are Pro-only.

**MVP phasing.** We are ahead of schedule as of July 3, 2026, which is why this is in MVP rather than deferred:
- **Draft State** and **Standard State** ship for the 8/1 launch — Draft State is close to already-built Draft Kit/Copilot work, Standard State is close to the existing dashboard.
- **Waiver Day, Game Day, and Film Room States** target **end of August 2026**. There are no regular-season games until Week 1 (~Sept 4, 2026), so there's no live cost to shipping these slightly later, and August preseason games (starting ~Aug 6) are a real, lower-stakes test bed: Game Day State can be validated against actual preseason kickoffs before real Week 1 traffic hits it.
- Ships behind a feature flag (10.1: Feature Flags) — this is new logic activating automatically for 100% of users on the highest-traffic day of the week; an instant kill switch back to Standard State is required.

**Design language per state** (flagged here so it isn't lost — needs a design pass, not fully specified): System Bar accent tone, ticker copy voice, and card border/glow treatment should each shift subtly per state — e.g., Game Day leans toward the cockpit/telemetry mono-value language already established in Section 3, Film Room leans toward a calmer review palette, Waiver Day leans toward the opportunity-green already used for Draft.

### 6.11 Player Intelligence Card (v5.1 — new)

> **THE IDEA:** ⌘K already has player search as one of its three command sources (6.7 W4) — today it only navigates. This turns it into decision intelligence: type a player, get an instant card with everything needed to make a call about them, right now, today.

**What it shows, for any player, at any time:**
- **Availability per league** — rostered, free agent, or on waivers, checked across every league the user has connected (cross-league before single-league, the standing Core Philosophy rule in Section 1)
- **Usage rate and snap count** — from nflverse (5.7), cron-cached
- **Projection** — platform-native where available (5.7): ESPN returns real per-league-scored projections for any player, rostered or not, confirmed live July 3, 2026
- **Trend** — direction of usage/snap share over the recent window, from the same nflverse cache
- **Context** — one or two sentences of Claude reasoning synthesizing the above into "why this matters right now," the same deterministic-data-then-Claude-explains pattern as Start/Sit (6.4) and Draft Copilot (6.3.1); never the thing deciding the numbers, only explaining them

**This is where Rostiro States (6.10) reach the individual-player level, not just the ambient chrome.** The same card reprioritizes what it leads with based on the active State — one card, contents reordered by day, matching the "components rearrange" principle already governing 6.10:
- **Draft State:** ADP, tier, sleeper/bust signal
- **Waiver Day:** usage trend, snap share change, buy-low/sell-high signal
- **Game Day:** live score impact, matchup context
- **Film Room:** what happened this week, usage delta from last week
- **Standard:** projection and availability, the general-purpose default

**Engineering note:** reuses the existing player search plumbing (`/api/draft/players`, 6.7 W4) for lookup; the card itself is new UI, and its data dependencies (nflverse ingestion, per-league availability check) are the same 5.7 pipeline Film Room needs — building one builds the other.

### 6.12 Game Day Engagement System — Momentum Triggers & Notifications (v5.3 — new)

> **THE PROBLEM THIS SOLVES:** Game Day State (6.10) says the OS becomes Mission Control at kickoff — but "becomes" has to mean something a user feels, not just a repainted dashboard. This is the retention core of the product: the moments that make someone check Rostiro instead of just refreshing their platform's own app. Every trigger below exists to serve the emotional arc already defined in Section 7, and every one passes the two-question filter (7) before it ships — none of this is urgency manufactured for its own sake.

**Trigger taxonomy** (v5.5: priority tier column added — see 7.1 for the full P0–P3 model this maps to):

| Trigger | Priority | Fires when | Delivery | Emotion served (Section 7) |
|---|---|---|---|---|
| Injury during live play | P0 | A rostered player is marked questionable/out mid-game | Inline card alert, persistent until seen; OS push always (actionable — surfaces the best bench alternative) | Concern → reassurance |
| Lineup-lock countdown | P0 | Inside the last 30 minutes before the user's own kickoff, with a questionable/unset player in the lineup | System Bar pulsing urgency accent; one OS push, never repeating | Urgency without punishment |
| Touchdown swing | P1 | A rostered player scores, in any connected league | In-app card flash + score tick, auto-dismiss; OS push if app is backgrounded | Excitement, ownership pride |
| Lead change | P1 | A live head-to-head matchup the user is in flips who's winning | In-app matchup-card border glow shift, auto-dismiss; OS push only for the user's own matchup | Suspense |
| Trade offer received | P1 | Any connected league surfaces a new trade proposal | Badge bounce on Leagues nav; OS push always (time-sensitive) | Anticipation |
| **Opportunity Surge** *(v5.5 — new)* | P1 | A rostered bench/stash player's projected usage or snap share jumps past a threshold week-over-week (nflverse cache, T-87 — no new data source) | Celebratory Pulse card + push, leads with the acknowledgment before the numbers; auto-dismiss | Vindication, "I called it" — the positive mirror to injury shock; independently named by external research as "Breakout surprise/FOMO" |
| Mission Complete | P2 | All of the user's live games for the day have ended | Pulse settles to a calm summary card, reusing the completion-bar animation (T-69) | Relief; celebration or support per the win/loss rule below |

**Engineering constraint (v5.5 — from 7.1):** one persistent interrupt slot at a time — a second P1 event queues behind the first rather than stacking, regardless of how many leagues or games are concurrently live.

**Rate limiting and fatigue control — what keeps this from reading as spam:**
- Fan-out from one detection event to all affected users, the same pattern already specified in 10.3 (Notifications) — one touchdown is one server-side event, never N per-user checks.
- Per-user de-duplication across leagues: a single scoring play affecting a user's player in three connected leagues is one push naming all three, not three pushes.
- Mode-tied density (Section 3), so notification volume is a facet of the persona choice that already exists rather than a new setting to design: Focused gets touchdown/lead-change/lineup-lock/trade/injury only; Savant may additionally surface narrower swings (e.g., a late-game momentum shift under one minute left); Balanced sits between.
- Hard ceiling regardless of mode: no more than one push per rostered-player-event per 2 minutes, collapsed into a single "multiple updates" push above that rate — this is what prevents a replay-review reversal or stat correction from double-firing.
- Never fires for events in a connected league the user doesn't own a rostered player in — filtered by the same cross-league-relevance rule that already governs Pulse (6.1's North Star test).

**Visual language — pulsing and glow, inside the existing token system (Section 3), not a new palette:**
- Score-change flash: card border briefly saturates to the existing signal-accent token, then settles back to resting glass state over ~600ms — confident, not jarring, per Section 7's Motion Philosophy.
- Win-probability lean: a live matchup card's accent hue leans toward the existing opportunity or alert token depending on whether the user is winning or losing, at low saturation — a lean, never a full color swap.
- Lineup-lock urgency ramp: System Bar countdown shifts calm → warm → urgent as the deadline nears, extending the deadline-countdown pattern already built in T-67.
- Mission Complete settle: reuses Pulse's existing completion-bar animation (T-69) rather than inventing a new one for end-of-slate.

**Engineering note — this is 10.2 (Game Day Architecture) plus 10.3 (Notifications), not a new subsystem:** detection is a diff between the current live-scores poll and the previous one (T-81's cron, already writing to `live_scores`), evaluated once server-side and fanned out via OneSignal — already end-to-end as of this session — to affected users' devices. No new polling loop and no new external dependency; this is the payoff of the architecture already built, not a reason to build another one.

**MVP phasing:** ships alongside Game Day State's end-of-August window (6.10), behind the same feature flag. An engagement system that fires for the entire user base near the same moment needs the same instant kill switch every Game Day component requires (10.1).

### 6.13 Per-State Visual & Motion Language (v5.3 — supersedes the flagged design-pass note in 6.10)

> Fleshes out 6.10's "needs a design pass" flag into one concrete accent/motion/ticker-voice spec per State, so implementation isn't guessing at what "shifts subtly per state" means.

| State | Accent lean | Card treatment | Signature motion | Ticker voice |
|---|---|---|---|---|
| Draft | Opportunity green | Sharp, forward-leaning borders | Queue items slide in from the right on ADP movement | "X being drafted faster than ADP" |
| Standard | Neutral existing palette | Resting glass, no glow | None beyond existing hover states | Calm, planning-oriented |
| Waiver Day | Opportunity green (shared with Draft — same emotion, per Section 7) | Priority-target cards carry a subtle top-border glow, ranked | Ranked list reorders with a soft reflow, never a hard cut | "Priority target: X, Y% roster-health lift" |
| Game Day | Cockpit/telemetry mono-value tokens (Section 3) | Live cards carry a persistent low-saturation border glow keyed to win/loss lean (6.12) | Score-change flash (6.12), kickoff transition (below) | Live scores, win-probability shifts |
| Film Room | Desaturated, calmer blues/greys — deliberately the quietest palette in the product | Recap cards read as a report, not a dashboard — no glow, no pulse | Single settle-in animation on load, then static | "What happened," never "what you missed" (avoids FOMO framing, per Section 7's non-punitive rule) |

**Kickoff-triggered transition animation** — the one named-but-unbuilt piece from today's session: at the first kickoff of a user's Game Day window, the System Bar and Pulse header transition over ~1.5–2s from Standard's resting palette to Game Day's cockpit accent, never an instant repaint. Sequence: (1) System Bar accent sweeps to the Game Day tone, (2) Pulse header re-labels to "Mission Control" with a brief mono-value flicker-in reusing the boot sequence's visual grammar (T-72) rather than inventing a new one, (3) live score ticker items slide into the ticker strip for the first time that day. Requires `PulseMark.tsx` — a brand kit component that doesn't exist yet — as the shared visual anchor for both this transition and the boot sequence; building it is the first concrete task in the Game Day UI workstream (T-91).

### 6.14 Seasonal & Intensity Variation — Engagement Triggers Across the Year (v5.4 — new)

> **THE PROBLEM THIS SOLVES:** 6.12 and 6.13 specify one Game Day intensity and one playoff theming layer (6.10) in the abstract. In practice a Thursday-night game with one league on the line doesn't feel like a four-game Sunday early window, and Week 16 shouldn't feel like Week 3. Without this, the engagement system is either always-maximum (fatigue) or flat all season (wasted opportunity on the moments that matter most). This section makes the variation concrete instead of leaving it implied.

**Concurrent-game intensity tiers** — the same triggers from 6.12, dialed by how many of the user's games are live at once, not just whether one is:
| Window | Typical concurrency | Trigger behavior |
|---|---|---|
| Thursday Night / Monday Night | One game | Every trigger fires at full detail — low volume means no fatigue risk, so this is the highest-signal, lowest-noise window in the week |
| Sunday early/late windows | Up to the user's full multi-league slate at once | The 6.12 rate ceiling and cross-league de-duplication carry the real weight here; touchdown/lead-change copy stays terse ("3 leagues" not three separate cards) to avoid the window feeling like a wall of alerts |
| Sunday Night Football | One marquee game, often after the user's other rosters have finished | Treated like Thu/Mon tier — full detail, since concurrency has dropped back to one |
| Bye-week Sundays (user has no live game) | Zero | Game Day State still activates (6.10 is per-connected-league, not per-user-game), but the System Bar and Pulse settle to a quieter "watching the rest of the league" framing instead of Mission Control at full intensity — never a broken-looking empty state, never fake urgency for a game the user has no stake in |

**Trade-deadline week amplification** (typically Week 9–10 of the NFL season — exact week is platform/league-configurable, not hardcoded): the Trade Offer trigger (6.12) gets elevated in-app placement (Pulse-pinned, not just a nav badge) and copy that names the deadline explicitly ("Trade deadline in 3 days — 2 open offers"), since this is the one week of the season where trade urgency is real and time-boxed rather than evergreen.

**Playoffs / Championship amplification (Weeks 15–17)** — ties the existing theming layer (6.10) directly to 6.12's triggers instead of leaving it generic: touchdown-swing flashes and lead-change glows run at a more saturated version of the same tokens (no new colors, per 6.10's "no new components" rule), and a Mission Complete on a playoff win reuses the same completion animation but with "legacy" copy framing (e.g., "Championship week: 1 win from the title") instead of the regular-season "Mission Complete" label — matching Section 7's existing Championship-week emotion ("Focus, legacy"). A playoff-week loss still follows the non-punitive rule (Section 7) — elevated stakes in the copy, never in blame.

**Preseason (~Aug 6 onward)** carries no user-facing intensity difference — it's the internal test bed already noted in 12 for validating Game Day State against real kickoffs, not a moment to design a distinct feel for.

**Engineering note:** all of this is copy/token/threshold variation read from the already-existing NFL schedule data (`nfl_schedule`, week number, `computeState`'s existing week-15–17 playoff check) — no new data source, no new detection logic beyond what 6.12/10.2 already built. This is tuning, not new architecture.

---

## 7. Emotional Experience & Product Philosophy (v5.0 — new, deepened v5.5)

Rostiro is not fantasy football software. It is a companion through an NFL season, designed to enhance the emotional experience users already have — not to showcase AI. We are not replacing ESPN, Yahoo, or Sleeper; we are enhancing the journey that already exists on top of them.

Every feature answers two questions before it ships (also stated in Section 1): **(1) does this improve the user's fantasy experience, and (2) does this enhance the emotion they are already feeling right now?** This sits alongside the North Star Pulse test (6.1) as the second filter every feature passes through.

> **v5.5 — externally validated.** An independently commissioned research pass ("Rostiro Emotional Calendar Report," external LLM research, July 4 2026 — survey of ESPN/Yahoo/Sleeper product language, fantasy-forum discourse, and attention/notification research) converged on the same architecture already committed here, without having seen it: a stateful, calendar-aware OS rather than a static dashboard; Pulse and Game Day as two different interaction models, not one product; and a single governing filter — **if it doesn't affect the user's portfolio, opponent, or the available-player market, it stays ambient, it doesn't interrupt.** Where the research sharpens rather than repeats what's already here, it's folded into 7.1/7.2 below. It also proposed nine season states (Offseason Watch, Camp Watch, Draft Mode, Pre-Kickoff Prep, Game Day Console, Prime-Time Lite, Waiver Window, Film Room, Playoff Pressure) — deliberately **not** adopted as nine top-level States. The existing five (6.10) already cover this ground; the difference is depth, not headcount (see the table below and 6.10's updated note).

### The Weekly Emotional Arc (v5.5 — extended)

Maps directly onto the Rostiro States (6.10) that carry it. Two rows are new since v5.0 — the pregame ramp and the Waiver Day session — both closing gaps identified this session rather than adding new States.

| Day / period | Emotion | Carried by State | Rostiro's job |
|---|---|---|---|
| Deep offseason (Feb–Jul) | Distance, dynasty itch, curiosity | Draft (dormant phase) | Low-frequency Pulse only — no state architecture needed for a phase where nothing is urgent |
| Training camp (late Jul–Aug) | Anticipation, uncertainty | Draft (ramping into) | Beat-report digest, depth-chart changes, ADP movement — the existing preseason Pulse empty-state (6.1) already carries this; no new surface required |
| Draft season | Hope, excitement, optimism, clock pressure | Draft | Mission preparation — Draft Copilot, ADP movement, portfolio groundwork |
| Post-draft | Pride, ownership | Standard (light beat, see 13) | Let users admire what they built — roster grade appears in Pulse even without a full Portfolio product at MVP |
| Wed–Sat | Preparation, optimization | Standard | Trade discussion, planning, confidence-building |
| **Tue afternoon–night** | Panic, opportunism, decision fatigue (an hour across 2–3 leagues, worst weeks 1–3) | **Waiver Day (session-mode, T-98)** | Resumable, session-framed Pulse — "League 1 of 3, ~12 min left" — with real FAAB math and roster-health delta per candidate, not just a reordered list |
| **Sun morning, pregame** | Anticipation curdling into scramble-anxiety — "did I set my lineup, am I missing a matchup" | **Game Day (pregame ramp, T-97)** | One unmissable cross-league lineup check + "don't sleep on this matchup," ahead of everything else in the queue |
| During games | Suspense, elation, dread, obsession, ritual | Game Day (live — see 7.2 for the two interaction sub-modes) | Alive without overwhelming — glanceable, portfolio-filtered, never a wall of alerts |
| Monday (win) | Celebration | Film Room | "Mission Complete" framing — leagues won, portfolio health improved, best move of the week |
| Monday (loss) | Support, not punishment | Film Room | Never punitive — "not your week, here's what we already found for Tuesday" |
| Playoffs / Championship (theming layer) | Pressure, hope, grief, legacy | Any state, themed | Communicate higher stakes while staying calm; ceremony, not alarm, at the close |

### 7.1 Emotional Event Taxonomy — Priority Model (v5.5 — new)

The research's biggest concrete contribution: a priority tier and an attention-layer for every alert in the product, so "should this interrupt someone" stops being decided ad hoc per feature.

**Attention layers** — every piece of information in Rostiro sits in exactly one of these:

| Layer | Behavior | Example |
|---|---|---|
| Ambient | Always visible, never interrupts | Ticker, sync status, live game state |
| Glance | Raises salience, no action demanded | Halftime recap, projection lean |
| Interrupt | Personally consequential, time-sensitive | Your TD, opponent lead-change, in-game injury |
| Action | Requires a decision | Waiver claim, lineup swap, trade response — routed to Pulse, never to the live/ambient surface |

**Priority tiers** — this is a rigor upgrade to 6.12's existing trigger table, not a replacement:

| Tier | Trigger examples | Default treatment |
|---|---|---|
| P0 — critical | Starter ruled OUT within 90 min of lock; in-game injury to a rostered starter | Push + persistent in-app card until seen |
| P1 — high | Your player's TD; opponent lead-change; trade offer received; lineup-lock countdown | In-app card, optional sound, auto-dismiss (except lock countdown, which persists until resolved) |
| P2 — medium | Halftime/final recap, waiver-relevant injury elsewhere in the league | Ambient/Console card only — no push by default |
| P3 — low | General box-score movement, non-portfolio news | Ticker only |

**Engineering constraint worth stating explicitly, not left implied:** one persistent toast/interrupt slot at a time — a second P1 event queues behind the first rather than stacking. This is what keeps Game Day glanceable instead of becoming a second task queue, and it's a one-line rule to enforce in whatever component renders interrupts.

**Handpicked for MVP.** The research names roughly nineteen distinct emotional events across a full season. Building all nineteen now would be exactly the overengineering this session already pulled back from once. The ones worth building first, and why:

| Event | Priority | Why it's in, now | Where it lives |
|---|---|---|---|
| Injury shock (off-day and in-game) | P0 | Already the product's core retention mechanic (6.6); most-trusted, least discretionary | Shipped (6.6) + 6.12 |
| Late inactive / lineup-lock panic | P0 | Directly the "did I set my lineup" moment you described; highest trust payoff for lowest build cost | T-97, T-69 |
| Your-player TD / lead-change | P1 | The habitual, many-times-a-week moment that makes Game Day feel alive | 6.12 (shipped in spec, not code — T-93) |
| **Opportunity Surge (breakout/handcuff heating up)** | P1 | The positive mirror to injury shock — no existing trigger covers it; independently named by the research as "Breakout surprise/FOMO" | New — T-99 |
| Waiver outcome / FAAB result | P1 | Closes the loop on the Tuesday session (7's Waiver Day row) — you don't just submit a claim, you find out if it worked | T-98 |
| Bye-week / bubble-week scenario framing | P2 | Real, recurring anxiety (weeks 5–14 bye stress, weeks 15–17 bubble dread) but lower frequency — a good fast-follow, not launch-blocking | Deferred, not scoped this session |
| Trade elation/anxiety detail, championship ceremony copy | P1/ceremony | Already named in 6.10/6.14's theming layer and 6.12's trade trigger — this session just confirms the copy tone (celebratory or dignified, never alarmist) rather than adding new mechanics | Existing (6.12, 6.14) |

Everything else in the research's taxonomy (predraft nerves, draft-clock stress, post-draft "rosterbation," bust realization, etc.) is real and worth revisiting once the handpicked list above is shipped and the pattern is proven — not before.

### 7.2 Interaction Model: Pulse vs. Game Day (v5.5 — new)

The research's other real contribution: Pulse and Game Day aren't the same product wearing different colors — they're two different interaction models, and conflating them is what would have made the "status board vs. task queue" tension (flagged earlier this session) a real design bug instead of a design choice.

| Dimension | Pulse (Standard, Waiver Day, Film Room) | Game Day (live) |
|---|---|---|
| Primary use case | Decision support | Situational awareness |
| Interaction style | Action-heavy — Done/Snooze/Dismiss | Glance-heavy — mostly nothing to tap |
| Attention mode | Center of attention | Periphery of attention |
| Card behavior | Persists until resolved or snoozed | Auto-fades unless P0/P1 |
| Success metric | Actions completed | Time spent open, low friction |

**The single-game-vs-many-games distinction from last session's brainstorm still matters — it's just not a new State.** It's Game Day's existing live interaction model expressing two intensities from the same concurrency signal already available in `todaysKickoffs` (`rostiroState.ts`): one live game (Thu/Mon/SNF) keeps every 6.12 trigger at full, unhurried detail; several concurrent games (Sunday windows) leans harder on the P0–P3 tiering and cross-league de-duplication so it doesn't read as a wall of cards. This is exactly 6.14's existing "concurrent-game intensity tiers" — the correction from this session is that the tiering should shape the *layout*, not only notification tone, without requiring a second top-level State or a ceremony/gating UI to get there.

### Motion Philosophy

Animation reinforces the emotional moment, never fights it:
- **Winning:** celebratory, tasteful — never gaudy.
- **Losing:** supportive, never negative or alarming.
- **New recommendation:** confident, never alarming.
- **Mission completed (Pulse fully cleared):** rewarding.

**Anti-patterns, stated explicitly (v5.5 — new):** no slot-machine-style celebration on every score; no red badge spam; no stacked alerts; never interrupt for information already visible on screen; no generic NFL news blasts unfiltered by roster relevance; no sound/haptics beyond a single short chime reserved for P0/P1. These aren't stylistic preferences — the research ties over-notification and constant-checking directly to fantasy-specific anxiety; Rostiro's differentiation is calm competence, not a dopamine loop.

This is the emotional rulebook that the boot sequence and coach marks (6.8) and state transitions (6.10) are built to follow.

---

## 8. Navigation Structure (v4 — new)

> **v4.4:** the OS Shell system bar (6.7 W1) sits above everything on both breakpoints — sync status, health dots, deadline countdown, mode chip, ⌘K. Leagues added to both navs (it was specified here in v4 but never present in the built nav). **v5.0:** system bar accent tone and ticker copy voice shift with the active Rostiro State (6.10) — the nav itself doesn't restructure, but its chrome reflects Draft / Standard / Waiver Day / Game Day / Film Room.

### Mobile (bottom nav, thumb-reachable)

```
┌─────────────────────────────────┐
│ ● Synced 8s · ●●●● · Waivers 5h │  ← system bar (condensed)
├─────────────────────────────────┤
│         [page content]          │
│                            (⌘)  │  ← command FAB
├─────────────────────────────────┤
│ Pulse │ Leagues │ Draft │ ···   │
└─────────────────────────────────┘
```

### Desktop (left sidebar)

```
┌────────────────────────────────────────────┐
│ ROSTIRO OS · Synced 8s · ●●●● · Waivers    │  ← system bar
│              05:23:47 · Balanced · ⌘K      │
├──────────┬─────────────────────────────────┤
│ Pulse    │                                 │
│ Leagues  │   [page content]                │
│ Draft Kit│                                 │
│ Lineups  │                                 │
│ Trades   │                                 │
│──────────│                                 │
│ Settings │                                 │
└──────────┴─────────────────────────────────┘
```

### Mode indicator

Always visible in the header/nav:
- Focused mode: subtle "Focused" chip
- Savant mode: subtle "Savant" chip
- Tap to switch — with a "are you sure? this changes your dashboard density" confirmation

---

## 9. Monetization (v5.0 — replaced)

> Pricing sells the enhanced-season experience, not a feature count. See Section 7 for the philosophy this reflects.

| Plan | Price | Includes |
|---|---|---|
| **Free** | $0 | 1 league. Morning Pulse (basic). Basic ticker. Rostiro States — full ambient experience, universal (6.10: states are never paywalled, only depth within them is). Limited Draft Copilot. Basic AI: 3 start/sit and 3 trade analyses per week. |
| **Rostiro Pro** | $9.99/mo | Unlimited leagues. Unlimited Pulse across all leagues. Full Draft Copilot (pre-fetched reasoning). Full state depth (unblurred live scores, full Film Room recap, full Waiver Day detail). Unlimited Start/Sit + Trade Analyzer. Push notifications. Complete OS experience. |
| **2026 Founder Season Pass** | $59 | Rostiro Pro for the full 2026 season. Launch-window pricing — never offered again after this window closes. |
| **Founding 500** | $149 lifetime | Strictly the first 500 users. Lifetime access, founder badge, priority feedback access, early feature previews. Never returns once sold out. |

**Open decision — free tier depth after trial.** Every new signup gets the existing 7-day full-Pro trial (built in onboarding Step 2, Section 4). Recommended default: after the trial expires, Free settles to the limited tier above rather than staying at full access indefinitely — this is what creates upgrade pressure, and it's consistent with what's already built. The alternative (full features forever on 1 league) is more generous and simpler to reason about, but removes the only lever pushing single-league casual users to convert. Flagged as open since it's a business call, not an engineering one — confirm before Stripe integration (T-85).

**Future pricing roadmap:** 2027 adds a Season Pass price increase, NBA support, and a possible all-sports pass. 2028+ multi-sport expansion. No additional pricing complexity introduced before it's justified.

---

## 10. Scalability & Operational Architecture (v5.0 — new)

> This is Rostiro's engineering constitution. Every subsystem in Section 6 is built against these rules whether or not each spec calls them out individually. Rostiro is being designed for 1,000 → 10,000 → 100,000+ paying users without a rewrite at any threshold.

### 10.1 Engineering Philosophy

**Deterministic First, AI Second.** Claude reasons; it never calculates. Rankings, ADP movement, snake-draft math, run/snipe detection, League Health scoring, countdown timers, and ticker generation are deterministic code (already true for 6.2, 6.3.1, 6.10) — now stated as a standing rule for every future feature. Claude is called only to explain what the deterministic layer has already decided.

**API Calls.** No user ever independently calls a third-party API. All Sleeper/Yahoo/ESPN traffic flows through centralized sync jobs with league-level deduplication (two users in the same league share one fetch), shared caches, background refresh workers, and event-driven updates where the platform supports them. A user opening the app reads a cache; they never trigger a live upstream fetch.

**Caching.** Everything expensive assumes a cache in front of it: Pulse, league data, player data, AI outputs, trade analyses, ticker content, weather, injuries. Cache invalidation is explicit and tied to sync-job completion, not TTL guessing alone.

**Rate Limits.** Every external API is assumed to have limits. Standard pattern: retry with exponential backoff, request queueing, circuit breakers per platform (if Yahoo is erroring, stop hammering it and serve cache), graceful degradation over hard failure.

**Observability.** Track from day one: API latency per platform, Claude latency, cache hit rate, league sync time, ticker freshness, queue depth, failed-sync count. Without this, "it's slow for some users" is undiagnosable at 10,000+ users.

**Feature Flags.** Every expensive or new-and-risky feature is toggleable without a deploy: Ticker, Draft Copilot, AI Pulse, Live Scores, Push Notifications, and Rostiro States (6.10) — the highest-risk addition, since it activates automatically for every user on the highest-traffic day.

**Cost Controls.** Every AI request documents, before it ships: expected latency, cache strategy, token estimate, monthly cost at projected scale, and fallback behavior if the call fails or a budget cap is hit.

**Data Model.** Schema assumes NFL, NBA, MLB, NHL, and future fantasy sports from day one — no sport-specific assumptions in the core tables (players, rosters, leagues, scoring). NFL is the only sport that ships in 2026 (13 Out of Scope is unchanged on that point) — this is a schema discipline, not a build-scope change.

**Performance Budget.** Dashboard load <2s. Cached Pulse <500ms. Command Palette open <100ms. Animations at 60fps. Zero layout shift.

**Resilience — degraded mode per dependency.** If Claude fails: serve the deterministic recommendation without the explanation, don't block the action. If Sleeper/Yahoo/ESPN fails: serve last-cached data with a visible staleness indicator, never a blank screen. If live scores fail: show last successful refresh timestamp rather than nothing.

### 10.2 Game Day Architecture

> The dedicated architecture for Sundays — the day every user is looking at Rostiro at once, and the day 6.10's Game Day State creates the product's signature moment.

- **Cached reads first.** No client ever fetches live scores directly from an upstream provider. One shared background job polls scores on a fixed interval and writes to a shared cache; every user's client reads that cache.
- **Shared polling, not per-user polling.** The 60-second state-transition check in 6.10 and the score-refresh job are the only things polling — never one poll per open client. At 100,000 concurrent Sunday users, per-client polling of any kind is the single biggest scaling risk in the product; this section exists specifically to rule it out before it's ever built.
- **Background refresh with graceful stale indicators.** If a refresh cycle is late, the UI shows the last-known value with a subtle "as of Xs ago" marker rather than blocking or spinning.
- **No polling storms at kickoff.** Because Game Day State activates for every user near the same kickoff windows, the transition-check and score-refresh jobs are staggered/jittered rather than firing for all users at the exact same second.

### 10.3 Per-Subsystem Scalability Considerations

| Subsystem | Considerations |
|---|---|
| **Pulse** | Generated by cron ahead of the user opening the app (already true per 6.7 W3), not on-demand per login. Claude called once per user per generation cycle, not per item. |
| **Draft Copilot** | Sleeper poll (10s) is per-draft, not per-user-in-that-draft — multiple managers in the same draft share one poll. Pre-fetched reasoning (6.3.1) is generated once per candidate set, cached, and reused if multiple users hit the same draft state. |
| **League Health** | Fully deterministic (`lib/healthScore.ts`, 6.2/6.7 W2) — zero AI cost, computed from already-cached roster/player data. Scales linearly with league count, not user count, since leagues are deduplicated. |
| **Ticker** | One shared content pipeline per data source (ADP snapshot, transactions, injury deltas, scores) feeds all users; nothing is generated per-request. |
| **Start/Sit** | Deterministic ranking + Claude explanation, same pattern as Draft Copilot — explanation cached per player/matchup, not regenerated per user asking about the same matchup. |
| **Trade Analyzer** | Same pattern — verdict is deterministic value comparison; Claude explanation cacheable per proposed trade shape. |
| **Notifications** | Fan-out from one detection event (e.g., one injury designation change) to all affected users' queues — never one third-party check per user per notification type. |
| **Portfolio** (deferred, 13) | Even without the sharing UI, weekly grade/exposure numbers are computed and stored from launch — cheap now, impossible to backfill later (same principle already applied to ADP/injury snapshots in 6.8 E2). |
| **Authentication** | Standard Supabase auth; scales without custom work at these tiers. |
| **League Sync** | The core centralization point — one sync per league per platform, shared across every user in that league, on a schedule plus event-driven triggers where the platform allows them. |
| **Analytics** | Deferred until it exists; when added, respect the same cost-controls and cache-first rules as everything else — no per-event third-party calls in the hot path. |

### 10.4 Secrets & Credential Management (v5.6 — new)

> Added after a real incident (July 2026): OneSignal's REST API key silently expired to a deprecated v1 format, and push notifications failed for an unknown period before anyone noticed — the credential-management version of 10.1's Resilience principle. This section exists so a key rotation is never a one-place fix that quietly misses a second place the same value lives.

**Every secret lives in exactly two places, always**: `.env.local` (local dev — git-ignored, never committed) and Vercel's **Project → Settings → Environment Variables** (production + preview deployments). A key rotated in only one of these two places is a key that's half-rotated — the app keeps working wherever the old value is still cached and silently fails wherever it isn't, exactly like the OneSignal incident above. **Vercel requires a redeploy to pick up a changed environment variable** — saving the dashboard value alone does nothing until the next deploy runs.

**The one exception**: `DEMO_MODE` and `DEMO_ROSTER_TEAMS` are local-only by design and must never be set in Vercel — they exist to demo features against fake data on a local machine, and would corrupt real user-facing behavior if they ever reached production.

| Variable | What it's for | Rotate/restore from |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | Supabase dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public client key (RLS-scoped, safe to expose) | Same |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS — server-only, never expose client-side | Same |
| `ENCRYPTION_KEY` | Encrypts stored OAuth tokens | Generated once at setup. **Never rotate once real data exists** — changing it makes every already-encrypted row unreadable, with no recovery path |
| `YAHOO_CLIENT_ID` / `YAHOO_CLIENT_SECRET` / `YAHOO_REDIRECT_URI` | Yahoo OAuth | Yahoo Developer dashboard |
| `ANTHROPIC_API_KEY` | Claude API | Anthropic Console → API Keys |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Billing (not yet live) | Stripe dashboard → Developers → API keys / Webhooks |
| `ONESIGNAL_APP_ID` / `NEXT_PUBLIC_ONESIGNAL_APP_ID` | Push app identity (same value, one public copy for the client SDK) | OneSignal dashboard → Settings → Keys & IDs |
| `ONESIGNAL_REST_API_KEY` | Push send auth | Same dashboard. **Must be the current `os_v2_app_...` format** — a legacy-format key fails silently at send time, not at setup time, which is exactly how the July incident went unnoticed for as long as it did |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Transactional email (not yet live) | Resend dashboard → API Keys |
| `NEXT_PUBLIC_APP_URL` | Not a secret — the deployed URL, used in links/redirects | N/A |
| `CRON_SECRET` | Gates every `/api/cron/*` route's Bearer check | Self-generated random string, not issued by any dashboard. Vercel automatically sends this exact value as the Authorization header for its own scheduled Cron invocations when the variable is named `CRON_SECRET` |
| `ADMIN_EMAIL` | Gates `/api/admin/simulate` and the Simulation Panel to one real account | Not a dashboard value — must exactly match a real row in `public.users.email` |
| `DEMO_MODE` / `DEMO_ROSTER_TEAMS` | Local-only fake-data overrides for design review | `.env.local` only — never Vercel |

**Restoration checklist, when a key needs regenerating:**
1. Regenerate in the source dashboard (Supabase / Anthropic / OneSignal / Stripe / Resend / Yahoo).
2. Update `.env.local` — verify locally against the specific `lib/*.ts` wrapper before touching Vercel (e.g. `verifyOneSignalCredentials()` for OneSignal).
3. Update the same variable in Vercel → Settings → Environment Variables — confirm it's set for the right environment(s) (Production and Preview, typically both).
4. Trigger a redeploy. A saved Vercel env var does nothing until the next deploy picks it up.
5. Re-verify against the deployed URL, not just localhost — a key can be valid locally and still missing or stale in Vercel if step 3 or 4 was skipped.

---

## 11. Technical Architecture

### Stack

| Layer | Decision |
|---|---|
| Frontend | Next.js 16 + TypeScript — App Router |
| Styling | Tailwind CSS — mobile-first, dark-first |
| Backend | Next.js API routes |
| Database | Supabase (PostgreSQL) |
| AI | Claude API — claude-sonnet-4-6 exclusively |
| Push | OneSignal |
| Email | Resend |
| Payments | Stripe |
| Hosting | Vercel |

### Database schema, API routes, build order

See v3 Section 7–11. All unchanged except season defaults updated to 2026, and schema discipline per 10.1 (sport-agnostic core tables).

---

## 12. Build Phases

### Completed (as of July 2026)

| Task | Status |
|---|---|
| T-01 through T-13 | Complete |
| Supabase schema live | ✓ |
| Sleeper live data verified | ✓ |
| Auth (login/signup) live on Vercel | ✓ |
| Onboarding flow built | ✓ |

### Status: ahead of schedule (v5.0, updated v5.3)

As of July 3, 2026, build is ahead of the original Week 3–7 plan. That room is what allowed Rostiro States (6.10) and the Scalability & Operational Architecture baseline (10) to move into MVP scope rather than being deferred past launch.

**Since v5.2 (this session, July 3, 2026 evening):** the Rostiro States engine (T-79) and the Game Day live-score backend (T-81's backend half, 10.2) both shipped and were verified against real data — the states engine computes correctly against synthetic boundary timestamps, and the live-score cron matched all 16 real Week 1 2026 games against ESPN's live scoreboard, catching a team-code mismatch (Rams, Washington) that would otherwise have silently broken the join. Remaining Game Day scope is now entirely frontend and was scoped, not built, this session: UI surfacing (T-90), `PulseMark.tsx` (T-91), the kickoff transition animation (T-92), the engagement/notification trigger system (T-93, new — 6.12), and Waiver Day / Film Room State UI (T-94, T-95).

### Remaining build order (historical, T-14–T-50)

Week 3: Dashboard + AI layer (T-14–T-23)
Week 4-5: Draft Kit (T-24–T-37)
Week 6: Pulse + Pulse empty state + League Health Score (T-38–T-46)
Week 7: Mobile audit + landing page + launch (T-47–T-50)

**GO / NO-GO GATE:** Yahoo OAuth returning live roster data AND ESPN cookie auth returning league data. Both must pass before dashboard UI is finalized.

### Phased build order (established July 4, 2026 — this is the ongoing sequencing mechanism)

Every remaining task (T-73 onward) sits in exactly one of these phases or the deferred list below. When new scope is discovered mid-build, it gets slotted into a phase or the deferred list in the same pass it's added to the task table — nothing floats untracked. Re-sequence phases here as priorities shift; don't leave the old order stale next to a new one.

**Phase 1 — Launch blockers (must ship before 8/1–8/10).** Real money and real user data start flowing at launch; these aren't optional by then.
- T-112 Marketing landing page overhaul — ✓ **Done** (July 4, 2026). See task table.
- T-78 Privacy policy + data controls — ✓ **Done.** See task table.
- T-76 Security hardening — ✓ **Done.** See task table.
- T-75 Accessibility baseline — ✓ **Done.** See task table.
- T-85 Pricing rebuild (Stripe) — Free / Rostiro Pro ($9.99/mo) / Founder Season Pass ($59) / Founding 500 ($149 lifetime, capped at 500). **Blocked on a real Stripe account existing** (confirmed none exists yet, July 4, 2026) — schema, gating logic, and webhook-handler shape can be built against Stripe's documented API now; live checkout can't be verified until real test-mode keys exist. **Last item in Phase 1**, by explicit founder direction — everything else above ships first, Stripe gets its own dedicated pass.

**Phase 2 — Finish the core State story.** ✓ **Done in full** (July 4, 2026). T-87, T-94, T-95, T-97, T-73 — see task table for details. Found and fixed one real cross-component bug along the way: `useGameDayKickoffTransition`'s sweep animation was firing 3 hours early, during the pregame ramp, because it only checked `rostiroState === 'game_day'` rather than whether a game had actually started.

**Phase 3 — Harden before real Week 1 traffic.** ✓ **Done** (July 4, 2026). T-84, T-86 — see task table for details and the two intentionally-unmeasured sub-items (cache-hit rate, queue depth).

**Phase 4 — Engagement depth (retention, not core-loop).** The 3 buildable triggers already work; these are additive.
- T-99 Opportunity Surge trigger
- T-96 Seasonal/intensity variation
- T-100 Engagement telemetry instrumentation

**Deferred — bigger, standalone, real runway before they're needed:**
- T-88 ESPN native projections wiring — nice-to-have parity feature, no user-facing gap without it yet.
- T-83 Playoffs/Championship theming — irrelevant until weeks 15–17, no reason to touch before December.
- (Carried forward from earlier sessions, unchanged: T-74 pending the marketing-design pass, T-77 post-launch by design, T-98 and T-111 per their own entries.)

---

## 13. Out of Scope for MVP

**Out of scope entirely** (unchanged from v3): native app, CBS/NFL/Fantrax/MFL platform connectors (Phase 2 per 5.5), DFS, dynasty features, basketball/baseball/hockey (the schema stays sport-agnostic per 10.1 — building for them does not), historical analytics, commissioner tools, in-app messaging.

**Deferred to fast-follow** (v5.0 — new; post-launch, not MVP, but not "never"):
- **Full Portfolio product** — shareable roster-grade graphics, animated reveals, exposure-summary cards for X / Instagram / league-chat distribution. Underlying weekly grade/exposure data is still computed and stored from launch (10.3) so this isn't a cold start when it ships.
- **Social sharing infrastructure** — confirmed as a growth mechanic worth building, but not an 8/1 launch or marketing dependency.

---

## 14. Updated Task List

All tasks from v3 carry forward. Additional tasks from v4:

| Task | Description |
|---|---|
| T-51 | Mode selection screen — onboarding step 3. Store user mode preference in users table. |
| T-52 | League Health Score — calculation service + display on dashboard cards |
| T-53 | Pulse empty state — preseason intel view with ADP movers and training camp flags |
| T-54 | ESPN "Unlock ESPN" repositioning — framing, copy, and placement in onboarding |
| T-55 | Mobile bottom navigation — Pulse / Leagues / Draft / More, 44px targets |
| T-56 | Desktop left sidebar navigation |
| T-57 | Mode indicator in nav + switch confirmation modal |

Additional tasks from v4.4 (Rostiro OS Shell — see 6.7):

| Task | Description |
|---|---|
| T-67 | System Bar — persistent chrome: live sync ticker, health dots, deadline countdown, mode chip, ⌘K affordance. `/api/system/status` endpoint. Desktop + condensed mobile variant. |
| T-68 | Leagues page + Health Score — `/leagues` route, `lib/healthScore.ts` (PRD 6.2 five-factor formula, deterministic), health rings + factor bars, nav updates. Closes T-52. |
| T-69 | Persistent actionable Pulse — write to `pulse_items` with content fingerprint, Done/Dismiss/Snooze, morning header + completion bar, cron generation, `deadline_reminder` + `lineup_decision` item types, daily ADP snapshot in players cron. |
| T-70 | Command palette — ⌘K overlay + mobile FAB, command registry (navigation / Pulse actions / player search), keyboard navigation. |
| T-71 | Identity + polish — mode persisted to `users` table (closes T-51), real Settings page, terminal visual pass (tabular-nums, update ticks, denser Savant layouts). Fixes AppShell setState-in-effect lint error. |

Additional tasks from v4.5 (Experience Layer + Product Foundations — see 6.8, 6.9):

| Task | Description |
|---|---|
| T-72 | ✓ **Done in full, July 6 2026.** Boot sequence shipped July 4 as before. Coach marks decided and shipped: founder confirmed **skippable**, not the mandatory tour floated earlier — "don't want to churn people." Ships per the original 6.8 spec: `lib/hints.ts` (5-entry registry: mode chip, ⌘K, league health dots, Pulse Done/Snooze, the ticker), `components/hints/HintProvider.tsx` + `HintAnchor.tsx` — one hint on screen at a time, shown the first time its real instrument mounts (register/unregister on mount), dismissed-forever per user via `users.seen_hints`. Found and fixed a real gap while wiring this: `app/api/settings/route.ts` already had the `addSeenHints`/`resetSeenHints` zod fields and the `seen_hints` column existed, but the PATCH handler silently never applied them and GET never returned them — the whole feature's storage layer was inert. "Replay tour" reachable from both Settings and the command palette. `⌘K` and the ticker anchors register only above the `md` breakpoint (real bug caught before shipping: registering while CSS-hidden on mobile would permanently occupy the one-hint slot with a coach mark nobody could see or dismiss). |
| T-73 | ✓ **Done.** Ticker seasonal sources — the "gating decision pending" note was stale: verified `scoresGated = plan === 'free'` in `/api/system/status` already drives the ticker's live-score blur + "UNLOCK LIVE SCORES WITH PRO" tail (shipped as part of T-90, just never reflected back here). In-season sources (per-league waiver claims, injury designation changes) intentionally wait — the response shape already stays fixed for that swap, and building in-season logic 2 months before the season starts would be building ahead of real usage. |
| T-74 | Features page — the OS story with live embedded components (real ticker, demo Pulse card), no screenshots. Timing: with the marketing-designs pass (default). |
| T-75 | ✓ **Done.** Accessibility baseline — WCAG AA contrast audit confirmed the flagged `--t3` (2.7-3.0:1 against `--void`/`--glass-solid`) and `--t4` (1.7-1.9:1) tokens both genuinely failed, across ~24 files of real body content, not decoration; fixed at the token level in `app/globals.css` (one change fixes every usage) rather than touching each file. New `lib/useFocusTrap.ts` shared hook wired into Pulse's detail drawer and the Command Palette — both were full-screen modal overlays with no `role="dialog"`, no Tab-trap, and no focus restore on close. `InterruptStack` upgraded to `role="alert"` for critical (P0) items, `role="status"` otherwise. `TickerBar`'s decorative, duplicated marquee (can't be paused, reads oddly to a screen reader) is now `aria-hidden`, with a one-pass `sr-only` text equivalent built from the same underlying data. Verified: production build clean, no CSP/console errors introduced. |
| T-76 | ✓ **Done.** Security hardening — `next.config.ts` now sends CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS, and Permissions-Policy on every route (verified live via curl and in-browser with no CSP violations, including OneSignal's CDN script). Found a real open cost/abuse vector while scoping this: `/api/draft/session/[id]/recommend` is deliberately unauthenticated (Draft Kit, no signup) and calls Claude on every request with zero rate limit — fixed with a new Postgres-backed `lib/rateLimit.ts` (same upsert pattern as `usage_counters`, no new external service) at 20 req/min/IP, also applied to `/api/leagues/sleeper/lookup` (external-API enumeration risk). `npm audit`: one moderate finding, Next.js's own bundled `postcss@8.4.31` — the suggested fix downgrades Next to a 2019 canary release, not actionable; tracked, not exploitable via the app's own surface. |
| T-77 | Daylight theme — designed light mode behind a Settings toggle + `prefers-color-scheme`, persisted on `users`. Default timing: post-launch fast-follow. |
| T-78 | ✓ **Done.** Privacy policy + data controls — public `/privacy` page (founder-written draft, flagged inline as not yet reviewed by counsel — not presented as a substitute for legal advice), covering the AI-processing disclosure, third-party sharing, retention, and contact. New `/api/settings/export` (JSON download, RLS-scoped via the SSR client so it can only ever return the caller's own rows) and `/api/settings/delete-account` (calls `auth.admin.deleteUser()` — `public.users.id` and every user-scoped table already cascade off `auth.users(id)`, so this one call is the complete, correct deletion, no per-table cleanup needed). Both wired into a new Settings "Data & privacy" section, delete gated behind a type-DELETE-to-confirm flow matching the existing disconnect-league pattern. Verifying the export route against the live database caught two real gaps, logged separately: T-107's waiver-cutoff columns (already had a fallback elsewhere, added here too) and **`usage_counters` missing from production entirely** — flagged to the founder, migration is idempotent and just needs a re-run. |

Additional tasks from v5.0 (Rostiro States, Scalability baseline, Emotional layer, Pricing — see 6.10, 7, 9, 10):

| Task | Description |
|---|---|
| T-79 | ✓ **Done.** Rostiro States engine — `lib/rostiroState.ts`, deterministic state computation from local time + NFL schedule + per-league waiver cutoffs. Feature-flagged. |
| T-80 | Waiver Day State — layout reprioritization, Mission Briefing Pulse framing, ticker tie-in. Not started (see T-94). |
| T-81 | Game Day State backend — ✓ **Done, verified July 3, 2026.** `live_scores` table, `lib/liveScores.ts`, per-minute cron with cheap early-exit (10.2), matched against all 16 real Week 1 2026 games including ESPN/nflverse team-code normalization. UI/animation half — layout reprioritization, cockpit/telemetry visual pass, kickoff-triggered transition animation — **not started** (see T-90–T-92). |
| T-82 | Film Room State — layout reprioritization, weekly AI recap, usage/snap-count surfacing. Not started (see T-95). |
| T-83 | **Rescoped and locked, July 7, 2026, founder decision** — was "visual treatment for weeks 15–17, no new components"; founder wants it personal, not calendar-flat: "Rostiro changes as the fantasy season does, and when you make the championship, Rostiro gains a level of intensity with you." Rescoped as a 4-tier ladder layered on top of the existing (already-built, currently unused) `PLAYOFFS_OVERLAY` gold-ring token in `lib/brandTokens.ts`/`components/PulseMark.tsx` — per the brand kit's own spec, "not an additional State," a second polyline over whatever State is active: **Tier 0** regular season (no overlay, unchanged); **Tier 1** your league's real playoff window is open (per-league, from Sleeper's actual `playoff_week_start` setting — not a hardcoded weeks 15–17, leagues configure this differently) — gold overlay activates; **Tier 2** your specific roster is still alive (won its most recent bracket round, from Sleeper's real `winners_bracket`/`losers_bracket` endpoints — neither fetched anywhere in this codebase today) — escalated gold, faster pulse; **Tier 3** your roster made the bracket's final round — full Championship Mode: boldest treatment, a distinct relabel (same pattern as Game Day's "Mission Control"), and a one-time reveal reusing the existing kickoff-transition-animation infrastructure (`lib/gameDayTransition.ts`'s once-per-day/season localStorage gating, System Bar accent sweep, mono-value flicker-in) rather than inventing new motion. Eliminated reverts quietly to Standard — no punitive "you lost" treatment, matching Section 7's standing non-punitive framing. Needs new Sleeper calls (league playoff settings + winners/losers bracket, none fetched today) and a new deterministic tier-computation module; `/api/system/status` is the natural place to compute and expose it per league, same as health/deadlines. Marketing tie-in: feed the founder's tagline into T-112's landing page pass as a differentiator (a fantasy tool that visually escalates with your actual season is a genuinely unusual pitch), and design Tier 3's reveal to be a deliberately shareable, screenshot-worthy moment — free distribution every time a manager clinches their championship. ✓ **Done, migration N/A** (shipped July 7, 2026 — no new table needed, this is entirely live Sleeper data + client state). New `lib/sleeper.ts` additions: `settings.playoff_week_start`/`playoff_teams` on the league-settings type, and `getSleeperWinnersBracket()` (championship-path bracket only — deliberately not `losers_bracket`, since this never cares about a consolation/toilet-bowl track). New `lib/playoffStatus.ts`'s `computePlayoffTier()` resolves Sleeper's real bracket shape (`t1`/`t2` seeded directly, or resolved via `t1_from`/`t2_from` pointing at an earlier match's winner/loser) into the 4-tier ladder, purely deterministically. `/api/system/status` computes it per league (reusing the schedule query already fetched there for the lineup-lock countdown to derive the current NFL week, no second query) and exposes both a per-league `playoffTier` and the max across all leagues at the top level (one league's championship run drives the ambient treatment even if another is already eliminated). `lib/brandTokens.ts`'s flat `PLAYOFFS_OVERLAY` became `PLAYOFF_TIER_OVERLAY`, a 3-tier config (color/width/dash/opacity plus `extraAmplitude`/`cycleScale` layered on top of the active State's own, never replacing it) — `components/PulseMark.tsx` takes a `playoffTier` prop instead of the old flat boolean. `components/nav/SystemBar.tsx` gets a "🏆 CHAMPIONSHIP" badge (Tier 3 only — the blanket "it's playoffs" tiers stay quiet, PulseMark-only) and a one-time gold `championship-sweep` reveal (new `lib/championshipReveal.ts`, same shape as `useGameDayKickoffTransition` but keyed per-season via localStorage, not per-day) the first time a client notices Tier 3; the Pulse page gets a matching "🏆 CHAMPIONSHIP WEEK" header relabel, coexisting with Mission Control/Mission Briefing rather than replacing them. `npx tsc`/`eslint`/production build all verified clean. Not yet verified live — no connected league has reached its real playoff week yet this season (mid-July), so Tiers 1-3 can only be confirmed once one does, or via the Simulation Panel forcing real bracket data. |
| T-84 | ◐ **Mostly done, July 4 2026.** Feature-flag framework and staggered background jobs were both already shipped (`lib/featureFlags.ts`; `vercel.json`'s crons already spread across 8am/9am/10am UTC + per-minute) — this pass added the two genuinely missing pieces: new `lib/observability.ts`, wired into all three platform fetch wrappers (`sleeperFetch`/`espnFetch`/`yahooFetch`) plus every Claude call, logging latency/success to `api_call_log` and tripping a per-platform circuit breaker after 5 consecutive real failures (network errors, 429s, 5xx — deliberately *not* 401/403/404, which are per-user/per-request issues, not a platform outage, and would wrongly block every other user if they tripped the breaker). "Cache-hit rate" specifically stays unmeasured — there's no single centralized cache-read function to instrument without a larger refactor, logged honestly rather than faked. "Queue depth" is N/A until a real job queue exists (crons are simple scheduled triggers, not a queue). |
| T-85 | Pricing rebuild — Free / Pro / Founder Season Pass / Founding 500 in Stripe, update onboarding trial copy (Step 2, done in this PRD), update Start/Sit and Trade Analyzer tier gating from Starter→Pro (done in this PRD, 6.4/6.5). |
| T-86 | ✓ **Done, July 4 2026.** Portfolio data plumbing — real ambiguity flagged and resolved rather than guessed: "roster grade" isn't a formula defined anywhere else in the PRD (unlike Health Score's precise 5-factor spec), and since this data is stored historically, guessing wrong would be expensive to redo. Confirmed with the founder: reuse the existing, already-verified Health Score rather than inventing a separate grading methodology. New `lib/portfolio.ts` computes both per-league health and cross-league exposure (how many of a user's leagues roster each player) and piggybacks on the existing daily `/api/cron/pulse` loop (already fetching every user's rosters) rather than a new cron. `week_start` (Monday of the ISO week) is now exported from `lib/usageLimits.ts` and reused here, so the whole codebase agrees on one "week" convention instead of each weekly feature defining its own. |

Additional tasks from v5.2 (Stats/Projections/Commentary data sources, Player Intelligence Card — see 5.7, 6.11):

| Task | Description |
|---|---|
| T-87 | ✓ **Done.** nflverse ingestion — real gap found and solved: nflverse's `snap_counts` release has no Sleeper player id, only a Pro-Football-Reference id. Verified join chain, not guessed: `pfr_player_id` → nflverse's own `players.csv` crosswalk → `gsis_id` → Sleeper's raw `/players/nfl` payload (confirmed live to carry `gsis_id` per player) → our canonical `sleeper_id`. New `lib/nflverseUsage.ts` resolves this once per sync using data the daily players cron already fetches (no second Sleeper API call); new `player_usage_snapshots` table (`migration_player_usage.sql`). Verified against real 2025 data (2026's file doesn't exist yet — season hasn't started): 1,434 rows resolved for week 1, spot-checked against Sleeper directly (player_id 4984 = Josh Allen, QB, BUF, 100% offense snaps week 1 — correct). Confirmed 2026 gracefully returns empty rather than erroring. |
| T-88 | **Deferred, founder decision July 7, 2026** — same underlying blocker as T-140. Investigation before starting found this task assumed a real dependency that doesn't exist yet: `lib/espn.ts`'s `getEspnPlayerProjection()` (the `statSourceId: 1` vs `0` parsing logic this task needs) is already built and verified live (July 3, 2026) — but `getEspnRosters()` and `getEspnWaivers()`, the two functions that would fetch a roster/player-pool response to surface it from, have zero callers anywhere in the app. The one ESPN pipeline that is wired (`pollEspnLeague`, `lib/liveMatchupPoints.ts`, feeding Pulse's touchdown-swing/live-event detection) only ever needs actual points, never projections. There is no existing ESPN roster or waiver-pool screen to attach projections to — that's the same "ESPN never resolves a real `team_id`" gap blocking Lineup/Trades/LIVE for ESPN all session (T-101, T-140), not a one-field addition. Founder chose to defer rather than build a one-off ESPN waiver-pool view just to have somewhere to hang this. Not started. |
| T-89 | ✓ **Done** — status corrected July 6, 2026 (was stale: this table and the §12 deferred list both still said "not required for launch," but the card has been built and wired for several sessions). `components/players/PlayerIntelligenceCard.tsx` + `/api/players/[playerId]/intelligence` — availability/usage/snap/projection/trend/context, opened via the shared `openPlayerCard()` trigger (`lib/openPlayerCard.ts`) now wired into every player-name surface in the app (T-118): ⌘K, Draft Kit, Lineups, Pulse, Trades, the live draft session, System Bar/Pulse's Live Now line, and the LIVE tab. |

Additional tasks from v5.3 (Game Day Engagement System, Per-State Visual Language — see 6.12, 6.13):

| Task | Description |
|---|---|
| T-90 | Game Day UI surfacing — live scores from the now-verified `live_scores` cache (T-81 backend) into Pulse, System Bar, and the bottom ticker. The backend has existed and been verified since July 3, 2026; this is purely the frontend wiring. |
| T-91 | ✓ **Done.** `PulseMark.tsx` — brand kit component, shared visual anchor for both the kickoff transition (T-92) and the existing boot sequence (T-72). Blocks T-92. |
| T-92 | Kickoff-triggered transition animation (6.13) — System Bar accent sweep, Pulse header re-label to "Mission Control" with mono-value flicker-in, ticker items sliding in for the day's first live scores. Depends on T-91 and T-90. |
| T-93 | Game Day Engagement System (6.12) — touchdown/lead-change/trade-offer/injury/lineup-lock triggers, fanned out via the existing OneSignal integration, rate-limited per the mode-tied density and 2-minute hard ceiling in 6.12. Reuses the T-81 live-scores diff for detection — no new polling. |
| T-94 | ✓ **Done.** Waiver Day State UI — the Mission Briefing framing/accent/reorder shipped earlier (T-108b); this pass added the missing "ranked-list reflow motion": reprioritized `waiver_alert` cards now get the opportunity-green stripe (overriding their ordinary priority color) plus a new `waiver-reflow-in` entrance animation (`app/globals.css`) so the reprioritization reads as motion, not an unexplained instant jump to the top. |
| T-95 | ✓ **Done.** Film Room State UI — new `lib/filmRoomSignals.ts`'s `computeTopUsageSignal()` (pure, deterministic per 10.1 — verified against 6 synthetic scenarios before wiring in) finds the roster's single largest week-over-week snap-share swing on a skill position, using T-87's new data. New `generateFilmRoomRecap()` in `lib/claude.ts` narrates the already-computed result + signal — verified against the real Anthropic API across win/loss/tie and all three modes (Focused led with the verdict, Savant stayed advisory, a loss was reviewed the same even-handed way as a win, per Section 7's non-punitive framing). Both additive to the existing recap card; a missing signal or a failed Claude call still shows the score. |

Additional task from v5.4 (Seasonal & Intensity Variation — see 6.14):

| Task | Description |
|---|---|
| T-96 | Seasonal/intensity variation (6.14) — concurrent-game intensity tiers, bye-week quiet framing, trade-deadline-week amplification, playoffs/championship trigger amplification. Layers onto T-93 once the base engagement system ships; not a standalone build. |

Additional tasks from v5.5 (Emotional Priority Model, Pregame Ramp, Waiver Session-Mode, Opportunity Surge — see 7, 7.1, 7.2, 6.12):

| Task | Description |
|---|---|
| T-97 | ✓ **Done.** Pregame-ramp Pulse content — `lineup_decision` items now reprioritize to the top of the queue during the ramp window (same stable-reorder pattern as Waiver Day), framed with a new "LAST CALL BEFORE KICKOFF" header distinct from both Standard and Mission Control. Found and fixed a real cross-component bug while wiring this: the trigger-widening (shipped earlier) made `rostiroState === 'game_day'` true for the whole 3h ramp, but `useGameDayKickoffTransition` (Pulse, System Bar, Ticker) still fired the kickoff-sweep animation on that same flag — meaning the "kickoff" celebration was firing 3 hours before any game actually started. Fixed by giving the hook a required `hasLiveGames` param so the sweep only fires once a game is truly live; all three call sites updated. |
| T-98 | Waiver Day session-mode — resumable multi-league progress framing ("League 1 of 3, ~12 min left"), real FAAB budget math and projected roster-health delta per candidate, replacing today's framing-and-reordering-only slice. Upgrades T-80. |
| T-99 | Opportunity Surge trigger (6.12) — usage/projection-spike detection over the existing nflverse cache (T-87), celebratory copy tone, added to the existing fan-out/rate-limit machinery from T-93. No new polling or data source. |
| T-100 | ✓ **Done, migration pending** (added and shipped July 7, 2026). Instrumentation only, per the task's own scope ("feeds retention measurement without new UI") — no dashboard built, just an append-only event log (`telemetry_events`, `migration_telemetry.sql`) that later analysis queries directly. New `lib/telemetry.ts`'s `logTelemetryEvent()` (client-side, fire-and-forget, never blocks the feature it instruments) covers all four things 7.1 asks for: (1) Game Day session opens + time-in-state — `app/(dashboard)/pulse/page.tsx` logs `game_day_session_open`/`game_day_session_close` (with `durationMs`) on every `isMissionControl` transition, plus an unmount-time cleanup so navigating away mid-session still closes it out; (2) P0 alert action rate — `components/InterruptStack.tsx` logs `interrupt_shown` (the denominator) whenever a new interrupt becomes current, and `interrupt_action` on dismiss/snooze with a `trigger: 'manual' | 'auto'` flag — a critical interrupt never auto-dismisses, so any action logged against one is always a real user response, never a timeout; (3) notification mute/dismiss rate — `handleAction` in the same Pulse page logs `pulse_item_action` (done/dismiss/snooze) for every ordinary Pulse card action. `npx tsc`/`eslint`/production build all verified clean; not yet verified live (needs the migration run, same as every other new table this session). |

Additional task from v5.6 (UX Behavior Spec, Live Fantasy Matchup Scoring — see `Rostiro_UX_Behavior_Spec.md`):

| Task | Description |
|---|---|
| T-101 | ◐ **Mostly done — status corrected July 6, 2026, Pulse/System Bar gap closed July 7, 2026.** This table still said "needs its own design pass" but the LIVE tab build session (which mislabeled its own code comments "T-111" — a real numbering collision with the actual T-111, Full Founder Recognition, below; not fixed retroactively across every comment, but noted here so the two are never confused again) already delivered nearly all of this: per-player live stat feed (`lib/liveMatchupPoints.ts`), a scoring engine against each league's real `ScoringSettings` (`lib/scoring.ts`, T-116), Sleeper matchup-by-week pairing and live starter aggregation into a team total for both sides (`lib/liveRoster.ts`'s `matchups`), all surfaced on `/live`. What was still genuinely missing — this lived only on the LIVE tab, not on Pulse or the System Bar — is now closed: both now read the same `/api/live/status` (`matchups`) rather than a second computation. Pulse gets a new "Your Matchup" card (real myScore/opponentScore + projected scores per league), placed above the existing "Live Now" real-NFL-score card and deliberately *not* gated on `liveGames.length > 0` the way that card is — `buildLiveRoster`'s own matchup rail stays populated between windows (an early game finished, a later one hasn't kicked off), so gating on "a game is live right now" would blank an already-real, already-accrued score for no reason. System Bar gets a new `LiveMatchupBadge` (same collapsing single/multi-league pattern as the existing `LiveScoreBadge`), polling `/api/live/status` on its own 60s interval only while `rostiroState === 'game_day'` — a second lightweight poll rather than folding this into `/api/system/status`'s own per-page poll, which would mean an extra `buildLiveRoster`/Sleeper-roster computation running on every authenticated page load, not just Game Day. Both surfaces respect the same Pro `scoresGated` blur the real-score cards already use. `npx tsc`/`eslint`/production build all verified clean. Still genuinely missing: ESPN/Yahoo aren't wired (Sleeper-only, same as the rest of LIVE) — that's a separate, larger integration gap, not attempted here. |

Additional tasks from `Rostiro_Behavior_Wiring_Plan.md` — recommended build sequence, in order:

| Task | Description |
|---|---|
| T-102 | ✓ **Done.** Mode-aware AI voice — thread `mode` through every route that calls `lib/claude.ts` (start/sit, trade analysis, draft recommendations, Pulse reasoning); each prompt-builder selects a tone block per PRD 3 (Focused: verdict-first, no hedging; Balanced: current default; Savant: advisory only, never directive). Verified against the real Anthropic API — Focused output opens with a direct instruction, Savant never issues one. |
| T-103 | ✓ **Done.** Free/Pro usage quota enforcement — new `usage_counters` table + `lib/usageLimits.ts`'s `checkAndIncrementUsage()`, gating `/api/lineup/sleeper` and `/api/trades/analyze` at 3/week for Free before the Claude call. Plus the 1-league cap for Free at each platform's league-connection route — verified live: cap correctly blocked a real second-league connect attempt. |
| T-104 | ✓ **Done, amber-vs-green mismatch resolved July 6, 2026.** Draft State / Standard State surface wiring — Draft Kit and live draft session pick up Draft State's accent; Leagues sorts health factors by urgency during Standard State. Trades and the ticker deliberately untouched — nothing genuine to differentiate. The flagged mismatch (shipped amber vs. 6.13's "opportunity green") is now resolved: founder confirmed Draft should share Waiver Day's green — both are acquisition moments, same positive "opportunity" emotion (Section 7). `STATE_CONFIG.draft.color` and every place that mirrored the old amber (`app/draft/page.tsx`, `app/draft/session/[id]/page.tsx`'s Copilot Signal panel, the dev Simulation Panel) now match. |
| T-105 | ✓ **Done.** Mode threaded into remaining surfaces — Leagues, Trades, live draft session, Command Palette all now vary by Focused/Balanced/Savant. |
| T-106 | ✓ **Done.** The Interrupt Stack — `components/InterruptStack.tsx` mounted in `AppShell`, implementing 7.1's "one persistent interrupt slot at a time" rule via a new `layer` column on `pulse_items`. `detectTouchdownSwings`/`detectLineupLockUrgency` retrofitted off the Action-layer queue; `detectMissionComplete` deliberately stays (6.12 calls it "a calm summary card," not an interrupt). |
| T-107 | ✓ **Done.** Per-league waiver-cutoff config — new `connected_leagues` columns (`waiver_cutoff_day`/`hour`, nullable) + Settings UI (any platform, not Sleeper-only); `computeState()` prefers a configured per-league cutoff over the global Tue/Wed default, and stops applying the default entirely once every connected league has customized. Verified with 4 scenarios; caught and fixed a real backward-vs-forward date-math bug along the way. |
| T-108 | ✓ **Done** (Sleeper). Film Room recap card (new — real matchup data for the most recently completed week, win/loss by score comparison, 6.13's quietest palette) + Waiver Day's waiver_alert deepened with real FAAB remaining and a projected League Health delta (reusing `computeLeagueHealth`, verified with synthetic scenarios). ESPN/Yahoo matchup parsing deliberately not attempted — their fetchers exist as untyped stubs but their raw shapes can't be verified without real data, so guessing was rejected rather than risked. T-98's "League 1 of 3, ~12 min left" resumable session framing also not attempted — logged separately as remaining scope, not silently dropped. |
| T-109 | ✓ **Done.** League integration gap — new `/leagues/add` (reuses existing platform connectors, returns to `/leagues` instead of restarting onboarding) plus persistent "Add league" affordances on Leagues/Settings regardless of current count. Also fixed Pulse/Lineup's Sleeper-only `leagueCount` falsely reporting "no leagues" for ESPN/Yahoo-only accounts. Found and fixed via direct user testing. Same pass also fixed a false "Connected" state after a plan-blocked league add, and added an honest explanation for unknown-status (ESPN/Yahoo) leagues on the Leagues page. |
| T-110 | ✓ **Done** (badge only). Visible plan badge — `/api/system/status` now returns `plan`; System Bar shows a gold PRO/STARTER/FOUNDER badge next to the Mode chip (both breakpoints), Founder visually distinct (filled + star, not just Pro's label swapped). Free gets no badge on purpose. Found via direct user testing — nothing in the UI showed plan at all before this. |
| T-111 | ✓ **Mostly done** (added and shipped July 6, 2026; supersedes the earlier "needs a product decision" note — founder decided). Section 9 promises Founding 500 three things: founder badge (T-110, shipped), priority feedback access, and early feature previews. **Priority feedback access — shipped:** a Founders-only section on the new Profile page (T-126) with (1) a "Founding Member #N of 500" identity line, backed by `migration_founder_recognition.sql`'s `founding_number` column + `assign_founding_number()` Postgres function (atomic via `nextval()`, idempotent, enforces the 500 cap) — schema-ready ahead of T-85, since real assignment happens at Stripe checkout and nothing calls it automatically yet; (2) an in-app feedback form (`app/api/founder/feedback/route.ts`, new `founder_feedback` table) gated server-side on `plan='commissioner'`, not just hidden in the UI; (3) an external community-channel row, deliberately left as an honest "Coming soon" placeholder rather than a fake URL — no real Discord/Slack link exists yet, founder to supply and set up. **Early feature previews — deliberately deferred:** no per-user feature-flag targeting exists (`lib/featureFlags.ts` is global on/off only), and there's no actual feature queued for early access yet, so building that targeting now would be speculative infrastructure with nothing real to preview; revisit when a real feature needs it. **Marketing copy acknowledging Founders** — still waiting on the marketing-design pass per the v5.0 changelog, unchanged. |
| T-112 | Marketing landing page overhaul (added July 4, 2026, Phase 1) — `app/page.tsx` still reads as a generic navy-blue SaaS template (last touched at T-66/T-74) while the post-auth product has moved to the "Rostiro OS" design language (`app/globals.css`: void ground, glass surfaces, signal-blue glow, mono tabular-nums data, ambient drift). Pricing section shows a stale Scout/Starter/Pro/Commissioner four-tier model matching neither current code (`free/starter/pro/commissioner`) nor the confirmed T-85 target (Free / Rostiro Pro $9.99mo / Founder Season Pass $59 / Founding 500 $149 lifetime). Full visual + copy pass: real OS design tokens, current feature set (Rostiro States, Modes, Pulse, Health Score, Command Palette, System Bar), correct pricing. |
| T-113 | Live in-game injury detection (added July 5, 2026 — founder-confirmed deferral, not a silent drop). 6.12's "Injury during live play" P0 trigger: everything shipped so far detects *weekly designation changes* (`players_cache.injury_status`, refreshed on a cron), not a player going down mid-game. Needs a live injury signal — candidate source is the same Sleeper week-stats endpoint the LIVE stat sheet already reads (`api.sleeper.app/stats/nfl/{season}/{week}` includes per-player `injury_status` in its embedded player object), diffed during the live-scores poll. Delivery already exists (pushToUser + Pulse injury_alert path); this is detection only. Not started. |
| T-114 | Live (in-game) Opportunity Surge (added July 5, 2026). The *weekly* Opportunity Surge shipped as T-99 (depth-chart diffs). The live version — "your bench handcuff just started getting every carry because the starter left the game" — needs per-play or per-drive usage, which no wired data source provides today. Blocked on a real live usage feed; explicitly not buildable from the current score-delta polling. Not started. |
| T-115 | Trade offer received trigger (added July 5, 2026). 6.12's P1 trade trigger has no implementation at all — no webhook or polling watches for new trade proposals on any platform. Sleeper: no webhooks; would be polling `/league/{id}/transactions/{week}` for `type: trade, status: proposed` rows. ESPN/Yahoo: blocked on their respective integration gaps. Ships with 6.14's trade-deadline amplification once built. Not started. |
| T-116 | ✓ **Done** (added and shipped July 6, 2026). LIVE tab projections + subtle score-tick animation, closing a real gap found in review: every card only ever showed a live actual, with no projection to read it against, and points updated in place with no visual cue that anything had changed. New `lib/scoring.ts` (`computeStatlinePoints`) scores Sleeper's real per-category weekly projections (`api.sleeper.app/projections/nfl/{season}/{week}` — verified live, real 2026 Week 1 data already published) against each league's actual `ScoringSettings` — never Sleeper's own generic `pts_ppr`/`pts_std`, which assume standard modifiers a real league can override; reuses `liveEvents.ts`'s existing `fetchLeagueScoring`, same real-settings rule already established for live-event classification. Player cards and the matchup rail both now show `proj X.X` alongside the live number; no projection data for a player renders as absent, never a false "proj 0.0". Score changes now play a brief (0.7s), direction-colored scale animation (green up / amber down) via a CSS-keyframe-on-remount pattern, deliberately quieter than the touchdown/big-play takeover so it doesn't compete with that moment. Sleeper-only, same pre-existing scope limit as the rest of LIVE (T-111) — ESPN's `getEspnPlayerProjection` (T-88) is the ready-made equivalent once ESPN's `team_id` gap closes. |
| T-117 | ✓ **Done** (added and shipped July 6, 2026). Leagues page optimization — founder feedback: the page showed Health Score factors ("Starter injury risk 30%," "Bye exposure 20%," etc.) that nobody associates with fantasy football, with no explanation and zero league management. Added: a "What do these mean?" disclosure (plain-language description per factor + how the overall 0–100 score reweights around missing preseason data, matching `lib/healthScore.ts`'s real formulas, not a generic gloss); a "Manage" panel per league with an "Open in Sleeper/ESPN/Yahoo →" deep link (new client-safe `lib/leagueLinks.ts` — deliberately not importing `lib/espn.ts`/`lib/yahoo.ts` directly, since those read OAuth secrets from `process.env` at module scope and would pull server-only code into the client bundle) and the same waiver-cutoff editor + disconnect flow Settings already had, moved to the page where a user actually looks at a specific league instead of only living in Settings. `SystemStatusLeague` (and `/api/system/status`) now also returns each league's platform id, team id, and waiver cutoff so the page doesn't need a second round trip. |
| T-119 | ✓ **Done** (added and shipped July 6, 2026). Full pre-launch QA pass across the app (Simulation Panel scenarios, live-clicked every surface touched this week), done alongside a live production Supabase project. Two real bugs found and fixed, neither requiring a database migration: **(1) A genuine hydration mismatch** on every page load — `BootSequence`, `PulseMark`, and `SystemBar` all built their `className` with `` `...fixed text ${condition ? 'x' : ''}` ``, which leaves a trailing space when the condition is false; something in the server/client render pipeline disagreed on that trailing space (7 call sites total, including 3 more introduced by T-116/T-118 this week: the score-tick classes on `/live`, the kickoff-sweep label on Pulse, `live-unlock-flash` on both nav variants). Fixed by `.trim()`-ing every one — cheap, safe, matches the pattern everywhere it appears rather than picking off only the ones that happened to be visibly caught. **(2) The existing "migration not run yet" graceful-degradation checks across 6 API routes only ever matched Postgres's native `42703` error code — but a real Supabase project's REST layer (PostgREST) returns its own `PGRST204` for a column missing from its schema cache, which is what every one of these routes actually hit in practice, verified live against this project's own real (currently degraded/intermittent) Supabase instance.** Meaning the "degrade honestly" safety net this codebase has relied on since T-71/T-78/T-107 never actually fired — every one of these silently 500'd instead of degrading. Fixed in `/api/settings` (mode + seen_hints), `/api/settings/export`, `/api/leagues/[id]`, `/api/system/status`, `/api/pulse/interrupts`, and `/api/pulse/items/[id]` — all now check both codes. **Update, same day:** both migrations (`migration_experience.sql` for `seen_hints`, `migration_waiver_cutoff.sql` for the waiver-cutoff columns) have now been run — Supabase's dashboard/SQL editor had a real, temporary outage, not a permanent block. Both fixes re-verified live end-to-end post-migration: a dismissed coach mark now survives a full reload (advances to the next hint instead of restarting), and a waiver-cutoff edit on the Leagues page now survives a full reload too. Both PATCH endpoints return clean 200s; the PGRST204 checks above are now just quietly-correct dead code, exactly as intended. Also investigated and ruled out as a false alarm: a duplicate "Puka Nacua — Doubtful" Pulse card seen during testing — traced to the dev Simulation Suite's `insertTrackedPulseItem` doing a raw insert with no fingerprint dedup by design (so a scenario can be re-fired repeatably same-day for testing), not a real production dedup gap. |
| T-74 | ✓ **Done** (shipped July 6, 2026, alongside T-120/T-121 below). Features page (`app/features/page.tsx`) — the OS story, told with real embedded components rather than screenshots per this task's own "no screenshots" note: the real `TickerBar` (its data route, `/api/adp/movers`, is already public/no-auth, same posture as Draft Kit — state/live-score theming just stays quiet for a logged-out visitor, which is honest), and a genuinely interactive Pulse density demo (`components/marketing/InteractivePulseDemo.tsx`) where clicking Focused/Balanced/Savant re-renders the same sample decision three different ways. Three pillars (Pulse/cross-league command center, the five Rostiro States, Game Day Mission Control + the Interrupt Stack), each pitched twice — once for the Savant persona, once for the casual manager — per PRD §3's two archetypes needing to see themselves on the same page. New reusable `ProductVideoDemo` component (glass frame, signal glow, breathing idle animation) holds three placeholder slots for the mid-July veo shoot, each with a founder shot-list note kept as a code comment next to its own call site rather than a separate doc. New `DataJoinDiagram` — a real inline SVG, not a screenshot — renders the nflverse→PFR-crosswalk→Sleeper join chain T-87 actually built. |
| T-120 | ✓ **Done** (added and shipped July 6, 2026). FAQ page (`app/faq/page.tsx`) — a hand-rolled accordion (`components/marketing/FaqAccordion.tsx`, no dependency, matching every other interactive surface in this codebase), five grouped categories, explicitly answering the objection vectors that actually matter pre-signup: does Rostiro replace ESPN/Yahoo/Sleeper (no — read-only for ESPN/Sleeper, OAuth read+write for Yahoo only), what Focused/Balanced/Savant actually mean, how connected-league credentials are secured (AES-256-GCM at rest, verified against `lib/encrypt.ts` rather than assumed), and why Game Day's portfolio-relevance filter is a genuinely different pattern than a normal fantasy app's notifications. |
| T-121 | ✓ **Done** (added and shipped July 6, 2026). Terms of Service (`app/terms/page.tsx`) — founder-written baseline, same "not legal counsel's work, flagged inline" posture as `/privacy`. Built around one specific liability concern raised directly by the founder: a fantasy manager losing a matchup or a league and blaming a Rostiro recommendation for it. §7 ("No guaranteed outcomes") states plainly and prominently that every recommendation is an informational opinion, never a guarantee, and that the user is solely responsible for every roster decision regardless of whether it followed Rostiro's advice — grounded in real research into fantasy-advice-industry disclaimer patterns (FantasyPros/Yahoo-style "as is," outcome, and AI-content disclaimers) rather than invented from scratch. Also covers: the same read-only-ESPN/Sleeper-vs-OAuth-Yahoo boundary from §5, an explicit Claude API / AI-generated-content disclaimer (§6) noting reasoning text isn't human-reviewed, a real liability cap and arbitration/class-action-waiver clause (standard for the category, not novel), and an explicit "not financial or betting advice, does not facilitate wagering" statement tying back to fantasy sports' legal skill-game distinction from sports betting. Signup (`app/(auth)/signup/page.tsx`) now links both Terms and Privacy in a "by creating an account, you agree to" line — previously neither was referenced anywhere in the signup flow. `PublicHeader`/`PublicFooter` updated with Features/FAQ/Terms links across the board. |
| T-118 | ✓ **Done** (added and shipped July 6, 2026). Two founder-reported gaps investigated together. **(1) Focused mode "no visible difference":** real bug found, not a perception issue — PRD §3 promises Focused caps Pulse at "5 max actions," but `app/(dashboard)/pulse/page.tsx` never actually sliced the list; it only hid reasoning text, so a short test-league Pulse queue looked identical across all three modes. Fixed: Focused now renders the top 5 of the already-prioritized queue, with an honest "N more in Balanced or Savant" note and the mode-label divider now saying "TOP 5 OF 8" rather than a bare item count that silently disagreed with what was on screen. Draft Kit / live draft session were already correctly mode-differentiated and are the best place to see Focused vs. Savant today. **(2) Player names not clickable everywhere:** full sweep against the app's own Core Philosophy rules ("surface actions, not information," "deep-link is a feature") rather than a literal PRD line, since 6.11 doesn't explicitly mandate it. Wired `openPlayerCard` (Player Intelligence Card, T-89) into every remaining static player-name render: Pulse's Film Room buy-low/sell-high signal; the Live Now player-attribution line shared by Pulse and System Bar (previously a single joined string, not individual elements — extracted into new `components/players/PlayerSummaryLine.tsx`, resolving a pre-existing duplication between the two call sites as a side effect); the entire live draft session sidebar/board (Best Available, My Queue, Recent Picks, My Roster, Copilot Signal, the strategy-switch confirm modal); Trades' selected-player chips and search-result rows (the latter required splitting one click target into two — name opens the card, the rest of the row still adds to the trade, since it was previously one button covering both); and the LIVE tab's roster cards (required converting the row from a `<button>` to a `role="button"` div, since a name button can't legally nest inside another button). `RelevantPlayer` (types) gained a `playerId` field to make the Live Now line's names clickable in the first place. Draft Kit and Lineup were already correctly wired — confirmed, not re-touched. |
| T-122 | ✓ **Done** (added and shipped July 6, 2026). Founder confirmed the front-end gap directly: the only sign-out entry points that existed were an unlabeled icon at the bottom of the desktop dock (`components/nav/Sidebar.tsx`) and a labeled item buried in mobile's More sheet (`components/nav/BottomNav.tsx`) — real code, but neither read as "log out" in practice, and Settings had none at all. Fixed by giving Log Out one unambiguous, explicitly-labeled home: the new Profile page (T-126). |
| T-123 | ✓ **Done** (added and shipped July 6, 2026). Founder decision: personalization capture happens post-email-confirmation, not on the signup form itself (avoids adding friction to the step most likely to lose someone before they've even verified their email). Scope confirmed as name-only, nothing broader — Mode already captures "how much do you want to see," and Rostiro already knows real rosters from synced leagues, so asking fandom-style questions on top would be scope creep without a functional payoff. Added an optional first-name field to onboarding Step 1 (`components/onboarding/ModeSelection.tsx`, alongside Mode selection), written via `supabase.auth.updateUser({ data: { full_name } })`. The Pulse greeting's name-personalization (`app/(dashboard)/pulse/page.tsx`'s `firstName`) and its data source (`app/api/pulse/sleeper/route.ts` reading `user_metadata.full_name`) already existed and were fully wired — nothing was ever collecting the name to populate it until now. `/api/settings` GET extended to also return `fullName` from the same field, powering the Profile page. |
| T-126 | ✓ **Done** (added and shipped July 6, 2026). New Profile page (`app/(dashboard)/profile/page.tsx`) — founder-requested, deliberately light: Identity (name, editable inline; email; member since), Plan & billing (current plan/badge; billing management explicitly deferred to Stripe checkout, T-85, rather than a fake non-functional link), and Session (one explicit, clearly-labeled "Log out" button — resolves T-122). Deliberately kept separate from Settings, which stays the granular-config surface (Mode, Connected leagues, Product tour, Data & privacy, Danger zone) with no overlap. Nav entries added: a Profile icon in the desktop dock (`Sidebar.tsx`, between Live and Settings) and a "Profile" row in mobile's More sheet (`BottomNav.tsx`). |
| T-124 | ✓ **Done** (added and shipped July 6, 2026). Founder decision after discussion: both hero sections needed (1) a one-time entrance stagger (badge → headline → subtext → CTAs cascade in on load, `.hero-enter` in `globals.css`, respects `prefers-reduced-motion`) and (2) the hero badge reflecting the *real, live* Rostiro State — schedule-driven and identical for every visitor at a given moment, same posture as the public ADP ticker, not a per-user or demo value. Visual only (accent color + the real animated `PulseMark`), not per-state copy rewrites — founder explicitly scoped out headline/subtext variation to keep launch-week copy risk low. New `lib/publicRostiroState.ts` reuses the exact same `computeState()` the real product calls, with one adaptation: Draft State can't come from a user's incomplete-draft signal on a logged-out page, so it uses a calendar window instead (now through the day before Week 1). Caught and fixed live during verification: an initial Aug 1 window start let the bare weekday math fall through to Film Room in the middle of July, before a single game had been played — pulled the window back to the marketing launch date itself so the entire pre-season stretch reads as "get ready," never a mid-season state that doesn't apply yet. `partsInEastern` exported from `lib/rostiroState.ts` so the public variant reuses the identical ET day-boundary logic rather than reimplementing it. **Revision, same day — "Living Signal Field":** founder asked for the homepage hero background itself to be animated too, evoking Bloomberg/an OS/Matrix/football together. First brainstorm (dense ticker rows of real player names/stats) was explicitly rejected by the founder as intimidating to a first-time casual visitor — the hero is the very first thing anyone sees, and PRD §3's Focused persona ("tell me what to do," not data density) is exactly who a stat-dense background would scare off. Rebuilt as two deliberately abstract layers, nothing legible: new `components/marketing/AmbientSignalField.tsx` renders (1) two large, blurred EKG/pulse-waveform strips (the same heartbeat envelope shape as `PulseMark`, scaled up) drifting slowly behind the hero, colored by the live state; (2) 2-3 sparse floating single-word tag pills cycling through the real Pulse card vocabulary (WAIVER, TOUCHDOWN, TRADE, INJURY, REVIEW — honest foreshadowing of real product tags, not invented decoration), fading in/out one at a time, never a dense row. Pure CSS-driven (`globals.css`'s `.signal-wave`/`.tag-pill-float`), no client JS, respects `prefers-reduced-motion`. Verified live: initial opacity/blur values were tuned too low to actually perceive against the dark background — confirmed via DOM inspection that the elements were rendering correctly before concluding it was a visibility-tuning issue, not a bug, and re-tuned until clearly visible without competing with the hero text. **Second revision, same day:** founder pointed to keyboardkarate.io's own hero (their other product) as the reference — pills there type themselves out character-by-character with a blinking cursor, not static text. Rebuilt the pill layer on that exact pattern: pure-CSS typewriter reveal (an overflow-hidden span animating `width` in `ch` units with `steps(N)`, `globals.css`'s `.type-reveal-text`/`.type-cursor`, sharing `--pill-duration`/`--pill-delay` with the existing fade envelope so the two animations never drift out of sync across infinite loop iterations), checkmark prefix, monospace. Content changed from single generic tag words to short real product moments per feature/state (Pulse, Co-Pilot Signal, Waiver Day, Game Day, Film Room), each colored by that state's real `STATE_CONFIG` accent — kept to short single-line phrases, deliberately sparser than keyboardkarate's denser 2-3 line pills, per the founder's standing concern about not overwhelming a first-time casual visitor. Still zero client JS. **Third revision, same day:** two founder fixes. (1) Too much empty space — doubled the pill count from 5 to 10, spread across the full hero height/width rather than 2-3 visible at once; still short single-line phrases, just more of them filling the flanks. This surfaced a real bug: right-side pills were positioned via `left: 90%`, so any pill wider than the remaining 10% of viewport overflowed past the edge and got clipped by the wrapper's `overflow-hidden` — fixed by anchoring right-side pills via `right:` instead of `left:`, so every pill's far edge is a fixed distance from its actual anchor edge regardless of text length. (2) Typing felt too slow — tightened `type-reveal-cycle`'s reveal window from 12%-38% of the cycle down to 12%-24%, roughly halving type-in time without making it instant. |
| T-127 | ✓ **Done** (added and shipped July 6, 2026). Auth screens (login/signup) were flat `var(--void)` with zero texture — the only pages on the whole site with none of the ambient "the OS is alive" language everything else now has. Founder's own idea, built as proposed: a slow ambient wash cycling through all five real Rostiro States' colors (`STATE_CONFIG`), a literal answer to "the various states of the OS throughout the fantasy week" rather than a single static blue gradient. New `components/AmbientStateSweep.tsx` — five blurred solid-color radial blobs stacked in the same position, crossfading through in sequence via staggered `animation-delay` (same technique as the hero's floating pills, five-way and much slower: 80s full cycle vs. the hero's ~16-19s pill loops). Deliberately calmer than the marketing hero per founder direction: no typing pills, no ticker vocabulary, and the login/signup card itself stays completely static — only the background moves, since typing a password is a task to get out of the way of, not a selling moment. Pure CSS, no client JS, respects `prefers-reduced-motion` (falls back to the original flat background). Verified live on both `/login` and `/signup`. |
| T-128 | ✓ **Done** (added and shipped July 6, 2026, founder-reported: sign-out button in the desktop dock "inert clicks every time, multiple sessions"). Real bug found, not the discoverability gap T-122 diagnosed — `app/api/auth/signout/route.ts` was hardcoded to redirect via `process.env.NEXT_PUBLIC_APP_URL`, and both `.env.local` and `.env.example` set that to the *production* URL (`https://rostiro.vercel.app`). So sign-out actually succeeded server-side in every environment, then redirected the browser away to the live production site instead of staying on the same origin — looked exactly like "nothing happened," and reproduced across sessions since it's not session-specific, it fires in every non-production environment. Fixed by deriving the redirect from the incoming request's own origin (`new URL('/login', request.url)`) instead of an env var — needs no configuration and can't drift out of sync with wherever the app is actually running. Found and fixed the identical pattern in `app/api/auth/yahoo/callback/route.ts` while checking for other occurrences — same root cause, same fix (`origin` from the already-parsed request URL). Not personally verified end-to-end (no logged-in test session available this pass) — founder should confirm live. |
| T-129 | ✓ **Done** (added and shipped July 6, 2026, founder-reported: T-128's fix now redirects correctly but hits a 405 on `/login`, and a manual refresh "fixes" it). Second bug in the same code path, masked by T-128's original one: `NextResponse.redirect()` defaults to a 307 status, which per HTTP spec preserves the original request's method at the new location. The dock/BottomNav sign-out control is a real `<form method="POST">`, so the browser was re-issuing a **POST** to `/login` — a page route that only handles GET — hence the 405. A manual refresh only appeared to fix it because a reload defaults to a fresh GET, which masked the real bug rather than resolving it. Fixed with the standard Post/Redirect/Get pattern: pass `303` explicitly (`NextResponse.redirect(new URL('/login', request.url), 303)`), which tells the browser to switch to GET regardless of the original method. |
| T-130 | ✓ **Done** (added and shipped July 7, 2026, founder-reported gap: "where is the password reset link"). Built all three pieces confirmed missing: (1) a real "Forgot password?" link on `app/(auth)/login/page.tsx`, replacing the placeholder comment that deliberately hadn't linked anywhere yet; (2) new `app/(auth)/forgot-password/page.tsx` calling `supabase.auth.resetPasswordForEmail(email, { redirectTo: '/api/auth/callback?next=/reset-password' })`, reusing the existing PKCE callback route (`app/api/auth/callback/route.ts`) that already handles magic-link/OAuth code exchange rather than building a second one — same success message whether or not the email has an account, so the form can't be used to enumerate real signups; (3) new `app/(auth)/reset-password/page.tsx`, gated on a real session existing (checks `getSession()` before rendering the form) so a stale or reused link shows "This reset link is invalid or has expired" with a link back to request a new one, instead of a form that would just fail on submit. Verified live end-to-end: submitted a real email through `/forgot-password` and got the real success state (confirmed via browser automation, not just code review); `/reset-password` visited directly with no session correctly shows the invalid-link guard. Emails still go out through Supabase's default (unbranded) sender until T-135 ships. |
| T-131 | ✓ **Done** (added and shipped July 6, 2026, founder-reported). Founder flagged that the sign-out control sits close to other buttons (Settings/Profile in the desktop dock, a dense mobile sheet) where a misclick could sign someone out unintentionally. New `components/LogoutConfirm.tsx` — a single shared confirm modal ("Log out of Rostiro?") used at all three sign-out entry points (`Sidebar.tsx`'s dock icon, `BottomNav.tsx`'s More sheet, the Profile page's explicit Log Out button, T-126), so the confirmation behavior and copy can't drift out of sync between them the way the three sign-out buttons themselves already had before T-122/T-126. Each call site keeps its own exact button styling via a render-prop trigger; the modal only owns the confirm step and the real `<form method="POST">` submit once confirmed. |
| T-132 | ✓ **Done** (added and shipped July 6, 2026, founder decision: "we do not use magic link so remove that from auth"). Removed the Magic Link tab/mode entirely from `app/(auth)/login/page.tsx` — `handleMagicLink`, the mode toggle, and `authMode` state all deleted; login is password-only now. Signup never had it. |
| T-133 | ✓ **Done** (added and shipped July 6, 2026, founder-requested). Browser-tab favicon was still the generic default Next.js/Vercel placeholder `app/favicon.ico` — never replaced with the real brand mark. Used `public/brand/notification-icon.svg` (blue `#378ADD` background, white pulse polyline) rather than the State-colored "Standard icon" spec — the brand kit itself designates the notification-icon variant as the one State-*independent*, fixed-color version, which is exactly right for a favicon that can't reflect live product state the way the in-app pulse mark does. Added as `app/icon.svg`, Next.js's native metadata-file convention (auto-injects the `<link rel="icon" type="image/svg+xml">` tag, verified live via the rendered page head); removed the old placeholder `app/favicon.ico` so it can't take precedence over the new one in any browser that still checks that path directly. |
| T-134 | ✓ **Done** (added and shipped July 6, 2026, founder-reported: T-131's logout confirm modal renders as a narrow broken column pinned to the sidebar instead of covering the screen — screenshot attached). Same root cause, same fix, as a bug already found and fixed once in this codebase: `components/nav/Sidebar.tsx`'s `<aside>` sets `backdropFilter` directly, and `filter`/`backdrop-filter` establish a new containing block for `position: fixed` descendants per the CSS spec — so `LogoutConfirm`'s "fixed, cover the whole viewport" modal, rendered inline as a child of that `<aside>`, was actually being contained by the aside's own 52px-wide box instead of the real viewport. Identical root cause to the Pulse detail drawer's earlier z-index bug (that fix's own comment explains it). Fixed the same way: `createPortal(..., document.body)`, escaping every ancestor's filter/transform/stacking context entirely. Not personally re-verified live (no logged-in test session available) — founder should confirm. |
| T-135 | **Code done, pending DNS verification** (added July 6, 2026, code shipped July 7, 2026, founder gap-analysis pass ahead of opening real signups). Both auth emails (signup confirmation, password reset) were rewritten to go through Resend instead of Supabase's own unbranded sender: `browserClient.auth.signUp()`/`resetPasswordForEmail()` (which always trigger Supabase's own built-in email, with no per-call template override short of Custom SMTP + dashboard-edited templates) were replaced with two new server routes, `app/api/auth/signup/route.ts` and `app/api/auth/forgot-password/route.ts`, that call `admin.auth.admin.generateLink()` (generates the confirmation/recovery link, sends nothing) and hand the link to new `lib/resend.ts`, which sends Rostiro's own branded HTML template (table-based layout for email-client compatibility, brand kit's navy/signal-blue tokens, the notification-icon mark, marketing-wordmark treatment since an email is a hero surface, not an in-product screen). Both client pages (`app/(auth)/signup/page.tsx`, `app/(auth)/forgot-password/page.tsx`) now POST to these routes instead of calling the Supabase client SDK directly; the underlying confirm/reset link mechanism is unchanged, so `/api/auth/callback` still handles it exactly as before. Verified for real: the actual `RESEND_API_KEY` in `.env.local` is valid and the account is live, and sending the exact branded template through Resend's sandbox sender (`onboarding@resend.dev`) to the account's own verified address (`lawrence@rostiro.com`) delivered successfully, confirming the code path, the API key, and the template itself all work end-to-end. Sending `from noreply@rostiro.com` still fails (`"The rostiro.com domain is not verified"`) — DNS records were added in Squarespace July 7 (confirmed live via direct `dig`: `send.rostiro.com`'s SPF TXT and MX both resolve to Amazon SES, which is what Resend runs on), but Resend's dashboard still shows the domain's records as pending verification, DKIM specifically didn't resolve in a follow-up check. Real user emails can't go out from `rostiro.com` until Resend marks it verified — revisit once that flips, no code changes needed at that point. |
| T-136 | ✓ **Done** (added July 6, 2026, shipped July 7, 2026, founder gap-analysis pass). Replaced the passive "by creating an account, you agree to Terms" footnote on `app/(auth)/signup/page.tsx` (no affirmative action required, "browsewrap") with a real unchecked-by-default checkbox ("clickwrap") linking the same Terms/Privacy pages; the submit button stays disabled until it's checked. Enforced server-side too, not just in the UI: `app/api/auth/signup/route.ts`'s Zod schema requires `agreedToTerms: z.literal(true)`, so hitting the API directly without it returns a 400 rather than silently creating an account, verified live via a direct `curl` with the field omitted. |
| T-137 | Pre-launch legal/business checklist (added July 6, 2026, founder gap-analysis pass) — not code tasks, logged so they don't get lost: (1) real lawyer review of Terms/Privacy before Stripe goes live, both pages currently self-disclose as founder-written drafts; (2) file trademark protection for the "Rostiro" name/logo — flagged in the founder's own marketing research as the one clearly protectable surface in this category, not yet filed; (3) verify `support@`/`privacy@`/`legal@rostiro.com` (referenced in the app's own Terms/Privacy pages) are real, monitored inboxes; (4) business entity + sales tax registration, required by Stripe before it processes real payments, bundle with T-85. |
| T-138 | ✓ **Done, migration pending** (added July 6, 2026, shipped July 7, 2026, founder gap-analysis pass). "Or equivalent" per this task's own text — built Postgres-backed, same posture as `lib/observability.ts`'s `api_call_log`/circuit breakers rather than adding a new external SDK (Sentry) into an app on a very new Next.js version (16.2.10) with no account provisioned yet anyway. New `app_error_log` table (`supabase/migration_error_log.sql`, not yet run — needs the founder to run it in the Supabase SQL editor, same as every other migration file in this repo) backs new `lib/errorLog.ts`'s `logAppError()`, distinct from `api_call_log` (that one only covers external Sleeper/ESPN/Yahoo/Claude call failures, this covers our own code). Wired into two real surfaces: (1) new `app/global-error.tsx`, Next's catch-all for an uncaught error escaping the root layout — previously a real crash showed Next's generic default screen and left zero record anywhere; now shows a real branded fallback and logs via a new `app/api/system/log-error/route.ts` (a Client Component can't import `logAppError` directly since it depends on `next/headers` through `lib/supabase.ts`, so it posts to this route instead, same client/server split the rest of the app already uses). (2) new `app/api/system/health/route.ts`, an unauthenticated GET checking real DB connectivity, meant as a target for an external uptime pinger (UptimeRobot/Better Stack free tier, etc. — none configured yet, this just gives one somewhere real to point at). Verified live: health endpoint returns `{ok:true, db:"reachable"}`; log-error endpoint accepts a real POST and degrades to a no-op (never throws) when the migration hasn't run yet, confirmed by testing both before and after adding the migration file. Call sites beyond the global boundary (individual API routes' own catch blocks) can adopt `logAppError()` incrementally as real errors are found — this pass ships the infra and the one crash boundary that previously had zero visibility at all, not a sweep of all ~40 existing routes. |
| T-139 | ✓ **Done** (added and shipped July 6, 2026, founder-reported). Founder review of `app/draft/join/page.tsx` found three real gaps: (1) ESPN had zero mention anywhere: checked the code, and it's not just under-explained, `SupportedPlatform` was hardcoded to `Extract<Platform, 'sleeper' \| 'yahoo'>` even though `types/index.ts`'s `Platform` already includes `'espn'`. Added an honest disabled "ESPN · Coming soon" tab rather than pretending it works or saying nothing, real wiring is its own follow-up (see T-140). (2) No copy explained how Co-Pilot actually uses the selected draft strategy, added a dedicated explainer panel (strategy filters every recommendation, updates live if you switch mid-draft). (3) The page sat in a `max-w-md` single column with large unused margins on anything wider than a phone, rebuilt as two columns at `md+` (platform/join mechanics left, strategy + explainer right), single column preserved on mobile. Revision, same day: founder flagged em-dashes and dense phrasing in the Co-Pilot explainer panel and the `late_qb` strategy card copy. Split the explainer into three short sentences, removed every em-dash from that panel plus the error/tooltip strings and code comments across `app/draft/join/page.tsx` and `lib/draftBoard.ts` for consistency, and rewrote the `late_qb` description without one. |
| T-140 | **On hold, founder decision July 7, 2026** — Wire real ESPN draft tracking to a route (added July 6, 2026, split out from T-139). `getEspnDraftDetail` and friends already exist in `lib/espn.ts` and work when called directly (confirmed in an earlier session), but nothing wires them to `/api/draft/session` the way Sleeper/Yahoo are wired. Investigation before starting the build (July 7, 2026) found this is a bigger gap than T-139's split-out implied: unlike Sleeper/Yahoo, there is no code anywhere that resolves which ESPN team is "mine" (ESPN's connected-league flow never stores a `team_id`), `player_mappings.espn_id` (the column that would translate ESPN's numeric player IDs into Rostiro's own player scheme) is real but unseeded, and `mDraftDetail`'s `picks` array populating pick-by-pick during a real, human-paced draft is still unverified — the one prior test used a bot-filled mock draft that completed too fast to check (only `inProgress` flipping true at kickoff was confirmed). Presented the founder three options (manual-entry MVP now with "Unknown player" degradation where the mapping table has no match, hold until real live-draft test access exists, or deprioritize below T-141-144) — founder chose to hold until live test access is available, rather than ship team-resolution/player-mapping code built against unverified API shapes. |
| T-141 | ✓ **Code done, migration pending** (added and shipped July 7, 2026, founder request: "almost no place for users to input their questions or add context"). New `notes` table (`supabase/migration_notes.sql`, not yet run — needs the founder to run it in the Supabase SQL editor, same as every other migration file in this repo): `id`, `user_id`, `league_id` (nullable, FK `connected_leagues`), `player_id` (nullable), `type` (`'general' \| 'ask_copilot'`), `body`, `response`/`status` (nullable, unused until T-142), `created_at`/`updated_at`, RLS scoped to `auth.uid() = user_id`. One shared table/route for both note types rather than two separate features — T-142 is additive on top of this, not a schema change. This pass ships General only: new `components/NotesPanel.tsx`, a contextual "Add note" toggle (no new nav tab, no standalone notebook) embedded directly in the Leagues page (scoped to that exact league, no picker) and the Trades page (a league picker sourced from `/api/settings`'s existing leagues list, since that page isn't tied to one league). 500-char cap with a live counter; General notes never call Claude at write time, pure storage. New routes `app/api/notes/route.ts` (GET list with league/player names resolved via join queries so a renamed league or player never shows a stale cached name, POST create) and `app/api/notes/[id]/route.ts` (DELETE), both RLS-backed via `createSSRClient` same as `app/api/founder/feedback/route.ts`. Verified: `npx tsc`/`eslint` clean, a full production build succeeds, and all three routes correctly return `401 Unauthorized` when hit without a session — full logged-in click-through wasn't possible this pass (no account password available to actually sign in and test live), so the UI itself is unverified beyond code review until the founder runs the migration and tries it. |
| T-142 | Ask Copilot note type — trade/scenario queries (added July 7, 2026, founder request, motivating example: "find me a trade for Patrick Mahomes, looking for RB or TE of similar return"). Builds on T-141's schema with `type = 'ask_copilot'`: league select is required (a trade ask is meaningless without knowing which league's real rosters to search), body capped at 280 chars to force a focused ask and keep the prompt small. Keeps this codebase's standing discipline (`app/api/trades/analyze/route.ts`, every other `generate*` in `lib/claude.ts`): deterministic layer finds real candidates first, Claude only explains them, never invents a trade partner it hasn't actually seen in that league's roster data. Needs one new deterministic step extending the Trade Analyzer's existing `adpValue` logic into a real candidate-finder: given a player + target position(s), scan that league's actual fetched rosters for comparable-value players at that position, then hand the top 1-3 real candidates to a new Claude reasoning function (same pattern as `generateTradeReasoning`). Cost controls: `checkAndIncrementUsage` (`lib/usageLimits.ts`) gets a new `'ask_copilot'` feature key, plan-gated weekly quota same as trade analysis; `checkRateLimit` (`lib/rateLimit.ts`) adds a per-user burst throttle (e.g. one ask per 30s) so quota can't be blown through scripted bursts. ✓ **Code done, migration pending** (shipped July 7, 2026). New `app/api/notes/ask-copilot/route.ts`: anchor player is resolved by longest-substring match of the ask text against the manager's own real rostered players (`getSleeperRosters`, cross-referenced with `players_cache`) — never a guess, always a player actually on their roster. Target position(s) parsed from QB/RB/WR/TE/K/DEF keywords in the ask text, falling back to the anchor's own position when none are mentioned. Candidates are every other roster's players at the target position(s), ranked by closeness to the anchor's `adpValue` (identical curve to the Trade Analyzer) and capped to the top 3; new `getSleeperLeagueUsers` (`lib/sleeper.ts`) resolves each candidate's real team name (`metadata.team_name`, falling back to `display_name`) so the answer names an actual manager, not a roster ID. New `generateAskCopilotReasoning` in `lib/claude.ts` explains only the candidates it's handed, same non-inventing discipline as `generateTradeReasoning`; a deterministic fallback sentence covers a failed/over-quota Claude call the same way the Trade Analyzer does. New `components/AskCopilotPanel.tsx` on the Trades page (league select required, 280-char cap, live counter). Every answer is persisted as a `notes` row (`type: 'ask_copilot'`, `response`, `status: 'answered'`) — degrades gracefully (still answers, just doesn't persist) if `migration_notes.sql` hasn't been run yet, same posture as T-141. `npx tsc`/`eslint`/production build all verified clean; full logged-in click-through not yet possible (same reason as T-141 — no account password available this pass). |
| T-143 | ✓ **Code done, migration pending** (added and shipped July 7, 2026, split out from T-141/T-142 — the loop-closing half of the notes feature). Right now every AI surface in this app tells the user something; none of them read anything the user wrote back. Two real wire-ups: (1) a general note on a rostered player feeds `generateOpportunitySurgeContext` (`lib/pulse.ts`'s `getOrGenerateSurgeReasoning`, the "your bench handcuff just started getting every carry" waiver-rundown sentence) — real gap found while building this: that reasoning is cached in `player_context_cache` **shared across every user** who sees the same surge event, so a note-influenced sentence bypasses that shared cache entirely (no read, no write) rather than leaking one user's private note into every other user's identical card; everyone without a note keeps hitting the same shared, note-free cache as before. (2) a general note on a league feeds `generateTradeReasoning` — added an optional league select to the Trades page (separate from Ask Copilot's required one; the deterministic verdict/value never depended on a league to begin with) that threads `leagueId` into `/api/trades/analyze`, which fetches that league's notes and passes them to Claude as extra context. Both wire-ups are strictly additive: notes are explicitly instructed as context only, never allowed to override the real depth-chart signal or the ADP-computed verdict, and a missing/failed note lookup (migration not run yet) just means no notes feed in. `npx tsc`/`eslint`/production build all verified clean. |
| T-144 | ✓ **Done** (added and shipped July 7, 2026, founder request). Real gap found before writing any code: `snoozed_until` and the `'snoozed'` status already existed on `pulse_items` (T-69's persistent Action-layer queue, `app/api/pulse/items/[id]/route.ts`'s PATCH already handles `action: 'snooze'` generically for any pulse item) — no new column needed, this task was purely wiring the Interrupt layer (T-106) up to that existing mechanism. Added a "Snooze" button next to the existing "✕ Dismiss" on a critical interrupt card (`components/InterruptStack.tsx` — non-critical interrupts already auto-dismiss in 7s, so snooze is only offered where dismiss already was) that PATCHes the same `action: 'snooze'`. `app/api/pulse/interrupts/route.ts`'s GET now selects `snoozed_until` and matches `status.eq.open` OR `(status.eq.snoozed AND snoozed_until.lte.now)` — a snoozed interrupt whose window has passed is read back in and presented as `open` again (the DB row itself keeps `status: 'snoozed'` until the user acts on it again; this is a read-time-only presentation, not a write-back). No new table, no cron, no migration. `npx tsc`/`eslint`/production build all verified clean. |
| T-145 | Admin errors page (added July 7, 2026, founder follow-up to T-138). T-138 shipped `app_error_log` + `/api/system/health` but no in-app viewer — today that means opening Supabase's Table Editor/SQL Editor by hand to see anything logged. Build a simple `/admin/errors` page (gated to the founder account the same way Profile's Founding 500 feedback panel is gated on `plan === 'commissioner'`), listing `app_error_log` rows newest-first with source/message/stack/context. Founder created a real Better Stack account July 7, 2026, meaning the actual uptime-alert half of T-138 (pointing an external monitor at `/api/system/health`) can now actually be finished — that's a founder-side dashboard step (adding the monitor URL in Better Stack), not code, but worth surfacing/linking from this same admin page once built rather than leaving it as a separate untracked step. ✓ **Done** (added and shipped July 7, 2026). New `app/api/admin/errors/route.ts` re-checks `plan === 'commissioner'` server-side via `createAdminClient` before reading — `app_error_log`'s own RLS policy only grants `service_role` (migration_error_log.sql), so this route has to go through the admin client to read it at all, same as every other admin/cron read in this codebase; the client-side check in the new page is UX only, not the real gate. New `app/(dashboard)/admin/errors/page.tsx` lists the most recent 200 rows newest-first with an expandable stack/context detail per row, no new nav item — reached via a "View error log →" link tucked inside Profile's existing Founding 500 panel, plus a note pointing at the Better Stack `/api/system/health` step (a founder-side dashboard action, not code). Degrades to an empty list rather than an error if `migration_error_log.sql` hasn't been run yet. `npx tsc`/`eslint`/production build all verified clean; full logged-in click-through not yet possible (same reason as T-141/T-142/T-143 — no account password available this pass). |
| T-146 | ✓ **Done** (added and shipped July 7, 2026, founder-reported gap after testing T-141). A note was previously only visible from wherever it was written (a specific league card, or the flat list on Trades) — no "show me everything I've written" surface, even though `/api/notes` GET already returned every note for the user regardless of league (this was a UI-only gap, not a schema/API gap): `NotesPanel` with no `leagueId` prop already showed the unfiltered full list (`visibleNotes = leagueId ? notes.filter(...) : notes`), it just had nowhere unscoped to render. Added a "My Notes" section to the Profile page, rendering `components/NotesPanel.tsx` with no `leagueId`. New `defaultExpanded` prop on `NotesPanel` — Leagues/Trades keep the contextual collapsed-behind-"+ Add note" behavior (a small annex, not somewhere to check unprompted), but Profile's is the dedicated full-list surface and opens by default instead of hiding everything behind a toggle. No new nav item. `npx tsc`/`eslint`/production build all verified clean. |
| T-147 | ✓ **Done** (added and shipped July 7, 2026, founder-reported gap after testing T-141). A typed note in Trades' NotesPanel did persist, but the trade *analysis itself* (give/receive players + verdict/reasoning from `app/api/trades/analyze/route.ts`) was pure component state and vanished on navigation. Added a "Save this trade" button to `AnalysisCard` that POSTs an ordinary `type: 'general'` note (reuses T-141's existing route/schema, no second one) auto-generated from the real trade — `Give: <names> → Receive: <names>. Verdict: <label>. <the real rosValueComparison sentence>` — tagged to whichever league is selected in T-143's league picker (same dropdown, reused rather than adding a second one just for this). Button disables and reads "Saved ✓" after a successful save so it can't double-write; re-running the analysis resets it. `npx tsc`/`eslint`/production build all verified clean. |
| T-148 | Trade Analyzer / future Ask Copilot trade-finder needs full league context, not just ADP (added July 7, 2026, founder request: "the trade analyzer aka copilot needs to look at ALL league context. scoring, scoring type, if the league allows future pick trades etc." — "ADP doesnt matter after week 2-3 when the real pecking order is shown to the world."). Confirmed by direct code check: `app/api/trades/analyze/route.ts`'s `adpValue()` is 100% ADP-based today, no fantasy-points-scored data or rest-of-season projection exists anywhere in this codebase (`lib/sleeper.ts` has zero stats/points references); neither the Trade Analyzer nor T-142's planned trade-finder use the league's actual `ScoringSettings` (PPR/standard/TE premium/superflex — the type already exists in `types/index.ts` and is normalized via `normalizeSleeperLeague`/`normalizeYahooLeague`, just never passed into trade valuation); and whether a league allows future draft-pick trades (dynasty/keeper) isn't tracked or checked anywhere. Split into sub-scope: (1) ✓ **Done, migration pending** (shipped July 7, 2026) — real in-season points ingestion + blending formula shifting weight from ADP toward real points as weeks accumulate. New `lib/seasonPoints.ts`: a daily cron (`app/api/cron/season-points/route.ts`, `vercel.json`) re-sums every completed week's real box score (`getSleeperWeekStats` — turned out to already exist, from T-111's live stat sheet, just never used for a season total) via `computeStatlinePoints` against a standard, disclosed 1-PPR baseline (`STANDARD_SCORING`, not any specific league's real scoring — that's sub-scope 2, deliberately kept separate) into a new `player_season_points` table (`migration_season_points.sql`), recomputed from scratch each run rather than incremented, so a corrected Sleeper stat line for an earlier week actually takes effect. `blendValue()` mixes `adpValue` with a disclosed `pointsValue` transform (points-per-game × 10, landing on roughly the same 0–260 scale as ADP), weighted by `pointsWeight()` (0.15/week completed, capped at 0.75) — a player with no season-points row yet (bye/IR all season, migration not run) falls back to pure ADP, never blocking a trade analysis. `app/api/trades/analyze/route.ts` now values every player through this blend instead of raw `adpValue`, and `generateTradeReasoning` explains the real-points half of the blend when a player has one. `npx tsc`/`eslint`/production build all verified clean; no live click-through yet (same reason as T-141 onward — no test account — plus the season-points table itself needs real completed weeks of data to differ from pure-ADP output, unverifiable from a preseason dev environment). (2) wiring real `ScoringSettings` + future-pick-trade eligibility into the Trade Analyzer's value model — has open design decisions the founder hasn't weighed in on yet (how PPR/TE-premium should shift player value, whether to block/flag future-pick trades in non-dynasty leagues vs. just informing). Not started. (3) lower-priority follow-up, dependent on (2) landing first: roster-wide "who else has this type of player"/trade-frequency search, needing either Rostiro-tracked trade history (none exists) or per-platform transaction-log pulls. Not started. |
| T-149 | ✓ **Done** (added and shipped July 7, 2026, founder gating audit). Direct code check against Section 9's pricing table found three real depth-gates promised but never implemented — every plan was silently getting the same experience: (1) **Draft Copilot** ("Limited" Free vs "Full... pre-fetched reasoning" Pro) — `app/api/draft/session/[id]/recommend/route.ts` is deliberately unauthenticated for the no-signup Draft Kit (T-76), but a real in-app draft session calls this same route with a live cookie session; added a best-effort auth check so an authenticated Free-plan caller gets the real deterministic candidate order with a plain ADP/need-based fallback line instead of Claude's pre-fetched reasoning (an anonymous Draft Kit caller is unaffected — no session, no gate, matches its top-of-funnel trial purpose). (2) **Film Room full recap** — `app/api/film-room/route.ts` had zero plan check; the real score/won-loss/usage signal are deterministic and stay free, but the Claude-narrated recap paragraph is now skipped for Free (new `recapGated` flag on the response, surfaced in `app/(dashboard)/pulse/page.tsx` as an "Unlock the full recap with Pro" line, same nudge pattern as the existing live-scores gate). (3) **Waiver Day full detail** — `lib/pulse.ts`'s waiver_alert deepening (real FAAB-remaining, League Health delta projection, T-98/T-108) had zero plan check either; `buildPulseItemsForUser` now resolves the caller's plan once (`isFreePlan`) and threads it into `buildLeagueItems`, which drops the FAAB/health sentences for Free and appends an "Unlock FAAB and League Health impact with Pro" nudge instead — the base alert (player name, ADP, unrostered) stays free. Flagged but explicitly not fixed this pass: `users.trial_ends_at` is written at signup and referenced in onboarding/signup copy ("7-day Starter trial begins automatically") but is never read by any gating check (`isFreePlan`, `canConnectNewLeague`, `pushToUser` all read `users.plan` directly, which defaults to `'free'` immediately) — every new signup is currently promised a trial they don't receive. Founder chose to prioritize the three depth-gates above in this pass; the trial gap remains open. `npx tsc`/`eslint`/production build all verified clean. |
| T-150 | ✓ **Done, migration pending** (added and shipped July 7, 2026, founder decision — replaces the trial gap flagged in T-149). Founder identified a real business-timing problem with the signup-anchored 7-day trial: signing up in July burns the entire trial during the dead offseason (no live games, no waivers, no real trade urgency), leaving nothing to convert that user once real value exists in September — actively working against getting users in the door early, including for Founding 500 sales. Full options assessment done in-conversation (no trial / global free week / silent-until-kickoff announcement); founder chose a global, season-anchored promo window over the old per-signup timer, specifically because it survives a shifting launch date without leaving stale per-user state behind (the founder's stated recurring pain point — "issues with this in the past as things get more built and launch plans change"). New `promo_windows` singleton table (`migration_promo_window.sql`, not yet run) holds one admin-adjustable `starts_at`/`ends_at` pair. `lib/usageLimits.ts`'s `isFreePlan` — already the one function every plan gate in the app calls — now checks this window first: every nominally-free user is unlocked while `now()` falls inside it, regardless of signup date. A personal fallback trial (the existing `trial_ends_at` column, previously written at signup but never actually read by anything — the exact gap T-149 flagged) is now honored, but *only* for a user whose `created_at` is after the promo window already ended — a late arrival who missed the global week gets their own 7-day taste; anyone who signed up before/during the window relies on the window itself, never stacking a personal trial on top of it (the mechanism that actually prevents the July-signup problem from recurring). If no promo window is configured at all (local/dev, or before the founder sets one), it falls back to the classic per-signup trial rather than gating everyone immediately. `canConnectNewLeague` (league cap), `pushToUser` (`lib/engagementTriggers.ts`, Pro-only push), and `scoresGated` (`app/api/system/status/route.ts`) were all refactored off their own independent inline `plan === 'free'` checks onto this same `isFreePlan`, so the window/trial logic applies everywhere at once instead of needing four separate fixes. Founder-adjustable via a new "Promo Window" section in `components/admin/SimulationPanel.tsx` (new `set_promo_window`/`clear_promo_window` actions on `/api/admin/simulate`) — deliberately backed by its own table rather than `sim_state`, so the Dev Simulation Suite's "Clear simulation" button can never accidentally wipe a real, live production setting. Removed the now-inaccurate "7-day Starter trial begins automatically" / "Free for 7 days" copy from `app/(auth)/signup/page.tsx` and `components/onboarding/ModeSelection.tsx`, replaced with season-anchored wording that doesn't overpromise a specific date. `npx tsc`/`eslint`/production build all verified clean. **Verified live, July 7, 2026**: founder ran the migration; a real free test account (created same day) rode the legacy per-signup trial with every gate unlocked until a promo window was configured, then immediately became properly gated the moment any window existed (confirmed via the Trade Analyzer's 3/week quota — 3 real Claude-written analyses, then the exact deterministic fallback text on the 4th), the league cap (real "Connected 1 league — Free plan is limited to 1" message when trying to add 2 Sleeper leagues at once), Draft Copilot's depth-gate (real authenticated draft session showed the deterministic candidate list with the "Upgrade to Pro for Copilot's full pre-fetched reasoning" fallback line), and the admin errors page (blocked server-side for the non-commissioner account). Promo window set to the real 2026 Week 1 dates — see T-151. |
| T-151 | Week 1 upgrade-gate moment (added July 7, 2026, founder decision — deferred, tied to a hard external date, do not lose). T-150's promo window is set to unlock every Free user from **Monday, September 7, 2026** (the Monday before Week 1) through **Tuesday, September 15, 2026, 6:00 AM ET** (just after Week 1's Monday Night Football, Chiefs–Broncos, concludes) — real 2026 NFL schedule, Week 1 opens Wednesday Sept 9 (Seahawks–Patriots) and runs through Monday Sept 14. Founder's intent: every Free user gets the full pre-Week-1 anticipation window (waiver claims, roster prep) plus the entirety of Week 1's live Game Day experience, then **Tuesday morning, September 15**, every Free account should hit a single, deliberate "Upgrade now" moment — not just today's per-feature quiet reversion (blurred scores again, Draft Copilot's fallback text again, etc.), but one unified gate/paywall screen that recaps what they just experienced (live scores, Draft Copilot reasoning, Film Room recaps, Waiver Day detail, unlimited AI) and asks them to upgrade. **Not built yet** — today's T-150 mechanism correctly re-gates every individual feature the moment the window ends, but there is no unified "you just lost Pro depth, here's what you're missing, upgrade now" surface anywhere; that's this task's entire scope. Needs: (1) a way to detect "a promo window recently ended for this user" (e.g. compare `now()` against `promo_windows.ends_at` within some grace window) (2) actual gate/paywall UI design — full-screen interstitial vs. persistent banner vs. Pulse card is an open design decision (3) copy for the recap ("here's what you had access to"). **Do not silently drop this** — it has zero engineering lead time before its real trigger date (Sept 15, 2026), unlike most tasks in this file with no hard deadline. |
| T-125 | ✓ **Done** (added and shipped July 6, 2026). Third rebuild pass of the three Remotion `ProductVideoDemo` placeholders, this time built directly against a real `/pulse` screenshot the founder provided rather than a from-memory approximation. New shared components: `remotion/components/AppFrame.tsx` rebuilt with the exact SVG icon paths from `components/nav/Sidebar.tsx` (was generic placeholder squares) plus a real bottom ticker strip matching `components/nav/TickerBar.tsx`'s actual format; new `remotion/components/PulseHeader.tsx` matches the real greeting + bold decision/est-minutes line + TODAY progress bar from `app/(dashboard)/pulse/page.tsx` exactly (missed entirely in both prior passes); new `remotion/components/PulseCardMock.tsx` matches the real `PulseCard`'s anatomy (glowing priority stripe, tag badge, Open/Done/Snooze buttons) instead of an invented card style. All three compositions rewired to use these. Verified frame-by-frame via Remotion stills before the final render, not just trusted on faith. |
| T-152 | ✓ **Done, verified live** (added and shipped July 8, 2026). Branded email suite: 9 new transactional emails extending the T-135 Resend foundation — welcome (post-signup-confirmation), 3 purchase confirmations (Rostiro Pro, Founder Season Pass, Founding 500 — the last with a gold accent and a "★ FOUNDER" heading mark), subscription-canceled, Season Pass expiring-soon (one-shot guard, 6-8 days out) + expired, account-deletion confirmation, and founder-feedback (member confirmation + founder notification, the latter HTML-escaped since it carries user-typed text). New send functions in `lib/resend.ts`, `supabase/migration_email_suite.sql` (`season_pass_expiry_warned_at`), hooked into `app/api/auth/callback/route.ts`, `app/api/stripe/webhook/route.ts`, `app/api/cron/season-pass-expiry/route.ts`, `app/api/settings/delete-account/route.ts`, `app/api/founder/feedback/route.ts` — every send try/catch-wrapped so a Resend outage can never block the underlying action. Built via `superpowers:subagent-driven-development` (7 tasks, each independently reviewed), then verified live end-to-end: real signup, real Stripe test-mode checkouts across all 3 paid tiers, real cron triggers, a real account deletion, and a real feedback submission with an intentional `<b>test</b>` XSS-escaping check — all 9 emails confirmed delivered, correctly branded, correctly escaped. Two rendering bugs found and fixed live: `emailShell()`'s card content and logo image were never actually centered (only the top wordmark block was, since T-135); and the new "★ FOUNDER" mark initially caused an ugly line-wrap, reworked into its own label line above the heading. See T-153/T-154 for two foundational bugs this verification pass surfaced outside the email code itself. |
| T-153 | ✓ **Done, verified live** (found during T-152's live verification, fixed and shipped July 8, 2026). Signup confirmation and password-reset links have been silently broken since T-135: `admin.generateLink()` (used by both `app/api/auth/signup/route.ts` and `app/api/auth/forgot-password/route.ts` to route confirmation content through Resend) is a server-to-server admin call with no client `code_verifier`, so it can never produce a PKCE `code` — Supabase's hosted `action_link` could only redirect back with an implicit-flow token in the URL fragment, which `app/api/auth/callback/route.ts`'s `exchangeCodeForSession(code)` can never read. Every confirmation/reset link was landing on `/login?error=auth_callback_failed` instead of `/onboarding`/`/reset-password` — never caught because it had never been exercised with a real click-through until T-152 forced one. Fixed by emailing the app's own callback URL with `token_hash` + `type` instead of Supabase's `action_link`, and verifying via `supabase.auth.verifyOtp({ token_hash, type })` in the callback route. Verified live for both signup confirmation and password reset. |
| T-154 | ✓ **Done** (found during T-152's Task 7 verification, fixed and shipped July 8, 2026). `public.founder_feedback` (T-111) had row-level security enabled with zero policies attached — deny-all — and was never added to `grants.sql` either, so every real Founding 500 member's feedback submission has been failing with a silent permission-denied 500 since T-111 shipped. Every other table in this codebase follows an enable-RLS + policy + grant pattern; this was the one exception. Fixed live in the database and committed into `supabase/migration_founder_recognition.sql` (idempotent, safe to re-run) so the fix is in version control. |
| T-155 | ✓ **Done** (added and shipped July 8, 2026). Technical SEO + LLM crawlability: `app/sitemap.ts`/`app/robots.ts` (the 9 real public routes; robots.txt disallows every private app route and explicitly allows both AI training bots — GPTBot, CCBot, Google-Extended, ClaudeBot — and AI answer/citation bots — OAI-SearchBot, ChatGPT-User, PerplexityBot — per founder's explicit call to maximize pre-launch AI discoverability). Homepage given its own `metadata` export for the first time (previously inherited the generic root-layout copy on the single highest-value page); `metadataBase` + `alternates.canonical` added site-wide on the `https://www.rostiro.com` `www` form (T-85 already paid for the apex-308-redirect lesson). New code-generated OG/Twitter card image (`app/opengraph-image.tsx`, no screenshot, real brand tokens). New dedicated `/pricing` page — `PricingSection` extracted into `components/marketing/PricingSection.tsx`, one shared source rendered on both `/` and `/pricing`. Structured data (`lib/seoSchema.ts`): `SoftwareApplication` (`/pricing`, `/features`), `FAQPage` (`/faq`, all 13 items), `Organization` (site-wide) — real fields only, no fabricated ratings, no `sameAs` since those social handles are still unclaimed. New `app/llms.txt/route.ts`. Built via `superpowers:subagent-driven-development` (7 tasks, each independently reviewed, final whole-branch review clean). Explicitly out of scope: blog, Google Search Console verification, social `sameAs` links, comparison/"how it works" pages. |
| T-156 | ✓ **Done** (added and shipped July 8, 2026, pre-launch hardening pass). Closed three real billing/security gaps found auditing the auth and Stripe surfaces before launch. (1) **Account deletion now cancels the Stripe subscription first** (`app/api/settings/delete-account/route.ts`) — previously a Pro user could delete their account while their Stripe subscription kept billing with no account left to manage or cancel it from. (2) **Rate-limiting on the auth surface** — `signup` and `forgot-password` were throttle-less, and login called Supabase directly from the client with no server route at all; added a real `app/api/auth/login/route.ts` and rate limits across all three. (3) **`invoice.payment_failed` is now handled in the Stripe webhook** (`app/api/stripe/webhook/route.ts` + new `lib/resend.ts` send) — the subscriber is emailed about the card decline; the actual downgrade still happens through the existing `customer.subscription.deleted` handler once Stripe exhausts its retries, so nothing double-downgrades. `npx tsc`/`eslint`/production build clean. |
| T-157 | ✓ **Done** (added and shipped July 9, 2026 — first of the July 9–10 marketing-content build-out; fulfills part of the "state-simulation tool" founder brainstorm logged earlier this file). **DEMO_MODE foundation (Phase 0–1)** — a self-contained, in-memory demo of Rostiro under `app/demo/**` that runs the app across its OS states on **real NFL box-score data** wrapped in one fictional league, serving two audiences: a self-playing public product tour and a hidden **Director's Console** (virtual clock + play/scrub/jump/inject) for scripting pixel-perfect screen recordings. Zero production leak is enforced *structurally*, not by review: a scoped ESLint `no-restricted-imports` rule fails the build if anything under `app/demo/**` imports `lib/supabase`/`lib/sleeper`/`lib/espn`/`lib/yahoo` or any DB/live-API-coupled module; the demo path is in-memory only (no Supabase, no network, no workers). Pure calculation engines (`computeLeagueHealth`, `computeStatlinePoints`, a pure `winProb`, a pure timeline state machine) run for real against baked fixtures; transient execution layers (push, game-day alerts) are scripted-toast UI, not real workers. Phase 1 ships the route shell, the timeline engine, the Director's Console, and the **Standard** state fully working, rendered in the real Rostiro OS chrome + Pulse decision feed; the Draft / Game Day / Waiver Day / Film Room engines were deliberately scoped as follow-on specs that plug into this foundation. Vitest added to the repo for the pure-engine tests (`chore: add Vitest`). **Honesty note / open item:** the baked fixtures are currently anchored on **real 2024 (anchor week 8)** data as a stand-in — the 2025 swap is a pending follow-up. |
| T-158 | ✓ **Done** (added and shipped July 9, 2026). **Choreographed feature-page live demos** — replaced the three Remotion-placeholder videos on `/features` (and retired the shipped `.mp4`s) with three looping, self-playing **live** demos that run the real demo-mode UI on a shared frame-based clock (`SceneStage` primitive: frame clock + visibility + reduced-motion static frame), so every frame is deterministic and screen-recordable: (1) multi-league connect → unified Pulse, (2) kickoff transition (Standard → Game Day sweep + `MISSION CONTROL` pill), (3) Interrupt Stack (touchdown card enters, auto-dismisses). Non-negotiable fidelity constraint: every pixel and behavior matches shipped code — scenes reuse the real demo components (`DemoShell`, `PulseFeed`, `PulseMark`, `ScriptedToast`) and real brand tokens/timings, with each scene's copy verified against the actual onboarding/pulse/interrupt source (exact `Step 2 of 6` header, the real three `PlatformCard` strings, `SWEEP_DURATION_MS = 1800`, `AUTO_DISMISS_MS = 7000`, etc. — explicitly *no* invented UX and no fake "N/3" counter). |
| T-159 | ✓ **Done** (added and shipped July 10, 2026). **Simulation Studio foundation (Phase 1)** — a gated Platform Sandbox at `/demo/studio` (gating identical to the Director's Console: dev-only or `?studio=true`, no new auth surface) that lets the operator author and fire simulated Rostiro OS "moments" — starting with the cross-league touchdown/interrupt card — for unlimited marketing screen-capture. **Hybrid authoring model:** real player search over `players.json`, real `winProb`/cross-league-impact math for prefill, then *full editorial override* of every metric row (rename a league to "Bench Regret FC", swap "Win Prob" → "Pain Index", hand-edit numbers, reorder/add/delete rows). Capture canvas (`DemoShell` + `PulseFeed` + fired card) is toggle-hideable and has a fixed 16:9 / 9:16 aspect option for landscape vs. TikTok/Reels. Architecturally it's an extensible `SimEvent` registry (`kind → { defaultEvent, AuthorForm, render }`) so future card types slot in additively. Key real-vs-simulated **honesty contract, stated in the spec because the output is marketing:** the card is rendered by a genuinely shared `InterruptCardView` **extracted from the shipped `components/InterruptStack.tsx`** (refactored to render it with zero live-app behavior/visual change, snapshot-guarded) using real player data — but the cross-league win-prob metric rows are authored/simulated here and were **not yet wired into the live Game Day pipeline** at this point (that gap is T-162). Ships with a 3-league fixture with overlapping founder rosters. |
| T-160 | ✓ **Done** (added and shipped July 10, 2026). **Simulation Studio multi-state expansion (Phase 2)** — generalized the Studio from a single game-day interrupt tool into a **state-aware marketing simulation platform**. Added a state selector (Standard / Waiver Day / Game Day / Film Room) and broadened `SimEvent` into a per-state **pack registry** (`app/demo/lib/studioPacks.tsx`): each `StatePack` exposes `defaultContent`/`prefill`/`AuthorForm` plus **both** a `FullSurface` (16:9 faithful state screen) and a `FocalCard` (9:16 punchy card), rendered by an aspect-aware pack-driven canvas (the existing game-day interrupt overlay preserved). Shipped two new packs — **Waiver Day (Mission Briefing surface + focal card + author form)** and **Film Room (weekly recap surface + focal card + author form)** — each with real-data prefill + total editorial override. Draft and roster-exposure packs are designed-for but deferred. Fixed a loss-consistent Film Room default recap + mid-tier buy-low signal on the way in. |
| T-161 | ✓ **Done** (added and shipped July 10, 2026). **LIVE second-screen companion simulation (Phase 1)** — a self-playing, capture-ready simulation of Rostiro's **LIVE second-screen companion tab**, added as a new "Live" state in the Simulation Studio. It replays real anchor-week-8 data as a compressed ~25s Sunday: the OS transforms (calm → kickoff sweep → LIVE opens), the founder's rostered players' points tick up from real box scores, TDs ring-flash, and matchup scores swing; loops, renders 16:9 and 9:16 for social. Driven by an **authorable `LiveScenario`** (`app/demo/lib/liveScenario.ts`) — prefilled from real 2024 week 8, then editable via a basic override form (custom names, final scores, captions) — over a pure `liveSimAt(t, scenario)` scoring engine (`app/demo/lib/liveSim.ts`), so the operator can compose custom-narrative clips. **Honesty:** every player identity + final week-8 points/stat line + opponents/league names are real; only the *intra-game timing* (how points accrue across the compressed clock, when each TD fires) is dramatized, because the box-score feed has no play-by-play. **Deliberate authoring boundary:** overrides set the *targets the animation ramps toward*; per-frame/keyframe hand-placement was explicitly kept out of Phase 1 to avoid building a mini video-editor. Two polish fixes on the way in (self-playing `LiveScene` in the studio; avoid an empty `img` src for missing headshots). |
| T-162 | 🚩 **PRIORITY — pre-Week-1 blocker. Do not miss.** ✓ **Code done, but migration NOT applied + NOT verified live** (added and shipped July 10, 2026). **Action needed before Sept 9, 2026 (Week 1):** apply `supabase/migration_interrupt_metrics.sql` to production Supabase, then confirm the win-prob rows fire on a real touchdown swing on a live Sunday. Until both are done this feature is dark for real users, and the Marketing System v2 "real cross-league win-prob on Sunday" content (which depends on this being live) must stay in the honest "shown in the Studio" framing, not "live in your app." **Project A — live cross-league win-probability on the real Interrupt card.** The Simulation Studio (T-159) *depicts* a touchdown card showing cross-league win-prob, but the shipped product didn't compute or show it — the marketing was ahead of the product. This closes that gap for real users: when a real touchdown swing fires on Game Day, the live Interrupt card shows the user's **current per-league win probability** (e.g. `Sunday Money — Win Prob 62%`), computed from real live matchup scores, **Pro-gated** consistent with live scores (Free users still get the card, just without the rows — no blur needed, the rows are simply absent). **Deliberate honesty decision:** production ships *current* win-prob, **not** a per-TD "+X%" delta — the live scoreboard feed is team-level only (`detectTouchdownSwings` cannot attribute the scoring player), so a truthful point-gain delta is unknowable; the Studio keeps its dramatized "+X%" framing for marketing, production ships the honest version. Implementation: pure `winProb` **graduated from the demo into `lib/winProb.ts`** (demo re-exports it — single source of truth); new `lib/liveWinProb.ts` adapter over `LiveMatchupSummary`; `InterruptMetricRow` moved to `types/index.ts` + `PulseItem.metrics` added; `detectTouchdownSwings` computes Pro-only metrics via `buildLiveRoster` (try/catch-wrapped — a failed matchup fetch just yields no rows, never blocks the card) and persists them to a new `metrics_json` column; read path threaded through `lib/pulse.ts` + `/api/pulse/interrupts` → `InterruptStack` → the shared `InterruptCardView metrics={...}` (the metrics branch already existed from T-159 — this was the last wire). **`supabase/migration_interrupt_metrics.sql` (`ALTER TABLE pulse_items ADD COLUMN metrics_json jsonb`) must be applied to Supabase as a deploy step.** Not yet verified live — a real touchdown swing needs live in-season games, unavailable in a preseason dev environment (same constraint as T-148). |

---

*Rostiro PRD v5.8 — July 2026*
*Run Every League. — rostiro.com*
