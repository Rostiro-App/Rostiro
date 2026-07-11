> ⚠️ **ARCHIVED / SUPERSEDED (July 10, 2026) by [`Rostiro_Marketing_System_v2.md`](Rostiro_Marketing_System_v2.md).**
> v1 assumed marketing meant *filming reality* (its video shotlist was deferred because it "required the founder to film"). v2 is rebuilt around the **Simulation Studio** content engine (PRD T-157–T-161) — manufacture faithful Rostiro moments in-product, capture 16:9 + 9:16, distribute at volume. **Use v2 for strategy.** This file is retained because several tactical banks are still valid and referenced by v2: Reddit templates (§10), Discord structure (§11), Product Hunt plan (§12), newsletter (§13), launch directories (§16), and the full X/TikTok banks (§7–8, minus any pricing claims until Stripe is live).

# Rostiro External Marketing System v1.0
### Built from `Rostiro_Marketing_Brief.md` (founder input, July 7, 2026), audited against `Rostiro_PRD_v5.md` and `rostiro-brand-kit.md`

> **Referenced from the PRD's changelog, not part of it.** This is a marketing plan, not a product requirement.
>
> **Ground rules this whole document follows:**
> - Every feature named below is real and shipped (or in the exact stated state — code-done-migration-pending, etc.). Nothing here promises functionality that isn't in the PRD.
> - **Sleeper is the fully-supported platform today.** ESPN and Yahoo connect, but real gaps exist (ESPN never resolves a team ID, so Lineup/Trades/Live are Sleeper-first) — copy below never claims equal ESPN/Yahoo depth. Where a post mentions "connect your leagues," it means Sleeper-first, more platforms improving.
> - **No native app.** Rostiro is a web product (Next.js). Nothing here says "download our app" or implies an App Store listing.
> - **No multi-sport claim.** NFL/fantasy football only for 2026. NBA is a 2027+ roadmap item, not something to imply is live.
> - Real pricing used throughout: **Free** / **Rostiro Pro $9.99/mo** / **2026 Founder Season Pass $59** / **Founding 500 $149 lifetime, capped at 500, never returns**.
> - Real, marketable mechanic: Free users get **full Pro access for a week around Week 1 kickoff** (Sept 7 to Sept 15, 2026) — a genuine "try it during the moment that matters" hook, not a generic trial.
> - Anything not yet confirmed (a handle's real availability, a tool choice, a follower number) is marked **`[PLACEHOLDER]`** — verify before publishing, don't invent past that marker.
> - Copy avoids: "Win your league," "Dominate fantasy football," "Next-gen," "Revolutionary," and em dashes throughout the content banks (per brief).

---

## Readiness gates — check before any content in this plan goes out

Two things in this plan are written as if already true. Confirm both before the relevant content runs, so this stays an honest plan instead of a revised one:

1. **Stripe/billing must be live before any pricing or Founding 500 content posts.** This entire plan is written assuming real Stripe checkout exists (per the founder's own build plan, ahead of executing this). Everything in Sections 5, 8, and 9 that mentions specific pricing or "capped at 500, never returns" scarcity is a live-purchase claim, not a waitlist tease, once it posts. If Stripe isn't live yet when a specific day/post in the calendar comes up, hold that piece and either skip it or reframe it as "join the waitlist to be first in line" until it is.
2. **Championship Mode (T-83) content should hold until it's been seen working against a real live playoff bracket.** It's fully built and passed every check, but no league has reached its real playoff week yet this season, so it's never fired against real data. Section 5 (Day 24) and Section 7 (script 11) both feature it as a ready-to-film hero moment. Don't film or post it as a proven "New:" feature until a real league's bracket confirms it actually works live. Everything else in this plan is both built and already tested live this session, this is the one exception.

Nothing else in this document depends on something not yet true — the core feature claims (Pulse, Health Score, Draft Copilot, Trade Analyzer, Live Matchup Scoring, Notes, Interrupt Stack, the States system, the free-Pro-week mechanic) are real, shipped, and already confirmed working.

**On pacing:** this plan was written with the brief's stated cadences (daily X, 3-5 TikToks/week) as a ceiling, not a mandate. The brief's own stated goal for this phase is awareness and trust, not conversion — treat the 30-day calendar in Section 5 as a menu to pull from at a sustainable pace, not a quota. A quieter, more honest posting rhythm beats a dense one that outruns what's actually ready to show. Skipping a day is fine; posting something before it's real isn't.

---

## 0. Product audit — what's actually real (the source of truth for every claim below)

**Positioning line the brief specifies, confirmed compatible with the product:** *Rostiro helps fantasy players manage all of their fantasy teams in one place.* This matches the product's own real architecture — Rostiro syncs multiple leagues across platforms into one account, one Pulse queue, one System Bar.

**What's real and demoable right now:**

| Feature | What it actually is | Marketing angle |
|---|---|---|
| **Pulse** | A ranked, cross-league daily action queue (Done/Dismiss/Snooze) — the one thing to check, not five apps | "One queue instead of five tabs" |
| **Rostiro States** | The whole product automatically reshapes itself — Draft, Standard, Waiver Day, Game Day, Film Room — on a schedule every manager already lives by | Most visually demoable idea in the product — the pulse mark literally changes color/speed |
| **System Bar** | Persistent top bar: live sync status, per-league health dots, deadline countdown, ⌘K command palette | "Command center," not a dashboard you have to dig through |
| **League Health Score** | Deterministic 0-100 score per league, real factors (injury risk, bye exposure, waiver opportunity, matchup difficulty, roster depth) | A reason to open the app even with nothing urgent |
| **Draft Copilot** | Live draft tracking (Sleeper), pre-fetched reasoning per pick, 8 real strategies (Zero-RB, Late-QB, TE Premium, etc.) | Real screen-recording gold for TikTok/Shorts |
| **Trade Analyzer + Ask Copilot** | Deterministic verdict blending ADP with real season-to-date scoring, natural-language trade-finder search over your league's real rosters | "Ask it who'd actually take this trade" |
| **Live Matchup Scoring** | Real-time fantasy score of your actual matchup on Sunday (not just NFL scores) surfaced in Pulse and the System Bar | The literal "Sunday command center" moment to film |
| **Interrupt Stack** | One persistent interrupt slot — a touchdown or lineup lock interrupts, everything else waits in queue | "It doesn't spam you" is a real, provable claim |
| **Playoff Intensity Ladder** | The product visually escalates (a gold pulse, a "Championship" mode) as your specific team advances through your league's real playoff bracket | *"Rostiro changes as your season does — when you make the championship, it gets more intense with you."* Ready-made hero line for launch |
| **Notes + Save This Trade** | Free-form notes on any league/player, save a full trade analysis for later | Low-key but real "it remembers context for you" proof |
| **Modes (Focused / Balanced / Savant)** | Controls information density everywhere in the app | "Pick how much detail you want, once" |

**What NOT to say yet:**
- Don't say "manage ESPN and Yahoo leagues just like Sleeper" — say "Sleeper-first, more platforms coming."
- Don't say "the Rostiro app" in an App Store sense — say "Rostiro" or "the Rostiro web app."
- Don't promise NBA/multi-sport.
- Don't promise a public Discord bot, mobile push beyond what's built, or a referral program — none exist yet.
- Don't quote user/follower counts before launch — every number in this doc is a target, not a claim.

---

## 1. Channel-by-channel marketing strategy

### X / Twitter — Tier 1

- **Purpose:** Build-in-public hub. Daily proof the product is real and being built by an actual person.
- **Audience:** Fantasy football power users, indie hackers/builders, Product Hunt crowd, dynasty/keeper league commissioners.
- **Frequency:** 1 to 3 posts/day. Daily minimum during pre-season; ramps to multiple/day during NFL Sundays at launch.
- **Content types:** Screenshots, GIFs of real screens (Pulse, Draft Copilot, Game Day), build-in-public progress notes, NFL news reactions tied to a real Rostiro feature, founder thoughts, soft waitlist asks.
- **Tone:** Direct, a little dry, confident about the product without hype language.
- **What not to post:** Generic motivational quotes, fake growth-hack threads, anything implying features that don't exist, engagement-bait ("agree?").
- **Example post format:** Screenshot + 1-2 sentence caption + soft CTA.
- **Example copy:** *"Every Sunday I had 6 tabs open just to know who was playing. Built the thing that fixes that. Pulse ranks what actually needs your attention across every league you're in."*
- **Pre-season role:** Primary channel for daily proof-of-life and the eventual Product Hunt launch amplifier.

### TikTok — Tier 1

- **Purpose:** The biggest real growth opportunity per the brief — screen recordings and real pain points, not trends.
- **Audience:** Fantasy managers 18-34 who run 3+ leagues and are annoyed by app-switching.
- **Frequency:** 3-5/week.
- **Content types:** Screen recordings of real features (Draft Copilot live, Pulse queue, Game Day live scoring), "things that annoy me about managing multiple leagues," feature reveals, Sunday-use-case clips.
- **Tone:** Native, fast-cut, talking directly to camera or voiceover over screen recording. Not scripted-sounding.
- **What not to post:** Dance trends, meme formats unrelated to the pain point, anything staged that doesn't reflect a real screen.
- **Example format:** Hook in first 1.5s, screen recording, on-screen text reinforcing the pain point, soft CTA in caption.
- **Example copy (caption):** *"POV: it's Sunday and you have to check 4 apps to know if your RB2 is even active. Built something that puts all of it in one place. Comment 'sundays' if this is you."*
- **Pre-season role:** Highest-leverage awareness channel before season start — this is where "manage all your teams in one place" gets discovered by people who've never heard of Rostiro.

### Instagram — Tier 1

- **Purpose:** Reels reuse TikTok content; Stories cover Sunday in real time; carousels teach.
- **Audience:** Overlaps TikTok, skews slightly older, more visual/carousel-receptive.
- **Frequency:** 3-4 Reels/week (repurposed from TikTok), Stories every NFL Sunday during season, 1-2 carousels/week.
- **Content types:** Reused TikToks, "what's live in Rostiro right now" Sunday Stories, carousel breakdowns of a single feature or pain point.
- **Tone:** Same voice as TikTok, slightly more polished captions.
- **What not to post:** Stock photos, generic fantasy football meme accounts' style, anything that isn't product- or pain-point-specific.
- **Example format:** Carousel, slide 1 = pain point, slides 2-4 = how Rostiro addresses it with a real screenshot, slide 5 = soft CTA.
- **Pre-season role:** Secondary awareness + the carousel format is genuinely good at explaining "why this exists" without a video.

### YouTube Shorts — Tier 1

- **Purpose:** Every TikTok becomes a Short. Zero extra production cost, extra discovery surface.
- **Audience:** Same as TikTok, plus people who search "fantasy football multiple leagues" directly on YouTube.
- **Frequency:** Same cadence as TikTok (repost, don't create separately) — 3-5/week.
- **Content types:** 1:1 repost of TikTok content initially. Eventually (post-launch): longer feature walkthroughs, a roadmap video.
- **Tone:** Identical to TikTok.
- **What not to post:** Long-form content before there's a reason to (a real launch, a real roadmap milestone).
- **Pre-season role:** Free extra reach for zero extra work — always repost same-day as TikTok.

### Reddit — Tier 1

- **Purpose:** Credibility through being genuinely helpful, not a promotional channel. **Do not create a subreddit yet.**
- **Audience:** r/fantasyfootball, r/DynastyFF, r/FFCommish, r/SleeperApp — real managers actively solving the exact pain points Rostiro addresses.
- **Frequency:** 2-3 helpful comments/week minimum; 1 value-first post every 1-2 weeks, only when genuinely useful.
- **Content types:** Answers to real questions (trade value, waiver strategy, "how do you manage multiple leagues"), never a drive-by link drop.
- **Tone:** Fantasy player first, founder second. Mention Rostiro only when it's the honest answer to the exact question asked, and disclose you built it.
- **What not to post:** Anything that reads as an ad, repeated self-promotion, posting the same content across multiple subreddits same-day.
- **Full strategy and templates:** see Section 10.

### Discord — Tier 1

- **Purpose:** The real home for beta testers, bug reports, and feature requests — even at 5-20 members.
- **Audience:** Early signups, beta testers, the most engaged waitlist people.
- **Frequency:** Always-on presence; 1 weekly update minimum.
- **Content types:** Announcements, bug/feature-request intake, direct founder access, beta build notes.
- **Tone:** Casual, responsive, genuinely small-team energy.
- **What not to post:** Marketing copy — this is a utility space, not a broadcast channel.
- **Full structure:** see Section 11.

### Product Hunt — Tier 1

- **Purpose:** Credibility and a concentrated awareness spike, not the primary growth engine.
- **Audience:** Builders, early adopters, tech press that scans PH daily.
- **Frequency:** One real launch day, prepared over 7 days.
- **Full plan:** see Section 12.

### LinkedIn — Tier 2

- **Purpose:** Founder story, hiring, investor/press credibility — proof this is a real, serious product, not a side project.
- **Audience:** Engineers, potential hires, investors, press, other builders.
- **Frequency:** 2/week.
- **Content types:** Founder-building-in-public posts, technical deep-dives (real architecture decisions from the PRD — e.g., the deterministic-first AI philosophy, the OS State system), milestone posts.
- **Tone:** Still direct and specific, slightly more polished than X, never corporate-generic.
- **Example copy:** *"Every AI feature in Rostiro follows one rule: the deterministic layer decides, Claude only explains. Verdict on a trade is math. The three sentences explaining it are the only thing AI writes. Built it this way after seeing too many fantasy tools where the AI just makes things up."*

### Bluesky / Threads — Tier 2

- **Purpose:** Cross-post channels. Same content as X, adjusted only for platform norms (Threads slightly more casual, Bluesky closer to X's original culture).
- **Frequency:** Same-day cross-post of X content, no separate content creation initially.
- **Note:** Don't 1:1-mirror identical text if avoidable — light rewrites keep it from reading as an obvious bot cross-post, but this is a "nice to have," not a blocker to starting.

### Facebook Page / Group, Newsletter, GitHub Organization — Tier 3

- **Facebook Page:** Claim the handle now, don't actively post until there's a real content backlog to justify a second full content queue.
- **Facebook Group:** Hold until Discord proves the community concept works — don't split a small early community across two platforms.
- **Newsletter (Beehiiv):** Real value once there's a large enough list to justify weekly content — start collecting signups now (waitlist), first issue timed near Week 1. See Section 13.
- **GitHub Organization:** **Already exists** — `github.com/Rostiro-App` is live and in use for the private repo. Nothing to claim; decide later whether any part of the stack goes public (unlikely pre-launch, given no open-source component is planned in the PRD).

---

## 2. Account setup checklist

Assume `@rostiro` is the target everywhere. **`[PLACEHOLDER]`** next to every platform — actual availability needs to be checked at signup time; this list gives clean fallbacks if taken.

| Platform | Target handle | Fallback if taken | Status |
|---|---|---|---|
| X / Twitter | `@rostiro` | `@rostiroapp`, `@rostirohq`, `@joinrostiro` | `[PLACEHOLDER: verify availability]` |
| TikTok | `@rostiro` | `@rostiroapp`, `@rostiro.app` | `[PLACEHOLDER]` |
| Instagram | `@rostiro` | `@rostiroapp`, `@rostiro.hq` | `[PLACEHOLDER]` |
| Threads | Mirrors Instagram handle automatically once IG is claimed | — | Follows IG |
| YouTube | `youtube.com/@rostiro` | `@rostiroapp` | `[PLACEHOLDER]` |
| Bluesky | `rostiro.bsky.social` initially, migrate to custom domain (`rostiro.com`) once verified | — | `[PLACEHOLDER]` |
| LinkedIn Company Page | `linkedin.com/company/rostiro` | `rostiro-app` | `[PLACEHOLDER]` |
| Discord | Server name "Rostiro", vanity URL `discord.gg/rostiro` (needs Discord's boost tier for a vanity link — start with a standard invite link, upgrade later) | — | `[PLACEHOLDER]` |
| Product Hunt | Maker + product page under "Rostiro" | — | `[PLACEHOLDER]` |
| Beehiiv | `rostiro.beehiiv.com` → custom domain later (e.g. `news.rostiro.com`) | — | `[PLACEHOLDER]` |
| Reddit account | Personal founder account (Lawrence), not a brand account — brand accounts read as more promotional and are more likely to get flagged | — | No new account needed if one exists |
| Facebook Page | `facebook.com/rostiro` | `rostiroapp` | `[PLACEHOLDER]`, Tier 3, low urgency |
| GitHub Organization | Already exists: `github.com/Rostiro-App` | — | **Done** |

**Do today regardless of availability checks:** claim X, TikTok, Instagram, and the Discord server — these are the four hardest to recover if squatted, and cost nothing to reserve now even months before posting seriously.

---

## 3. Bio and profile copy

**X:** Fantasy football, run every league from one place. Building in public. → rostiro.com

**TikTok:** Manage every fantasy team you have in one place. No more app-switching on Sundays.

**Instagram:** One place for every fantasy league you're in. Building Rostiro, the fantasy football command center.

**YouTube:** Rostiro is the operating system for fantasy football. Screen recordings, feature builds, and Sunday chaos, solved.

**Threads:** Same as X — building Rostiro so Sundays stop feeling like ten tabs.

**Bluesky:** Rostiro. One place for every fantasy league. Building in public.

**LinkedIn (Company Page):** Rostiro is the operating system for fantasy football — one command center for every league, every platform, every Sunday. Building the product our own leagues needed.

**Product Hunt (tagline, reused from Section 12):** The operating system for fantasy football — one place for every league you're in.

**Discord server description:** The home for Rostiro beta testers. Bugs, feature requests, and a direct line to the person building it.

**Beehiiv newsletter description:** Waivers, injuries, and the Rostiro build, delivered before your Sunday gets complicated.

---

## 4. Launch-ready pinned posts

**X (pinned):**
> Rostiro is one place for every fantasy team you manage. Sleeper, and more platforms coming. One ranked list of what actually needs you today instead of five open tabs. Free to start. Building in public here, would love early users.
> rostiro.com

**LinkedIn:**
> I run fantasy leagues across multiple platforms and got tired of opening five apps every Sunday just to know who's playing. So I built Rostiro: one account, every league you're in, one ranked queue of what actually needs your attention. It's live, it's free to start, and I'm building it in public. Would love to connect with anyone who plays fantasy football or is building something similar.

**Threads:**
> Building Rostiro: one place for every fantasy league you manage instead of switching between apps all Sunday. Free to start. Posting the build here.

**Bluesky:**
> Building Rostiro, one command center for every fantasy football league you're in. Sleeper-first today, more coming. Free to start, would love early users. rostiro.com

**Reddit-safe founder intro** (use only where self-promotion is explicitly welcome, e.g. a weekly "what are you building" thread, never a cold standalone post):
> Hey, I'm Lawrence. I play fantasy football across a handful of leagues and got tired of the Sunday routine of checking Sleeper, then ESPN, then a group chat, then a spreadsheet, just to know what actually needed my attention. Built a tool called Rostiro that pulls it into one ranked list. It's live and free to start if anyone wants to try it, genuinely just looking for people to break it and tell me what's wrong with it.

**Discord welcome announcement:**
> Welcome to Rostiro. This server is for beta testers and early users, bugs, feature requests, and direct access to me while I build this. Check #announcements for what's new, drop bugs in #bug-reports, and feature ideas in #feature-requests. Glad you're here.

---

## 5. 30-day pre-season content calendar

Starts from an assumed kickoff date of **today + 1 week** so the founder has a few days to finish account setup (Section 2) and asset production (Section 14) first. Shift the whole calendar to whatever real start date is chosen — the day-by-day logic doesn't depend on a specific calendar date. `[R]` = reusable elsewhere per the brief's repurposing goal.

| Day | Platform(s) | Content idea | Hook | Format | CTA | Asset needed | Reuse |
|---|---|---|---|---|---|---|---|
| 1 | X | Founder intro / why Rostiro exists | "I run 4 fantasy leagues and got tired of..." | Text + 1 screenshot | Would this help your Sundays? | Pulse screenshot | LinkedIn `[R]` |
| 1 | LinkedIn | Founder story (longer version) | Same pain point, more context | Text post | Join the waitlist | none | — |
| 2 | TikTok | Screen recording: Pulse queue walkthrough | "This is everything I need to do today, across every league" | Screen recording + VO | DM "Rostiro" for early access | Screen recording | IG Reel, YT Short `[R]` |
| 2 | IG, YT | Repost Day 2 TikTok | same | same | same | same | Source: TikTok |
| 3 | X | Screenshot: League Health Score | "This number tells you if your team needs help before you know it does" | Screenshot + caption | Want early access? | Health Score screenshot | IG carousel slide `[R]` |
| 4 | TikTok | "3 tabs I used to have open every Sunday" | Relatable pain-point list | Talking head or VO over screen | Comment "sundays" | Screen recording | IG Reel, YT Short `[R]` |
| 4 | IG, YT | Repost Day 4 TikTok | same | same | same | same | Source: TikTok |
| 5 | X | Build-in-public: a real feature note | "Just shipped: live matchup score during your actual Sunday game, not just NFL scores" | Screenshot/GIF | Reply if you'd use this | GIF of Live Matchup card | LinkedIn `[R]` |
| 5 | Reddit | Helpful comment pass (no post) | — | Comment in r/fantasyfootball thread about waiver strategy | — | — | — |
| 6 | X | NFL news reaction tied to product | React to a real injury/news story, tie to Rostiro's injury tracking | Text + screenshot | — | Screenshot | — |
| 7 | X | Weekly recap / what shipped this week | "This week in Rostiro" | Thread | Join the waitlist | none | Discord update `[R]` |
| 7 | Discord | Weekly update post | Same content as X thread, more detail | Text | — | none | Source: X |
| 8 | LinkedIn | Technical deep-dive | "Every AI feature follows one rule: deterministic decides, AI only explains" | Text post | — | none | — |
| 9 | TikTok | Draft Copilot screen recording | "Watching an AI explain a real draft pick in real time" | Screen recording | Looking for beta users | Screen recording | IG Reel, YT Short `[R]` |
| 9 | IG, YT | Repost Day 9 TikTok | same | same | same | same | Source: TikTok |
| 10 | X | Screenshot: Trade Analyzer verdict | "Ask it about a trade, it checks real rosters in your league before answering" | Screenshot | Want early access? | Trade Analyzer screenshot | — |
| 10 | IG | Carousel: "Why Rostiro exists" | Pain point → solution, 5 slides | Carousel | Join the waitlist | 5 slide graphics | — |
| 11 | Reddit | Value-first post (if a natural opening exists that week) | e.g. "How do you all track injury news across leagues?" genuine discussion starter | Text post | — | — | — |
| 11 | X | Founder thought | Short, honest opinion on a real fantasy football debate | Text | — | none | — |
| 12 | TikTok | "POV: it's Sunday and you don't know who's even playing" | Relatable chaos | Screen recording, fast cut | Comment if this is you | Screen recording | IG Reel, YT Short `[R]` |
| 12 | IG, YT | Repost Day 12 TikTok | same | same | same | same | Source: TikTok |
| 13 | X | Screenshot: Rostiro States explainer | "The whole app changes shape depending on the day. Draft mode, Waiver mode, Game Day mode" | Screenshot/GIF | — | GIF of state transition | LinkedIn `[R]` |
| 14 | LinkedIn | Repost/expand Day 13 concept | Longer explanation of the States system as a design decision | Text | — | none | Source: X |
| 14 | Discord | Weekly update | What shipped this week | Text | — | none | — |
| 15 | X | Build-in-public milestone | Real number if one exists (waitlist size, leagues connected) `[PLACEHOLDER: use real number only]` | Text | Join the waitlist | none | — |
| 16 | TikTok | Feature reveal: Ask Copilot | "I asked it to find me a trade partner and it actually checked real rosters" | Screen recording | DM "Rostiro" | Screen recording | IG Reel, YT Short `[R]` |
| 16 | IG, YT | Repost Day 16 TikTok | same | same | same | same | Source: TikTok |
| 17 | X | Fantasy football pain point (non-product) | A real, relatable fantasy football gripe, no pitch | Text | — | none | — |
| 18 | Reddit | Helpful comment pass | — | — | — | — | — |
| 18 | IG | Carousel: Sunday chaos | 5 slides on the Sunday problem, last slide intros Rostiro | Carousel | Would this help your Sundays? | 5 slide graphics | — |
| 19 | X | Screenshot: Notes / Save This Trade | "It remembers the context you jot down, not just the numbers" | Screenshot | — | Screenshot | — |
| 20 | TikTok | "Managing 5 leagues used to mean 5 apps. Now it's one" | Direct pain-point statement | Screen recording | Looking for beta users | Screen recording | IG Reel, YT Short `[R]` |
| 20 | IG, YT | Repost Day 20 TikTok | same | same | same | same | Source: TikTok |
| 21 | X | Weekly recap thread | "This week in Rostiro" | Thread | Join the waitlist | none | Discord update `[R]` |
| 21 | Discord | Weekly update | Same content | Text | — | none | Source: X |
| 22 | LinkedIn | Founder post: building solo/small team | Honest note on what building Rostiro has actually been like | Text | — | none | — |
| 23 | X | NFL news reaction | React to real news, tie to a real Rostiro surface (injury tracking, waiver alerts) | Text + screenshot | — | Screenshot | — |
| 24 | TikTok | **[GATE: hold until verified live, see Readiness Gates]** Championship/Playoff Intensity Ladder reveal | "The app itself changes when your team makes the championship" | Screen recording of the gold reveal | Want early access? | Screen recording of T-83 reveal | IG Reel, YT Short `[R]` |
| 24 | IG, YT | Repost Day 24 TikTok | same | same | same | same | Source: TikTok |
| 25 | X | Product Hunt prep tease | "Launching on Product Hunt soon, here's a preview" | Screenshot/GIF | Follow for launch day | Hero asset | — |
| 25 | IG | Carousel: feature roundup | 6-7 slides, one per major feature | Carousel | Join the waitlist | slide set | — |
| 26 | Reddit | Value-first post | Genuine, tied to whatever real fantasy discussion is timely that week | Text | — | — | — |
| 27 | X | Product Hunt countdown | "2 days out" | Text + asset | — | Countdown graphic | — |
| 28 | Discord | PH launch-day briefing to community | Ask early users to support on launch day | Text | — | none | — |
| 29 | X | Product Hunt countdown | "Tomorrow" | Text + asset | — | Countdown graphic | — |
| 30 | X, LinkedIn, IG, TikTok, Discord | **Product Hunt launch day** — see Section 12 for the full checklist | "We're live on Product Hunt" | Cross-platform push | Support us on Product Hunt | Launch assets | Full cross-post |

**Newsletter concept for this window:** hold the first real issue until roughly Day 20-25, once there's enough build-in-public content to fill it honestly (see Section 13's first 5 issue ideas) — don't force an issue before there's real content.

---

## 6. Content pillars

### Pillar 1 — Sunday Chaos
**Description:** The exact, relatable pain of managing fantasy on game day: multiple tabs, multiple apps, missed lineup locks.
**Best platforms:** TikTok, Instagram Reels/Stories, X.
**Example hooks:** "It's Sunday and you have 4 tabs open just to know who's playing." / "POV: your phone dies and you can't remember which app has which league."
**Example posts:** Screen recording of a real Sunday, split-screen "before Rostiro / after Rostiro."
**Visual assets:** Screen recordings of Pulse and Live Matchup Scoring during a real game window.

### Pillar 2 — Multi-League Management
**Description:** The core positioning: one account, every league, every platform (Sleeper-first).
**Best platforms:** X, LinkedIn, Instagram carousels.
**Example hooks:** "All your leagues, all your players, all together." / "You shouldn't need five logins to check five teams."
**Example posts:** Screenshot of Leagues page showing multiple connected leagues at once.
**Visual assets:** Leagues page screenshot, System Bar showing multiple league health dots.

### Pillar 3 — Founder Building in Public
**Description:** Real, honest progress notes from actually building the product.
**Best platforms:** X, LinkedIn.
**Example hooks:** "Shipped this today:" / "Found a real bug in production this week, here's what happened."
**Example posts:** A real T-number-style shipped-feature note, rewritten in plain language.
**Visual assets:** None required — text-first pillar, occasional screenshot.

### Pillar 4 — Feature Demos
**Description:** Screen recordings of real, working features.
**Best platforms:** TikTok, YouTube Shorts, Instagram Reels.
**Example hooks:** "Watch this actually find a trade partner in my league." / "This score updates live during the game."
**Example posts:** Draft Copilot live-pick reasoning, Trade Analyzer verdict, Live Matchup Scoring during a real Sunday.
**Visual assets:** Direct screen recordings, no staging.

### Pillar 5 — NFL News Reactions
**Description:** Timely reactions to real NFL news, tied back to a genuine Rostiro surface (never forced).
**Best platforms:** X, Instagram Stories.
**Example hooks:** React to an injury report, tie to injury tracking. React to a trade, tie to Trade Analyzer.
**Example posts:** Quote-tweet-style reaction + screenshot of the relevant Rostiro feature.
**Visual assets:** Relevant in-app screenshot, timed to the news cycle.

### Pillar 6 — Product Education
**Description:** Teaching what a specific feature does and why, for people who've never seen the product.
**Best platforms:** Instagram carousels, LinkedIn, YouTube Shorts.
**Example hooks:** "What is a League Health Score?" / "Here's what 'Rostiro States' actually means."
**Example posts:** Carousel breaking down one feature per post.
**Visual assets:** Annotated screenshots.

### Pillar 7 — Beta User Feedback
**Description:** Real (with permission) feedback and stories from actual early users once they exist.
**Best platforms:** X, Discord, LinkedIn.
**Example hooks:** "A beta user told us this today." / "Someone found a bug we didn't know about, fixed it same day."
**Example posts:** Screenshot of real feedback (permission granted) + how it was addressed.
**Visual assets:** Screenshotted feedback (anonymized unless permission given).

---

## 7. TikTok / Reels / Shorts scripts (20)

Each reused as-is for Reels and Shorts unless noted.

1. **Hook:** "It's Sunday and I have 4 tabs open just to know who's playing." **Visual:** Screen recording of switching between 4 browser tabs, then Pulse. **On-screen text:** "before Rostiro" → "after Rostiro". **VO/caption:** Same as hook, plain delivery. **CTA:** "Comment 'sundays' if this is you." **Reuse:** Direct 1:1 to Reels/Shorts.

2. **Hook:** "This number tells you if your fantasy team is in trouble before you even know it." **Visual:** Health Score ring animating in. **On-screen text:** "League Health Score." **VO:** Explain the 5 real factors briefly. **CTA:** "Want early access?" **Reuse:** Direct.

3. **Hook:** "Watch it explain a real draft pick in real time." **Visual:** Draft Copilot screen recording during a live pick. **On-screen text:** "This is live." **VO:** Read the actual Copilot reasoning aloud. **CTA:** "Looking for beta users." **Reuse:** Direct.

4. **Hook:** "I asked it to find me a trade and it actually checked real rosters." **Visual:** Ask Copilot query + real candidate results. **On-screen text:** "Not a guess. Real players in my real league." **VO:** Narrate the result. **CTA:** "DM 'Rostiro' for early access." **Reuse:** Direct.

5. **Hook:** "The app changes shape depending on the day of the week." **Visual:** Time-lapse-style cut between Draft/Standard/Waiver Day/Game Day pulse colors. **On-screen text:** Name each state as it appears. **VO:** "Draft mode. Waiver mode. Game day mode." **CTA:** "Want early access?" **Reuse:** Direct.

6. **Hook:** "This score updates live during my actual game, not just the NFL score." **Visual:** Live Matchup card ticking up in real time during a real Sunday. **On-screen text:** "Real fantasy score. Live." **VO:** Explain briefly. **CTA:** "Would this help your Sundays?" **Reuse:** Direct.

7. **Hook:** "Managing 5 leagues used to mean 5 different logins." **Visual:** Leagues page with multiple connected leagues. **On-screen text:** "Now it's one." **VO:** Plain delivery. **CTA:** "Reply if you manage multiple teams." **Reuse:** Direct.

8. **Hook:** "It doesn't spam you. Only one thing interrupts you at a time." **Visual:** Interrupt Stack showing a single touchdown alert, then dismissing. **On-screen text:** "One alert. Not ten." **VO:** Brief explanation. **CTA:** "Want early access?" **Reuse:** Direct.

9. **Hook:** "POV: your phone dies and you forget which app has which league." **Visual:** Comedic staging, then reveal Pulse solving it. **On-screen text:** Relatable chaos, then "there's a fix." **VO:** Light, slightly funny delivery. **CTA:** "Comment if this is you." **Reuse:** Direct.

10. **Hook:** "This is everything I need to do today. Across every league I'm in." **Visual:** Full Pulse queue scroll. **On-screen text:** "One list. Every league." **VO:** Plain. **CTA:** "Looking for beta users." **Reuse:** Direct.

11. **[GATE: hold until verified live, see Readiness Gates]** **Hook:** "When your team makes the championship, the app itself gets more intense." **Visual:** T-83's gold championship reveal sweep. **On-screen text:** "Championship Mode." **VO:** "It changes with your season." **CTA:** "Want early access?" **Reuse:** Direct, a strong hero clip once confirmed, worth a second post as a standalone X GIF too.

12. **Hook:** "Free week during kickoff. Full access, no card." **Visual:** Screenshot of the free-Pro-week framing on signup. **On-screen text:** "Free during Week 1." **VO:** Explain the mechanic honestly (real free access during real Week 1 dates). **CTA:** "Join the waitlist." **Reuse:** Direct, time this one specifically for late August.

13. **Hook:** "I built this because I was tired of my own Sundays." **Visual:** Founder talking head, screen recording cut in. **On-screen text:** None needed, talking-head format. **VO:** Real founder story, brief. **CTA:** "Would this help your Sundays?" **Reuse:** Direct.

14. **Hook:** "Here's what actually happens when you trade in my app." **Visual:** Trade Analyzer full flow, pick players, get verdict. **On-screen text:** "Real math. Real reasoning." **VO:** Narrate the verdict. **CTA:** "Want early access?" **Reuse:** Direct.

15. **Hook:** "Your league's playoffs work differently than you think." **Visual:** Playoff bracket / Championship tier explainer using real Sleeper bracket data. **On-screen text:** "It knows your real bracket." **VO:** Explain briefly. **CTA:** "Reply if your league's in the playoffs." **Reuse:** Direct.

16. **Hook:** "This is what happens when a starter gets hurt mid-week." **Visual:** Injury alert flowing into Pulse. **On-screen text:** "You'd know before kickoff." **VO:** Brief. **CTA:** "Looking for beta users." **Reuse:** Direct.

17. **Hook:** "3 things I didn't know I needed until I built them." **Visual:** Quick cuts of Notes, Save This Trade, Health Score. **On-screen text:** List format. **VO:** Fast, list-style delivery. **CTA:** "Want early access?" **Reuse:** Direct.

18. **Hook:** "Every AI feature in this app follows one rule." **Visual:** Trade Analyzer verdict + reasoning side by side. **On-screen text:** "Math decides. AI explains." **VO:** Explain the deterministic-first philosophy plainly. **CTA:** "Reply if you're building something similar." **Reuse:** Direct, also good for LinkedIn as a written post.

19. **Hook:** "Command palette. One keyboard shortcut, anywhere in the app." **Visual:** ⌘K opening, jumping straight to a player. **On-screen text:** "⌘K. That's it." **VO:** Brief. **CTA:** "Want early access?" **Reuse:** Direct.

20. **Hook:** "We're launching on Product Hunt. Here's what that actually means." **Visual:** Product Hunt page preview. **On-screen text:** "Launch day is [date]." **VO:** Brief, genuine ask for support. **CTA:** "Follow for launch day." **Reuse:** Direct, time for Product Hunt launch week specifically.

---

## 8. X content bank (100 posts)

No em dashes anywhere in this section, per the brief.

### Build in public (1-15)
1. Shipped Pulse this week. One ranked list of what actually needs you across every league.
2. Found a real bug in production today. Fixed it in an hour. This is what building solo looks like.
3. Every feature in Rostiro starts as a question: does this actually help on a real Sunday.
4. Today's build note: live matchup scoring now updates during your actual game, not just the NFL score.
5. Spent the morning testing the free plan gates myself, logged in as a fake account to check every limit works.
6. The hardest part of building this wasn't the AI. It was making sure the numbers underneath it are always right first.
7. Shipped a small thing today that took way longer than it should have: making sure a dismissed alert never comes back.
8. Working solo means every bug report actually gets read by the person who built the thing.
9. Today I rebuilt a whole feature because it made a promise the product couldn't actually keep yet.
10. Real build update: the app now changes intensity when your team makes the championship. Wrote that logic today.
11. Nothing shipped today. Spent it all on a data pipeline nobody will ever see directly. Worth it.
12. Nobody tells you how much of building a product is deciding what NOT to build yet.
13. nfl season is 5 weeks out and I'm still finding things to fix before it matters most.
14. nfl season is 5 weeks out and I'm still finding things to fix before it matters most.
15. Today's fix: a free plan user was getting a feature they shouldn't have had access to yet. Caught it, fixed it.

### Fantasy football pain points (16-30)
16. Nobody warns you that "just check the app" means checking 4 different apps.
17. You shouldn't need a spreadsheet to remember which league has which waiver deadline.
18. The worst part of Sunday morning is realizing you forgot to set a lineup in your third league.
19. Managing 6 leagues should not feel like a part time job.
20. Every fantasy app assumes you only play in one league. Most of us don't.
21. Nobody built the thing that just tells you what actually needs your attention today.
22. Waiver day shouldn't require opening a note app to remember your priorities.
23. Your bench player getting hurt should not be something you find out from a group chat.
24. If you play in more than 2 leagues, you already know the app switching problem.
25. Sunday morning panic: did I set my lineup in every league or just some of them.
26. Trade value conversations always start with someone guessing. There's a better way.
27. You should not need to check 3 different scoring formats in your head before making a trade.
28. The 15 minutes before kickoff should not be spent tab switching.
29. Championship week deserves to feel different than week 4. Most apps don't know the difference.
30. Fantasy football got more complicated than any single app was built to handle.

### Founder thoughts (31-45)
31. I did not set out to build a fantasy app. I set out to fix my own Sundays.
32. The best feedback I've gotten so far came from someone telling me exactly what was wrong.
33. Building solo means moving fast and also owning every mistake immediately.
34. I would rather ship something honest and small than something big and half true.
35. The deterministic first, AI second rule has saved me from shipping something embarrassing more than once.
36. Every time I'm tempted to add a feature nobody asked for, I go read a real support message instead.
37. I test every free plan limit myself before I ship it. If it annoys me, it's wrong.
38. Building this alone means the roadmap is whatever actually matters this week, not a slide deck.
39. I'd rather have 20 people who actually use this than 2000 who signed up and forgot.
40. The hardest product decisions are always about what to leave out.
41. Most fantasy tools are built by people who don't play in 5 leagues themselves. I do.
42. I read every single piece of feedback that comes in. That won't scale forever, but it's true today.
43. Building in public means admitting when something breaks. It broke today, here's what happened.
44. The best compliment so far: someone said it felt like it was built by an actual fantasy player.
45. I'm not trying to reinvent fantasy football. I'm trying to fix the parts that are annoying.

### Feature reveals (46-60)
46. New: League Health Score. One number, five real factors, tells you if your team needs help.
47. New: Draft Copilot now explains every recommended pick in real time during your live draft.
48. New: Ask Copilot can find you a real trade partner by checking your league's actual rosters.
49. New: Live matchup scoring. Know if you're winning during the actual game, not just after.
50. New: Notes. Jot context on any player or league, it's there when you need it later.
51. New: Save this trade. Keep a real trade analysis instead of losing it when you close the tab.
52. New: The app now escalates when your team makes the playoffs, and again for the championship.
53. New: Command palette. One shortcut, jump anywhere in the app instantly.
54. New: Modes. Focused, Balanced, or Savant, pick how much detail you actually want to see.
55. New: Interrupt Stack. Only the most important thing interrupts you. Everything else waits.
56. New: System Bar shows every connected league's health at a glance, always visible.
57. New: Rostiro States. The whole app reshapes itself by day of week automatically.
58. New: Trade Analyzer now blends draft value with real season performance, not just preseason rankings.
59. New: Free week during Week 1 kickoff. Full access, no card required.
60. New: 8 real draft strategies in Draft Copilot, from Zero RB to Late QB.

### NFL Sunday reactions (61-70)
61. Injury news just dropped. This is exactly what waiver alerts are built for.
62. Bye week chaos is real. Rostiro's health score already flags it before it matters.
63. That trade everyone's debating today is exactly the kind of thing Ask Copilot checks against real rosters.
64. Sunday's about to get loud. This is the whole reason Game Day mode exists.
65. Someone's bench player just became the waiver wire's most wanted. You'll see it in Pulse first.
66. Kickoff's in an hour. If your lineup's not set in every league, that's the whole point of this app.
67. Monday morning quarterbacking starts with Film Room mode. Built for exactly this.
68. That last second lineup swap everyone's making right now is exactly what lineup lock alerts catch.
69. This week's waiver wire is chaos. Health Score already knows which of your teams needs it most.
70. Championship week hits different. The app knows it too.

### Waitlist / beta asks (71-80)
71. Looking for beta users who play in 3+ leagues. Reply and I'll get you set up.
72. If Sunday app switching sounds familiar, join the waitlist, free to start.
73. Building this for people exactly like you. Want early access?
74. Beta spots open. DM "Rostiro" and I'll walk you through it.
75. If you commissioner more than one league, I'd love your feedback specifically.
76. Free plan is live right now. No card needed to try it.
77. Reply if you manage multiple fantasy teams and I'll send you an invite.
78. Looking for a few Dynasty/Keeper league managers to test Trade Analyzer specifically.
79. Early access is open. Would this help your actual Sundays?
80. If you've ever missed a waiver deadline because you forgot which league it was in, this is for you.

### Product Hunt prep (81-90)
81. Launching on Product Hunt soon. Building the page this week.
82. 7 days until launch. Here's what Product Hunt day actually looks like for a solo builder.
83. If you've ever supported a Product Hunt launch, I could really use that this week.
84. The Product Hunt gallery is basically the highlight reel of everything shipped so far.
85. 3 days out. Getting the maker comment ready, it's the part I've rewritten the most.
86. Tomorrow's the day. Nervous and ready.
87. We're live on Product Hunt right now. Would mean a lot if you checked it out.
88. First comment's up on Product Hunt. Answering every question today.
89. Thank you to everyone who supported the launch today. Reading every comment.
90. Product Hunt day taught me more about what people actually want than a month of guessing would have.

### Screenshot / GIF captions (91-100)
91. This is what Sunday morning looks like now.
92. One queue. Every league. That's the whole pitch.
93. Watching Draft Copilot explain a pick in real time never gets old.
94. This score is live right now during a real game.
95. This is the moment the app knows your team made the championship.
96. Health Score, updated the second your roster changes.
97. This is what "one interrupt at a time" actually looks like.
98. Every league you're in, one screen.
99. This is the free week during kickoff. Full access, genuinely free.
100. This is the whole app in one screenshot. Every league, one place.

---

## 9. Instagram carousel concepts (15)

1. **"Why Rostiro exists"** — Slide 1: "Sunday used to mean 5 apps." Slides 2-4: real screenshots of the problem → Pulse solving it. Slide 5: "Free to start." CTA: Join the waitlist.
2. **"What is a League Health Score"** — Slide 1: the ring graphic. Slides 2-4: the 5 real factors explained simply. Slide 5: CTA to try it.
3. **"Sunday chaos, before and after"** — Split-screen style, tabs vs. one screen. CTA: Would this help your Sundays?
4. **"Rostiro States explained"** — One slide per state (Draft, Standard, Waiver Day, Game Day, Film Room) with its real color and a one-line description. CTA: Want early access?
5. **"5 things Rostiro actually does"** — Quick list format, one feature per slide, real screenshot each. CTA: Join the waitlist.
6. **"How Draft Copilot works"** — Slide-by-slide walkthrough of a real draft pick and its reasoning. CTA: Looking for beta users.
7. **"Ask Copilot in action"** — A real trade question, the real deterministic candidates it found, the explanation. CTA: Want early access?
8. **"What Championship Mode looks like"** — The gold reveal, explained slide by slide. CTA: Reply if your league's in the playoffs.
9. **"Managing 5 leagues, before Rostiro"** — Relatable chaos narrative across slides, resolves with the product. CTA: Would this help you?
10. **"The pricing, plainly"** **[GATE: hold until Stripe checkout is live, see Readiness Gates]** — Free / Pro $9.99/mo / Founder Season Pass $59 / Founding 500 $149 lifetime, one slide each, no fine print games. CTA: Join the waitlist.
11. **"What's live right now during your Sunday game"** — Live Matchup Scoring explained. CTA: Want early access?
12. **"Notes that actually stick around"** — Notes + Save This Trade explained together. CTA: Try it free.
13. **"One interrupt, not ten"** — Interrupt Stack explained with a real example. CTA: Want early access?
14. **"Founder building this alone"** — More personal, behind-the-scenes carousel on what building Rostiro has looked like. CTA: Follow the build.
15. **"Free during kickoff week"** — Explains the real Week 1 free-access mechanic plainly, no gimmick framing. CTA: Join the waitlist.

Visual direction for all 15: real in-app screenshots on the product's own dark "void" background (per brand kit), Inter typography, signal-blue/gold accents matching the actual State colors, never stock photography.

---

## 10. Reddit strategy

**Subreddits to participate in:** r/fantasyfootball, r/DynastyFF, r/FFCommish, r/SleeperApp.

**Types of posts that are acceptable:**
- Genuine questions about fantasy strategy, unrelated to Rostiro.
- "What are you building" or self-promo Saturday style threads where the subreddit explicitly allows it (check each sub's rules first).
- A post asking for beta testers, only in subreddits/threads that explicitly permit it.

**Types of comments to leave:**
- Direct, useful answers to real questions (trade value, waiver priority, lineup decisions) that don't mention Rostiro at all, most of the time.
- Occasionally, when a commenter's exact problem is "I manage too many leagues and lose track," an honest, disclosed mention: "I actually built a tool for exactly this, happy to share if useful, don't want to just drop a link uninvited."

**What to avoid:**
- Never post the same content across multiple subreddits same day.
- Never comment with a link and nothing else.
- Never argue with rule enforcement or mods, follow each sub's self-promo rules exactly.
- Never create a subreddit yet.

**How to mention Rostiro only when appropriate:** Only when the exact question being asked is the exact problem Rostiro solves, always disclosed as "I built this," never presented as a neutral third-party recommendation.

**10 helpful Reddit post ideas (genuinely useful, not disguised ads):**
1. "How do you all track injury news across multiple leagues?" (genuine discussion starter)
2. A real trade value breakdown for a specific, currently-debated player.
3. "What's your waiver priority strategy in points leagues vs. rotisserie?"
4. A post breaking down a real draft strategy (Zero RB, Late QB, etc.) with your own honest take.
5. "Commissioners: what's your biggest pain point running multiple leagues?"
6. A post reacting to real, current NFL news with fantasy implications, no product mention.
7. "What do you wish existed in Sleeper/ESPN/Yahoo but doesn't?"
8. A build-in-public post in a subreddit that explicitly allows self-promotion threads.
9. "How many leagues do you all actually play in? Curious how common 3+ is."
10. A genuinely useful weekly waiver wire breakdown, written from real research, no link.

**20 helpful Reddit comment templates (fill in the specific detail each time, never copy-paste verbatim):**
1. "For that matchup, I'd lean toward [X] because of [real reasoning], not just ADP."
2. "Worth checking [player]'s snap count trend before you bench them, that's usually the tell."
3. "If your league runs PPR, that changes this calculation quite a bit."
4. "That's a fair trade honestly, the value gap isn't as big as it looks on paper."
5. "I've had good luck prioritizing handcuffs over speculative WR3s in shallow benches."
6. "Commissioner tip: setting waiver deadlines to Wednesday morning instead of Tuesday night usually gets more participation."
7. "That injury designation usually means [realistic expectation], not automatically out."
8. "If you're running Zero RB, this is exactly the kind of pick that strategy is built for."
9. "Worth double-checking your league's exact scoring settings before assuming standard PPR math applies."
10. "That kind of workload share swing is usually real, not just a one-week blip."
11. "Bye week stacking is rough this year, worth checking your whole roster's bye distribution now."
12. "In dynasty specifically, that player's value skews younger than redraft rankings would suggest."
13. "I manage a few leagues myself and that's a real pain point, curious if others deal with it too."
14. "Depth chart order matters more than raw talent here honestly."
15. "That trade actually favors the other side slightly once you factor in positional scarcity."
16. "Worth setting a reminder for that waiver deadline specifically, it's easy to miss in a busy week."
17. "If you're in a superflex league, that QB's value is meaningfully higher than standard rankings show."
18. "I'd rather roster the boring, consistent option there than the high-ceiling gamble, depends on your risk tolerance though."
19. "That's a real injury concern worth monitoring, not a season-ending one based on what's been reported."
20. "Good question, curious what others do here too, I've tried a couple approaches myself."

---

## 11. Discord structure

**Categories and channels:**

```
WELCOME
  #welcome
  #rules
  #announcements

COMMUNITY
  #general
  #introduce-yourself
  #nfl-talk

FEEDBACK
  #bug-reports
  #feature-requests
  #beta-feedback

BUILD LOG
  #shipped-this-week
```

**Welcome message** (posted in #welcome, pinned):
> Welcome to Rostiro. This is the home for beta testers and early users. I'm Lawrence, I built this because managing multiple fantasy leagues was a mess. Check #announcements for updates, drop bugs in #bug-reports, and feature ideas in #feature-requests. Say hi in #introduce-yourself, genuinely glad you're here.

**Rules** (posted in #rules, pinned):
> 1. Be respectful, this is a small community.
> 2. Bug reports and feature requests go in their channels, not general chat.
> 3. No spam, no unrelated self-promotion.
> 4. Beta features may break, that's expected, tell us when they do.
> 5. Be honest, harsh feedback is welcome, it's how this gets better.

**Bug report template** (pinned in #bug-reports):
> **What happened:**
> **What you expected:**
> **Steps to reproduce:**
> **Platform (Sleeper/ESPN/Yahoo):**
> **Screenshot if you have one:**

**Feature request template** (pinned in #feature-requests):
> **What you want:**
> **Why it'd help:**
> **How often you'd use it:**

**Beta feedback template** (pinned in #beta-feedback):
> **What you tried:**
> **What worked:**
> **What didn't:**
> **Anything confusing:**

**Announcement format** (used in #announcements):
> **Shipped: [feature name]**
> [1-2 sentence plain-language explanation]
> [Screenshot or GIF]

**Early user roles:**
- `Beta Tester` — anyone who's connected a real league and used the product.
- `Founding 500` — real, verified Founding 500 purchasers (ties to the actual pricing tier).
- `Bug Hunter` — awarded manually for a genuinely useful bug report.

---

## 12. Product Hunt prep

**Tagline:** The operating system for fantasy football.

**Description:** Rostiro brings every fantasy league you're in, across platforms, into one place. One ranked queue of what actually needs your attention instead of five open tabs. The product itself reshapes around the fantasy calendar (draft, waivers, game day, film room) and escalates with your season, all the way to your league's real championship. Free to start.

**Maker comment (posted at launch):**
> Hey, I'm Lawrence, I built Rostiro. I play fantasy football across a handful of leagues and every Sunday looked the same: five tabs open just to know who was playing. Rostiro pulls every league you're in into one ranked list of what actually needs you, and the whole app reshapes itself depending on the day, draft mode, waiver mode, game day mode. It's live and free to start. Would genuinely love your feedback, I'm reading every comment today.

**Launch day checklist:**
- [ ] Product Hunt page fully built (gallery, tagline, description, maker comment) at least 48h before launch.
- [ ] Post launch day early (Product Hunt runs on a 12:01am PT cycle) — coordinate with a real supporter list ready to upvote/comment in the first hour.
- [ ] Founder available all day to answer every comment.
- [ ] Cross-post to X, LinkedIn, Instagram Stories, Discord the moment it's live.
- [ ] Prepared answers ready for the predictable questions (pricing, platform support, what makes this different from Sleeper/ESPN's own apps).

**Asset checklist:** Gallery images/GIFs (see Section 14), a launch-day thumbnail, at minimum one short demo video/GIF showing Pulse or Live Matchup Scoring in motion.

**GIF/video ideas:** Pulse queue scroll, Draft Copilot live reasoning, the T-83 Championship gold reveal (a strong, unusual visual for a PH gallery), Live Matchup Scoring ticking up in real time.

**First comment copy:** Same as the Maker comment above, posted immediately at launch.

**Supporter outreach copy** (DM/email to people asked to support):
> Hey, launching Rostiro on Product Hunt on [date]. Would mean a lot if you could check it out and leave honest feedback, upvote if you think it's worth it. Link goes live at [time].

**7-day pre-launch plan:**
- Day -7: Finalize PH page draft, start supporter outreach list.
- Day -5: Finalize gallery assets and maker comment.
- Day -4: Confirm supporter list, send outreach copy.
- Day -3: Cross-platform teaser posts begin (Section 5, Days 25-29).
- Day -2: Final page review, confirm launch time.
- Day -1: Final countdown post, remind supporters.
- Day 0: Launch, founder live all day answering comments.

---

## 13. Newsletter plan (Beehiiv)

**Name ideas:** *The Rostiro Rundown*, *Sunday Briefing* (matches Pulse's own "Mission Briefing" framing), *The Waiver Wire* (careful: generic, many fantasy newsletters already use this), recommend **"Sunday Briefing"** to reuse existing product language.

**Description:** Waivers, injuries, and what's new in Rostiro, before your Sunday gets complicated.

**Weekly sections:**
- **What's live** — real product updates shipped that week.
- **Waiver wire watch** — general fantasy content, not Rostiro-specific, genuine value.
- **Injury report** — real, current injury news roundup.
- **From the build log** — one honest founder note.

**First 5 issue ideas:**
1. "Why we built Rostiro" — origin story issue, sets the tone.
2. "What a League Health Score actually measures" — product education, standalone useful.
3. "Preseason waiver targets" — pure fantasy value, no product pitch beyond the footer.
4. "What Championship Mode means and how your bracket actually works" — ties T-83 to real bracket mechanics readers care about regardless of Rostiro.
5. "Week 1 is free. Here's what that actually means" — the real T-150 mechanic, explained honestly.

**Signup CTA copy:** "Get waivers, injuries, and what's new in Rostiro, every week. Free."

**How to connect newsletter content to the product:** Every issue's fantasy-value sections stand alone (real value even to someone who never signs up); the "what's live" section is the only place product news appears, always with a one-line, non-pushy link back.

---

## 14. Brand asset checklist

All colors/specs below are the real, existing brand kit values (`rostiro-brand-kit.md`) — nothing invented.

| Asset | Dimensions | Purpose | Priority |
|---|---|---|---|
| Logo (marketing, white wordmark) | SVG, scalable | All marketing surfaces, dark backgrounds | High — exists in-product, confirm exported as standalone marketing asset |
| Logo (light/navy wordmark) | SVG, scalable | Press kit, light surfaces | High |
| Favicon | 32x32, 16x16 | Browser tab | High — confirm current favicon matches brand kit's pulse-mark-only icon spec |
| App icon (standard, Standard-blue pulse) | 512x512 source, exported to platform sizes | Any future PWA install icon, social profile fallback | Medium |
| OG image (link preview) | 1200x630 | Link unfurls on X/LinkedIn/Discord/iMessage | High — `[PLACEHOLDER: confirm exists in app/opengraph-image or similar]` |
| X/Twitter banner | 1500x500 | X profile header | High |
| LinkedIn banner | 1128x191 | Company page header | Medium |
| YouTube banner | 2560x1440 (safe area 1546x423) | Channel header | Medium |
| Product Hunt thumbnail | 240x240 (gallery), 1270x760 (gallery images) | PH listing | High, needed before launch day |
| Discord server icon | 512x512 | Server branding | Medium |
| Instagram profile image | 320x320 (displays circular) | Profile | High |
| TikTok profile image | 200x200 (displays circular) | Profile | High |
| Brand colors | `#0D1B2A` navy, `#378ADD` blue, `#1D9E75` green, `#E24B4A` red, `#7F77DD` purple, `#F5C842` gold | All assets | Already defined, reuse exactly |
| Typography | Inter, weight 500 wordmark only, never 600/700 | All assets | Already defined |
| Press kit | PDF or web page, logo files + boilerplate + founder bio | Journalists/press requests | Medium, needed before any press outreach |
| Founder photo/headshot | High-res, real photo | LinkedIn, press kit, PH maker profile | High — `[PLACEHOLDER: needs a real photo, don't use a placeholder image publicly]` |
| Screenshot pack | Real, un-staged app screenshots, several per major feature | All social content | High, ongoing need |
| GIF pack | Short, looping screen recordings of Pulse, Draft Copilot, Live Matchup, T-83 reveal | Social, PH gallery | High |
| Demo video | 60-90s, feature walkthrough | Landing page, YouTube, PH gallery | Medium, before PH launch |
| Launch trailer | 30-60s, high-energy cut of real screens | Product Hunt launch day, X launch post | Medium, before PH launch |

---

## 15. SEO and AI search visibility plan

**Public FAQ ideas** (drive both Google and AI-assistant answer surfacing):
- "What is Rostiro?"
- "Does Rostiro work with Sleeper?" / "Does Rostiro work with ESPN?" / "Does Rostiro work with Yahoo Fantasy?" (answer honestly: Sleeper-first, others connect with fewer features today)
- "How much does Rostiro cost?"
- "Is Rostiro free?"
- "What is a League Health Score?"
- "What are Rostiro States?"

**Documentation-style pages worth having public:** a real, honest features page (already exists per the PRD, `app/features/page.tsx`), a pricing page, a "how it works" page.

**Schema recommendations:** `Organization` schema on the homepage, `FAQPage` schema on the FAQ content, `SoftwareApplication` schema on the features/pricing pages (real fields only, no fabricated ratings/review counts).

**Landing page copy sections to make sure exist and are crawlable (not JS-only rendered without SSR):** clear "what is Rostiro" statement above the fold, a real feature list, real pricing, a real FAQ block.

**Blog post ideas** (each doubles as SEO content and genuine fantasy value):
- "How to manage multiple fantasy football leagues without losing your mind"
- "What is a League Health Score and why does it matter"
- "Sleeper vs. ESPN vs. Yahoo fantasy football, what's actually different"
- "How fantasy football playoff brackets actually work"
- "The real cost of switching between fantasy apps every Sunday"

**Comparison pages** (only ones honestly defensible given what's real today): "Rostiro vs. checking Sleeper, ESPN, and Yahoo separately" — frame as a workflow comparison, not a false claim of feature-for-feature superiority over any single platform's own native app.

**Crawlable content recommendations:** ensure marketing pages server-render their text content (not client-only React state) so both traditional search crawlers and AI-answer-engine crawlers can read it directly.

**"What is Rostiro?" page copy (draft):**
> Rostiro is the operating system for fantasy football. It brings every league you're in, across platforms, into one place: one ranked list of what actually needs your attention, a health score for every team, and a product that reshapes itself around the fantasy calendar, from draft day through your league's real championship. Free to start.

---

## 16. Launch directory checklist

| Directory | Short description | Category | Angle | Assets needed | Best timing |
|---|---|---|---|---|---|
| Product Hunt | The operating system for fantasy football | Sports / Productivity | Primary launch, full push (Section 12) | Full gallery, maker comment | Main launch day |
| BetaList | Rostiro: one place for every fantasy football league you manage | Productivity / Sports | Pre-launch beta signal, waitlist growth | Logo, short description, 1 screenshot | 2-3 weeks before main launch |
| Uneed | Fantasy football command center across every league | Productivity tools | Discovery/credibility | Logo, description | Same window as BetaList |
| Microlaunch | Rostiro | Sports tech | Small, low-effort listing | Logo, 1-liner | Anytime pre-launch |
| Startup Fame | Rostiro | Sports / SaaS | Credibility listing | Logo, description | Anytime pre-launch |
| Indie Hackers | Building Rostiro: fantasy football's missing command center | Community post, not just a listing | Build-in-public story post, genuine, not a pitch | None required, text post | Ongoing, start now |
| Peerlist | Rostiro | Startup showcase | Builder-credibility listing | Logo, description | Anytime pre-launch |
| Hacker News (Show HN) | "Show HN: Rostiro, one place for every fantasy football league you manage" | Show HN | Technical-audience credibility, expect blunt feedback | Working live link, honest description | Time near Product Hunt launch, not the same exact day (avoid splitting attention) |

**Long-description template (reusable across most of the above):**
> Rostiro is the operating system for fantasy football. It connects every league you're in (Sleeper today, more platforms coming) into one account, with a ranked daily action list instead of five apps to check. The product reshapes itself around the real fantasy calendar, draft day, waiver day, game day, film room, and even escalates visually as your specific team advances through your league's real playoff bracket. Free to start; Pro unlocks unlimited leagues and full depth.

---

## 17. Repurposing workflow

**Every real feature ship becomes:**

1. 1 TikTok (screen recording + hook, per Section 7's script format).
2. 1 Instagram Reel (direct repost of the TikTok).
3. 1 YouTube Short (direct repost of the TikTok).
4. 5 X posts (1 announcement + 4 drawn from the relevant content-bank category in Section 8, adapted to the specific feature).
5. 1 LinkedIn post (the "why this decision was made" angle, more technical/founder-voice).
6. 1 GIF (for Product Hunt gallery updates or the landing page).
7. 1 Reddit discussion idea (only used if a genuine, non-promotional opening exists that week — see Section 10).
8. 1 Newsletter section slot ("What's live" section, Section 13).

**Reusable template (fill in per feature):**

```
FEATURE: [name]
ONE-LINE PLAIN DESCRIPTION: [no jargon, what does it actually do]
SCREEN RECORDING: [captured? Y/N]

TikTok hook: [from Section 7 style]
X announcement post: [from Section 8 "Feature reveals" style]
X supporting posts (4): [pick from relevant categories]
LinkedIn angle: [why this decision, what problem it solves]
GIF: [10-15s loop of the feature in action]
Reddit opening (if any): [only if genuinely relevant that week]
Newsletter line: [1-2 sentences, "What's live" section]
```

---

## 18. Founder voice guide

**Voice for Lawrence, across every channel:**

- Direct. Say the thing plainly, don't wrap it in marketing language.
- Helpful first. Every post should be useful or honest before it's promotional.
- Slightly funny, never forced. Humor comes from real, relatable annoyance (Sunday chaos), not jokes for their own sake.
- Product-obsessed. It's fine, even good, to nerd out about a real technical decision.
- Fantasy-football-native. Write like someone who actually plays, not like someone marketing to people who play.
- Honest. If something's broken, say so. If a feature is Sleeper-only today, say so.
- Not corporate. No "we're thrilled to announce," no "synergy," no team-of-one pretending to be a department.
- Not fake-viral. No manufactured urgency, no "this is going to change everything."
- Not cringe. No forced trend participation, no meme formats that don't fit.

**Avoid entirely:**
- Generic SaaS language ("game-changing," "seamless," "unlock your potential").
- Overhyped claims ("revolutionary," "the future of fantasy football").
- Fake urgency ("only 3 spots left" when it isn't true).
- Spammy Reddit behavior (link-and-run comments, cross-posting identical text).
- Empty motivational posts with no real content behind them.

**Quick gut check before posting anything:** would a real fantasy football manager who plays in 4 leagues actually find this useful, funny, or interesting, on its own, even if they never sign up?

---

## 19. Final action plan

### Create today
- Claim X, TikTok, Instagram, and Discord (the four hardest to recover if squatted).
- Set up the Discord server structure (Section 11).
- Start the waitlist/signup capture if not already live.

### Create this week
- Finish account setup checklist (Section 2) fully.
- Write and schedule bios (Section 3) across every claimed platform.
- Post the pinned/intro posts (Section 4).
- Begin the 30-day content calendar (Section 5), Day 1.
- Start the screenshot and GIF asset pack (Section 14) — this feeds almost everything else.

### Create before launch (Product Hunt / Week 1)
- Full brand asset checklist (Section 14) complete.
- Product Hunt page fully built and supporter list ready (Section 12).
- Newsletter first issue drafted and ready near Day 20-25 of the calendar.
- Demo video and launch trailer produced.
- Press kit assembled if any press outreach is planned.

### Delay until later
- Facebook Page and Group (Tier 3, hold until Discord proves the community model).
- Full newsletter cadence beyond the first few issues (start small, prove the format).
- Any paid promotion/ads (explicitly out of scope for this phase per the brief).
- Longer-form YouTube content beyond Shorts.

### Highest-leverage 10 actions before NFL season
1. Claim TikTok, X, Instagram, Discord today.
2. Start the screenshot/GIF asset pack immediately, it feeds every other channel.
3. Post the founder-story pinned posts on X and LinkedIn this week.
4. Begin daily X posting and 3-5x/week TikTok immediately, don't wait for "perfect" content.
5. Build the Discord server now, even empty, so early signups have somewhere real to land.
6. Start Reddit value-first participation now, credibility compounds slowly, start the clock early.
7. Time the T-83 Championship reveal clip and the Week 1 free-access clip specifically for maximum relevance (real playoff weeks, real Week 1 dates).
8. Lock the Product Hunt launch date and start the 7-day plan (Section 12) with real lead time.
9. Get the founder headshot and press kit done now, before any press or PH outreach needs it.
10. Start collecting waitlist signups everywhere immediately, every post should have somewhere real for interest to land.
