# Rostiro System & Operations Map v1.0

**Companion to `Rostiro_PRD_v5.md` and `Rostiro_Marketing_Toolstack_v1.md`.** The PRD holds every one of these facts, but as prose across ~1,200 lines — this is the same platform drawn as one picture, so the architecture and data flow can be grasped at a glance. Drawn from the **live codebase on 2026-07-12**, not paraphrased from the PRD, so it reflects what actually runs.

**Visual version (interactive, shareable):** the same map rendered as an artifact in Rostiro's OS visual language — open it for the color-coded, scrollable layout. This markdown is the committed, version-controlled source of truth.

**Ground-truth counts (from code):** 4 data sources · 7 Vercel crons · 45 API routes · 38 Postgres tables · 4 outbound services · 5 product States.

---

## 1. The stack, top to bottom

Read it as one signal falling downward: real data comes in, gets processed on a schedule, lands in one store, reshapes into product surfaces, and goes back out to the user.

### Layer 1 — Sources (ingest)
The outside world. Real fantasy + NFL data, plus inbound billing events.

| Source | What it provides |
|---|---|
| **Sleeper API** (`api.sleeper.app`) | leagues · rosters · players · live drafts |
| **ESPN API** (`fantasy.espn.com`) | leagues · projections · live scores · news RSS |
| **Yahoo API** *(pending review)* | leagues · write-back — code ready (`lib/yahoo.ts`), waiting on access |
| **nflverse** (`raw.githubusercontent.com`) | player stats · cross-platform id mappings |
| **Stripe events** (inbound webhook) | checkout · renewals · payment failures |
| **User actions** | connect league · edit lineup · save note |

### Layer 2 — Compute (Vercel)
Seven crons on a clock, plus 45 request routes. Claude sits here as the reasoning brain both the app and future automations can call.

| Cron | Schedule | Job |
|---|---|---|
| `cron/live-scores` | every 1 min | game-day scoreboard + big-play detection |
| `cron/news` | every 15 min | ESPN RSS → scratch classifier → relevance scoring |
| `cron/season-pass-expiry` | 07:00 daily | expiry-warning emails |
| `cron/nfl-schedule` | 08:00 daily | schedule refresh |
| `cron/players` | 09:00 daily | Sleeper player-payload refresh |
| `cron/pulse` | 10:00 daily | builds the daily decision feed |
| `cron/season-points` | 11:00 daily | season points roll-up |

**Claude (Anthropic)** — Draft Copilot, Trade Analyzer, weekly recaps, Notes copilot.
**Key request routes** — `draft/recommend` · `trades/analyze` · `leagues sync` · `stripe/webhook` · `auth` · `settings/export|delete`.

### Layer 3 — Store (Supabase Postgres, 38 tables)
RLS-scoped, cache-first. Grouped by role:

- **Identity & billing** — `users` · `connected_leagues` · `espn_credentials` · `yahoo_tokens` · `usage_counters` · `promo_windows` · `founder_feedback`
- **Fantasy cache** — `players_cache` · `player_mappings` · `roster_snapshots` · `adp_snapshots` · `injury_snapshots` · `player_usage_snapshots` · `player_context_cache` · `nfl_schedule` · `weather_cache`
- **Product state** — `pulse_items` · `notes` · `draft_sessions` · `news_items` · `player_scratches`
- **Live (game day)** — `live_scores` · `live_events` · `live_matchup_points` · `window_recap_log`
- **Portfolio & analytics** — `portfolio_exposure_snapshots` · `portfolio_health_snapshots` · `player_season_points`
- **Ops & infra** — `feature_flags` · `circuit_breaker_state` · `api_call_log` · `app_error_log` · `rate_limit_events` · `telemetry_events` · `engagement_log` · `ai_queries` · `push_subscriptions`

### Layer 4 — Surfaces (the product)
The 5 States (Standard · Draft · Waiver Day · Game Day · Film Room) reshape these by moment: **Pulse** (daily decision feed) · **Leagues + Health Score** · **Lineup** · **Trade Analyzer** · **Draft Copilot** · **LIVE companion** · **Film Room** · **Interrupt Stack** · **Notes** · **Profile / Settings / Upgrade**.

### Layer 5 — Outbound (reach the user)
The only two channels that leave the app:
- **Resend** — 9 branded emails: welcome · purchases · expiry · decline · deletion · feedback
- **OneSignal** — push: touchdown swings · starter scratches · lineup lock

---

## 2. Follow the data — five real paths

1. **Injury** — a starter is ruled out 90 min before kickoff:
   `ESPN news RSS → cron/news (15m) → scratchClassifier → player_scratches → pulse_items + push → OneSignal (Pro, starters only) → You`
2. **Sunday** — a touchdown swings a game:
   `ESPN scoreboard → cron/live-scores (1m) → live_scores/live_events → liveWinProb → Interrupt Stack → push + LIVE tab → You`
3. **Morning** — what needs you today:
   `Sleeper + ESPN rosters → cron/pulse (10:00) → pulse.ts (rank + fingerprint) → pulse_items → Pulse feed`
4. **Draft** — frozen on the clock:
   `Sleeper live draft → draft/session/picks → draft/recommend → Claude reasoning (Pro) → Draft Copilot`
5. **Revenue** — someone buys the Founding 500:
   `Stripe checkout → stripe/webhook → users.plan + founding_number (atomic, capped 500) → Resend welcome (★ Founder) → New member`

---

## 3. The operations layer — where n8n (and the cockpit) fit

**The honest framing, because it saves money:** the *product's* automation is already code, running on Vercel crons, in the repo. n8n's real job is the **glue between tools that live outside the app** — Stripe, Supabase, Discord, Beehiiv, social — that no single service owns. **Don't rebuild the crons in n8n.** Use it to watch, alert, and connect.

**Since this map was first drawn (2026-07-12), a second automation layer went live: the AI cockpit** (Discord ↔ Claude Agent SDK, on Fly.io — separate repo `Rostiro-App/rostiro-cockpit`). Where n8n handles one-way alerts and drafts, the cockpit is the operator's interactive assistant: it reads/edits code, queries Supabase (read-only), checks n8n executions, and runs a Marketing sub-agent wired to **Postiz Cloud** (hosted, not self-hosted) for cross-posting — live 2026-07-14. 5 channels auto-post (X, Threads, Instagram, TikTok, YouTube); LinkedIn and Reddit are permanently manual by founder decision. Full state: `Rostiro_Marketing_System_v2.md §3`, `Rostiro_Cockpit_Operator_Manual_v1.md`.

**Status key:** 🟢 live · 🟡 manual today · 🔴 monitoring gap (build first).

### A. Reliability & monitoring — *all live*
`app_error_log`, `circuit_breaker_state`, `api_call_log` now page you when they turn red. Built and verified in `automations/n8n/README.md`.

| Automation | Flow | Status |
|---|---|---|
| **Cron heartbeat** — alert when the 10:00 Pulse or 15-min news cron doesn't run | cron ping → n8n → if silent 20m → Discord `#alerts` | 🟢 live |
| **Error-log pager** — new critical `app_error_log` row → instant ping | Supabase insert → n8n → Discord `#alerts` | 🟢 live |
| **Circuit-breaker alert** — Sleeper/ESPN trips the breaker | state change → n8n → Discord `#alerts` | 🟢 live |
| **Daily API cost digest** — roll up `api_call_log` + `ai_queries` | n8n 08:00 → Supabase → Discord | 🟡 manual (not yet built) |

### B. Revenue & business ops — *know your numbers*
Stripe already emails the customer. What's missing is **your** visibility.

| Automation | Flow | Status |
|---|---|---|
| **Customer billing emails** | stripe/webhook → Resend | 🟢 done |
| **Sale ping** — every purchase → Discord, PII-safe payload | Stripe → n8n → Discord `#wins` | 🟢 live |
| **New-signup + Founding-500 milestones** | Stripe/Supabase → n8n → Discord `#wins` | 🟢 live |
| **Daily business digest** — signups, conversions, MRR, F500 remaining | n8n 08:00 → Supabase + Stripe → Discord | 🟡 manual (not yet built) |

### C. Marketing ops — *the distribution machine*
Where the "better at building than distribution" gap is felt most. Full runbook: `Rostiro_Marketing_Toolstack_v1.md`.

| Automation | Flow | Status |
|---|---|---|
| **News Desk auto-inbox** — relevant headlines → private inbox + drafted angle | cron/news data → n8n → Claude Haiku → Discord `#headline-inbox` (draft-only, you post) | 🟢 live |
| **Mention radar** — Reddit pain-phrase/brand mentions → one channel | F5Bot/Reddit → n8n → Discord `#mentions` | 🟢 live |
| **Cross-post publishing** — same clip/text everywhere | cockpit Marketing agent (or Postiz's own dashboard) → Postiz Cloud → 5 auto channels; LinkedIn/Reddit manual | 🟢 live (2026-07-14) — TikTok/Threads mid-connection |

### D. User lifecycle & feedback — *retention*

| Automation | Flow | Status |
|---|---|---|
| **Trial & season-pass expiry** | cron/season-pass-expiry → Resend | 🟢 done |
| **Founder-feedback → ticket** — new `founder_feedback` row → Discord/Linear | Supabase insert → n8n → Discord/Linear | 🟡 opportunity (not yet built) |
| **Re-engagement nudge** — inactive N days → "what you missed" | Supabase activity → n8n/cron → Resend | 🟡 manual |
| **Weekly retro** — Sunday roll-up of the week | n8n Sun 21:00 → Supabase → digest | 🟡 manual |

---

## 4. If you do three things (priority order)

1. ~~**Wire monitoring** 🔴~~ ✅ **Done** — cron heartbeat + error-log pager + circuit-breaker alert all live in `#alerts`.
2. ~~**Business + sale pings**~~ ✅ **Done** — sale ping + signup/Founding-500 milestones live in `#wins`. Daily digest still manual.
3. ~~**News Desk inbox**~~ ✅ **Done**, plus Mention Radar shipped alongside it. Both draft-only per the honesty contract — you always post manually.

**Next up:** finish connecting TikTok and Threads in Postiz (mid-connection as of 2026-07-14), then run the first Simulation Studio session — the marketing table's cross-post publishing is live, but the video content it distributes doesn't exist yet.

---

*Rostiro System & Operations Map v1.0 — 2026-07-12. Drawn from the live codebase. Run Every League. — rostiro.com*
