# ROSTIRO — Product Requirements Document v4.0
**Run Every League.**
The operating system for fantasy sports.
rostiro.com | July 2026 | Pass directly to Claude Code

---

## Changelog from v3 → v4

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

Rostiro should feel like Raycast, Linear, or Vercel — not ESPN or Yahoo. The design language is:
- **Near-black backgrounds** (`zinc-950` / `#09090b`) — not pure black, not dark gray
- **Subtle borders** (`zinc-800`) — structure without weight
- **White as the action color** — primary CTAs are white on dark, not colored buttons
- **One accent color maximum** — used sparingly for critical priority items only (e.g. `red-400` for CRITICAL pulse items)
- **No gradients on content** — gradients only on hero/marketing surfaces
- **Typography: Geist** — already in the stack, feels native to the product category

### Information Density as Identity

The product serves two distinct users. These are not modes — they are personalities:

| Persona | Descriptor | What they want |
|---|---|---|
| **Focused** | "I have 2-3 leagues, I want to be done in 3 minutes" | 5 cards, clear verdicts, one tap to act |
| **Savant** | "I have 4+ leagues, I want every data point" | Full portfolio view, exposure bars, Vegas lines, weather overlays |

The density choice is made at onboarding and persists. It is always changeable from the profile menu. It is never a tab or toggle mid-session — it changes the entire interface density.

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

### Step-by-Step Onboarding Flow

```
STEP 1 — LANDING
"Run Every League."
One hero. One CTA: "Get started free — no card required"
Secondary CTA: "Try Draft Kit free →" (no account needed)

STEP 2 — SIGNUP
Email + password. No oauth friction here.
Sub-headline: "7 days of Starter free. Cancel anytime."

STEP 3 — MODE SELECTION (new in v4)
"How do you run your leagues?"

  ┌─────────────────────┐  ┌─────────────────────┐
  │    FOCUSED          │  │    SAVANT           │
  │                     │  │                     │
  │  2-3 leagues        │  │  4+ leagues         │
  │  Quick decisions    │  │  Full data          │
  │  Done in 3 min      │  │  Every edge         │
  │                     │  │                     │
  │  "Just tell me      │  │  "Show me           │
  │   what to do"       │  │   everything"       │
  └─────────────────────┘  └─────────────────────┘

  "You can change this anytime in settings."

STEP 4 — CONNECT FIRST LEAGUE
"Connect your first league to see your Pulse."

  [Sleeper — No login needed]     ← lead with this
  [Yahoo — Connect with Yahoo]
  [ESPN — Unlock ESPN]            ← "unlock" framing, not peer

  Sleeper is the default-open option. Username field visible immediately.
  Yahoo and ESPN are collapsed accordions.

STEP 5 — FIRST VALUE MOMENT
Immediately after first league connected:
  Show a league health card with the league name
  Show 1-2 sample Pulse items (clearly marked "preview")
  Show: "Connect more leagues to see cross-league intelligence"

STEP 6 — CONNECT MORE (optional, skippable)
"Your Pulse gets smarter with every league."
Progress indicator: "1 of your leagues connected"
[Connect Yahoo] [Connect ESPN] [Skip — go to my dashboard]

STEP 7 — DASHBOARD
First real session begins.
```

### ESPN Onboarding — "Unlock ESPN" (v4 — Repositioned)

ESPN is not presented as equal to Sleeper or Yahoo on the onboarding screen. It is framed as an unlock:

- Label: **"Unlock ESPN"** — not "Connect ESPN"
- Position: Third, collapsed by default
- Trigger: User clicks to expand, then sees the 4-step cookie guide
- If user skips: Dashboard shows an "Unlock ESPN" card with a subtle prompt, never blocking
- Copy: "ESPN doesn't have an official API — we use your browser cookies. Takes 2 minutes. Read-only."

This framing reduces perceived risk and sets expectations. Users who complete it feel like they've done something special, not jumped through a hoop.

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
