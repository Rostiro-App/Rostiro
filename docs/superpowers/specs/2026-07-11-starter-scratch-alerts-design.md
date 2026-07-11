# Starter Scratch Alerts (T-163) — Design Spec

**Date:** 2026-07-11
**Status:** Approved design → ready for implementation plan
**Context:** Closes the highest-stakes gap in Rostiro's news pipeline, traced in full 2026-07-11. Today, a starter ruled OUT ~90 minutes before kickoff (healthy that morning) never reaches the user through Rostiro — `injury_status` refreshes once/day (~5am ET from Sleeper's 5MB player payload), and the only fast pipeline (ESPN RSS, 15 min) is prose-only: it never updates status, never pushes, and only surfaces as a passive `player_news` card on next Pulse open. This is the "Option D" mitigation from that analysis, plus the UX layer required to introduce genuinely urgent, fast-moving alerts into a system deliberately designed for calm.

**Scope (v1):** ESPN-headline-derived scratch detection → a fresh per-player scratch signal that drives **both** a reversal-safe in-app Pulse card **and** a Pro-gated, cross-league-collapsed push, for **starters only**, gated by confidence. **Explicitly out of scope:** a faster structured injury feed (Options A/B from the gap analysis — a separate future track), ESPN/Yahoo game-day support, bench players, medium-confidence pushes, and any batching/coalesce window.

**Guiding tension:** Rostiro's positioning is *calm competence* — Pulse is a once-daily, self-reconciling decision list, and live noise (touchdowns/scores) is correctly routed to the Interrupt/LIVE surfaces, never to Pulse. This is the first genuinely urgent, fast-moving event allowed into that calm system. **Speed alone is not the win; speed plus restraint is.** Multi-league aggregation — our core value prop — is also a notification-volume multiplier, so cross-league collapse and confidence-gating are load-bearing, not polish.

---

## Locked decisions (founder, 2026-07-11)

1. **Signal + both outputs.** One new scratch signal feeds both the fingerprint card (reversal-safe) and the engagement_log push. Card and push must not diverge.
2. **Fire fast, no batching window.** Same-tick cross-league grouping already collapses the one-player-N-leagues case to one push; different players in different 15-min ticks get separate pushes.
3. **Deterministic keyword classifier.** No Claude in the push-gate path; the news cron stays deterministic by design.
4. **Pro-only, Sleeper-only** for the push, consistent with every existing push trigger. Free tier still gets the in-app card.

---

## What is reusable vs. net-new

**Reusable (do not reinvent):**
- ESPN RSS ingestion + `matchPlayerIds` player-tagging (`app/api/cron/news`, `lib/newsRelevance.ts`).
- Cross-league grouping: `detectTouchdownSwings`' `byUser` map that fires **one push per user** naming every affected league.
- Starter determination: `myRoster.starters` (Sleeper) + the Pulse builder's `starterSet`.
- Per-user one-shot dedup: `claimTrigger` + `engagement_log` (see the per-user confirmation below).
- Push delivery: `pushToUser` → `sendPushNotification` (OneSignal), Pro-gate + subscription lookup.
- Fingerprint reconciliation: `syncPulseItems`' `injury:{league}:{player}:{status}` fingerprint — already handles status-change, reversal, snooze, and no-resurrect.
- The persistent Pulse `injury_alert` builder in `lib/pulse.ts`.

**Net-new:**
- `lib/scratchClassifier.ts` (deterministic classifier + ESPN→Sleeper vocab normalization).
- `player_scratches` table (the fresh signal).
- News-cron extension: classify → upsert scratches → invoke the push detector.
- `detectStarterScratches` in `lib/engagementTriggers.ts`.
- `buildPulseItemsForUser` merge of `player_scratches` into the injury builder.
- Enforcement of the currently-cosmetic global `push_enabled` + a new `notify_scratches` preference (onboarding + settings).
- `migration_scratch_alerts.sql`, including a **CHECK-constraint alteration** on `engagement_log.trigger_type`.

---

## Per-user dedup — confirmed correct (documented to close the audit)

The push lane keys on `dedupe_key = scratch:{player}:{status}`. The `{userId}` is **not** in the string — it is carried by the `engagement_log.user_id` column, and uniqueness is the composite constraint. This rules out the "first user claims globally, everyone else silently gets no push" bug.

`supabase/migration_engagement_triggers.sql:11-18`:
```sql
create table if not exists public.engagement_log (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  trigger_type text not null check (trigger_type in ('touchdown_swing', 'lineup_lock', 'mission_complete')),
  dedupe_key   text not null,
  sent_at      timestamptz not null default now(),
  unique (user_id, trigger_type, dedupe_key)   -- composite, user-scoped
);
```
`claimTrigger` inserts `{ user_id, trigger_type, dedupe_key }`, and `detectStarterScratches` (like `detectTouchdownSwings`) calls it **inside a per-user loop** with each user's own `userId`. Two users rostering the same scratched starter each claim independently.

---

## Data flow (end to end)

```
ESPN RSS  (news cron, */15 * * * *)
   │  fetchEspnNflNews() + matchPlayerIds()            [reuse]
   ▼
classifyScratch(headline, summary) → {status, confidence} | null   [NEW, deterministic]
   │  normalize ESPN language → Sleeper vocab (Out/Doubtful/Questionable)
   ▼
upsert player_scratches (one current row per player)   [NEW table]
   │
   ├─────────────────────────────► CARD  (fingerprint lane, reversal-safe)
   │   buildPulseItemsForUser reads player_scratches for rostered players,
   │   merges with players_cache injury_status ("freshest / most-severe wins"),
   │   emits injury_alert under the SAME injury:{lg}:{player}:{status}
   │   fingerprint → syncPulseItems gives reversal + no-resurrect + snooze free.
   │   Free + Pro. Medium-confidence lands here (card only).
   │
   └─────────────────────────────► PUSH  (engagement_log lane, one-shot)
       detectStarterScratches (invoked from the news cron after upsert):
         load Sleeper leagues + rosters (reuse touchdown's roster cache)
         build byUser map over HIGH-confidence scratches:              (#1)
           for each user: which of their STARTERS are scratched,       (#2)
           across which leagues
         per user:
           gate: isPro && push_enabled && notify_scratches             (#4)
           gate: confidence === 'high'                                 (#3)
           claimTrigger(userId, 'starter_scratch',
                        `scratch:{player}:{status}`) one-shot           (#6-push)
           pushToUser(title, "…Starting in {League} +N others", url)   (#5)
```

## The six UX principles → where each slots in

| # | Principle | Mechanism |
|---|---|---|
| 1 | One push per user, cross-league collapsed | `byUser` map (reuse touchdown pattern). One `player_scratches` row → one push naming all affected leagues. |
| 2 | Starters only, no v1 exceptions | Filter each user's scratched players to `myRoster.starters`. Bench scratches never push (they may still appear as the existing free bench injury_alert card). |
| 3 | Confidence-gated, not binary | `classifyScratch` returns `confidence`. **High → push + card. Medium → card only, never push.** |
| 4 | Preference, default on, at onboarding | Enforce global `push_enabled` in `pushToUser` (fix latent bug) **and** new `users.notify_scratches` (default `true`), toggled at onboarding + settings Notifications. |
| 5 | "Why you got this" line | Message formatter: `"{Player} — ruled out. Starting in {topLeague}{ +N others}."` (reuse free-text payload; `affectedLeagues` already available). |
| 6 | Reuse fingerprint/reconciliation, no separate lane | **Card** uses the existing `injury:` fingerprint (reversal/no-resurrect free). **Push** uses `engagement_log` with a **status-in-key** dedupe so an escalation (questionable→out) re-pushes but a flip-flop back does not. |

---

## Components (net-new detail)

### 1. `lib/scratchClassifier.ts` (pure, unit-tested)
```ts
export type ScratchStatus = 'out' | 'doubtful' | 'questionable'
export type ScratchConfidence = 'high' | 'medium'
export interface ScratchClassification { status: ScratchStatus; confidence: ScratchConfidence }
export function classifyScratch(headline: string, summary: string | null): ScratchClassification | null
```
- **High-confidence (→ status `out`):** `ruled out`, `inactive`, `will not play`, `won't play`, `won’t play`, `declared out`, `downgraded to out`, `out for (the game|today|week)`.
- **Medium-confidence:** `doubtful` (→ `doubtful`), `questionable`, `limited (in )?practice`, `did not practice`/`dnp`, `game-time decision`, `trending toward`.
- **Reversal/positive language** (`will play`, `active`, `expected to play`, `cleared`, `upgraded`) → returns `null` (no scratch); reversal handling is primarily the card's job (fingerprint stale-cleanup) and the next daily Sleeper sync.
- Case-insensitive, word-boundary matched, evaluated against `headline + ' ' + (summary ?? '')`. First high match wins over medium. Pure and deterministic — no network, no Claude.
- **Normalization** is the whole point: it maps varied ESPN prose onto the exact Sleeper `injury_status` vocabulary so the card fingerprint (`injury:{lg}:{player}:{status}`) reconciles with Sleeper-sourced rows instead of colliding (Tradeoff D).

### 2. `player_scratches` table (`migration_scratch_alerts.sql`)
```sql
create table if not exists public.player_scratches (
  player_id    text not null,
  platform     text not null default 'sleeper',
  status       text not null check (status in ('out','doubtful','questionable')),
  confidence   text not null check (confidence in ('high','medium')),
  source       text not null default 'espn_news',
  news_id      text,
  headline     text,
  detected_at  timestamptz not null default now(),
  primary key (player_id, platform)
);
create index if not exists player_scratches_detected_idx on public.player_scratches (detected_at);
```
- **One current row per player** (upsert on `(player_id, platform)`). A newer headline overwrites; escalation (questionable→out) updates `status` + `detected_at`.
- **Freshness window:** readers (card builder + push detector) only consider rows with `detected_at` within a bounded recent window (design default: **the current NFL game day / last ~18h**), so post-game or stale scratches age out rather than resurfacing. The exact window is an implementation constant, documented in the plan.
- Admin-written only (cron). RLS: enable + a read policy only if any client ever needs it; the cron uses the admin client. Add to `grants.sql`.

### 3. News-cron extension (`app/api/cron/news`)
After the existing tag + upsert of `news_items`, and **still deterministic (no Claude)**:
1. For each relevant item, `classifyScratch(headline, summary)`; for hits, upsert `player_scratches` for each tagged `player_id`.
2. After upserts, call `detectStarterScratches(admin)` (best-effort `.catch(() => {})`, same posture as the live-scores cron's trigger calls).

### 4. `detectStarterScratches` (`lib/engagementTriggers.ts`)
Mirrors `detectTouchdownSwings`:
- Read recent **high-confidence** `player_scratches` (within the freshness window).
- `loadSleeperLeagues` + roster cache (reuse). Build `byUser`: for each user, the set of their **starters** that are scratched, and the league names.
- For each `[userId, info]`:
  - Gate: `!isFreePlan` (Pro), `push_enabled`, `notify_scratches` (see §5). If any fails, **skip the push** (the card still exists via the builder).
  - `claimTrigger(admin, userId, 'starter_scratch', ` + `` `scratch:${playerId}:${status}` `` + `)` — per scratched starter, so multiple scratched starters for one user in the same tick each claim (and are named together in a single push; see message format). One-shot: escalation re-pushes, flip-flop does not.
  - `pushToUser(admin, userId, title, message, url)`.
- `insertPulseItem` is **not** called here — the persistent record comes from the fingerprint builder (§6), avoiding a duplicate card. (An interrupt-overlay surface for in-app immediacy is a deliberate v1.1 candidate, held back for restraint.)

### 5. Preferences (`push_enabled` + `notify_scratches`)
- **Fix the latent bug:** `pushToUser` currently checks only `isFreePlan` + subscription; it must also read `users.push_enabled` (today stored + toggled in settings but never enforced — the settings copy even says "ships soon"). Gate: `push_enabled === false` → return (no push). This makes the existing global toggle real for **all** triggers, not just scratches.
- **New per-type pref:** `users.notify_scratches boolean not null default true` (`migration_scratch_alerts.sql`). Read in `detectStarterScratches`' gate.
- **Onboarding surface:** a single, plain toggle — *"Get notified the moment a starter is ruled out"* — **on by default**, in the onboarding notifications step, with an easy opt-down. Also in the settings Notifications section alongside the global push toggle.
- Settings API (`app/api/settings/route.ts`) extends its existing `push_enabled` handling to also read/write `notify_scratches`.

### 6. Card path (`buildPulseItemsForUser`, `lib/pulse.ts`)
- Fetch active `player_scratches` (within window) for the user's rostered players.
- In the injury loop, resolve each rostered player's effective status by taking the **most severe** of the two currently-valid signals (Sleeper `players_cache.injury_status` and an in-window `player_scratches.status`), ranked `out > doubtful > questionable`; `detected_at` breaks a true severity tie only. This deliberately prevents a milder-but-newer headline from masking a more severe standing designation. A genuine reversal is not handled by downgrading here — it's handled by `classifyScratch` returning `null` (no new scratch upsert), the scratch row aging out of the freshness window, and the next daily Sleeper sync reclaiming the authoritative status; the fingerprint stale-cleanup then removes the card.
- Emit `injury_alert` under the **unchanged** `injury:{league}:{player}:{status}` fingerprint, so `syncPulseItems` gives reversal, no-resurrect, and snooze for free. Free + Pro; medium-confidence scratches surface here (card only).
- Reasoning text may note the source when it's news-derived ("reported ruled out") vs. the Sleeper designation — implementation detail for the plan.

### 7. `migration_scratch_alerts.sql`
- `create table player_scratches` (§2) + index.
- `alter table users add column if not exists notify_scratches boolean not null default true`.
- **CHECK-constraint alteration on `engagement_log`** — required, or every `claimTrigger` for the new type fails a `23514` check violation (which `claimTrigger` currently *throws* on, not a `23505` it treats as "already claimed"):
```sql
alter table public.engagement_log drop constraint if exists engagement_log_trigger_type_check;
alter table public.engagement_log add constraint engagement_log_trigger_type_check
  check (trigger_type in ('touchdown_swing','lineup_lock','mission_complete','starter_scratch'));
```
- `grants.sql` entry for `player_scratches`.
- **Deploy note:** like every migration in this repo, must be applied to Supabase as a deploy step (see the pending-migration reconciliation task).

Also update the `claimTrigger` `triggerType` TypeScript union and any `pulse_items` type checks to include `'starter_scratch'` where relevant.

---

## Tradeoffs recorded (decided)
- **Card/push scope:** signal + both outputs (not push-only) — card and push stay consistent; #6 honored for scratches.
- **No batching window:** the feared cross-league multiplier is a *single* news event and collapses in one tick; separate players in separate ticks get separate pushes. Accepts occasional two-in-a-row pushes in exchange for speed and simplicity.
- **Deterministic classifier:** brittle to novel phrasing, but transparent, cheap, Claude-free, and — because a push can't be unsent — deliberately conservative (high-confidence pushes only). A false-positive *card* self-heals via fingerprint reversal; a false-positive *push* is already delivered, which is exactly why medium never pushes.
- **Pro + Sleeper only:** consistent with the existing push model; revisit free-tier "trust lever" framing only with a deliberate pricing decision.

## Error handling
All best-effort, matching the codebase: a classifier miss, a failed scratch upsert, or a push failure never breaks the news cron or the Pulse build. `detectStarterScratches` is wrapped in `.catch(() => {})` at the call site; individual per-user/per-league failures `continue` rather than abort the run.

## Testing (vitest, pure-function-first)
- `classifyScratch`: high/medium/negative matrix; reversal language → null; case-insensitivity; word boundaries (no false hit on "outstanding"/"questionably").
- ESPN→Sleeper vocab normalization correctness.
- `byUser` cross-league grouping: one player in N leagues → one grouped result.
- Dedup semantics: no re-push on flip-flop (out→questionable→out within window claims once per distinct status); escalation (questionable→out) is a new key → pushes.
- Preference gating: `push_enabled=false` or `notify_scratches=false` or free plan → no push; card still built.
- Message formatting: 1 league vs. N leagues ("+N others").
- Card merge: news-derived scratch produces an `injury_alert` under the expected fingerprint; reversal removes it on rebuild.

## Honesty & marketing guardrails (must ship with the feature)
- Latency is **~15 min** (ESPN RSS cadence), **headline-derived**, **high-confidence only**, **Pro + Sleeper only**.
- ✅ Claimable: *"Rostiro pings you when your starter's ruled out, within minutes of the news breaking — one alert across all your leagues."*
- ❌ Not claimable: "instant," "real-time," "never miss a scratch," or any structured-feed guarantee.
- This is the pre-Week-1 mitigation. The structured-injury-feed fix (gap-analysis Options A/B) is a separate future track; `player_scratches` is deliberately the seam where a faster source would later write **instead of / alongside** ESPN, so v1 doesn't paint that track into a corner.

## Effort
Low–Medium; pre-Week-1 feasible. ~70% reuse; net-new surface is contained (one classifier, one table, one detector, one builder-merge, one preference).
