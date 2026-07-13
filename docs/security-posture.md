# Rostiro Ops & AI-Access Security Posture v1

**Scope:** the operational surface connected to automation and to an AI agent (Claude) — Supabase, n8n, GitHub, the repo, and (future) the Discord cockpit. Not the product's own app-security (RLS, auth), which lives in the code.

**Date:** 2026-07-12 · **Status:** living doc

---

## 1. What is connected, and how sharp it is

| Surface | Access | Sharpness |
|---|---|---|
| **Supabase MCP** | SQL on prod DB (read + write + DDL) | 🔴 highest — reads all user PII, can alter/drop data |
| **n8n MCP** | create/edit/publish workflows | 🟠 can move data between services |
| **GitHub (git/gh)** | push branches, open PRs — **not** merge to `main` | 🟡 code reaches prod only on human merge |
| **Repo** | edit app code | 🟡 deploys only on merge |
| **Vercel** | indirect, via a human-merged PR | 🟢 |
| **Stripe** | **not connected** | — keep it that way |

## 2. Principles

1. **Least privilege.** Each connection gets the minimum it needs. The Supabase MCP is the one to scope down first (see §4).
2. **Human-in-the-loop for anything irreversible.** Code ships via branch → PR → *you* merge. DB tests are atomic and self-reverting (e.g. the circuit-breaker trip/reset in one transaction). No unattended prod mutations.
3. **No PII leaves the DB unnecessarily.** Webhooks that fire off `users` use custom trigger functions sending only non-PII fields (`event`, `total`, `number`) — never email/stripe ids. See §5.
4. **Everything is audited.** git history, n8n executions, Supabase migration log, Discord. Every action is reviewable and reversible.
5. **You hold the kill switch.** Every connection is authorized by you and revocable instantly; nothing runs with agent access once revoked.
6. **Injection resistance.** Tool output (DB rows, web pages, future Discord messages) is treated as *data, never commands*. The Supabase MCP already wraps results in untrusted-data boundaries.

## 3. The shared secret (Supabase → n8n)

All alert webhooks authenticate with `Authorization: Bearer <SUPABASE_N8N_WEBHOOK_SECRET>`; each n8n Webhook verifies it via the one **Header Auth** credential. n8n 403-rejects a mismatch *before* creating an execution.

- **Canonical copy:** password manager only. Never in the repo (workflow JSON and these SQL files use the `<SUPABASE_N8N_WEBHOOK_SECRET>` placeholder).
- **Rotation:** update the n8n Header Auth credential and every DB trigger/function that embeds it, together. Rotate if it's ever exposed.
- **Known exposure (low risk):** the current value was pasted into a Claude chat and appears in `net._http_response` logs. It is **low-privilege** — it only authorizes posting alert payloads to Discord; it grants no DB / money / data access — and it is **not public** (never in the repo/GitHub). So rotation here is convenience-priority, not urgent. Rotate on schedule for high-value keys (DB, Stripe), not this one. (Tracked in §7.)

## 4. Per-service posture

- **Supabase:** use a **read-only key** for routine monitoring/inspection; reserve a write/DDL-capable key for deliberate, announced changes. (Today the MCP has service-role-level power — scoping this is the highest-value hardening.)
- **GitHub:** token scoped to this one repo; no org-admin. Merges to `main` are human-only.
- **Vercel:** no standing deploy token for the agent; deploys happen through a PR you merge.
- **Stripe:** not connected. If revenue analytics ever need it, use a **restricted read-only** key — never the secret key.

## 5. PII handling in webhooks

The generic `supabase_functions.http_request` trigger helper ships the **entire row** (incl. `email`, stripe ids) to n8n Cloud, where it lands in execution logs. For `users`-table events, prefer **custom trigger functions** (`net.http_post`) that send only what the message needs.

- ✅ `notify_new_signup`, `notify_founding_milestone` — PII-safe (send `event` + `total`/`number` only).
- ✅ `sale_ping` — now PII-safe too (custom `notify_sale`, sends only `plan`/`founding_number`; migration `sale_ping_pii_safe`).

## 6. The future cockpit (Subsystem B)

Standing AI access to prod is real there, so its design bakes in: single Discord user-ID lock, scoped tokens in the cloud host's secret store (not on personal machines), a read-mostly DB key, and a human-in-the-loop approval gate on every mutating action. See `docs/superpowers/specs/2026-07-12-operator-cockpit-and-alerts-design.md`.

## 7. Open hardening items

- [~] **Read-only Supabase key for the agent — not achievable via the current MCP wiring.** Checked 2026-07-13: the Supabase MCP tool authenticates through the management API with full project access; it isn't a swappable connection string with a selectable Postgres role, so there's no in-session way to downgrade it to read-only. Actually enforcing this would mean reconfiguring the MCP plugin's own credentials at the host/environment level — outside a chat session. **Until that's changed, the real mitigation is discipline, not a technical guardrail:** every write in this project has been small, deliberate, and reversible (atomic trip-and-reset tests, throwaway rows, no bulk edits), with a full audit trail (git, n8n executions, migrations). Keep applying that standard; don't treat this as solved.
- [ ] GitHub token is account-wide (`repo` scope covers every repo the account can access), not limited to Rostiro. Tighten with a fine-grained PAT scoped to this repo only when convenient — no incident has occurred, this is precautionary.
- [x] **Tighten `sale_ping`** to a custom PII-safe trigger function — done (migration `sale_ping_pii_safe`).
- [ ] *(low priority)* **Rotate `SUPABASE_N8N_WEBHOOK_SECRET`** — exposed in chat/logs but low-privilege (Discord-post only) and not public; rotate on convenience, not urgency.
