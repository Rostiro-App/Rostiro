# Rostiro Marketing Docs — Index

**What this is:** the map of every marketing-relevant document in this repo, current status, and who reads what. Not a new source of truth — just a clean way to see the whole set at a glance instead of guessing from filenames. Update this whenever a marketing doc is added, retired, or superseded.

**Jarvis's actual reading list lives in `rostiro-cockpit/src/agents/marketing.ts`'s REFERENCE DOCS section** — this index should always match it for the "current" docs below; if they ever drift, the code is the one that governs what Jarvis really reads.

---

## Current — read these for anything active

| Doc | Purpose | Who reads it |
|---|---|---|
| [`Rostiro_Marketing_System_v2.md`](Rostiro_Marketing_System_v2.md) | The full strategy: content pillars, News Desk workflow, phased launch calendar, brand voice guide, honesty contract. | Jarvis (always) + Claude Code |
| [`Rostiro_Growth_Execution_Jul2026.md`](Rostiro_Growth_Execution_Jul2026.md) | The actual day-to-day plan — X-only cadence, reply playbook, Intel Sheets, the 2-week content calendar, Today's Checklist. This is "what do I do today." | Jarvis (always) + Claude Code + Lawrence directly |
| [`Rostiro_Cockpit_Operator_Manual_v1.md`](Rostiro_Cockpit_Operator_Manual_v1.md) | How Lawrence actually operates the Discord cockpit — commands, approval flow. | Jarvis (when asked how something works) |
| [`Rostiro_Marketing_Toolstack_v1.md`](Rostiro_Marketing_Toolstack_v1.md) | Tool-by-tool runbook — Postiz, Feedly, F5Bot, Discord, X Lists setup. Mechanics, not strategy. | Jarvis (when a question is about a specific tool) |
| [`Rostiro_System_Map_v1.md`](Rostiro_System_Map_v1.md) | Cross-repo picture — n8n automations, the cockpit, what's live vs. pending. | Jarvis (when a question spans beyond marketing) |
| [`rostiro-brand-kit.md`](rostiro-brand-kit.md) | Brand voice/color/type reference. **Known to drift from the real shipped code** (e.g. it still lists an old `draft` state color) — `marketingAssets/brandTokens.ts` in the cockpit repo is the actual source of truth for colors, this doc is the source of truth for voice/tone. | Jarvis (brand judgment calls), rarely needs a full read since the agent's own prompt has the real color values inline |

## Still in the repo root, not archived — actively referenced

| Doc | Why it's still here |
|---|---|
| [`Rostiro_Marketing_System_v1.md`](Rostiro_Marketing_System_v1.md) | Superseded by v2 (has its own banner saying so), **but v2 still points into 5 of its sections** (Reddit templates, Discord structure, Product Hunt plan, X/TikTok script banks) rather than duplicating them. Moving it would break those references — leave it in place. |

## Archived — `archive/marketing-history/`

The research-to-plan lineage that predates the current strategy: `deep-research-report (1).md` → `Rostiro_Marketing_Brief.md` → `Rostiro_Marketing_Plan_v1.md`. None of these are referenced by any current doc — moved 2026-07-15 to de-clutter the repo root. See the README in that folder for the full chain.

## Adjacent, out of scope for this index (not touched)

These exist in the repo root but aren't marketing docs — flagging for awareness, not acted on:
- `Rostiro_PRD_v3_Final.md` / `Rostiro_PRD_v4.md` — superseded by `Rostiro_PRD_v5.md` (the real current PRD), same clutter pattern as the marketing docs had, but product versioning is a separate decision from marketing — ask if you want these archived too.
- `Rostiro_Video_Shotlist.md`, `Rostiro_Behavior_Wiring_Plan.md`, `Rostiro_UX_Behavior_Spec.md`, `Rostiro_State_of_the_Union_Day3.md` — product/UX planning docs, companions to the PRD, not marketing.
