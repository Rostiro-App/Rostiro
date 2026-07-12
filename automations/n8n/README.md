# Rostiro n8n Automations

Cloud n8n workflows that watch the app's Supabase tables and alert the operator. These live in **n8n Cloud**; the JSON exports and this runbook are version-controlled here so they're reproducible and portable to self-hosted later.

**Design source:** `Rostiro_System_Map_v1.md` §3.A (Reliability & monitoring).

**Pattern (shared by all "watch a table" workflows):**
```
Supabase DB Webhook (push)  →  n8n Webhook (Header Auth)  →  format  →  Discord  [+ Twilio SMS]
```
Push, not polling: event-driven, near-instant, and it keeps the database connection string out of n8n Cloud. Supabase sends `{ type, table, schema, record, old_record }`; `old_record` is what lets update-based workflows fire only on a state transition.

**Secrets never live in this repo.** Workflow JSON references credentials by name; real values (Twilio token, Discord webhook URL, the Supabase→n8n shared secret) live only in n8n Cloud credentials and the Supabase webhook config. Keep a copy in a password manager.

**Two notification channels — positive vs negative.** Money/good-news events post to **`#wins`** (credential `Discord Wins Webhook`); errors/monitoring/bad-news post to **`#alerts`** (credential `Discord Webhook account`). A 💰 should never look like a 🔴. Current split: `#alerts` = error pager, circuit-breaker, cron heartbeat · `#wins` = sale ping (and, later, Founding-500 milestones + new-signup pings).

---

## Shared secret (once, for all workflows)

Generate a secret that authenticates Supabase → n8n so nobody else can POST fake alerts:
```
openssl rand -hex 24
```
Save it in your password manager as `SUPABASE_N8N_WEBHOOK_SECRET`. Every Supabase webhook sends it as `Authorization: Bearer <secret>`; every n8n Webhook node verifies it via a Header Auth credential.

---

## Workflow 1 — Error-Log Pager  🔴 monitoring

Fires a Discord alert on every new row in `public.app_error_log`. (That table has no severity column — every row is already an error. Add a `source` filter later only if it gets chatty.)

**Nodes:** Webhook → Code → Discord.

### n8n build
1. New workflow → name **"Rostiro — Error Log Pager"**.
2. **Webhook** node:
   - HTTP Method `POST`, Path `error-log-pager`
   - Authentication **Header Auth** → new credential:
     - Header **Name:** `Authorization`
     - Header **Value:** `Bearer <SUPABASE_N8N_WEBHOOK_SECRET>`
   - Respond: **Immediately**
3. **Code** node (JavaScript), connected from Webhook:
   ```js
   const body = $json.body || {};
   const rec = body.record || {};
   const message = (rec.message || '(no message)').toString().slice(0, 800);
   const source = rec.source || 'unknown';
   const when = rec.created_at || new Date().toISOString();
   let ctx = '';
   if (rec.context) {
     const c = JSON.stringify(rec.context);
     ctx = '\n```' + (c.length > 400 ? c.slice(0, 400) + '…' : c) + '```';
   }
   const content = `🔴 **Rostiro error** · \`${source}\`\n${message}${ctx}\n_${when}_`;
   return [{ json: { content } }];
   ```
4. **Discord** node, connected from Code:
   - Resource **Message**, Operation **Send**, Connection **Webhook**
   - New Discord Webhook credential → paste the `#alerts` Incoming Webhook URL
   - Message / content: `{{ $json.content }}`
5. **Save**, toggle **Active**, copy the **Production URL** from the Webhook node.

### Supabase webhook
Database → Webhooks → Create a new hook:
- Name `error_log_pager` · Table `public.app_error_log` · Events **Insert**
- Type HTTP Request · Method `POST` · URL = n8n Production URL
- HTTP Header: `Authorization` = `Bearer <SUPABASE_N8N_WEBHOOK_SECRET>`

### Test
Supabase SQL editor:
```sql
insert into app_error_log (source, message, context)
values ('n8n-test', 'Test alert from setup', '{"ok":true}'::jsonb);
```
Expect a Discord `#alerts` message within ~1–2s. If nothing: check n8n **Executions** (did it trigger? auth ok?) and the Supabase webhook's delivery log.

---

## Workflow 2 — Circuit-Breaker Alert  🔴 monitoring  ✅ built (Discord; SMS pending Twilio)

Watches `public.circuit_breaker_state`; fires a Discord alert only on the transition to *open* (`new.opened_until` in the future AND `old.opened_until` null/past). Twilio **SMS** is designed in but not wired yet — it needs a Twilio account + credential (see "Twilio setup", below).

**Nodes:** Webhook → Code (`Gate + Format`) → Discord. Same shape and shared secret as Workflow 1. Committed export: `circuit-breaker-alert.json`. n8n production path: `/webhook/circuit-breaker-alert`.

**Double-gated on the transition** (so routine breaker writes never page you):
1. **Supabase side** — the trigger has a `WHEN` clause, so Postgres only calls n8n on the real closed→open transition (no n8n execution is spent on failure-count increments/resets).
2. **n8n side** — the Code node re-checks the transition and returns 0 items otherwise, so Discord is skipped. Belt and suspenders.

### Supabase trigger (created via migration `add_circuit_breaker_alert_webhook`)
```sql
create trigger circuit_breaker_alert
after update on public.circuit_breaker_state
for each row
when (
  new.opened_until is not null
  and new.opened_until > now()
  and (old.opened_until is null or old.opened_until <= now())
)
execute function supabase_functions.http_request(
  'https://rostiro.app.n8n.cloud/webhook/circuit-breaker-alert',
  'POST',
  '{"Content-Type":"application/json","Authorization":"Bearer <SUPABASE_N8N_WEBHOOK_SECRET>"}',
  '{}',
  '5000'
);
```
The table is pre-seeded one row per platform (`claude`, `espn`, `sleeper`) and updated in place, so an `after update` trigger is sufficient — no insert path needed.

### Test (safe — never leaves the real breaker open)
Trip and reset in one transaction; the trigger still fires on statement 1, but the app never sees an open breaker:
```sql
update public.circuit_breaker_state
  set opened_until = now() + interval '5 minutes', consecutive_failures = 5
  where platform = 'espn';
update public.circuit_breaker_state
  set opened_until = null, consecutive_failures = 0
  where platform = 'espn';
```
Expect one Discord `#alerts` message within ~1–2s. Verify via n8n Executions + `net._http_response` (status 200).

### Twilio setup (needed before SMS on this + the cron heartbeat)
1. Create a Twilio account, buy a number, note the **Account SID** + **Auth Token**.
2. In n8n → Credentials → new **Twilio API** credential with those values.
3. Then the urgent alerts add a parallel **Twilio** node off the same `Gate + Format` output (multi-channel branch, per the notification best-practice: one condition → Discord + SMS in parallel).

---

## Workflow 3 — Cron Heartbeat  🔴 monitoring  ✅ built (Discord; SMS pending Twilio)

Catches the failure the error pager can't: a Vercel cron that **stops running entirely**, so there's no `app_error_log` row to page on. (Error pager = "a cron ran but errored"; heartbeat = "a cron stopped running".)

**How it works (push, like the others — no DB creds in n8n):**
1. Each cron route calls `recordCronRun('<name>')` right after its auth guard (`lib/cronHeartbeat.ts`), stamping `public.cron_heartbeat.last_run_at`. Best-effort, never throws — a heartbeat write can't break a Sunday score sync.
2. A Supabase **pg_cron** job runs `check_cron_heartbeats()` every 2 min. It compares each row's `last_run_at` against its `stale_after` and `net.http_post`s to the n8n webhook **only on a state change**: stale (once) and recovered (once). Re-alert suppression via `alerted_at`.
3. n8n: Webhook → Code (`Format`, branches on `event`) → Discord. Export: `cron-heartbeat.json`. Path `/webhook/cron-heartbeat`.

**Thresholds** (`stale_after`, seeded per cron — easily tuned in the table): live-scores **5 min**, news **20 min**, the five daily crons **26 h**. The stamp is placed *after auth but before any work*, so it means "the handler was invoked" — live-scores stamps every minute even off-season when it no-ops.

**Migration:** `supabase/migration_cron_heartbeat.sql` (applied as `add_cron_heartbeat_table` + `add_cron_heartbeat_checker`).

### ⚠️ Arm it AFTER the app deploy
The pg_cron schedule is intentionally **not** created until the deploy shipping `recordCronRun()` is live and `last_run_at` values are advancing — otherwise the seeded rows age out and false-alarm. Once deployed and verified:
```sql
create extension if not exists pg_cron;
select cron.schedule('cron-heartbeat-check', '*/2 * * * *',
                     $$select public.check_cron_heartbeats()$$);
```

### Test (no app or deploy needed)
Fully exercised via a throwaway row: make it stale → `select check_cron_heartbeats()` → Discord `STALLED`; run again → silent (dedup); set `last_run_at = now()` → `recovered`; delete the row. Verify via n8n Executions + `net._http_response` (200).

---

## Workflow 4 — Sale Ping  💰 revenue  ✅ built & verified

Posts to **`#wins`** (not `#alerts`) when a user upgrades into or between paid plans, or is assigned a Founding 500 number. First **positive** notification — separate channel + credential from the error alerts.

**Nodes:** Webhook → Code (`Format`) → Discord (`Discord Wins Webhook`). Export: `sale-ping.json`. Path `/webhook/sale-ping`.

**Sale = an upward move** (gated in the trigger via `plan_rank`, so the season-pass-expiry downgrade never pings). Plan map (from `lib/stripe.ts`): `pro` = Rostiro Pro $9.99/mo · `starter` = Founder Season Pass $59 · `commissioner` = Founding 500 $149 lifetime (+ `founding_number`).

**Migration:** `supabase/migration_sale_ping.sql` (applied as `add_sale_ping_webhook`) — adds `plan_rank(text)` + the `sale_ping` trigger on `public.users`.

### Test (no real charge, no user-row change)
Verified by POSTing a simulated `users` update straight to the webhook (`record.plan='commissioner'`, `founding_number=127`) → `#wins` got `🏆 New sale · Founding 500 — $149 lifetime · #127`. The trigger→n8n path is identical to Workflow 2 (already proven end-to-end), and `plan_rank` was checked directly; real paying rows were never mutated.

---

## Workflow 5 — Wins Events (signups + Founding-500 milestones)  💰 growth  ✅ built & verified

Two more **`#wins`** pings in one workflow, branched by `event`:
- **New signup** — `handle_new_user()` creates a `public.users` row on auth signup, so an insert = a real signup. Ping: `🎉 New signup! — that's N total.`
- **Founding-500 milestones** — at `founding_number` 100 / 250 / 400 / 500. Ping: `💯 100 Founders!` … `🏁 FOUNDING 500 SOLD OUT`.

**Nodes:** Webhook (`/webhook/wins-events`) → Code (`Format`, branches on `event`) → Discord (`Discord Wins Webhook`). Export: `wins-events.json`.

**PII-safe by design:** unlike the generic Supabase webhook (which ships the whole row, incl. email), these use **custom trigger functions** (`notify_new_signup`, `notify_founding_milestone`) that `net.http_post` **only** `event` + `total`/`number`. No email or stripe id ever leaves the DB. Milestone trigger is transition-gated (`old.founding_number is distinct from new`), so it fires once per threshold.

**Migration:** `supabase/migration_wins_events.sql` (applied as `add_wins_events_triggers`).

### Test (no user-row change)
Both events POSTed straight to the webhook → `#wins` showed `💯 100 Founders!…` and `🎉 New signup! — that's 142 total.` Triggers confirmed installed on `public.users`.

---

## Verified export

Once a workflow works, export it from n8n (⋯ → Download) and commit the JSON here (`error-log-pager.json`, `circuit-breaker-alert.json`). The working workflow is the source of truth for the JSON — not a hand-written guess.
