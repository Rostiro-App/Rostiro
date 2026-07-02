# ROSTIRO — Product Requirements Document v4.2
**Run Every League.**
The operating system for fantasy sports.
rostiro.com | July 2026 | Pass directly to Claude Code

---

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

| Platform | Priority |
|---|---|
| CBS Sports Commissioner | Phase 2 |
| NFL Fantasy | Phase 2 |
| Fantrax | Phase 2 |
| MyFantasyLeague (MFL) | Phase 2 |

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

---

## 7. Navigation Structure (v4 — new)

### Mobile (bottom nav, thumb-reachable)

```
┌─────────────────────────────────┐
│                                 │
│         [page content]          │
│                                 │
├─────────────────────────────────┤
│  Pulse  │ Leagues │ Draft │ ··· │
└─────────────────────────────────┘
```

### Desktop (left sidebar)

```
┌──────────┬──────────────────────┐
│ ROSTIRO  │                      │
│──────────│   [page content]     │
│ Pulse    │                      │
│ Leagues  │                      │
│ Draft    │                      │
│ Start/Sit│                      │
│ Trade    │                      │
│──────────│                      │
│ Settings │                      │
│ [Plan]   │                      │
└──────────┴──────────────────────┘
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

---

*Rostiro PRD v4.0 — July 2026*
*Run Every League. — rostiro.com*
