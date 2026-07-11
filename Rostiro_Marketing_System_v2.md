# Rostiro External Marketing System v2.0

**Supersedes `Rostiro_Marketing_System_v1.md`** (July 7, 2026), which assumed marketing meant *filming reality*. This version is built around a capability that didn't exist when v1 was written: the **Simulation Studio** (PRD T-157–T-161) — an in-product video factory that lets us manufacture faithful, on-brand Rostiro moments on demand, capture them in both 16:9 and 9:16, and ship them everywhere. That flips the whole model. In v1, content production was the bottleneck (the video shotlist was deferred because it "required the founder to film"). In v2, **volume is the strategy**.

**First posting day: July 13, 2026.** NFL regular-season Week 1 opens **Wednesday, September 9, 2026** (per PRD T-151). Preseason runs across August. That gives us roughly **8 weeks of pre-season runway** to build audience, trust, and a repeatable content machine before real conversion pressure arrives.

**Phase goal (unchanged from the founder brief):** awareness, trust, early signups/beta, make the product feel real in public, and build repeatable content systems for launch season. **Not** a paid-conversion push yet.

---

## Readiness gates — confirm before the relevant content runs

These are the only claims in this plan written as if already true. Hold the dependent content until each is real, so this stays an honest plan.

1. **Stripe/billing must be live before any pricing, Founding 500, or "capped at 500" scarcity content posts.** Until then, reframe those beats as "join the waitlist / want early access" instead of a live-purchase claim. (PRD T-85 — verified in test mode; go-live checklist at `docs/T85_STRIPE_GO_LIVE.md`.)
2. **Live cross-league win-probability (T-162) is real in code but its migration isn't applied and it hasn't been verified against a live game.** The **Simulation Studio** may depict it freely — that's what the Studio is for, and its dramatized "+X%" framing is a labeled editorial choice. But do **not** post "this is live in your app right now" until `migration_interrupt_metrics.sql` is applied and it's confirmed firing on a real Sunday.
3. **Championship / playoff-bracket content holds** until it's fired against a real playoff week (carried from v1 — no league has reached a real bracket yet).
4. **Demo fixtures are currently real 2024 data** (anchor week 8), pending a 2025 swap. Every number in a Studio clip is a real NFL number — say "real NFL data," never imply it's this-second-live unless it is.

Everything else — Pulse, Health Score, Draft Copilot, Trade Analyzer, Live Matchup Scoring, LIVE second-screen companion, Notes, the Interrupt Stack, the five States, the free-Pro-week mechanic — is shipped and confirmed working.

---

## 0. Product audit — the source of truth for every claim below

Say only what's real. From the PRD as of v5.8:

**What Rostiro is:** the operating system for fantasy sports. One command center for **every** league a manager runs, across Sleeper / Yahoo / ESPN. Positioning line: **"Run Every League."**

**Real, shipped surfaces we can show on camera:**
- **Pulse** — the daily decision feed. "Here's what actually needs you today," across all your leagues, ranked.
- **Health Score / League Health** — a real computed score per league/roster.
- **Draft Copilot** — live draft assistant (full pre-fetched reasoning on Pro; deterministic candidate order on Free).
- **Trade Analyzer** — blended ADP + real in-season points valuation, with written reasoning; save-a-trade to Notes.
- **Live Matchup Scoring + LIVE second-screen companion tab** — real fantasy scoring on game day.
- **The Interrupt Stack** — the one-slot transient card that fires on a touchdown swing, lineup lock, etc.
- **Cross-league live win-probability on the interrupt card** (T-162) — *see gate #2*.
- **The five States** — Standard, Draft, Waiver Day, Game Day, Film Room — the OS reshapes itself by moment.
- **Film Room** — weekly recap surface.
- **Free "Pro week"** — every free user is unlocked for Week 1 (Sept 7 → Sept 15), then a single deliberate upgrade moment.

**Production tooling (ours, not user-facing):** `/demo` self-playing tour, `/features` live in-page demos, and the gated **Simulation Studio** at `/demo/studio` — author any state's moment, real prefill + full editorial override, 16:9 / 9:16 capture.

**Anti-claims (never post):** "win your league," "dominate fantasy," "next-gen/revolutionary platform." Rostiro doesn't replace ESPN/Yahoo/Sleeper — it sits on top of all of them. Never promise a feature that isn't in the list above.

---

## 1. The Rostiro Studio Content Engine (the core system)

This is the single most important section. Everything downstream is a distribution problem once this runs.

**The factory, one loop:**

```
1. PICK A MOMENT     A touchdown swing, a waiver alert, a Film Room recap,
                     a LIVE Sunday, a news reaction, a pain-point scene.
2. AUTHOR IT         In /demo/studio: real player + real data prefill,
                     then full editorial override (names, numbers, labels,
                     captions) to say exactly what this clip needs to say.
3. CAPTURE BOTH      Record the canvas in 9:16 (IG/TT/Shorts) AND 16:9
                     (X GIF, YouTube, landing page, PH).
4. DRESS IT          Hook text (first 1.5s), caption, CTA, sound.
5. DISTRIBUTE        Same 9:16 clip → IG Reel + TikTok + YT Short.
                     16:9 cut → X (as GIF/clip when it helps) + site.
                     Text take → X → mirror to Threads + Bluesky.
```

**Why this wins:** a solo founder can produce a week of cross-platform video in a single afternoon sitting, because the expensive part (a real, faithful product surface doing something dramatic) is generated, not filmed, not edited from scratch, and deterministic — it looks the same every take, so it's screen-recordable and re-shootable.

**What the Studio can render today (clip inventory the engine draws from):**
- **Interrupt / touchdown moment** with cross-league win-prob rows (author the leagues, the play label, the numbers).
- **Waiver Day "Mission Briefing"** surface + focal card.
- **Film Room weekly recap** surface + focal card.
- **LIVE second-screen companion Sunday** — a compressed ~25s highlight loop, points ramping, TDs flashing, scores swinging, authorable via `LiveScenario`.
- **Standard-state Pulse** decision feed.
- **Kickoff transition** — Standard → Game Day sweep with the `MISSION CONTROL` pill.

**Batching target:** one **Studio session = 8–12 finished 9:16 clips.** That's 1.5–2 weeks of IG/TT/Shorts inventory per sitting. Two sessions a week keeps every video channel fed with margin.

**The honesty contract (non-negotiable, inherited from the Studio specs):** real player identities and real data; any override (custom league name like "Bench Regret FC," a dramatized "+18%," compressed game timing) is **editorial and stays inside the Studio's marketing frame** — we never present an authored number as a live user's real result. Marketing that lies is a bug. This is also a *feature* of the story: "every number you see is a real NFL number."

---

## 2. The Content Honesty Contract (say this out loud, it's a differentiator)

The fantasy space is full of hype accounts. Our edge is calm competence. Three rules that double as brand:

1. **Real data, labeled dramatization.** Studio clips use real NFL numbers; pacing/《+X%》framing is a dramatized highlight, and we're fine saying so. Never imply a live pipeline that isn't wired.
2. **Never post a feature that isn't shipped.** The audit list above is the ceiling. If it's not there, it's "coming," not "here."
3. **Product-anchored takes only.** Every news reaction lands *through* a Rostiro surface — "here's how this hits your three leagues" — not a naked hot take we'd have to defend as analysts. We're not competing to be the best FF predictor; we're showing what it feels like to run every league in one place.

---

## 3. Channel model & roles

The structural decision that shapes everything: **the same vertical video ships to IG + TikTok + YT Shorts; X is the text desk.**

| Channel | Role | Format | Cadence (sustainable ceiling) |
|---|---|---|---|
| **Instagram (LEAD)** | Primary video growth engine — best algo for a zero-audience cold start | 9:16 Reels (Studio clips, reaction memes, news), Stories on Sundays, occasional carousel | 1 Reel/day target, 4–6/week floor |
| **TikTok** | Same videos as IG, parallel reach | Identical 9:16 clips | Same clips, same days |
| **YouTube Shorts** | Same videos again, search longevity | Identical 9:16 clips | Same clips, batched upload |
| **X / Twitter (TEXT DESK)** | News, takes, build-in-public, threads, founder voice. Home of the "News Desk." Clips/GIFs only when they add to a take | Text-first; 16:9 GIF optional | 1–3 posts/day |
| **Threads** | Mirror of X text | Cross-post | Mirror |
| **Bluesky** | Mirror of X text | Cross-post | Mirror |
| **LinkedIn** | Founder story, credibility, hiring/investor signal | Founder posts + occasional clip | 2/week |
| **Reddit** | Value-first presence in FF communities. No subreddit, no spam | Helpful comments/posts, Rostiro only when genuinely relevant | Ongoing, organic |
| **Discord** | Community home: bugs, requests, beta, announcements | Server | Standing |
| **Product Hunt + directories** | Launch credibility | One-time launch push | Timed to launch |
| **Newsletter (Beehiiv)** | Later; weekly FF value + product | Email | Start ~Aug |

**Same-clip-everywhere** (IG/TT/Shorts) and **same-text-everywhere** (X/Threads/Bluesky) is the whole efficiency play. Never hand-craft per platform except the caption tweak and the vertical-vs-landscape cut.

**Why IG leads:** stated by the founder — with no existing audience, IG's current discovery (Reels) is the strongest cold-start surface. We optimize the clip for IG first (hook in 1.5s, on-screen text legible at a glance, trending-adjacent sound), then it works as-is on TT and Shorts.

---

## 4. Content pillars (7)

Each pillar: what it is, best channels, example hook, the Studio asset behind it.

**1. Viral Moment, Visualized (HERO).** The Sunday feeling — a touchdown fires, the interrupt card shows your win-prob move *across every league at once*. The single clearest "why Rostiro exists" in one clip.
- Channels: IG/TT/Shorts (hero), X GIF.
- Hook: *"Your RB just scored. Here's what it did to all 4 of your leagues at once."*
- Asset: Studio interrupt moment + cross-league win-prob rows.

**2. The News Desk.** Product-anchored preseason/FF takes at volume (see §5). The daily engine.
- Channels: IG/TT/Shorts clip + X text take.
- Hook: *"[Player] just [news]. If you roster him in even one league, here's your Tuesday."*
- Asset: authored Pulse card / interrupt / Film Room recap reacting to the news.

**3. Reaction Memes, In-Product.** Meme-format reactions built *inside* Rostiro surfaces — the native IG/TT format. The joke *is* the product state (e.g. a Waiver Day "Mission Briefing" that reads like a heist; a Film Room recap of a blowout loss).
- Channels: IG/TT/Shorts.
- Hook: relatable pain, punchline is a real Rostiro screen.
- Asset: Studio Waiver Day / Film Room / interrupt with edited copy.

**4. Sunday Chaos / Multi-League Pain.** The core positioning from the brief: no more ten tabs on Sunday; every roster, matchup, injury, score in one place.
- Channels: IG/TT/Shorts + X.
- Hook: *"Managing 5 fantasy teams on Sunday shouldn't require 10 open tabs."*
- Asset: the unified Pulse feed; kickoff sweep.

**5. Founder & Build-in-Public.** Balanced founder presence. The origin story is the hero (see §6). Plus honest building-in-public: what shipped this week, what broke, what's next.
- Channels: X (home), LinkedIn, occasional IG clip.
- Hook: *"I tore my Achilles the night the Knicks won the title. Then I built a fantasy app."*
- Asset: founder on camera + Rostiro screen inserts.

**6. Feature Reveals / Product Education.** How each surface actually works — Draft Copilot, Trade Analyzer, Health Score, LIVE companion.
- Channels: IG/TT/Shorts + X thread.
- Hook: *"Rostiro's Trade Analyzer stopped valuing players on ADP after Week 3. Here's what it uses instead."*
- Asset: Studio state or a real screen recording of the feature.

**7. Beta / Community.** Waitlist asks, Discord invites, "reply if you manage 3+ teams," early-user shoutouts.
- Channels: all, soft CTA.
- Hook: *"Looking for 50 people who run 4+ leagues to break this before Week 1."*
- Asset: Pulse screenshot + Discord link.

---

## 5. The News Desk workflow (the semi-news-outlet, at scale)

This is the daily volume driver from July 13 through the season. It turns the firehose of preseason + FF news into a steady stream of product-anchored clips **faster than any pure-analyst account can, because our take renders as a product moment.**

**The 15-minute loop (repeatable, batchable):**

```
1. SPOT      A real news item (injury, depth-chart move, preseason
             standout, trade, beat-reporter note). Sources: NFL beat
             writers, r/fantasyfootball, Rotoworld/PFF headlines.
2. ANGLE     One product-anchored sentence: "how does this hit a
             manager who rosters him in one/several leagues?"
3. AUTHOR    Build it in /demo/studio as the fitting surface:
               - roster/injury news  -> Pulse decision card
               - big-play/preseason  -> interrupt/LIVE moment
               - week-in-review      -> Film Room recap
             Real player, real prior data; the take is the caption.
4. CAPTURE   9:16 for IG/TT/Shorts.
5. SHIP      Clip + caption to IG/TT/Shorts; a sharper text-only take
             to X (mirror Threads/Bluesky). Soft CTA.
```

**Volume math:** a single Studio sitting can bank 8–12 news-desk clips against a slate of headlines, scheduled out across the week. That's the "quickly, volume, at scale" the founder wants, without ever filming.

**Preseason as fuel (August):** preseason games are content gold — everyone's speculating, nobody knows anything, and every rookie/depth-chart rep spawns a take. Author a "preseason standout" LIVE moment or a Pulse "watch this guy" card. **Honesty:** preseason "results" in the Studio are authored (real identities + your typed numbers, dramatized timing) — frame as *"if this preseason rep is real, here's your Rostiro Tuesday,"* never as a live preseason data feed. Mark specific games/dates **[confirm]** and drop in the real slate.

**Guardrails:** product-anchored only (gate §2.3); never a bold predictive call we'd have to defend; if a take would embarrass us if the player busts, reframe it as "here's how you'd *see* it in Rostiro," not "he's a league-winner."

---

## 6. Founder story & build-in-public

**The origin hero (film this first, it's your best cold-start asset):**
> "I tore my Achilles celebrating the Knicks' first championship in 53 years — three minutes after they actually won it, sprinting up the street with a crowd of strangers. Then I sat on my couch for months and built the fantasy app I always wanted."

Why it works: it's true, it's specific, it's a little funny, it's not a SaaS origin story, and it earns the product. It's the anti-"revolutionary platform" opener. Cut it three ways:
- **60–90s founder talking-head** (LinkedIn + pinned X thread + IG).
- **20s hook version** for IG/TT/Shorts (the sprint → the tear → cut to Rostiro).
- **Text thread** on X (the story, then "here's what I built and why").

**Build-in-public cadence (X-forward):** 2–3x/week — what shipped, what broke and how you fixed it, a real screenshot, an honest metric. The PRD is a goldmine of honest build stories (the PKCE confirmation bug, the RLS deny-all founder-feedback bug, the trial-timing rethink, the cross-league win-prob honesty decision). These humanize the product and signal seriousness to engineers/investors without a pitch.

**Balance:** founder appears for the origin story, major reveals, and build-in-public text. The *volume* stays product/screen-first so the machine never depends on you filming yourself daily.

---

## 7. Production workflow & batching

**One Studio session (target 90 min → 8–12 clips):**
1. Open `/demo/studio` (dev or `?studio=true`).
2. Pull the week's headline list + pillar mix (aim: ~40% News Desk, ~25% Viral Moment/Reaction, ~20% Product/Sunday-chaos, ~15% Founder/community).
3. For each: pick state → author content → set 9:16 → capture (screen record; deterministic, so re-take freely) → also grab a 16:9 pass for the best 2–3.
4. Dump raw captures into a dated folder.

**Post-capture (batch, ~60 min):**
5. Add hook text + caption + CTA (template in §17). Legible-at-a-glance on-screen text; hook in first 1.5s.
6. Schedule: IG/TT/Shorts via a scheduler; X takes queued separately.

**Tooling to set up once:** a screen recorder with clean 9:16/16:9 framing (the Studio's aspect toggle does the framing; you just record the canvas), a scheduler (Buffer/Later/Metricool — pick one), and a shared clip library folder (dated).

**Rhythm:** 2 Studio sessions/week (e.g. Mon + Thu) = full IG/TT/Shorts coverage with a buffer. X runs daily off the News Desk + build-in-public, no session required.

---

## 8. Repurposing matrix (1 moment → N posts)

| Source | Becomes |
|---|---|
| **1 Studio 9:16 clip** | IG Reel + TikTok + YT Short (identical) |
| **1 Studio 16:9 cut** | X GIF/clip + landing-page asset + PH gallery |
| **1 News item** | 1 clip (above) + 1 X text take + Threads/Bluesky mirror |
| **1 feature reveal** | 1 clip + 1 X thread + 1 LinkedIn post + 1 Reddit-relevant comment when apt |
| **1 founder story** | talking-head (LI/IG) + 20s hook (IG/TT/Shorts) + X thread |
| **1 build-in-public win** | X post + LinkedIn + Discord announcement + newsletter bullet |

Rule: no asset gets made for one channel. Every capture has at least a vertical life and a text life.

---

## 9. Account setup & handles

Claim/confirm **@rostiro** everywhere; fallbacks if taken: `@rostiroapp`, `@getrostiro`, `@rostiro_app` (keep it consistent across platforms once chosen).

**Claim today (hardest to recover if squatted):** TikTok, Instagram, X, YouTube, Discord.
**This week:** Threads, Bluesky, LinkedIn company page, Reddit account (personal, founder), Product Hunt (maker), Beehiiv.
**Later:** Facebook Page/Group (hold until Discord proves the model), GitHub org.

*(Tactical per-platform setup steps carry over unchanged from `Marketing_System_v1.md §2` — still valid.)*

---

## 10. Bios & profile copy

Short, product-specific, no hype. "Run Every League." as the through-line.

- **X (160):** `Run every fantasy league from one command center. Sleeper + Yahoo + ESPN, one Sunday console. Building in public. Early access ↓`
- **Instagram:** `The operating system for fantasy football 🏈` / `Every league. One place. No more 10 tabs on Sunday.` / `Early access ↓`
- **TikTok:** `Run every fantasy league from one place. Real Sundays, one console.`
- **YouTube:** `Rostiro is the operating system for fantasy sports. Run every league from one command center — Sleeper, Yahoo, ESPN, one Sunday.`
- **Threads / Bluesky:** same as X.
- **LinkedIn (company):** `Rostiro is the operating system for fantasy sports. One command center for every league a manager runs — across Sleeper, Yahoo, and ESPN. Pulse tells you what needs you today; the OS reshapes itself for draft day, waivers, and Sunday.`
- **Product Hunt:** `One command center for every fantasy league you run.`
- **Discord description:** `The Rostiro community — bugs, feature requests, beta access, and Sunday chaos. Run every league.`
- **Beehiiv:** `Weekly fantasy signal for people who run more than one league. Waivers, injuries, and what actually needs you — plus what we're shipping.`

---

## 11. Pinned / intro posts

- **X pinned (thread):** the founder origin story (§6) → "so I built Rostiro: run every fantasy league from one command center" → 1 hero clip → "early access ↓".
- **LinkedIn intro:** founder-story long-form, credibility framing (what it is, why it's serious, what's shipped).
- **Threads/Bluesky:** short version of the X pin.
- **Reddit (founder profile, not a post yet):** just be a helpful FF person first; no launch post until there's a genuine "I built this, want feedback" moment.
- **Discord welcome:** what Rostiro is, how to report a bug / request a feature / get beta access, house rules.

---

## 12. The phased launch calendar

Three phases. Treat daily cadences as a **ceiling, pulled from as a menu** — a quieter honest rhythm beats posting before something's real.

### Phase 1 — Cold start & origin (Jul 13 → Jul 26, day-by-day)

Goal: exist, plant the origin story, prove the clip machine, seed the News Desk. Soft CTA everywhere = waitlist.

| Day | Date | Lead post (IG/TT/Shorts unless noted) | X (text desk) |
|---|---|---|---|
| 1 | Sun Jul 13 | **Origin hook clip** (20s Achilles→Rostiro) | Pin the origin thread |
| 2 | Mon Jul 14 | **Viral Moment hero** — touchdown → cross-league win-prob | "Why I'm building this" build-in-public post |
| 3 | Tue Jul 15 | **Sunday Chaos** — 10 tabs vs one Pulse | News Desk take #1 |
| 4 | Wed Jul 16 | **News Desk** clip | News take + build-in-public screenshot |
| 5 | Thu Jul 17 | **Reaction meme** (Waiver Day heist framing) | News take |
| 6 | Fri Jul 18 | **Feature reveal** — Pulse ("what needs you today") | Thread: how Pulse ranks your day |
| 7 | Sat Jul 19 | **News Desk** clip | Light Saturday take + waitlist ask |
| 8 | Sun Jul 20 | **LIVE companion Sunday** highlight loop | "This is what our Sunday looks like" |
| 9 | Mon Jul 21 | **News Desk** (weekend news) | Build-in-public: what shipped |
| 10 | Tue Jul 22 | **Feature reveal** — Trade Analyzer (post-Week-3 blend) | Thread on the ADP→points blend |
| 11 | Wed Jul 23 | **Reaction meme** (Film Room blowout recap) | News take |
| 12 | Thu Jul 24 | **News Desk** clip | News take |
| 13 | Fri Jul 25 | **Sunday Chaos / multi-league pain** | Founder thought + waitlist |
| 14 | Sat Jul 26 | **Best-of re-cut** of week's top clip | Recap week + beta ask |

Also Phase 1: build the Discord (even empty), start value-first Reddit participation, LinkedIn origin post (Day 1–2), begin the screenshot/GIF asset pack, stand up the waitlist landing so every post has somewhere to send interest.

### Phase 2 — Preseason News Desk ramp (August)

Preseason is the engine's peak fuel. Cadence: **1 clip/day IG/TT/Shorts + 1–3 X takes/day**, ~40% News Desk. Anchor to the real preseason slate **[confirm dates/matchups]**:
- **HOF Game week (late July/early Aug) [confirm]** — first "preseason standout" LIVE moment.
- **Preseason Weeks 1–3 [confirm]** — daily News Desk on rookies/depth charts/injuries; "watch this guy" Pulse cards.
- Feature-reveal cadence 1–2/week (Draft Copilot as real drafts approach, Health Score, LIVE companion).
- Founder build-in-public 2–3/week.
- **Product Hunt prep** starts mid-August (7-day plan below), targeting a launch window that rides the pre-Week-1 attention peak.
- Newsletter issue #1 drafts (~mid-Aug).

### Phase 3 — Week 1 tie-in (Sep 7 → Sep 15)

The product's own free-week mechanic *is* the marketing beat. Every free user is unlocked **Mon Sep 7 → Tue Sep 15** (PRD T-150/T-151); Week 1 opens **Wed Sep 9**.
- **Sep 7–8:** "Everyone gets Rostiro Pro free for Week 1" clip + X thread (only if Stripe/promo window is live — gate §1).
- **Sep 9–14:** live-Sunday content — LIVE companion clips, interrupt-moment clips, real Sunday-chaos-solved posts. This is when the Viral Moment pillar and (if T-162 is verified live) real cross-league win-prob shine.
- **Sep 15 (the upgrade moment):** honest "here's what you had this week — keep it" content, aligned to the in-app upgrade gate. Conversion push begins *here*, not before.

---

## 13. Short-form script bank (Studio-native)

Format for each: **Hook (0–1.5s) / Visual (Studio asset) / On-screen text / Caption / CTA.** Reuse identically across IG/TT/Shorts.

1. **Origin.** Hook: "I tore my Achilles for the Knicks." Visual: founder → cut to Rostiro. OST: "then I built this." CTA: early access.
2. **Cross-league TD.** Hook: "Your RB scores. Watch all 4 leagues move." Visual: interrupt + win-prob rows. CTA: waitlist.
3. **10 tabs.** Hook: "My Sunday, last year." Visual: chaos → one Pulse. OST: "vs my Sunday now." CTA: waitlist.
4. **Waiver heist.** Hook: "Waiver day is a heist." Visual: Waiver Day Mission Briefing. CTA: reply if you run 3+ leagues.
5. **Film Room L.** Hook: "When you lose by 2." Visual: Film Room recap. CTA: soft.
6. **Trade Analyzer.** Hook: "ADP is useless after Week 3." Visual: Trade Analyzer blend. CTA: thread on X.
7. **Draft Copilot.** Hook: "It's the 9th round and you're frozen." Visual: Copilot reasoning. CTA: waitlist.
8. **Pulse.** Hook: "What actually needs you today?" Visual: ranked Pulse feed. CTA: waitlist.
9. **LIVE Sunday.** Hook: "Second screen for every league at once." Visual: LIVE companion loop. CTA: waitlist.
10. **News Desk template.** Hook: "[Player] just [news]." Visual: authored Pulse/interrupt. Caption = the product-anchored take. CTA: soft.
11–20. **News Desk variants** across injury / depth-chart / preseason-standout / trade / bye-week / target-share / snap-count / rookie-debut / handcuff / streaming-defense angles — same template, different headline.

*(Additional evergreen scripts from `Marketing_System_v1.md §7` remain usable where they don't imply filming.)*

---

## 14. X take & news bank (text desk)

**Voice: direct, helpful, a little funny, fantasy-native, honest. No em dashes on X. No hype.** Categories:

**Build-in-public**
- "Shipped today: a touchdown in one league now shows your win-prob move in every league at once. One screen. Fixed the honest version, not the flashy fake one."
- "Spent today killing a bug that silently broke every signup confirmation email for weeks. Nobody noticed because nobody had clicked one yet. Fun."
- "Rostiro reshapes itself for draft day, waiver day, and Sunday. Same app, different console. Building the Sunday one now."

**Multi-league pain**
- "Managing 5 fantasy teams should not require 10 browser tabs and a spreadsheet."
- "You do not have a lineup problem. You have a 'which of my 6 leagues am I even looking at' problem."
- "Every fantasy app is built like you play in one league. Nobody plays in one league."

**News Desk takes (product-anchored)**
- "[Player] news. If you roster him in even one league you already know your Tuesday. If you roster him in three, you need to see all three in one place."
- "Preseason take: nobody knows anything, which is exactly why you want one screen watching all your rosters instead of ten."

**Founder thoughts**
- "I did not build this to win my league. I built it because I could not keep track of my leagues."
- "The fantasy space rewards loud predictions. I would rather build the calm screen you actually check on Sunday."

**Waitlist / beta**
- "Looking for people who run 4+ leagues to break Rostiro before Week 1. Reply and I will get you in."
- "Want early access? Reply 'Rostiro' or grab the waitlist link in bio."

*(Scale to 100 by templating the News Desk category against the live headline stream. Full v1 bank at `Marketing_System_v1.md §8` remains a source, minus any pricing claims until gate §1.)*

---

## 15. IG / TikTok clip catalog (ranked to shoot first)

Ranked by leverage for a cold start. Shoot the top 10 in your first two Studio sessions.

1. Origin hook (20s) · 2. Cross-league TD win-prob · 3. 10-tabs Sunday chaos · 4. LIVE companion Sunday loop · 5. Waiver Day heist reaction · 6. Pulse "what needs you today" · 7. Trade Analyzer post-Week-3 blend · 8. Film Room blowout reaction · 9. Draft Copilot frozen-pick · 10. News Desk (first real preseason headline) · 11–20. News Desk variants (see §13) · 21+. Feature reveals + build-in-public inserts.

Each entry produces one 9:16 (IG/TT/Shorts) and, for the top 3, a 16:9 for X/site/PH.

---

## 16. Reddit strategy

Unchanged in principle from v1 (`§10`): **helpful fantasy player first, founder second.** Participate in r/fantasyfootball, r/DynastyFF, r/FFCommish, r/SleeperApp. No subreddit yet. No spam. Mention Rostiro only when it genuinely answers the question. Start now — credibility compounds slowly. Value-first comment/post templates carry from `Marketing_System_v1.md §10`.

---

## 17. Discord, Product Hunt, Newsletter, Directories

- **Discord** — structure, welcome message, bug/feature/beta templates carry from `Marketing_System_v1.md §11`. Stand it up now, even empty.
- **Product Hunt** — tagline "One command center for every fantasy league you run," 7-day plan and asset checklist from `§12`; **time launch for the mid/late-August pre-Week-1 attention peak** and gate any pricing on §1. Now we also have real Studio clips for the PH gallery (v1 didn't).
- **Newsletter (Beehiiv)** — start ~August; weekly signal (waivers, injuries, "what needs you," what shipped). Plan from `§13`.
- **Launch directories** — BetaList, Uneed, Microlaunch, Startup Fame, Indie Hackers, Peerlist, Show HN. Copy/angles from `§16`.

**Caption/CTA template (use on every clip):**
```
HOOK (first line, the take or the pain)
1–2 line payoff tied to the Rostiro surface shown
Soft CTA: "Run every league. Early access in bio." / "Reply if you run 3+ leagues."
Hashtags: #fantasyfootball #NFL + 2 niche (#dynastyff / #sleeperapp) — IG/TT only
```

---

## 18. Brand assets — delta from v1

Most of the hard SEO/brand work is already done (PRD T-155: OG image, sitemap, robots, schema, `/pricing`, `llms.txt`; social banners exist in `Social Media/`). **Remaining before launch:**
- Founder headshot / origin-story B-roll (needed for §6 and any press).
- A clip library folder + naming convention (feeds everything).
- YouTube channel banner (reuse brand tokens).
- Product Hunt thumbnail + gallery (now sourced from Studio clips).
- Press kit (assemble once, if any outreach planned).

SEO/AI-search: largely shipped (T-155). Remaining from v1 `§15`: a blog (needs a content system), Search Console verification, `sameAs` once handles are claimed, comparison/"how it works" pages.

---

## 19. Founder voice guide

Direct, helpful, slightly funny, product-obsessed, fantasy-native, honest, not corporate, not fake-viral, not cringe. Avoid generic SaaS language, "revolutionary," fake urgency, spammy Reddit behavior, empty motivation. On X: no em dashes. The origin story sets the register — real, specific, self-aware, earns the product instead of hyping it.

---

## 20. Highest-leverage 10 actions (do these first)

1. **Claim TikTok, IG, X, YouTube, Discord today** (@rostiro or the chosen fallback).
2. **Film the origin story** (§6) — your single best cold-start asset. Cut the 20s hook + the thread.
3. **Run your first Studio session** — bank the top 10 clips from §15. Prove the machine.
4. **Post Day 1 (Jul 13):** origin hook clip + pin the X origin thread.
5. **Stand up the waitlist landing + Discord** so every post has somewhere real to land.
6. **Start the News Desk** — one product-anchored take/clip per real headline, daily. This is the volume engine.
7. **Begin value-first Reddit** now — the clock on credibility starts slow.
8. **Set up the scheduler + clip library** so IG/TT/Shorts posting is one action, not three.
9. **Lock the Product Hunt date** for the mid/late-August peak; start the 7-day plan with lead time.
10. **Keep it honest** — respect the gates (§1). Post nothing before it's real; label every dramatization.

---

*Rostiro Marketing System v2.0 — July 2026*
*Built around the Simulation Studio content engine. Supersedes v1.*
*Run Every League. — rostiro.com*
