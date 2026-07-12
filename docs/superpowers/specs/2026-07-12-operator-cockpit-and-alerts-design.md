# Rostiro Cloud Ops: Alerts + Operator Cockpit — Design v1

**Date:** 2026-07-12
**Status:** Approved design, pre-implementation
**Companions:** `Rostiro_System_Map_v1.md` §3 (where n8n fits), `automations/n8n/README.md` (the alert pattern), `Rostiro_Marketing_Toolstack_v1.md` §9 (automation layer)

---

## 1. Goal

Give a solo operator, from anywhere (including a phone with no laptop), two things:

1. **Push:** the instant something breaks or a milestone hits, get told — a buzz that cuts through on a Sunday.
2. **Two-way control:** message Claude to *diagnose, fix, deploy, and communicate* about it — code changes, infra, and public status comms — with a human approval gate on every change.

The motivating scenario: a live-scores error fires on an NFL Sunday → SMS pings the operator → they open Discord → "what's breaking?" → Claude reads logs/DB, proposes a code patch, operator says `go`, it deploys → then "let users know" → Claude drafts a status post, operator says `go`, it posts to socials. One conversation, crossing code → infra → public comms.

## 2. Hard constraints

- **No critical functions run on any of the operator's personal machines** (dev/personal PC or the always-on Macs). All alerting and the cockpit run in the cloud.
- **Human-in-the-loop.** Claude proposes; a human `go` gates every mutating action (file write, commit, deploy, social post). Read-only actions (reading logs, querying Supabase) run freely.
- **Honesty contract** (`Marketing_System_v2.md` §2) governs all generated content: Claude may draft status posts; it never fabricates facts, results, or engagement. The approval gate enforces this by construction.
- **Secrets never live in the repo or on a personal machine** — only in the cloud hosts' secret stores.

## 3. Decisions locked

| Decision | Choice |
|---|---|
| Autonomy | Propose → human `go` → apply (never unattended) |
| Channels | Discord = two-way cockpit; SMS = one-way urgent push only |
| Cockpit host | Tiny always-on **cloud** container (Fly.io ~$5/mo) running the Claude Agent SDK + a Discord bot |
| Deploy gate | **Two-gate**: `go` → branch + Vercel **preview**; `ship` → promote to **production** |
| Cockpit tools | Pluggable set of MCP servers; start with Supabase + n8n + git/GitHub; social/marketing is phase 2 |
| Sequencing | Subsystem A (alerts) first, then Subsystem B (cockpit) |

## 4. Architecture

```
                 ┌──────────────── DISCORD (private server) ────────────────┐
                 │   #alerts  (one-way, from A)     #cockpit (two-way, B)    │
                 └────────▲──────────────────────────────────▲──────────────┘
                          │                                   │
  SUBSYSTEM A (alerts)    │           SUBSYSTEM B (cockpit)   │
  ───────────────────     │           ────────────────────   │
  Supabase events ──► n8n Cloud ──► Discord #alerts           │
       │                  └──► Twilio ──► 📱 SMS (urgent subset only)
       │                                                       │
       └── already 100% cloud, no personal machine ──         │
                                                               │
  Fly.io container (always on, cloud) ◄────────────────────────┘
    • Discord bot (outbound websocket — no tunnel / no inbound port)
    • Claude Agent SDK  (= real Claude Code: file/git/bash tools)
    • MCP servers: Supabase, n8n  (+ marketing MCP in phase 2)
    • clone of the Rostiro repo + scoped GitHub + Vercel tokens
    → propose in #cockpit → operator `go` → push branch → Vercel preview
    → operator `ship` → promote to production
```

The two subsystems share only the Discord server. They are built, deployed, and fail independently.

## 5. Subsystem A — Proactive alerts (already cloud)

Same pattern as the shipped Error-Log Pager: a Supabase/business event → n8n Cloud → Discord (+ Twilio SMS for the urgent subset). Nothing runs on a personal machine.

| Alert | Trigger | Channels | Status |
|---|---|---|---|
| Error-log pager | `app_error_log` insert | Discord | ✅ live |
| Circuit-breaker | `circuit_breaker_state` → *open* transition (`old_record` gate) | Discord + **SMS** | build |
| Cron heartbeat | expected cron ping absent > 20 min | Discord + **SMS** | build |
| Sale ping | Stripe event / `users.plan` change | Discord (+ Sheet) | build |
| Founding-500 countdown | `founding_number` crosses 100/250/400/500 | Discord | build |
| Daily cost digest | 08:00 roll-up of `api_call_log` + `ai_queries` | Discord | build |

**SMS policy:** Twilio is reserved for the *urgent* subset (breaker open, cron heartbeat silent, Sunday errors). An SMS means "something is on fire — open Discord." Everything else is Discord-only to avoid alert fatigue.

**Shared secret:** all Supabase→n8n hooks authenticate with `Authorization: Bearer <SUPABASE_N8N_WEBHOOK_SECRET>`; each n8n Webhook verifies it via a Header Auth credential. *(The v1 outage was a mismatch between these two — the sender secret and the n8n credential must be byte-for-byte identical. See §9 lesson.)*

## 6. Subsystem B — Operator cockpit (cloud container)

### 6.1 Host & process
- **Fly.io** single small always-on machine; auto-restart; secrets in Fly's secret store.
- A **TypeScript** service: `discord.js` bot + the **Claude Agent SDK**. The bot holds an **outbound** gateway websocket, so there is no inbound port, tunnel, or firewall change.
- On startup it has a clone of the Rostiro repo as the agent's working directory.

### 6.2 Tools (pluggable, curated)
The Agent SDK session is configured with:
- **file / git / bash** (edit code, branch, commit, push) — real Claude Code.
- **Supabase MCP** — read logs, query state, diagnose. Uses a **read-mostly** key so a stray command cannot destroy data.
- **n8n MCP** — inspect/trigger workflows.
- **(Phase 2) marketing MCP** — post status updates to socials. Preferred wiring: **Postiz via its n8n node**, called through the n8n MCP already present (no new plumbing); alternatively a thin MCP wrapping Postiz's Public API. Postiz is self-hosted as its own cloud container (Docker + Postgres), consistent with the no-personal-machine constraint.

Tool list stays **curated, not maximal** — every added MCP widens blast radius. The approval gate (6.3) is what keeps a broad tool set safe.

### 6.3 Human-in-the-loop (native to the SDK)
Use the Agent SDK's **tool-permission callback**. Every *mutating* tool call (file write, commit, deploy, social post) is intercepted: the bot posts the proposed diff/plan/draft to `#cockpit` and only proceeds on `go`; `cancel` drops it. Read-only tool calls run without a prompt, so diagnosis stays fast.

### 6.4 Deploy flow (two-gate)
1. Operator approves the change → Claude commits to a **branch** and pushes → Vercel builds a **preview**; the preview URL is posted to `#cockpit`.
2. Operator reviews the preview → replies `ship` → the branch is promoted/merged to **production**.

Rationale: Rostiro processes **real Stripe payments**; one extra tap buys a real safety net. (A `hotfix` fast-path for trivial copy/banner flips may be added later, out of v1 scope.)

### 6.5 Security
- **Locked to a single Discord user ID and the single `#cockpit` channel.** All other users/channels ignored.
- **Scoped tokens:** GitHub deploy token limited to the one repo; Vercel token limited to the one project; read-mostly Supabase key for the MCP.
- **Full audit trail:** every action appears in the Discord channel log and in git history.
- **No secret in repo or on a personal machine** — all in Fly secrets.

### 6.6 Error handling
- Container crash → Fly restarts it; `discord.js` auto-reconnects. Subsystem A's alerts are unaffected (separate, in n8n).
- Failed apply/deploy → status reported back to `#cockpit`; never leaves a half-applied change (wrap apply+deploy, report outcome).
- Agent/tool error → surfaced in `#cockpit` with the error text, not swallowed.

## 7. Sequencing (phased)

1. **Phase 1 — Finish Subsystem A.** Circuit-breaker alert next (highest Sunday risk), then cron heartbeat, then sale ping / countdown / cost digest. Reuses the proven pattern; low risk; gets a safety net up in days. Commit each workflow's JSON to `automations/n8n/`.
2. **Phase 2 — Stand up Subsystem B v1.** Fly container + Discord bot + Agent SDK with Supabase/n8n/git tools; human-in-loop gate; two-gate deploy. Code cockpit only.
3. **Phase 3 — Add the marketing MCP.** Postiz (self-hosted) reachable via the n8n node → the cockpit can draft + (on approval) post status updates. Completes the Sunday scenario end to end.

## 8. Testing

- **A:** insert test rows into the source table (as done for the pager) → verify Discord and, for urgent alerts, SMS. Verify update-triggered alerts fire only on the real transition (`old_record` gate), not every write.
- **B:** end-to-end dry run in `#cockpit` on a throwaway branch — message → propose → `go` → apply → preview → `ship`. Verify: the permission gate **blocks an unapproved** mutating action; an **unauthorized user is ignored**; a deploy failure reports cleanly.

## 9. Risks & lessons

- **Shared-secret drift** (the v1 outage): sender and verifier secrets must match exactly; n8n 403-rejects mismatches *before* creating an execution, so failures are invisible in the Executions list. Mitigation: store the canonical secret once; verify with a direct authed `curl` after any change.
- **Blast radius grows with each MCP.** Keep the tool list curated; rely on the approval gate; use least-privilege keys.
- **Postiz MCP specifics unverified.** Design routes through the Postiz **n8n node** (verified to exist) rather than an unconfirmed MCP; revisit if a first-class Postiz MCP is confirmed.
- **Cost:** Fly container ~$5/mo; Postiz self-host adds a container + Postgres. Both cloud, both small.

## 10. Out of scope (v1 / YAGNI)

- Inbound SMS command parsing (SMS stays one-way).
- Multi-user / team access to the cockpit.
- A `hotfix` single-gate fast path.
- Rebuilding any in-app cron in n8n (the product's automation stays code on Vercel — `System_Map` §3).
- Auto-posting without approval (violates the honesty contract by construction).

---

*Rostiro Cloud Ops design v1 — 2026-07-12. Run Every League.*
