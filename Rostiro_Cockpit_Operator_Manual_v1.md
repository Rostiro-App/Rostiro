# Rostiro Cockpit — Operator Manual

**What this is:** your day-to-day guide to actually using the cockpit — the Claude-powered Discord bot that runs your marketing (and code/infra) work 24/7 on Fly.io. Not a setup guide (that's `rostiro-cockpit/README.md`); this is "what do I type and what happens."

Read this before testing the Discord flow for the first time. It won't take long.

---

## 1. The big picture

You have one Discord channel (`#cockpit`, locked to you — nobody else can talk to the bot even if they're in the server). You type messages there like you'd message a very capable, very cautious employee. Behind that channel:

- **The main cockpit session** — reads/edits Rostiro's code, checks Supabase, checks n8n, can push branches and trigger deploys.
- **The Marketing sub-agent** — delegated to automatically when you ask about marketing. It's the one wired to Postiz (your social scheduler) and has its own real analytics access, image generation, and the brand voice/honesty rules baked in.

Everything mutating — a code edit, a scheduled social post, a deploy — passes through **one safety gate** before it happens. That gate is the whole point of this manual: know what it does, and you'll never be surprised by it.

---

## 2. Talking to it

Just type in `#cockpit`. Plain English. Examples:

- `draft a founder build-in-public post about today's Postiz work`
- `what's connected on Postiz right now`
- `how did the intro tweet do`
- `generate a stat card for the Founding 500 pricing and post it to X`
- `check if the Vercel deploy from this morning is healthy`

You don't need to say "delegate to marketing" — the cockpit figures out when a request is a marketing question and routes it there itself.

**A response takes a bit.** You'll see a "🧠 Working on it..." message that updates live with what tool it's currently running (`🔧 Running integrationList...` etc.) so you know it hasn't gone quiet — a real diagnosis or draft can take a couple minutes.

---

## 3. The approval flow (the part that matters most)

Anything that actually changes something outside the conversation — scheduling a real post, editing code, pushing to a branch, deploying — pauses and asks you first, unless you've explicitly switched modes (see §4).

When it needs your OK, you'll see something like:

```
⏸️ Approval needed (production action) — mcp__postiz__integrationSchedulePostTool
{
  "socialPost": [...]
}
[if there's an image, it shows inline in the Discord message]
Reply "go a1b2c3" to approve, or "cancel a1b2c3" to reject.
```

**Before you reply `go`:**
- Read the exact final text — this is what actually gets published, not a paraphrase.
- If there's supposed to be an image, check it's actually attached and looks right.
- Check the target platform(s) match what you asked for.

**To respond:** type `go <the-id-shown>` or `cancel <the-id-shown>` — copy the id exactly as shown, it's how the bot knows which pending request you're answering. An unanswered approval just sits there, waiting — it never times out and silently proceeds, and it never silently vanishes either.

**The one thing that ALWAYS gates, no matter what mode you're in:** actually publishing a social post (`integrationSchedulePostTool`). Even if you've turned auto mode on, that one step always stops and asks. Drafting, checking analytics, generating an image — those can be sped up; the actual "this is now public" moment never is.

---

## 4. Modes — `!mode <name>`

Type this in `#cockpit` to change how cautious the bot is:

| Command | What it does |
|---|---|
| `!mode propose` | **Default, and what it resets to on every restart.** Every mutation pauses for your `go`/`cancel`. Safest, slower. |
| `!mode auto` | Low-stakes mutations (drafting, generating images, checking analytics, file edits, non-main-branch commits) run without asking. **Publishing a real post still always gates.** Use this for a short deliberate stretch, then switch back. |
| `!mode readonly` | Nothing mutates, period — even if you say `go`. Pure diagnosis/lookup mode. |

Also: `!new` clears the conversation and starts fresh — use it if a thread of context has gotten confused or stale.

---

## 5. What the Marketing agent can actually do today

**Quality over volume, always.** The agent is explicitly instructed on this: zero followers, roughly two months of runway, every post is a first impression. Automation makes high cadence easy on the 5 auto channels — that's not a mandate to fill every slot. If you ask for a day's post and there's nothing sharp/real behind it, expect it to say so and suggest skipping rather than draft something weak just to post.

**Drafting & research**
- Draft a post for any connected channel, in Rostiro's brand voice (calm, direct, a little funny, no hype, no em-dashes on X).
- Real-world research via web search (a headline, a competitor, a trend) to ground a News Desk take.

**Images**
- `asset_search` — pull a real, already-captured screenshot from the asset library, if one exists.
- `generate_stat_card` — a branded card from real data (breaking-news / stat-highlight / quote-card templates). Never fabricates a stat.
- `generateImageTool` — a generated image for anything a stat card can't cover (needs your prompt approval first).
- **No video yet.** That's on you — see §7.

**Posting**
- Check what's connected (`integrationList`), learn a platform's posting rules (`integrationSchema`), and schedule/publish (`integrationSchedulePostTool`) — the last one always gates, see §3.
- **LinkedIn and Reddit are permanently manual** (founder decision, 2026-07-14) — the agent will draft for these but will never call the schedule tool on them. It hands you the exact final text; you copy/paste and post it yourself. Same for Threads until it's reconnected.

**Analytics**
- `get_platform_analytics` — an account's real engagement trend over a trailing window (impressions, likes, replies, retweets, bookmarks).
- `get_post_analytics` — the same, for one specific post.
- These are read-only, so they never trigger an approval prompt, even in `propose` mode — ask freely.

**What it will NOT do**
- Won't publish anything you haven't seen in its exact final form.
- Won't invent a feature, stat, or event that isn't real.
- Won't touch app code (no Bash/Write/Edit on this agent) — code questions get handed back to the main cockpit session.

---

## 6. Currently connected channels

As of today (2026-07-14):

| Channel | Status | Notes |
|---|---|---|
| X (`@RostiroOS`) | ✅ auto-posting | Text desk |
| LinkedIn (your personal account) | ✅ connected, **manual-only** | Founder voice, draft-then-copy/paste, never auto-scheduled — permanent policy, not a technical limit |
| Instagram (`@rostrioapp`) | ✅ connected, no posts yet | Video trio (with TikTok/YouTube), waiting on real content |
| YouTube (`@rostirosports`) | ✅ connected, no posts yet | Video trio |
| Reddit (`RostrioSports`) | ✅ connected, **manual-only** | Comment/value-first — permanent policy, never broadcast |
| TikTok | 🟡 mid-connection | Video trio once live |
| Threads | 🟡 suspended | Meta flagged the Postiz OAuth attempt as bot-like — not a Rostiro-side bug. Text desk (with X) once it clears |
| Bluesky | ❌ not connected | Deferred — TikTok's reach potential is the priority, not this |

See `Rostiro_Growth_Execution_Jul2026.md` for the current week's content plan and the reasoning behind this list.

---

## 7. What still needs you, not the bot

- **Claiming TikTok/Threads/Bluesky** in the Postiz dashboard — OAuth login, has to be you.
- **Recording Studio clips** (`/demo/studio`, screen-recorded) — this is the actual unlock for IG/TikTok/YouTube. Nothing in the cockpit can operate your product's UI for you.
- **Reddit participation** — value-first comments in real threads, not something to templatize.

Once clips exist, hand them to the cockpit (upload to the asset library, or give it a URL) and it can caption + distribute the batch across IG/TikTok/YouTube Shorts identically.

---

## 8. If something looks wrong

- **Bot goes quiet mid-response:** the typing indicator refreshes every ~8s and the status message live-edits — if both stop for a long time, something errored; you'll get an explicit `⚠️ Failed` message with the error text, not silence.
- **An approval you didn't expect:** that's the gate working as designed — read it carefully, `cancel` if anything looks off rather than assuming it's fine.
- **Wrong mode:** `!mode propose` any time to snap back to maximum caution. It also happens automatically on any restart.
- **Conversation feels confused/stuck on old context:** `!new`.
- **Suspect a credential or infra issue:** don't try to fix it via Discord chat — that's a "come back to a real session with me (Claude Code, not the cockpit)" problem.

---

## 9. Quick reference

```
!mode propose      -- default, everything gates
!mode auto          -- low-stakes stuff skips the prompt; publishing still always gates
!mode readonly      -- nothing mutates, even if you say go
!new                -- fresh conversation, drops resumed context
go <id>              -- approve a pending action
cancel <id>          -- reject a pending action
```

Just talk normally otherwise — the routing to the right specialist (Marketing, or the main session) happens automatically based on what you ask.
