# Rostiro Growth Execution Plan — Jul 14 onward

**Purpose:** reconciles `Rostiro_Marketing_System_v2.md`'s strategy (the 8-week pre-season plan, content pillars, phased calendar) against what's *actually live right now* — Postiz + the cockpit's Marketing agent — so this stops being a strategy document and starts being a daily punch list. Phase, goal, and pillars are unchanged from v2; this is the "what do I actually do Tuesday" layer on top.

**Standing directive (founder, 2026-07-14):** growth and awareness only — reach, impressions, follower growth, getting in front of new people, not signups/MRR/conversion (that's a later phase). **Equally important, and not in tension with the above: quality over raw volume.** We're building from zero followers with roughly two months of runway before real conversion pressure arrives — every post is a first impression for someone. The setup below (5 automated channels) makes high cadence *logistically easy*; that is not a mandate to use all of it every day. Skip a slot rather than post something weak. Read every analytics number and every cadence target through both of these at once.

---

## 1. The setup, as finalized 2026-07-14 — 5 automated, 2 permanently manual

This is the real, settled model (see `Rostiro_Marketing_System_v2.md` §3 for the full rationale) — not a work-in-progress:

| Channel | Status | Role |
|---|---|---|
| X (`@RostiroOS`) | 🤖 Auto — live | Text desk |
| Threads | 🤖 Auto — mid-connection (Meta anti-bot flag on first attempt, expected clear within hours) | Text desk (mirrors X) |
| Instagram (`@rostrioapp`) | 🤖 Auto — connected, zero posts yet | Video trio |
| TikTok | 🤖 Auto — mid-connection | Video trio |
| YouTube (`@rostirosports`) | 🤖 Auto — connected, zero posts yet | Video trio |
| LinkedIn (Lawrence's personal account) | ✍️ **Manual, permanently** | Founder credibility, 2/week ceiling — not a reach play |
| Reddit (`RostrioSports`) | ✍️ **Manual, permanently** | Value-first comments only, never broadcast |

**Why LinkedIn/Reddit stay manual is not a limitation, it's the point:** both are trust channels where a real human posting IS the signal. This is enforced in the cockpit's Marketing agent code, not just this doc — it will draft for these two but will never call its own publish tool on them.

Bluesky is deliberately not in this list — deferred, TikTok's reach matters more for a cold start.

**Posted so far (2 days in, against the Day 1–2 calendar in v2 §12):**
- Founder/origin post → LinkedIn (matches the origin-story pillar, just on LinkedIn instead of the planned X pin+IG clip)
- Intro post, Founding 500 pricing, Pulse feature reveal → X

**The honest gap: zero video exists.** v2's content engine runs on the Simulation Studio — 8–12 clips per 90-minute session, distributed identically across IG/TikTok/Shorts. That machine has not run yet. This is the single highest-leverage missing piece, and it is **not something the cockpit or I can do** — Studio sessions mean physically operating `/demo/studio` and screen-recording the canvas. Everything below is built around that constraint: text + generated stat cards are fully executable through the cockpit today; video is blocked on you.

---

## 2. Split of responsibility (what's autonomous vs. what needs you)

**Cockpit can do today, on your `go`/`cancel` approval (for the 5 auto channels):**
- Draft and schedule X/Threads/Instagram/TikTok/YouTube posts (News Desk takes, build-in-public, founder thoughts — v2 §14 bank)
- Draft (never schedule) LinkedIn and Reddit posts — you take the final text and post it yourself
- Generate branded stat cards (`generate_stat_card` — breaking-news, stat-highlight, quote-card templates) from real Rostiro data
- Generate a supporting image (`generateImageTool`) when no stat card template fits
- Pull real screenshots already on file (`asset_search`) — **worth checking whether any real product screenshots already exist in the asset library before assuming we have nothing visual; ask the cockpit to search before generating new**
- Pull real engagement analytics on anything published (`get_platform_analytics`/`get_post_analytics`)

**Needs you, in priority order:**
1. **Finish connecting TikTok and Threads** in Postiz — both mid-connection, no action needed unless they're still stuck by the time you read this.
2. **Run one Studio session** (target: 90 min → 8–12 clips, per v2 §7). This is the actual unlock — until this happens, the entire video trio (IG/TikTok/YouTube) stays silent. Pull the top 10 from v2 §15's ranked clip catalog (origin hook, cross-league TD, 10-tabs Sunday chaos, LIVE companion loop, Waiver Day heist reaction are the first 5). Quality bar applies here too — a rough or off-brand clip isn't worth shipping just to fill the queue.
3. Once clips exist: hand raw captures to the cockpit (via Supabase asset upload or a shared link) and it can caption/schedule the distribution batch (IG Reel + TikTok + YT Short, identical) using `integrationSchedulePostTool` + `uploadFromUrlTool`.

---

## 3. This week's plan (Jul 14 → Jul 20) — text/stat-card track, runs regardless of Studio timing

Adapted from v2 §12's Phase 1 calendar, scoped to what's executable without video. Ask the cockpit's Marketing agent to draft each day's post the morning-of against the real headline/build state — don't pre-write these verbatim, v2's honesty contract means every News Desk take needs a real news item behind it. **This is a menu, not a quota — skip a day rather than force a weak post.**

| Day | X (+ Threads mirror, once connected) | Instagram (stat card or real screenshot) |
|---|---|---|
| Mon Jul 14 (done) | Intro + Founding 500 + Pulse reveal | — |
| Tue Jul 15 | News Desk take #1 (real headline) | Sunday Chaos stat card — "10 tabs vs. one Pulse" |
| Wed Jul 16 | News take + build-in-public screenshot | — |
| Thu Jul 17 | News take | Feature reveal card — Pulse ranking logic |
| Fri Jul 18 | Thread: how Pulse ranks your day | — |
| Sat Jul 19 | Light Saturday take + waitlist ask | News Desk stat card (weekend headline) |
| Sun Jul 20 | "This is what our Sunday looks like" (honest, no LIVE clip yet without Studio) | — |

**LinkedIn (2/week ceiling) and Reddit (organic, comment-first):** both manual per §1 — the cockpit drafts on request, Lawrence posts by hand. Reddit specifically needs a real thread and a genuine answer, not a templated drop; start as founder-voice value-add in r/fantasyfootball / r/DynastyFF / r/FFCommish.

---

## 4. Analytics checkpoint

Every **Sunday**, ask the cockpit's Marketing agent to pull `get_platform_analytics` for X, LinkedIn, and (once posting) Instagram over the trailing 7 days, and compare which posts/pillars earned more impressions/engagement than others. This early, the goal is trend direction and "which format/hook is earning attention," not a target number — see the agent's own system prompt for this framing. Feed the answer into the next week's pillar mix (v2 §7's ~40/25/20/15 News-Desk/Reaction/Product/Founder split is a starting ratio, not a fixed law).

---

## 5. What "done" looks like for this plan

- TikTok/Threads connected in Postiz (Bluesky deliberately excluded, see §1).
- One Studio session banked (8–12 clips, quality-checked, not just produced), first IG/TikTok/YT Shorts posts live.
- A sustainable X/Threads cadence held for a full week — consistency, not necessarily daily-maximum.
- First Sunday analytics check run, feeding into week 2's mix.

Once those four are true, this doc's job is done and v2's Phase 1 calendar (§12) becomes the actual day-by-day again — this addendum only exists to bridge the gap between "the strategy is written" and "the machine is actually running."
