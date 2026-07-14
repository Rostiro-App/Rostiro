# Rostiro Marketing Tool Stack & Operator Runbook v1.0

**Companion to `Rostiro_Marketing_System_v2.md`.** That doc is the *strategy* (what to post, why, when). This doc is the *machine* (what tools to use, how to set each one up, and the exact button-by-button workflow to run every day and every week). It exists because the founder is stronger at building than distribution — so distribution is treated here as a system with a manual, not a talent.

**Written for a solo operator.** Every instruction assumes one person, limited time, and a preference for "set it up once, then repeat a checklist." Read it once end-to-end, then keep it open beside you for the first two weeks. After that you'll have it memorized and won't need it.

**Status context (updated July 14, 2026):** Stripe is fully live (PRD T-85 done), so CTAs can be real-purchase asks ("Founding 500 — $149 lifetime, capped at 500"), not just waitlist. The only content still gated is: live cross-league win-prob "in your app right now" (T-162, verify first), playoff/championship brackets (no real bracket yet), and never implying Studio demo data is this-second-live (it's real 2024 data). See `Marketing_System_v2.md §1` gates.

**Postiz status: live and settled, not a to-do.** §3 below describes **Postiz Cloud** (a hosted subscription, `api.postiz.com`), not self-hosted — that plan was superseded 2026-07-14 (self-hosted Postiz's MCP-over-SSE has a known bug outside Postiz's own hosted instance, `gitroomhq/postiz-app#984`; Cloud sidesteps it entirely and was live same-day). The cockpit's Marketing agent is wired to Postiz's official MCP server and already publishing real posts. 5 channels post automatically (X, Threads, Instagram, TikTok, YouTube); LinkedIn and Reddit are permanently manual by founder decision, not a setup gap — see `Marketing_System_v2.md §3`.

---

## 0. The stack at a glance

Six jobs. One tool each. This is the whole kit — resist adding more.

| # | Job in the workflow | The tool | Cost | Why this one |
|---|---|---|---|---|
| 1 | **Capture** the Studio canvas as clean video | **Screen Studio** (Mac) | ~$90 one-time (or $20/mo) | Auto-zoom + native 9:16/16:9 export makes a raw screen-record look intentional with zero editing skill |
| 2 | **Caption / hook / subtitles** for short-form | **CapCut** (desktop) + **Submagic** | Free + ~$16/mo | CapCut is the Reels/TikTok workhorse; Submagic adds the animated auto-caption look in one click |
| 3 | **Publish one-to-many** across all channels | **Postiz Cloud** (hosted, `api.postiz.com`) | $29/mo (Standard plan) | Live and wired 2026-07-14. Real documented API + AI-agent MCP server, so the cockpit's Marketing agent posts/analyzes programmatically, not just a human clicking a UI. Cloud (not self-hosted) specifically avoids a known self-hosted MCP-over-SSE bug (`gitroomhq/postiz-app#984`) |
| 4 | **Feed the News Desk** (spot headlines fast) | **Feedly** + **F5Bot** + an **X list** | ~$8/mo + free + free | Your daily volume engine lives on spotting postable news in minutes |
| 5 | **Community + newsletter + launch** | **Discord** + **Carl-bot** · **Beehiiv** · **Product Hunt** | Free · Free tier · Free | Community home, owned audience, launch credibility |
| 6 | **Know what works** (link tracking) | **Dub.co** | Free | Tells you which post actually drove a signup — turns guessing into a system |
| + | **Glue / automation** (optional, high-leverage) | **Make.com** or **n8n** | Free tier / self-host | Pre-chews the daily News Desk loop and pings you on new signups |
| + | **Clip library** | **Google Drive** | Free | Dated folders; the source everything is scheduled from |

**Running cost:** Postiz Cloud $29 + Submagic $16 + Feedly $8 ≈ **~$53/mo**, plus Screen Studio ~$90 once. Everything else is $0.

---

## 1. Screen Studio — capturing the Studio canvas

**What it does:** records your screen and automatically adds smooth zoom-ins, clean cursor motion, and lets you export the same recording as both 9:16 (vertical) and 16:9 (landscape). Your Simulation Studio already renders a deterministic, pixel-faithful canvas — Screen Studio just turns a plain recording of it into something that looks produced.

**Why it's the highest-leverage purchase:** it's the tool that most directly compensates for "I'm better at building than making it look good." You don't need motion-design skill; the auto-zoom and export presets do it.

### One-time setup
1. Buy and install from **screen.studio** (Mac only). One-time license is cheaper long-run than the subscription; either is fine.
2. On first launch, grant **Screen Recording** permission: macOS **System Settings → Privacy & Security → Screen Recording → enable Screen Studio.** (macOS will ask; if you miss it, this is where to fix it.)
3. Open Preferences and set:
   - **Export → Format: MP4, 1080p** (higher than needed for social; keeps a clean master).
   - **Cursor size:** slightly enlarged — reads better on mobile.
   - **Auto-zoom:** on, medium intensity.

### The capture workflow (repeat per clip)
1. Open the Simulation Studio at `/demo/studio` (dev, or `?studio=true`). Author the moment per `Marketing_System_v2.md §1` (real player + real data prefill, then editorial override for exactly what the clip should say). Set the Studio's **aspect toggle to 9:16** — the Studio does the framing; you just record the canvas.
2. In Screen Studio, click **Record → Selected Area**, and drag the capture box tightly around the Studio canvas only (no browser chrome).
3. Let the moment play through once, cleanly. Because the Studio is deterministic, if you fumble it, just re-record — it looks identical every take.
4. Stop. In the editor, trim dead space at the head/tail. Leave ~0.5s of breathing room each end (needed for smooth loop playback — `Marketing_System_v2.md §7`).
5. **Export twice for your hero clips:** once at 9:16 (IG/TT/Shorts), once with the aspect switched to 16:9 (X GIF / site / Product Hunt). For pure News Desk clips, 9:16 only is fine.
6. Save straight into today's dated clip-library folder (see §8).

**Free fallback if you skip Screen Studio:** macOS **Shift-Cmd-5** records a selected area; **CleanShot X** (~$29) adds cleaner cursor and quick trims. You lose the auto-zoom polish but the pipeline is identical.

---

## 2. CapCut + Submagic — captions, hooks, and the short-form look

Raw Studio clips are faithful but "quiet." Short-form platforms reward a **hook in the first 1.5s** and **legible-at-a-glance on-screen text**. These two tools add that.

### CapCut (the workhorse, free)
**What it does:** the dominant free editor for Reels/TikTok/Shorts. Auto-captions, text overlays, trending sounds, templates.

**One-time setup:** install **CapCut desktop** (capcut.com — desktop is far less cramped than mobile for this). Create a free account.

**Per-clip workflow:**
1. New project → drag in your Screen Studio 9:16 export.
2. **Add the hook text** (first frame, first 1.5s): one big line — the take or the pain. Example: *"Your RB just scored. Watch all 4 leagues move."* Keep it top-third so platform UI (usernames, buttons) doesn't cover it.
3. **Auto-captions** (only if the clip has voiceover): **Text → Auto captions → generate.** Skip for silent product clips.
4. **Sound:** add a subtle trending-adjacent track from CapCut's library at low volume. On IG/TikTok, using an on-platform trending sound helps reach — you can also add that *in the app* at post time instead (see §3 note).
5. **Export: 1080×1920, 30fps.** Save to today's folder.

### Submagic (the auto-caption look, ~$16/mo)
**What it does:** in one click, adds the animated word-by-word "karaoke" subtitle style that reads as native short-form. Faster and better-looking than doing it by hand in CapCut. Use it whenever a clip has spoken words (founder talking-head, voiceover News Desk takes).

**Setup:** sign up at **submagic.co**, pick the Starter plan. Upload a clip, choose a caption template (pick one clean style and reuse it for brand consistency — don't switch styles per clip).

**When to use which:** silent product clip → CapCut hook text only. Talking clip (founder story, spoken take) → run it through Submagic for captions, then optionally polish in CapCut. Don't use both on every clip; that's wasted time.

---

## 3. Postiz Cloud — publish everything from one place

**This is the keystone tool, and it's live.** It's what makes "same clip everywhere / same text everywhere" a single action instead of nine — and, unlike a closed SaaS scheduler, it's also what the AI cockpit's Marketing agent (`Rostiro-App/rostiro-cockpit`, `src/agents/marketing.ts`) calls programmatically via Postiz's official MCP server, so scheduling is a Discord conversation with the cockpit, not just a dashboard click.

**Why Postiz Cloud (not self-hosted, not Metricool/Buffer/Ayrshare):** open-source-backed, covers every channel this plan needs (X, Threads, Instagram, TikTok, YouTube auto-posted; LinkedIn/Reddit connected but manual by policy), and ships an official MCP server built specifically for AI agents — the closest architectural match to a Claude-Agent-SDK cockpit that exists in this space. Self-hosting was the original plan but was superseded 2026-07-14: self-hosted Postiz's MCP-over-SSE has a known bug outside Postiz's own hosted instance (`gitroomhq/postiz-app#984`), so Cloud (`api.postiz.com` / `mcp.postiz.com`) was the correct call — it sidesteps the bug entirely and was live same-day instead of after a Docker/Elasticsearch/Temporal debugging session.

### Setup — done, for reference
1. Postiz Cloud account, Standard plan ($29/mo).
2. Channels connected through Postiz's own dashboard (Settings → Connections): X, Instagram, YouTube, Reddit, LinkedIn all live; TikTok and Threads mid-connection as of 2026-07-14 (Threads hit a Meta anti-bot flag from the OAuth attempt on first try — not a Rostiro-side bug; expected to clear).
   - **IG gotcha (for reference, already handled):** Instagram publishing requires the IG account to be a **Business or Creator** account linked to a **Facebook Page** — the single most common setup snag if reconnecting from scratch.
   - **New-account OAuth caution:** a brand-new social account authorizing a scheduling tool via OAuth almost immediately can read as bot signup to that platform's fraud detection (this is what happened with Threads). Post manually a few times first on any new account before connecting it to Postiz.
3. API key (Settings → Developers → API Key) is in `.env.local` (main repo, `POSTIZ_API_KEY`) and as a Fly secret on the cockpit, used for both the `postiz` CLI and the cockpit's MCP connection (`mcp.postiz.com/mcp`, Bearer auth).
4. `postiz` CLI installed globally (`npx skills add gitroomhq/postiz-agent`) for direct terminal posting alongside the cockpit's Discord flow — two working paths, not either/or.

### The publish workflow (this replaces posting to 9 apps)
Whether done via the `postiz` CLI, Postiz's own dashboard, or the cockpit's Marketing agent, the shape is the same:
1. **Create post.**
2. **Select all the channels this asset goes to at once** — for a vertical clip: IG + TikTok + YT Shorts. For a text take: X + Threads (once connected).
3. Upload the 9:16 clip (or paste the text).
4. **Write the caption once**, then make the *only* two per-platform tweaks that ever matter (per `Marketing_System_v2.md §3`): trim hashtags for X (hashtags are IG/TikTok-only), and shorten if a platform is tighter. Everything else stays identical — that's the efficiency play.
5. Add the CTA from the template (`Marketing_System_v2.md §17`): *"Run every league. Founding 500 — $149 lifetime, in bio."* (Stripe is live, so real-purchase CTAs are cleared.)
6. **Schedule**, don't post-now — drop it into a queue slot. If routed through the cockpit, a real publish ALWAYS pauses for your `go`/`cancel` in Discord regardless of mode — the honesty contract means a human approves every real post before it goes out, every time, no exceptions (see `Rostiro_Cockpit_Operator_Manual_v1.md §3`).
7. **Sound caveat for IG/TikTok:** to attach an *on-platform trending sound* (a real reach lever), you sometimes must post natively in-app rather than via scheduler. Rule of thumb: schedule the everyday volume through Postiz; for a hero clip where a trending sound matters, post that one natively in the IG/TikTok app and let Postiz handle the rest.
8. **LinkedIn and Reddit are the exception to all of the above** — permanently manual by founder decision (`Marketing_System_v2.md §3`). The cockpit will draft for these but will never schedule them; copy the final text and post it yourself.

**Rhythm, quality-gated, not a fixed quota:** two Studio sessions/week (e.g. Mon + Thu) → 8–12 clips each → caption + schedule the whole batch in ~60 min. We have zero followers and roughly two months of runway — every post is a first impression, so a day with nothing sharp to say gets skipped, not filled. Automation makes high cadence easy; it doesn't make it mandatory.

---

## 4. The News Desk monitoring rig — Feedly + F5Bot + an X list

Your daily volume engine (`Marketing_System_v2.md §5`) is only as fast as your ability to *spot a postable headline*. This is the rig that surfaces them so you're never hunting.

### Feedly — the headline firehose, filtered
**What it does:** pulls RSS from every source into one prioritized reading board, and its AI can surface the injury/trade/depth-chart items worth a take.

**Setup:**
1. Sign up at **feedly.com** (free works; Pro ~$8/mo adds AI prioritization and is worth it once volume ramps).
2. Create a **Board called "News Desk."**
3. Add sources (search each in Feedly and follow): **Rotoworld / NBC Fantasy**, **PFF**, **ESPN NFL**, key **beat writers** for high-fantasy-relevance teams, and the **r/fantasyfootball** subreddit (Feedly can follow a subreddit as a feed).
4. (Pro) Create an **AI Feed / "Leo" priority** for keywords: `injury`, `ruled out`, `questionable`, `depth chart`, `trade`, `snap count`, `target share`, `waiver`. This floats the postable stuff to the top so you skim less.

**Workflow:** once each morning (and again pre-Sunday), skim the News Desk board for 5 minutes. Each headline worth a take → run the 15-minute News Desk loop (`Marketing_System_v2.md §5`): spot → one product-anchored angle → author in Studio → capture 9:16 → schedule + X text take.

### F5Bot — free mention + Reddit radar
**What it does:** emails you the moment your keywords appear on **Reddit or Hacker News**. This is simultaneously your brand-mention monitor *and* your value-first Reddit early-warning system (`Marketing_System_v2.md §16`).

**Setup (2 minutes):**
1. Go to **f5bot.com**, sign up with email.
2. Add keywords: `Rostiro`, and a couple of pain-phrases you want to help on, e.g. `multiple fantasy leagues`, `manage all my fantasy teams`, `fantasy football multiple leagues`.
3. You'll get an email whenever any appear. Reply helpfully as a fantasy player first, mention Rostiro only when it genuinely answers the question — never spam.

### X list — the fastest breaks
**What it does:** the fastest injury/trade news breaks on X first. A dedicated list of beat reporters is your fastest signal.

**Setup:** in X, create a **private List called "NFL News Desk,"** add ~20–30 beat reporters + Rotoworld/PFF/Schefter/Rapoport-tier accounts. Pin the list column (X Pro / the old TweetDeck view if you have it, or just the list feed). Check it before each posting session.

---

## 5. Discord + Carl-bot — the community home

**What it does:** your owned community — bug reports, feature requests, beta access, Founding 500 members, Sunday chaos. Stand it up now, even empty (`Marketing_System_v2.md §17`).

### Setup
1. Create a server at **discord.com** → **+ → Create My Own.** Name it **Rostiro.**
2. Channels (keep it lean): `#welcome`, `#announcements`, `#general`, `#bugs`, `#feature-requests`, `#beta`, `#founding-500` (gated to Founder members later), `#sunday-chaos`.
3. Write the **welcome message** (`Marketing_System_v2.md §10` Discord description): what Rostiro is, how to report a bug / request a feature / get beta access, house rules.
4. **Add Carl-bot** (carl.gg → Invite): use it for a **reaction-role welcome** (react to get roles), basic **automod** (spam/link filtering), and a **welcome DM**. MEE6 is an equivalent alternative; pick one.
5. Put the invite link in every bio and in Beehiiv (see §6, §8).

**Workflow:** check daily for bugs/requests; post build-in-public wins to `#announcements` (they mirror from your X posts — `Marketing_System_v2.md §8` repurposing matrix). When Founding 500 buyers come in, give them the Founder role → access to `#founding-500`.

---

## 6. Beehiiv — the owned newsletter

**What it does:** the one audience no algorithm can take from you. Start list-building the signup form *now* even though issue #1 doesn't ship until ~August (`Marketing_System_v2.md §12` Phase 2).

### Setup
1. Sign up at **beehiiv.com** (free tier is fine to start).
2. Set publication name **Rostiro**, bio (`Marketing_System_v2.md §10` Beehiiv line: *"Weekly fantasy signal for people who run more than one league…"*).
3. Grab your **subscribe page URL** and the **embeddable form.** Put the subscribe link in every bio and pin.
4. Turn on **Beehiiv's referral/recommendation** features later; ignore for now.
5. **Connect to your automation** (see §7): new-subscriber webhook → Discord ping.

**Workflow:** collect signups passively from July. Draft issue #1 mid-August. Weekly cadence once live: waivers, injuries, "what needs you," what shipped (`Marketing_System_v2.md §17`).

---

## 7. Dub.co — link tracking (know what actually works)

**What it does:** free, open-source short links with click analytics. Put a Dub link in every bio and CTA; it tells you *which post/channel drove the traffic and signups.* This is the single thing that converts distribution from guesswork into a measurable system — the highest-value habit for a builder who's new to marketing.

### Setup
1. Sign up at **dub.co** (free). Add your domain later if you want branded links; the default `dub.sh` short domain works now.
2. Create your core links:
   - `→ rostiro.com` (or the pricing/Founding 500 page) — this is your **bio link.**
   - Optionally a per-channel variant so you can tell IG vs TikTok vs X traffic apart.
3. Put the right link in each platform's bio.

**Workflow:** once a week, open the Dub dashboard. Look at which links/channels drove clicks. Double down on what works, quietly drop what doesn't. That's the whole feedback loop — five minutes, weekly.

---

## 8. The clip library — Google Drive

**What it does:** the single source of truth every scheduled post pulls from. Nothing fancy; discipline beats tooling here (`Marketing_System_v2.md §7`).

### Setup
1. In Google Drive, create **`Rostiro Marketing / Clips / `.**
2. Inside, one **dated folder per Studio session:** `2026-07-13/`.
3. **Naming convention** (so you can find anything): `pillar_topic_aspect.mp4` → e.g. `newsdesk_mahomes-questionable_9x16.mp4`, `viral_crossleague-td_16x9.mp4`. Pillars: `origin`, `viral`, `newsdesk`, `reaction`, `sundaychaos`, `founder`, `feature`, `beta` (the 7 pillars from `Marketing_System_v2.md §4`).
4. Keep both the raw Screen Studio master and the captioned final.

---

## 9. The automation layer — Make.com or n8n

**Don't over-automate.** Publishing stays human (the caption tweak matters, and platforms punish bot-posting). Automate only the two things that give real time back. Use **Make.com** (easier, visual, generous free tier) or **n8n** (self-host, free, more powerful) as the glue.

### Automation A — the News Desk auto-inbox (highest value)
**Goal:** wake up to a queue of postable moments instead of hunting for them.

**Flow to build:**
1. **Trigger:** *Watch RSS* module → point it at your key beat-writer / Rotoworld / PFF feeds (add several RSS modules or one aggregated feed via **RSS.app**).
2. **Filter:** only pass items whose title contains your keywords (`injury`, `ruled out`, `questionable`, `trade`, `depth chart`, `waiver`, `snap`, `target share`).
3. **(Optional) Enrich:** an **Anthropic/Claude API** module that takes the headline and drafts one product-anchored angle sentence ("how does this hit a manager who rosters him in 1–3 leagues?" per `Marketing_System_v2.md §5`). Keep it draft-only — you edit before posting; never auto-publish AI text.
4. **Action:** post the headline + link + drafted angle into a Discord `#headline-inbox` channel (private, just for you) via a Discord webhook.

**Result:** your News Desk loop starts from a pre-filtered, pre-angled queue. This directly attacks the "distribution is hard" problem by removing the blank-page part of the daily engine.

### Automation B — new-signup notification
**Goal:** stay close to early users with zero manual effort.

**Flow:** Beehiiv (or your waitlist form) *new subscriber* webhook → Make/n8n → Discord ping in a private `#signups` channel (and optionally a Beehiiv auto-welcome email). Tiny, but it keeps you personally connected to every early believer, which is a real cold-start advantage.

**Everything else stays native:** cross-posting the same clip to 3 platforms and the same text to 3 more is handled *inside Postiz* — do not build automations for that.

### Honesty guardrail on all tooling
Skip any "AI content spinner," fake-engagement, auto-comment, or follow/unfollow-bot tool. They'd break the §2 honesty contract that is your actual differentiator. AI is fine for *drafting* captions and angles; never for fabricating results, engagement, or reviews.

---

## 10. How a full week actually flows (put it together)

This is the repeatable rhythm once everything above is set up. Two anchor sessions + light daily upkeep.

**Monday — Studio Session #1 (~90 min) + schedule (~60 min)**
1. Skim Feedly News Desk board + X list; pull the week's headline list.
2. Open `/demo/studio`. Author + capture 8–12 clips (aim ~40% News Desk, ~25% viral/reaction, ~20% product/Sunday-chaos, ~15% founder/community — `Marketing_System_v2.md §7`). Screen Studio each; export 9:16 (+16:9 for the best 2–3).
3. Caption/hook in CapCut (Submagic for any spoken clips). Save to today's dated folder.
4. In Postiz: batch-schedule the whole week's IG/TT/Shorts. Queue X text takes separately.

**Tuesday–Wednesday — light daily upkeep (~15 min/day)**
- Run the News Desk loop on any fresh breaking item (Feedly/X list) → quick Studio clip or just an X text take.
- Reply to any F5Bot Reddit hits, helpfully.
- Check Discord for bugs/requests.

**Thursday — Studio Session #2** (repeat Monday's capture + schedule; refresh the batch).

**Friday — build-in-public + community**
- One build-in-public post (what shipped / what broke — `Marketing_System_v2.md §6`) to X → mirror Threads/Bluesky → LinkedIn → Discord `#announcements`.
- Post a soft beta/Founding 500 CTA.

**Sunday — live game-day content**
- Post a LIVE companion clip / interrupt-moment clip; Stories on IG. React to real Sunday chaos.

**Weekly (5 min):** open Dub analytics → note what drove signups → adjust next week's mix.

---

## 11. The 24-hour setup checklist (do before first post)

Ordered by "hardest to recover if skipped." Check each off.

- [x] **Claim @rostiro-family handles** on X, Instagram, YouTube, Reddit, Discord — done. TikTok/Threads mid-connection (`Marketing_System_v2.md §9`).
- [x] Instagram converted to Business/Creator, linked to a Facebook Page — done, connected in Postiz.
- [ ] Install **Screen Studio** + **CapCut**; do one 10-min test: author a Studio clip → capture → caption → export 9:16. Prove the pipeline works before you rely on it.
- [x] **Postiz Cloud** live (`api.postiz.com`/`mcp.postiz.com`), cockpit wired via MCP — done 2026-07-14.
- [ ] Set up **F5Bot** (`Rostiro` + 2 pain-phrases) and a **Feedly "News Desk" board** with your core sources. Build the **X "NFL News Desk" list.**
- [ ] Stand up the **Discord** server (even empty) + Carl-bot welcome; grab the invite link.
- [ ] Create the **Beehiiv** publication + subscribe form.
- [ ] Create your **Dub** bio link(s); put the right link in every bio.
- [ ] Create the **Google Drive clip library** with the dated-folder + naming convention.
- [ ] (Optional, when you have an hour) Build **Automation A** (News Desk auto-inbox) in Make/n8n.

---

## 12. Cost summary

| Tool | Plan | Monthly | One-time |
|---|---|---|---|
| Screen Studio | License | — | ~$90 |
| CapCut | Free | $0 | — |
| Submagic | Starter | ~$16 | — |
| Postiz Cloud | Standard | $29 | — |
| Feedly | Pro | ~$8 | — |
| F5Bot | Free | $0 | — |
| Discord + Carl-bot | Free | $0 | — |
| Beehiiv | Free tier | $0 | — |
| Dub.co | Free | $0 | — |
| Make.com / n8n | Free / self-host | $0 | — |
| Google Drive | Existing | $0 | — |
| **Total** | | **~$53/mo** | **~$90 once** |

---

*Rostiro Marketing Tool Stack & Operator Runbook v1.0 — July 2026*
*Companion to Marketing System v2.0. The strategy tells you what to say; this tells you how to ship it.*
*Run Every League. — rostiro.com*
