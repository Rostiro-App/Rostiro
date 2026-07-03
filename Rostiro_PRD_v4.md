# ROSTIRO — Product Requirements Document v4.5
**Run Every League.**
The operating system for fantasy sports.
rostiro.com | July 2026 | Pass directly to Claude Code

---

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

### Core Philosophy — Non-Negotiable

- **AI is infrastructure, not the headline.** Never market "AI." Market the outcome: fewer missed decisions, more wins.
- **Surface actions, not information.** Every feature must produce something the user can act on.
- **Cross-league before single-league.** Every intelligence call considers all connected leagues simultaneously.
- **Explainable by default.** Every recommendation shows 2-3 sentences of reasoning. No black-box scores.
- **Deep-link is a feature.** "Rostiro tells you exactly what to do and takes you there in one tap."
- **Mode is identity, not a setting.** Focused and Savant are not toggles — they are the user's declared relationship with the product. Set once at onboarding, changeable anytime.
- **Mobile is the primary surface.** Saturday night at 11pm when the push fires, users are on their phone. Design for that moment first.

> **COMPETITIVE VALIDATION:** ChatGPT deep research across 18 competitors confirms the PI (Pulse/inbox) column is empty across the entire market. No competitor has built a true cross-platform action center. This is the white space.

---

## 2. Product Architecture

| Layer | Purpose |
|---|---|
| Rostiro | The consumer brand and web product at rostiro.com |
| Rostiro OS | Core engine. Sync, normalization, intelligence, prioritization, orchestration. Users never see it — they feel it. |
| Rostiro Draft Kit | FREE preseason acquisition product. Standalone at rostiro.com/draft. No account required to start. Funnel into Rostiro Pro. |
| Rostiro Pulse | The daily command center and prioritized action inbox. The morning screen. The retention engine. |
| Rostiro Intelligence | Premium reasoning layer. Natural-language queries. "Why this move, why this league, why now." Savant mode. $5/mo add-on. |

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
Email + password or magic link.
Headline: "Your Rostiro OS is ready."
Sub-headline: "Create your account to save it."
Never say "Sign up." Never say "Register."
7-day full Starter trial begins automatically on confirm.

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

**Base URL:** `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/2026/segments/0/leagues/{LEAGUE_ID}`

**Authentication:** espn_s2 + SWID cookies. Stored AES-256 encrypted in Supabase. See onboarding guide in Section 4.

**Deep-link strategy:**
- Button text: "Set lineup on ESPN →", "Claim on ESPN →", "Propose trade on ESPN →". Never "Go to ESPN."

### 5.3 Yahoo

> **STATUS:** Official REST API with OAuth 2.0. Full read and write. Attribution required: "Fantasy data provided by Yahoo Fantasy."

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
| Yahoo | **In progress** | Official API already has `getYahooDraftResults()` (`/league/{leagueKey}/draft/results`) in `lib/yahoo.ts`, unused until now. Yahoo's own docs: "If called during the draft, it includes the players that have been drafted thus far" — confirmed live-capable, not just post-draft. Requires OAuth (already built) — unlike Sleeper, this is **not** a no-account path; user must have already connected a Yahoo league. |
| ESPN | **Re-open for testing** | v3 PRD flagged an unofficial `?view=mDraftDetail` endpoint — ESPN's own React draft room calls it internally — as untested-but-promising for **read-only** live tracking. This got dropped when v4 reframed ESPN as write-incapable (that part is still correct — no official write API — but read-only tracking was never actually ruled out, just never verified). Needs a 10-minute mock-draft test: poll it every 10s during an active ESPN mock draft, confirm the picks array grows. |
| MyFantasyLeague (MFL) | **Recommended next after Yahoo** | See 5.5 — no OAuth, confirmed live-capable including auction state. |
| Fantrax | **Candidate** | See 5.5 — no-auth endpoints, documented as live-capable. |
| CBS Sports / NFL Fantasy | **Ruled out** | See 5.5 — no viable API surface for either. |

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

Recommendations across all leagues simultaneously. Free: 3/week. Starter+: unlimited.

### 6.5 Trade Analyzer

Win / Lose / Roughly Even verdict + reasoning. Free: 3/week. Starter+: unlimited.

### 6.6 Web Push Notifications

**Primary channel.** Saturday night at 11pm injury report push is the core retention mechanic.

Provider: OneSignal. Permission prompt fires after first league connected — highest-intent moment.

### 6.7 Rostiro OS Shell (v4.4 — new)

> **THE PROBLEM:** The built UI is a set of well-made but disconnected pages — the user navigates to a tool and operates it. That's a program. An OS holds ambient state about all leagues, interrupts only with decisions, and brings actions to the user. Three absences cause the "program" feel: no ambient state visible anywhere, no cross-cutting surface that follows the user between screens, and actions that live inside tools instead of on the intelligence that surfaced them.

Approved from an interactive mockup (July 2026). Five workstreams, sequenced so each ships independently:

**W1 — System Bar (T-67).** Persistent chrome on every authenticated screen. Contains: live sync status ("Synced 12s ago", ticking), per-league health dots with hover tooltips, next-hard-deadline countdown (nearest waiver cutoff / lineup lock across all leagues, ticking), mode chip, ⌘K affordance. Mobile variant condenses to dots + countdown. Backed by one `/api/system/status` endpoint (last sync, health scores, next deadline), polled on an interval. This is the single biggest "OS not program" change.

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

**E3 — Features page (T-74).** Marketing page telling the OS story: what Rostiro does (ambient monitoring, the decision queue, Draft Copilot, Health Score, modes) and how it's different (deterministic numbers, Claude only explains; actions come to you; one system for every league). Embeds the *real living components* — an actual ticking ticker, a live demo Pulse card — never screenshots.
*Open decision (default: build after the incoming marketing designs land, in one pass with the rest of the marketing surface).*

### 6.9 Product Foundations (v4.5 — new)

Genuine build targets with acceptance criteria — not launch-week afterthoughts.

**F1 — Accessibility (T-75).** Acceptance criteria: WCAG AA contrast on all text (known issue: `--t3` dim text at small sizes needs an audit pass), visible focus states on every interactive element, full keyboard operability (palette ✓, drawer focus-trap needed, cards ✓), `prefers-reduced-motion` honored everywhere (✓), ticker marked `aria-hidden` with a static screen-reader alternative, `aria-live` regions for value updates kept polite/off where noisy, semantic landmarks per screen. Audit + fix pass, then a11y checks added to the pre-launch checklist.

**F2 — Security hardening (T-76).** Pre-launch pass: security headers in `next.config` (CSP, HSTS, X-Frame-Options, Referrer-Policy), rate limiting on API routes (especially Claude-backed ones), dependency audit, full `/security-review` run with findings triaged. Already in place and staying: RLS on every table, Zod on every body, encrypted OAuth tokens, CRON_SECRET on crons, service-role keys server-only.

**F3 — Daylight theme (T-77).** Light mode as designed work, not inversion — the glow-and-glass identity needs light equivalents (white translucency + soft tinted shadows instead of glows). Structurally cheap: every color is already a CSS custom property, so the theme is a `:root` swap behind a toggle in Settings + system-preference detection (`prefers-color-scheme`), persisted alongside mode on `users`.
*Open decision (default: post-launch fast-follow — launch is dark-first, it's the brand identity).*

**F4 — Privacy policy + data controls (T-78).** Quietly launch-critical: Yahoo OAuth app review requires a public privacy-policy URL; Stripe expects one. Public `/privacy` page (drafted for review, plain language) covering: what's collected, platform credentials handling (encrypted, never logged), AI processing disclosure (league data sent to Claude for explanations), retention, contact. Backed by real controls in Settings: export my data (JSON), delete my account (cascade — schema already cascades on `users.id`), disconnect leagues (✓ built). Analytics opt-out lands here if/when analytics are added.

---

## 7. Navigation Structure (v4 — new)

> **v4.4:** the OS Shell system bar (6.7 W1) sits above everything on both breakpoints — sync status, health dots, deadline countdown, mode chip, ⌘K. Leagues added to both navs (it was specified here in v4 but never present in the built nav).

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

## 8. Monetization

(Unchanged from v3)

| Plan | Price | Includes |
|---|---|---|
| Free / Scout | $0 | 1 league. Draft Kit. Basic Pulse. 3 start-sit/week. 3 trade/week. 7-day trial. |
| Starter | $8/mo or $69/yr | 3 leagues. Full Pulse. Unlimited AI. Push notifications. Yahoo write-back. |
| Pro | $15/mo or $119/yr | 10 leagues. Cross-league intelligence. Proactive trades. What-if sims. |
| Commissioner | $19/mo or $149/yr | Unlimited leagues. Co-manager seats. Custom digest. |
| Intelligence add-on | +$5/mo | Savant mode full layer. Deep explanations. Portfolio risk scoring. |

---

## 9. Technical Architecture

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

See v3 Section 7–11. All unchanged except season defaults updated to 2026.

---

## 10. Build Phases

### Completed (as of July 2026)

| Task | Status |
|---|---|
| T-01 through T-13 | Complete |
| Supabase schema live | ✓ |
| Sleeper live data verified | ✓ |
| Auth (login/signup) live on Vercel | ✓ |
| Onboarding flow built | ✓ |

### Remaining build order

Week 3: Dashboard + AI layer (T-14–T-23)
Week 4-5: Draft Kit (T-24–T-37)
Week 6: Pulse + Pulse empty state + League Health Score (T-38–T-46)
Week 7: Mobile audit + landing page + launch (T-47–T-50)

**GO / NO-GO GATE:** Yahoo OAuth returning live roster data AND ESPN cookie auth returning league data. Both must pass before dashboard UI is finalized.

---

## 11. Out of Scope for MVP

(Unchanged from v3 — native app, CBS/NFL/Fantrax, DFS, dynasty features, basketball/baseball/hockey, historical analytics, commissioner tools, in-app messaging)

---

## 12. Updated Task List

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
| T-72 | Boot sequence + coach marks — first-login boot moment (skippable, never repeats), `<Hint>` registry component, `seen_hints` persistence, contextual first-use hints, replay from Settings/palette. |
| T-73 | Ticker seasonal sources — injury-status snapshots start immediately (backfill-proofing); in-season: per-league top waiver claims (Sleeper transactions) + injury designation changes; game day: live scores (gating decision pending). Response shape stays fixed. |
| T-74 | Features page — the OS story with live embedded components (real ticker, demo Pulse card), no screenshots. Timing: with the marketing-designs pass (default). |
| T-75 | Accessibility baseline — WCAG AA contrast audit (`--t3` flagged), drawer focus-trap, ticker screen-reader alternative, keyboard operability pass, a11y in pre-launch checklist. |
| T-76 | Security hardening — security headers, API rate limiting, dependency audit, full /security-review with triage. |
| T-77 | Daylight theme — designed light mode behind a Settings toggle + `prefers-color-scheme`, persisted on `users`. Default timing: post-launch fast-follow. |
| T-78 | Privacy policy + data controls — public `/privacy` page (Yahoo OAuth review prerequisite), data export, account deletion (cascade), AI-processing disclosure. |

---

*Rostiro PRD v4.5 — July 2026*
*Run Every League. — rostiro.com*
