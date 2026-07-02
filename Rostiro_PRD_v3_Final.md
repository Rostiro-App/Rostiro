# ROSTIRO — Product Requirements Document v3.0 Final

**Run Every League.**
The operating system for fantasy sports.
rostiro.com | July 2025 | Pass directly to Claude Code

---

## 1. Vision, Positioning & Core Philosophy

Rostiro is not a fantasy football assistant. It is not an AI chatbot with rankings. It is the **operating system for fantasy sports** — confirmed by competitive research showing the Pulse/inbox column (PI) is empty across every major competitor in the market.

Fantasy managers playing in 3-5 leagues across ESPN, Yahoo, and Sleeper are switching between apps constantly — checking injuries, setting lineups, processing waivers, analyzing trades — in 3 different UIs with 3 different notification systems and zero shared intelligence. Rostiro ends that.

| Field | Value |
|---|---|
| Product name | Rostiro |
| Domain | rostiro.com (purchase immediately) |
| Tagline | Run Every League. |
| Category | The Operating System for Fantasy Sports |
| Target user | Fantasy managers in 2+ leagues across ESPN, Yahoo, and/or Sleeper |
| Target persona | The savant who manages 3-5 leagues and feels the platform-switching pain daily |
| Launch target | August 1–10, 2025 — before first major fantasy drafts |
| Platform | Web app, mobile-responsive. No native app for MVP. |
| Stack | Next.js 14 · TypeScript · Supabase · Tailwind CSS · Claude API (claude-sonnet-4-6) · Stripe · Resend · OneSignal |
| GitHub | Telff |
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
- **Deep-link is a feature.** "Rostiro tells you exactly what to do and takes you there in one tap" — never "we can't submit lineups for you."
- **Two modes, one product.** Focused (5 decisions, done) for casual managers. Savant (full portfolio intelligence) for data managers. One toggle.

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

## 3. Platform Integration Architecture

> **READ FIRST:** The integration approach for each platform drives the entire product architecture. Read this section before writing any data-fetching code. Build each client in its own file: `/lib/espn.ts`, `/lib/yahoo.ts`, `/lib/sleeper.ts`.

### 3.1 Read / Write / Deep-Link Framework

| Platform | Access level | Notes |
|---|---|---|
| ESPN | Read only | Unofficial v3 endpoints + espn_s2/SWID cookie auth. No write API. Deep-link to all action pages. |
| Yahoo | Read + Write | Official REST API, OAuth 2.0. Full read + write: lineup submission, waiver claims, trade proposals. Lead all write features here. |
| Sleeper | Read only | Public REST API, no auth. Username lookup. Full read. No official write. Deep-link for actions. |

### 3.2 ESPN

> **STATUS:** No official API. Unofficial v3 endpoints. ESPN tightened access Aug 1, 2025 — espn_s2 cookie now required for all private leagues. Build behind a typed service layer with graceful degradation.

**Authentication:** Two cookies from user's browser DevTools. Build an animated step-by-step onboarding guide — this is the highest-friction moment in ESPN setup.

- `espn_s2` — Application > Cookies > espn.com in Chrome DevTools
- `SWID` — Same location. Store both AES-256 encrypted in Supabase.

**Base URL:** `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/2025/segments/0/leagues/{LEAGUE_ID}`

**Data available:**
- League settings, scoring rules, roster slot configuration
- All team rosters with player IDs and positions
- Weekly matchup scores, live projections, opponent roster
- Player projections and ownership percentages
- Waiver wire with position filtering
- Draft results via `?view=mDraftDetail` (test during live mock draft before shipping)

**ESPN live draft — the mDraftDetail opportunity:**
UNTESTED DURING LIVE DRAFTS. Must be verified during a mock draft before Draft Kit ships. If mDraftDetail populates the picks array during an active draft (likely — ESPN's own React draft room calls this endpoint internally), live ESPN draft sync is fully automatic with no extension required.

> **ACTION REQUIRED:** Run a mock ESPN draft this week. While active, poll `?view=mDraftDetail` every 10 seconds. If picks array grows with each selection, ESPN live draft sync is solved. If it does not work, fall back to manual pick entry.

**ESPN draft fallback options:**
- **Option A (MVP fallback):** Manual pick entry. User runs ESPN draft in one tab, Rostiro in another. Fast tap-to-pick UI — one tap per pick, large targets, auto-advance focus.
- **Option B (post-MVP):** JavaScript bookmarklet reads ESPN draft room React component state. Posts picks to Rostiro via webhook. No Chrome extension needed.

**Deep-link strategy:**
- Lineup: `https://fantasy.espn.com/football/team?leagueId={ID}&teamId={TEAM_ID}`
- Waivers: `https://fantasy.espn.com/football/players/add?leagueId={ID}`
- Trade: `https://fantasy.espn.com/football/trade?leagueId={ID}`

Button text: "Set lineup on ESPN ->", "Claim on ESPN ->", "Propose trade on ESPN ->". Never "Go to ESPN."

### 3.3 Yahoo

> **STATUS:** Official REST API with OAuth 2.0. Full read and write. The cleanest integration. Lead all write-back features with Yahoo. Attribution required: "Fantasy data provided by Yahoo Fantasy" on any screen using their data.

**Authentication:** Standard OAuth 2.0. User clicks "Connect Yahoo", grants permission, Rostiro receives access + refresh tokens stored encrypted. Auto-refresh on expiry before every API call.

- Required scope: `fspt-r` (read) + `fspt-w` (write)
- Redirect URI: `https://rostiro.com/api/auth/yahoo/callback`

**Write operations available (Phase 1):**
- Submit lineup changes — start/bench decisions pushed from Rostiro directly
- Add/drop players — waiver claims submitted from Rostiro
- Propose trades — trade offers generated and sent from Rostiro

**Live draft polling:**
- Endpoint: `GET /fantasy/v2/league/{league_key}/draft/results`
- Poll every 10 seconds during active draft. Returns all picks made. Diff for new picks. Fully automatic.

### 3.4 Sleeper

> **STATUS:** Public REST API. No auth required. Username lookup only. Best live draft sync of any platform. Use Sleeper as the primary demo platform in all marketing materials.

**Authentication:** None. User provides Sleeper username. Rostiro fetches everything automatically.

**Live draft endpoint:** `GET https://api.sleeper.app/v1/draft/{draft_id}/picks`

Poll every 10 seconds. Returns all live picks. Zero friction. Works on mobile. Rate limit: stay under 1,000 calls/minute — 10-second polling = 6 calls/minute, well within limit.

### 3.5 Phase 2 Platform Connectors

| Platform | Priority |
|---|---|
| CBS Sports Commissioner | Phase 2 — high-customization leagues |
| NFL Fantasy | Phase 2 — large free platform, Fantasy+ premium layer |
| Fantrax | Phase 2 — dynasty/keeper/custom leagues |
| MyFantasyLeague (MFL) | Phase 2 — serious dynasty leagues |
| Fleaflicker | Phase 3 |
| FFPC / NFFC | Phase 3 — high-stakes |

---

## 4. Feature Specifications

### 4.1 Rostiro Pulse — Daily Command Center

> **RETENTION ENGINE:** Pulse is the product. Without Pulse being genuinely useful weekly, users cancel in October. Build Pulse after the data layer is solid — do not build Pulse until league sync is reliable.

**Pulse inbox item types:**

| Item type | Description |
|---|---|
| Lineup decision | Critical/Important/FYI. Affected leagues shown. Reasoning. One-tap deep-link per platform. |
| Injury alert | Starter injured or questionable. Replacement recommendation. Decision deadline shown. |
| Weather alert | Wind > 20mph or precip > 60% at outdoor stadiums. Affected players flagged with data. |
| Waiver alert | High-value add available. FAAB budget shown. Urgency deadline. Roster gap context. |
| Trade opportunity | Proactive suggestion — trades that improve 2+ leagues simultaneously. |
| Opponent intel | Notable opponent roster moves, streaming decisions, bye-week vulnerabilities. |
| Deadline reminder | Waiver cutoff, trade deadline, playoff roster lock. Time-prominent display. |
| Exposure flag | High player concentration — "You own Lamar Jackson in all 3 leagues. Weather alert affects all of them." |

**Pulse generation flow:**
1. Triggered on login, on demand, and on schedule (cron — Sunday 6am, Saturday post-injury-report ~11pm)
2. Fetch fresh roster data from all connected leagues (cache if < 1 hour old)
3. Fetch current injury report (ESPN public API or nflverse)
4. Fetch weather forecasts for all games involving user's players (Open-Meteo free API)
5. Fetch top available waiver targets per league
6. Assemble full context JSON — rosters, injuries, weather, waivers, scoring settings, opponent rosters
7. Single Claude API call → returns prioritized PulseItem array as JSON
8. Store in `pulse_items` table, serve to client

**Claude system prompt for Pulse must emphasize:** be decisive not hedging, surface actions not information, prioritize by impact not category, identify cross-league patterns a manager would miss, each item = one clear action.

**View modes:**
- **Focused mode (default):** 5 prioritized decisions, one at a time. Est. completion shown. Built for the manager who wants to be done in 2 minutes.
- **Savant mode (one toggle):** Full portfolio intelligence layer. All rosters, cross-league exposure bars, weather overlays, matchup difficulty, Vegas totals. Same data, full density.

### 4.2 Rostiro Draft Kit — Free Acquisition Product

> **ACQUISITION FUNNEL:** Free. No account required to start. Account required to save draft and access post-draft grade. Funnel: free Draft Kit → create account → see Pulse preview → upgrade to Pro before Week 1.

**User flow:**
1. User lands on `rostiro.com/draft` — no login required
2. Enters platform (ESPN/Yahoo/Sleeper), league ID, scoring settings
3. Yahoo and Sleeper: settings auto-fetched after optional connect
4. Draft board loads with Rostiro consensus rankings by position tier
5. User enters draft position and team count
6. Draft starts: Sleeper + Yahoo auto-sync every 10 seconds. ESPN: mDraftDetail auto-sync if verified, otherwise manual entry.
7. After each pick: top 3 AI recommendations with reasoning (streaming)
8. ADP value alerts fire automatically: steal (>+6 ADP delta), reach (<-8 ADP delta)
9. Draft ends: post-draft grade card generated (A-F)
10. Gate: "Save your draft and see your Week 1 lineup — create a free Rostiro account"
11. Account created → 7-day full Starter trial begins → Pulse preview with 1 league → upgrade prompt

**Draft Kit AI recommendation engine — Claude call context:**
- All picks made (player, position, team, round, pick number)
- User's current roster
- User's next 2 pick slots (snake-draft aware)
- Top 60 available players with consensus ADP
- League scoring settings (PPR weight, TE premium, superflex, roster slots)
- Positional scarcity count — how many top-N players remain at each position
- Injury flags on all available players

Response format: `{ recommendations: [{player, position, reasoning, confidence, adp_delta}], alerts: [{type, message}] }`

Stream the response. Target under 3 seconds. Partial text is better than waiting.

**Post-draft grade card:**
- Overall grade A-F with one verdict sentence
- Positional grades: QB / RB / WR / TE / K / DEF
- Best value pick (biggest positive ADP delta)
- Biggest reach (worst negative ADP delta)
- Projected Week 1 optimal lineup
- Shareable PNG download and shareable URL
- Share copy: "Just finished my draft. Rostiro graded my team [GRADE]. Try it free: rostiro.com/draft"

### 4.3 Unified League Dashboard

- One card per connected league: platform badge, record, matchup projected scores, top injury flag
- Global alert bar: time-sensitive cross-league items
- Expand any card: full roster, matchup detail, top 3 waiver targets, AI start/sit for that league
- League standings at a glance
- Upcoming bye weeks flagged on each player
- Cross-league exposure section: every player owned with % of leagues and concentration risk color-coding

### 4.4 Start/Sit Engine

- Recommendations across all leagues simultaneously on one screen
- Each: Player A vs Player B, verdict, confidence, 2-sentence reasoning
- Context: matchup difficulty, injury status, weather, Vegas totals, target share, usage trends, league scoring
- Cross-league exposure flag: "You own Tyreek Hill in 3 leagues — benching him in League 2 only"
- Free: 3 queries/week. Starter+: unlimited.

### 4.5 Trade Analyzer

- Input: paste trade offer or select players from connected roster
- Output: Win / Lose / Roughly Even verdict + 3-5 sentence reasoning
- Context: ROS value comparison, roster construction impact, league scoring, dynasty vs. redraft mode
- Proactive mode (Pro+): Rostiro surfaces trades that would improve roster — shown in Pulse
- Free: 3/week. Starter+: unlimited.

### 4.6 Web Push Notifications — Primary Alert Channel

> **PRIMARY CHANNEL:** Saturday night at 11pm — injury report drops — Rostiro fires a push notification to every user. This is what makes people pay $8/month and tell their league about it.

Web push works without a native app. Browser Push API works on Chrome desktop/Android (immediate), Firefox, Edge, and Safari iOS 16.4+ (requires Add to Home Screen).

**Provider:** OneSignal (free tier — unlimited notifications, unlimited subscribers)

**Implementation:** Service worker registered on first visit. Permission prompt shown after user connects first league (highest-intent moment). OneSignal SDK handles delivery.

**Notification templates:**

| Type | Copy |
|---|---|
| Injury critical | Rostiro: [Player] is OUT. Affects [N] leagues. Tap to see moves. |
| Weather alert | Rostiro: 30mph winds in Buffalo. Bench [Player] in [N] leagues. |
| Waiver deadline | Rostiro: Waiver cutoff in 2 hours. You have [N] pending decisions. |
| Trade pending | Rostiro: Trade offer waiting in [League]. Lean: [Accept/Decline]. |
| Sunday morning | Rostiro: [N] lineup decisions before kickoff. Est. 3 min. |
| Monday night | Rostiro: Your team is [winning/losing] by [X] pts. [Player] still playing. |

Email (Resend) is the fallback for users who deny push permission. Always prompt for push first.

### 4.7 Waiver Command Center — Phase 2

One ranked waiver list across all leagues. Best adds ranked by roster gap, not general rankings. FAAB budget tracker per league. Yahoo: submit claim from Rostiro directly. ESPN/Sleeper: deep-link.

### 4.8 Opponent Behavior Modeling — Phase 2

Who over-drafts rookies, who hoards RBs, who historically accepts 2-for-1 trades, who streams QBs. Shown in Pulse as intel items. Builds over the season from transaction history.

### 4.9 Licensing Layer — Phase 3

Three paths validated by competitive research:
- Tooling-as-a-service for smaller fantasy hosts
- Publisher/media licensing for content sites with weak product UX
- Adjacent gaming/pick-em licensing (PrizePicks, Underdog-style platforms)

---

## 5. Monetization — Revised Pricing

Market corridor confirmed at $3-25/month. FantasyPros HOF is $8.99/mo. PFF is $10/mo annualized. Rostiro enters above lightweight tools, well below top of market. Season = August 1 through Super Bowl (~6 months).

| Plan | Price | Includes |
|---|---|---|
| Free / Scout | $0 | 1 league sync. Draft Kit (unlimited). Basic dashboard. 3 start/sit/week. 3 trade/week. Basic Pulse (1 league). 7-day full Starter trial on signup. |
| Starter | $8/mo or $69/yr | Up to 3 leagues. Full Draft Kit with live sync. Full Pulse across all leagues. Unlimited start/sit and trade. Web push notifications. Yahoo lineup write-back. |
| Pro | $15/mo or $119/yr | Up to 10 leagues. Full portfolio exposure view. Cross-league Pulse with opponent intel. Proactive trade suggestions. Advanced what-if simulations. |
| Commissioner | $19/mo or $149/yr | Unlimited leagues. Shared reports. Co-manager seats. League power reports. Custom digest scheduling. Priority AI. |
| Intelligence add-on | +$5/mo or +$39/yr | Savant mode full data layer. Deep explanations. Portfolio risk scoring. League summary memos. Available on any paid tier. |

### 5.1 Conversion Funnel

1. User finds Rostiro Draft Kit (Reddit, TikTok, ProductHunt, word of mouth)
2. Uses Draft Kit free during draft — no account, no card, no friction
3. Draft ends. Grade card. Gate: "Save and unlock Pulse — create free account"
4. Account created. 7-day full Starter trial begins automatically.
5. User sees Pulse with 1 connected league. Sees "Connect 4 more leagues" prompt.
6. Week 1 NFL approaches. User upgrades to Starter for full Pulse + push notifications.
7. Pulse drives weekly active use. Saturday night push drives retention.
8. Post-playoffs: discounted renewal offer. Multi-sport expansion retains year-round.

### 5.2 Revenue Targets

| Metric | Target |
|---|---|
| Beta launch (Week 1) | 50 paying subscribers — $520 MRR |
| Month 1 goal | 150 paying subscribers — $1,560 MRR |
| Season goal (6 months) | 400 paying subscribers — $4,160 MRR — $25K season revenue |
| Breakout scenario | 1,000 paying subscribers — $10,400 MRR — $62K season revenue |
| Blended ARPU target | ~$10.40/mo across Starter/Pro/Commissioner mix |
| Intelligence add-on attach rate | 20-30% of paid base |

---

## 6. KPIs — What Actually Matters

> Three KPIs matter right now. Everything else is noise until you have 500 users: **(1) leagues connected per user, (2) free-to-paid conversion rate, (3) weekly active users during the season.**

### 6.1 Activation KPIs

| KPI | Target |
|---|---|
| Accounts created | 500 by end of Week 1 NFL |
| % who connect 1+ league | 60%+ |
| % who connect 2+ leagues | 40%+ |
| Avg leagues connected per active user | Below 1.5 = tool. Above 2.5 = OS. This is the number. |
| Draft sessions completed | 200 in first draft week |
| % of Pulse items acted on or dismissed | 40%+ |

### 6.2 Monetization KPIs

| KPI | Target |
|---|---|
| Free to paid conversion | 8-10% of activated accounts |
| Trial to paid conversion | 30%+ of trial starts |
| Annual plan mix | 50%+ of paid on annual |
| Monthly churn during season | Under 15% |
| Intelligence add-on attach rate | 25% of paid base |

### 6.3 OS-Fit KPIs

| KPI | Target |
|---|---|
| Pulse inbox opens per week | 3+ for active users |
| % using 2+ modules weekly | 50%+ of active users |
| Time to first value after sync | Under 90 seconds |
| Push notification opt-in rate | 60%+ of users who connect a league |
| Push notification open rate | 20%+ (industry average: 7%) |
| NPS among 3+ league users | 50+ |

---

## 7. Technical Architecture

### 7.1 Stack

| Layer | Decision |
|---|---|
| Frontend | Next.js 14 + TypeScript — App Router |
| Styling | Tailwind CSS — mobile-first. Dark mode required throughout. |
| Backend | Next.js API routes |
| Database | Supabase (PostgreSQL) — auth, storage, realtime |
| User auth | Supabase Auth — email/password + magic link |
| Yahoo auth | Yahoo OAuth 2.0 — encrypted in Supabase |
| ESPN auth | espn_s2 + SWID cookies — AES-256 encrypted |
| Yahoo API | Official Fantasy Sports REST API — read + write |
| ESPN API | Unofficial v3 endpoints — read only |
| Sleeper API | Public REST API — no auth |
| NFL player data | ESPN public API + nflverse/nflfastR (free) |
| ADP data | FantasyPros consensus ADP (scraped daily during draft season) |
| Weather data | Open-Meteo API (free, no key) — stadium lat/lng → hourly forecast |
| AI layer | Anthropic Claude API — **claude-sonnet-4-6 model exclusively** |
| Push notifications | OneSignal (free tier) — web push, service worker |
| Email fallback | Resend — transactional alerts and receipts |
| Payments | Stripe — monthly subscription + annual + 7-day trial |
| Hosting | Vercel |
| Realtime | Supabase Realtime — draft board sync, Pulse updates |

### 7.2 Database Schema

```sql
-- All tables include created_at, updated_at. RLS enabled on all tables.

users
  id uuid PRIMARY KEY
  email text
  plan text CHECK (plan IN ('free','starter','pro','commissioner'))
  trial_ends_at timestamptz
  season_pass_expires_at timestamptz
  stripe_customer_id text
  stripe_subscription_id text
  intelligence_addon boolean DEFAULT false
  push_enabled boolean DEFAULT false

connected_leagues
  id uuid PRIMARY KEY
  user_id uuid REFERENCES users
  platform text CHECK (platform IN ('espn','yahoo','sleeper'))
  league_id text
  league_name text
  season integer DEFAULT 2025
  scoring_settings_json jsonb
  roster_slots_json jsonb
  team_id text
  team_name text
  last_synced_at timestamptz
  sync_status text

yahoo_tokens
  user_id uuid REFERENCES users
  access_token text  -- encrypted
  refresh_token text -- encrypted
  expires_at timestamptz
  scope text

espn_credentials
  user_id uuid REFERENCES users
  espn_s2 text    -- AES-256 encrypted
  swid text       -- AES-256 encrypted
  last_validated_at timestamptz
  is_valid boolean

roster_snapshots
  id uuid PRIMARY KEY
  league_id uuid REFERENCES connected_leagues
  team_id text
  snapshot_json jsonb
  snapped_at timestamptz
  -- Cache, refresh hourly

players_cache
  player_id text
  platform text
  name text
  position text
  nfl_team text
  injury_status text
  injury_designation text
  adp_consensus numeric
  adp_espn numeric
  adp_yahoo numeric
  last_updated timestamptz

player_mappings
  name text
  nfl_team text
  espn_id text
  yahoo_id text
  sleeper_id text
  -- Seeded from nflverse. MUST exist before any cross-platform intelligence.

draft_sessions
  id uuid PRIMARY KEY
  user_id uuid REFERENCES users
  league_id uuid REFERENCES connected_leagues
  platform text
  draft_id text
  status text CHECK (status IN ('setup','active','complete'))
  settings_json jsonb
  picks_json jsonb
  my_picks_json jsonb
  grade_json jsonb

pulse_items
  id uuid PRIMARY KEY
  user_id uuid REFERENCES users
  type text
  priority text CHECK (priority IN ('critical','important','info'))
  headline text
  reasoning text
  affected_leagues_json jsonb
  deadline timestamptz
  action_url text
  platform text
  is_dismissed boolean DEFAULT false

ai_queries
  id uuid PRIMARY KEY
  user_id uuid REFERENCES users
  query_type text CHECK (query_type IN ('pulse','start_sit','trade','draft_rec'))
  context_hash text
  response_json jsonb
  tokens_in integer
  tokens_out integer
  latency_ms integer

weather_cache
  stadium_id text
  game_date date
  forecast_json jsonb
  fetched_at timestamptz
  -- 6 hour TTL

push_subscriptions
  id uuid PRIMARY KEY
  user_id uuid REFERENCES users
  onesignal_player_id text
  created_at timestamptz
```

### 7.3 Key API Routes

| Route | Purpose |
|---|---|
| `POST /api/auth/yahoo/callback` | Yahoo OAuth callback — exchange code for tokens, encrypt and store |
| `POST /api/leagues/espn` | Validate and store ESPN cookies, test fetch |
| `POST /api/leagues/sleeper` | Lookup Sleeper username, fetch and store all leagues |
| `GET /api/leagues` | All connected leagues with cached roster for authenticated user |
| `POST /api/leagues/[id]/sync` | Force re-sync a specific league |
| `GET /api/pulse` | Generate Pulse inbox — assembles context, calls Claude |
| `POST /api/draft/start` | Initialize draft session, load league context and ADP |
| `GET /api/draft/[id]/sync` | Poll platform for new picks |
| `POST /api/draft/[id]/pick` | Manual pick entry (ESPN fallback) |
| `POST /api/draft/[id]/recommend` | Claude streaming recommendation for current draft state |
| `POST /api/draft/[id]/grade` | Generate post-draft grade card JSON |
| `POST /api/ai/start-sit` | Start/sit query with cross-league context |
| `POST /api/ai/trade` | Trade analysis with roster context |
| `POST /api/yahoo/lineup` | Submit lineup change via Yahoo write API |
| `POST /api/yahoo/waiver` | Submit waiver claim via Yahoo write API |
| `POST /api/push/register` | Register OneSignal push subscription |
| `POST /api/push/send` | Internal — trigger push notification (cron/webhook) |
| `POST /api/stripe/checkout` | Create Stripe checkout session |
| `POST /api/stripe/portal` | Create Stripe customer portal session |
| `POST /api/stripe/webhook` | Handle Stripe events — activate/cancel plans |

---

## 8. Build Phases — Confirmed Sequence

> **TIMELINE:** Start July 1, 2025. Target launch August 1-10, 2025. Working 6 hrs/day, 6 days/week, ~35% Claude Code acceleration. ~252 hours available. ~155 hours estimated (post-acceleration). Buffer: ~97 hours. Achievable if go/no-go gate is hit.

| Timeline | Phase | Deliverables |
|---|---|---|
| Week 1-2 | Platform foundation | Yahoo OAuth + token storage. ESPN cookie auth + validation UI. Sleeper username lookup. ALL Supabase tables created. `/lib/yahoo.ts`, `/lib/espn.ts`, `/lib/sleeper.ts` complete. `/lib/normalize.ts` — one League/Roster/Player type regardless of platform. `/types/index.ts` — all shared types. **Verify: all 3 platforms return normalized data before moving to Week 3.** |
| Week 3 | Dashboard + AI layer | Unified league dashboard UI. `/lib/claude.ts` — start/sit and trade prompt builders. Start/sit advisor. Trade analyzer. Stripe — all tiers + 7-day trial. OneSignal — service worker, permission prompt after first league connect. |
| Week 4-5 | Draft Kit — launch feature | Draft board UI. `/lib/adp.ts` — ADP data. Sleeper live auto-sync. Yahoo live auto-sync. ESPN mDraftDetail test — auto-sync if works, manual entry if not. Claude streaming recommendations. ADP value alerts. Post-draft grade card + shareable URL. `rostiro.com/draft` standalone no-auth entry point. |
| Week 6 | Pulse + Polish | Pulse inbox MVP. `/lib/weather.ts` — Open-Meteo. Cross-league exposure view. Mobile audit (375px). ESPN onboarding guide. Error handling. Landing page + pricing page. |
| Week 7 | Buffer + Launch | Bug fixes. Edge cases. ESPN credential expiry. Yahoo token auto-refresh. Soft launch: 50-100 beta users from r/fantasyfootball. Hard launch before first major draft week. |

> **GO / NO-GO GATE — JULY 14:** Yahoo OAuth returning live roster data AND ESPN cookie auth returning league data. If both platforms feed clean normalized data by July 14, ship. If either is broken, stop and fix before building any UI.

---

## 9. Edge Cases and Risk Mitigation

| Risk | Mitigation |
|---|---|
| ESPN API change | Build all ESPN calls behind `/lib/espn.ts` with `EspnAPIError` class. Graceful degradation to "sync unavailable" state — never crash. |
| Yahoo token expiry | Auto-refresh using refresh token BEFORE every API call. If refresh fails, show reconnect prompt immediately. Never silently fail. |
| ESPN draft mDraftDetail unverified | Test during mock draft first. If it fails, use manual entry UI. Do NOT assume it works. |
| Claude API latency | 8-second timeout. Stream all draft recommendations. Show last recommendation with loading state if timeout exceeded. Never block draft board on AI response. |
| ADP data staleness | Cache with 6-hour TTL. Show last-updated timestamp. Refresh at 6am daily during draft season. |
| Player ID normalization | `player_mappings` table (seeded from nflverse) maps player name + NFL team to all three platform IDs. MUST be built before any cross-platform intelligence. |
| Weather data | Cache per stadium per game, 6-hour TTL. Only alert when wind > 20mph or precip > 60%. Build NFL stadiums table with lat/lng for all 32 venues. |
| Rate limits | Yahoo: exponential backoff on 429s. Sleeper: 10s polling = 6 req/min, well within 1000/min limit. ESPN: no published limit — monitor for 429s. |
| Private ESPN leagues | espn_s2 + SWID required. Detect privacy on first fetch, prompt for credentials only if missing. |
| Yahoo write-back failures | Wrap all writes in try/catch. On failure: show error + direct deep-link to Yahoo. Never silently fail a write. |
| Push notification Safari iOS | Requires "Add to Home Screen." Show gentle prompt explaining this for iOS users. Don't block experience. |
| Multiple simultaneous drafts | User may have 3 drafts same weekend. Support multiple active draft sessions in Supabase, selectable from a draft lobby screen. |

---

## 10. Out of Scope for MVP

- Native iOS / Android app — web only, mobile-responsive
- ESPN write-back (lineup, waivers, trades) — read + deep-link only
- CBS Sports, NFL Fantasy, Fantrax, MFL — Phase 2
- DFS (DraftKings, FanDuel, PrizePicks) — Phase 3 / licensing only
- Native push (APNs/FCM) — OneSignal web push covers MVP
- Dynasty-specific features (taxi squad, startup draft, devy) — Phase 2
- Best Ball mode — Phase 2
- Basketball, baseball, hockey — Phase 3
- Historical season analytics — Phase 3
- Commissioner tools — Phase 3
- In-app messaging — Phase 3
- Opponent behavior modeling — Phase 2
- Licensing API — Phase 3

---

## 11. Instructions for Claude Code

> **MANDATORY:** Read this entire PRD before writing any code. Follow the build order in Section 8 exactly. Do not skip ahead. The go/no-go gate in Week 2 is real.

### 11.1 Project Initialization

```bash
npx create-next-app@latest rostiro --typescript --tailwind --app --eslint
```

- Next.js App Router (not Pages Router)
- TypeScript strict mode — zero `any` types, ever
- Tailwind CSS for all styling
- Dark mode required on all screens — product runs dark-first
- Create Supabase project and add ALL environment variables before writing feature code
- Create ALL database tables from Section 7.2 before writing any feature code
- Install: `@anthropic-ai/sdk stripe resend zod date-fns`
- OneSignal: follow their Next.js integration guide for service worker setup

### 11.2 Folder Structure

```
/app
  /(auth)          — login, signup, onboarding routes
  /(app)           — protected routes: dashboard, pulse, draft, trade, start-sit
  /api             — all API routes
  /draft           — public Draft Kit standalone (no auth required)
/components
  /pulse           — Pulse inbox item components
  /draft           — draft board components
  /dashboard       — league card components
  /ui              — shared UI primitives
/lib
  /espn.ts         — ESPN API client, EspnAPIError class, all data methods
  /yahoo.ts        — Yahoo API client, OAuth helpers, read + write methods
  /sleeper.ts      — Sleeper API client, all data methods
  /claude.ts       — Claude API client, all prompt builders, streaming helpers
  /adp.ts          — ADP fetch, cache (6hr TTL), value delta calculation
  /weather.ts      — Open-Meteo client, NFL stadiums table, alert threshold logic
  /normalize.ts    — normalize League/Roster/Player from all 3 platforms into shared types
  /players.ts      — cross-platform player ID normalization via player_mappings table
  /push.ts         — OneSignal web push helpers, notification templates
  /encrypt.ts      — AES-256 encryption/decryption for ESPN credentials + Yahoo tokens
/types
  /index.ts        — ALL shared TypeScript types. Define these FIRST before any lib files.
/utils             — shared utility functions
```

### 11.3 Build Order — Follow Exactly

1. `/types/index.ts` first
2. Supabase schema — run all table creation SQL
3. `/lib/encrypt.ts`
4. `/lib/sleeper.ts`
5. `/lib/yahoo.ts`
6. `/lib/espn.ts`
7. `/lib/normalize.ts`
8. Test: all 3 platforms return normalized data ← **GO/NO-GO GATE**
9. Auth flows (Supabase Auth + Yahoo OAuth)
10. Onboarding flow — connect ESPN, Yahoo, Sleeper
11. API routes for league fetching
12. Dashboard UI
13. `/lib/claude.ts` + start/sit + trade analyzer
14. Stripe + plan gating
15. OneSignal setup
16. `/lib/adp.ts`
17. `/lib/players.ts` — seed `player_mappings` from nflverse
18. Draft Kit standalone page
19. Draft board UI
20. Sleeper live sync → Yahoo live sync → ESPN sync (mDraftDetail or manual)
21. Claude streaming recommendations
22. ADP value alerts + positional scarcity
23. Post-draft grade card + shareable URL
24. Account gate on draft completion
25. `/lib/weather.ts`
26. `/lib/pulse.ts` + Pulse generation
27. Pulse inbox UI
28. Focused/Savant mode toggle
29. Yahoo lineup write-back
30. Push notification templates + cron job
31. Cross-league exposure view
32. Mobile audit (375px everything)
33. ESPN cookie onboarding guide
34. Landing page + pricing page
35. Soft launch

### 11.4 Code Standards — Non-Negotiable

- TypeScript strict — zero `any` types. Use Zod for all API input validation.
- Typed error classes: `EspnAPIError`, `YahooAPIError`, `SleeperAPIError`, `ClaudeAPIError` — all extend base `AppError`
- All credentials encrypted at rest — use `/lib/encrypt.ts` before any INSERT of ESPN credentials or Yahoo tokens
- Supabase Row Level Security enabled on ALL tables — users access only their own data
- All Claude API calls: 8-second timeout, stream where possible, typed fallback on failure
- Rate limiting on all AI endpoints
- Mobile-first — test all components at 375px before marking any task complete
- Deep-links verified and tested before any action card ships
- All Yahoo write operations: try/catch, error shown to user, deep-link fallback always provided
- Never silently fail any sync operation — always surface status to user

### 11.5 Environment Variables

```env
YAHOO_CLIENT_ID=                    # developer.yahoo.com — create app
YAHOO_CLIENT_SECRET=
YAHOO_REDIRECT_URI=https://rostiro.com/api/auth/yahoo/callback

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=      # safe for client
SUPABASE_SERVICE_ROLE_KEY=          # server-side only, never expose to client

ANTHROPIC_API_KEY=                  # console.anthropic.com — claude-sonnet-4-6

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

ENCRYPTION_KEY=                     # 32 random bytes: openssl rand -hex 32

ONESIGNAL_APP_ID=
ONESIGNAL_REST_API_KEY=
NEXT_PUBLIC_ONESIGNAL_APP_ID=       # safe for client

RESEND_API_KEY=
```

---

## 12. The Task List — Ship In This Order

Check off each task as a GitHub commit. Do not start a new task until the current one is verified working.

| Task | Description |
|---|---|
| T-01 | Create `/types/index.ts` with League, Roster, Player, DraftPick, PulseItem, AIRecommendation, DraftSession types |
| T-02 | Create Supabase project and run all table creation SQL from Section 7.2 |
| T-03 | Create `/lib/encrypt.ts` — AES-256 encrypt/decrypt functions |
| T-04 | Create `/lib/sleeper.ts` — username lookup, league fetch, roster fetch, draft picks endpoint |
| T-05 | Create `/lib/yahoo.ts` — OAuth helpers, league fetch, roster fetch, matchup fetch, draft results |
| T-06 | Create `/lib/espn.ts` — cookie auth, league fetch, roster fetch, mDraftDetail endpoint |
| T-07 | Create `/lib/normalize.ts` — normalize League and Roster from all 3 platforms into shared types |
| T-08 | Test: connect to Sleeper with your username, return normalized leagues ✓ |
| T-09 | Test: Yahoo OAuth flow complete end-to-end, return normalized leagues ✓ |
| T-10 | Test: ESPN cookies validated, return normalized leagues ✓ — **GO/NO-GO GATE** |
| T-11 | Supabase Auth — email signup/login, magic link |
| T-12 | Onboarding flow — connect ESPN (cookie guide), connect Yahoo (OAuth), connect Sleeper (username) |
| T-13 | `POST /api/leagues/espn`, `POST /api/leagues/sleeper`, Yahoo callback route |
| T-14 | `GET /api/leagues` — return all connected leagues with roster data for authenticated user |
| T-15 | Dashboard page — league cards with roster, matchup, injury flags |
| T-16 | Create `/lib/claude.ts` — start/sit prompt builder, trade prompt builder, streaming helper |
| T-17 | `POST /api/ai/start-sit` — recommendations with league scoring context |
| T-18 | `POST /api/ai/trade` — trade analyzer with ROS context |
| T-19 | Start/sit UI page — all leagues, recommendations with reasoning |
| T-20 | Trade analyzer UI page — paste offer, see verdict and reasoning |
| T-21 | Stripe — checkout sessions, webhook handler, plan activation in users table |
| T-22 | Free tier gating — 3 AI queries/week enforced, upgrade prompt |
| T-23 | OneSignal — service worker, push registration route, permission prompt after first league connect |
| T-24 | Create `/lib/adp.ts` — fetch FantasyPros ADP, cache 6hr TTL, value delta calculation |
| T-25 | Create `/lib/players.ts` — seed `player_mappings` table from nflverse, cross-platform lookup |
| T-26 | Draft Kit standalone page at `/draft` — no auth required |
| T-27 | Draft board UI — live picks list, available players panel, my pick indicator, timer display |
| T-28 | Sleeper live draft sync — poll `/v1/draft/{id}/picks` every 10 seconds, push to client via Supabase Realtime |
| T-29 | Yahoo live draft sync — poll `draft/results` endpoint every 10 seconds |
| T-30 | ESPN draft: test mDraftDetail during live mock draft — auto-sync or manual entry UI based on result |
| T-31 | `POST /api/draft/[id]/recommend` — Claude streaming recommendation after each pick |
| T-32 | ADP value alert system — steal and reach thresholds, visual flags on available players |
| T-33 | Positional scarcity tracker — live count of top-N players remaining per position |
| T-34 | `POST /api/draft/[id]/grade` — post-draft grade card JSON generation |
| T-35 | Grade card UI — shareable PNG download and shareable URL |
| T-36 | Draft session persistence — restore from Supabase if user closes and reopens browser |
| T-37 | Account gate on draft completion — "Save your draft and see Week 1 lineup" prompt |
| T-38 | Create `/lib/weather.ts` — Open-Meteo client, NFL stadiums table (all 32 venues with lat/lng), alert thresholds |
| T-39 | Create `/lib/pulse.ts` — Pulse context assembly (rosters + injuries + weather + waivers + scoring) |
| T-40 | `GET /api/pulse` — Claude call with full context, return prioritized PulseItem array |
| T-41 | Pulse inbox UI — action cards with priority, reasoning, deadline, action buttons |
| T-42 | Focused/Savant mode toggle — Pulse focused view and full intelligence layer |
| T-43 | `POST /api/yahoo/lineup` — Yahoo lineup write-back, error handling, deep-link fallback |
| T-44 | Push notification templates in `/lib/push.ts` — all types from Section 4.6 |
| T-45 | Cron job — Saturday 11pm injury report check, trigger push if starters affected |
| T-46 | Cross-league exposure view — all owned players with league concentration bars |
| T-47 | Mobile responsiveness — audit all screens at 375px, fix any overflow or tap target issues |
| T-48 | ESPN cookie onboarding — animated step-by-step guide for espn_s2 and SWID copy |
| T-49 | Landing page — headline, product demo, pricing, Draft Kit CTA |
| T-50 | Soft launch — share on r/fantasyfootball, collect beta feedback, iterate |

---

> **THE ITERATE LOOP:** Ship T-01 through T-37, launch. Watch usage. Find what's broken or missing. Fix it. Usage up. Repeat. Do not gold-plate features before launch. The draft is the moment. Own it.

---

*Rostiro PRD v3.0 — Final — July 2025*
*Run Every League. — rostiro.com*
