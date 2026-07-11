# ROSTIRO: Launch Validation & Founder Dashboard Specification v1.0

**Companion to:** `Rostiro_PRD_v5.md` and `Rostiro_Marketing_System_v2.md`  
**Date:** July 11, 2026  
**Owner:** Lawrence, Founder  
**Implementation target:** Claude Code  
**Priority:** Capture launch data immediately; complete the operating dashboard before the 2026 NFL regular season.

---

## 0. Purpose

Rostiro has a strong product thesis and a capable marketing-content system. The next risk is not whether the product can be built. The next risk is launching without enough evidence to determine:

1. Which marketing messages produce qualified users.
2. Whether users understand Rostiro's differentiation.
3. Where users abandon onboarding.
4. Whether users connect multiple leagues and reach a useful Pulse.
5. Whether they return and rely on Rostiro.
6. Whether live data, notifications, and Game Day systems are trustworthy.
7. Which users and behaviors convert to paid plans.

This document adds the validation, analytics, trust, and distribution systems required to answer those questions. It does not replace the existing PRD or marketing system. It provisions the measurement and feedback layer around them.

### The most important sequencing rule

**Event capture and campaign attribution must ship before meaningful marketing traffic begins. The full visual Founder Dashboard may ship afterward because it can query already-captured history.**

Do not delay the July marketing start solely to finish every chart. Do not send traffic before the critical acquisition, onboarding, connection, Pulse, and purchase events are being stored correctly.

---

## 1. Strategic corrections to adopt

### 1.1 Differentiation

Do not claim that no competitor aggregates multiple fantasy leagues. FantasyPros and other products already sync multiple leagues and provide cross-league tools.

Rostiro's defensible differentiation is:

> Other products give managers tools and information across their leagues. Rostiro continuously prioritizes what needs their attention and reshapes itself around the moment of the fantasy week.

Approved positioning hierarchy:

| Layer | Copy |
|---|---|
| Category | The operating system for fantasy sports |
| Tagline | Run Every League. |
| Primary promise | Know what needs you across every league. |
| Product mechanism | Rostiro Pulse monitors connected leagues and prioritizes the next decisions. |
| Emotional benefit | Calm control instead of tab-switching chaos. |
| Honest execution statement | Rostiro identifies what needs action and takes the user to the right platform when direct write access is unavailable. |

Recommended homepage explanation:

> Connect your fantasy leagues. Rostiro monitors every roster, matchup, injury, waiver opportunity, and deadline, then builds one prioritized Pulse of what needs you next.

### 1.2 Initial audience

Prioritize serious managers who:

- Manage at least three leagues.
- Have at least one Sleeper league.
- Draft during August.
- Regularly check player news and lineup status.
- Can articulate the pain of switching between platforms.

Sleeper is the preferred early activation path because username-based connection is the lowest-friction integration. ESPN remains an optional advanced unlock. Yahoo must be labeled according to its actual approval and availability state.

### 1.3 Product truth

Rostiro succeeds if users repeatedly trust Pulse to catch an important decision faster and more calmly than their existing routine. Feature count, video volume, total signups, and follower count are secondary.

---

## 2. North-star and supporting metrics

### 2.1 Primary north-star metric

**Weekly Activated Multi-League Managers (WAMM)**

A unique user counts as a WAMM for a rolling seven-day period when all conditions are true:

1. The user has at least two currently connected leagues.
2. Rostiro generated at least one non-empty Pulse for that user.
3. The user performed at least one meaningful action during the period.

Meaningful actions for v1:

- Open a Pulse item detail.
- Mark a Pulse item Done.
- Follow a deep link to act on a league platform.
- Run a start/sit or trade analysis.
- Use Draft Copilot during a connected draft.
- Open the LIVE companion during an active game.
- Open Film Room after a completed week.

Simply logging in or viewing the landing page does not count.

### 2.2 Activation definitions

**Basic activation:** one league connected, first non-empty Pulse generated, and one Pulse item opened or completed within the first seven days.

**Target activation:** at least two leagues connected, first non-empty Pulse generated, and one meaningful action within the first seven days.

**High-intent activation:** at least three leagues connected, notifications enabled, and two meaningful actions within the first seven days.

The dashboard must show all three. Marketing optimization should ultimately use Target Activation, not account creation.

### 2.3 Supporting metrics

| Category | Metrics |
|---|---|
| Acquisition | Unique visitors, CTA rate, account starts, accounts confirmed, source/campaign/content |
| Onboarding | Step completion, step abandonment, time per step, platform selected, connection attempts and outcomes |
| Activation | First league connected, second league connected, time to first Pulse, first action, activation rate |
| Engagement | Pulse opens, Pulse completion, analyses run, Draft Copilot sessions, LIVE opens, Film Room opens |
| Retention | Day 1, Day 7, Day 14, Week 4 return; weekly active connected users; WAMM |
| Notifications | Permission requested, enabled, denied, push sent, delivered when available, opened, disabled |
| Revenue | Trial starts, pricing gates, checkout starts, purchases, plan mix, cancellation, failed payment |
| Reliability | Sync success, sync latency, stale data, cron success, queue delay, alert delay, API/provider failures |
| Trust | Helpful, irrelevant, incorrect feedback; false alerts; reversals; support reports |

---

## 3. Analytics foundation

### 3.1 Build versus buy

Use the simplest architecture consistent with the existing stack. A third-party product analytics service may be used for exploratory funnels and session-level analysis, but the authoritative business and operational events must remain queryable from Rostiro's own data layer.

Do not make a third-party analytics SDK the only record of activation, subscription, platform connection, or operational reliability.

### 3.2 Event storage

Create an append-only analytics event table or reuse an existing equivalent after auditing the codebase.

Suggested table: `analytics_events`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key |
| `event_id` | text | Client/server idempotency key; unique where present |
| `event_name` | text | Allowlisted event name |
| `user_id` | uuid nullable | Authenticated user when known |
| `anonymous_id` | text nullable | First-party anonymous visitor identifier |
| `session_id` | text nullable | First-party session identifier |
| `occurred_at` | timestamptz | Event occurrence time |
| `received_at` | timestamptz | Server receipt time |
| `source_surface` | text nullable | Landing, onboarding, Pulse, Draft, LIVE, Film Room, pricing, etc. |
| `platform` | text nullable | Sleeper, ESPN, Yahoo when relevant |
| `properties` | jsonb | Allowlisted non-secret event properties |
| `utm_source` | text nullable | First-party campaign attribution |
| `utm_medium` | text nullable | First-party campaign attribution |
| `utm_campaign` | text nullable | First-party campaign attribution |
| `utm_content` | text nullable | Creative or hook identifier |
| `referrer_host` | text nullable | Host only; avoid unnecessary full URL storage |

Recommended supporting table or fields on `users`: `user_attribution`

- `first_touch_*`
- `last_touch_*`
- `first_landing_at`
- `account_created_at`
- `activated_at`
- `target_activated_at`
- `high_intent_activated_at`
- `first_paid_at`

Attribution should survive anonymous-to-authenticated conversion by associating the pre-signup `anonymous_id` and stored first-touch campaign with the confirmed user.

### 3.3 Ingestion rules

- Add an allowlisted event ingestion route, such as `POST /api/analytics/event`.
- Validate every body with Zod.
- Rate-limit anonymous ingestion.
- Limit payload size.
- Reject unknown event names and unknown high-risk properties.
- Never accept `user_id` from an untrusted client as authority. Derive authenticated identity server-side.
- Generate critical lifecycle events server-side whenever possible.
- Use idempotency for webhook, cron, purchase, notification, and connection events.
- Critical events must not depend exclusively on browser JavaScript completing successfully.
- Analytics failures must never block signup, league connection, Pulse generation, payment, deletion, or notification delivery.

### 3.4 Data that must never enter analytics

- ESPN cookies or OAuth tokens.
- Supabase, Stripe, Resend, OneSignal, Anthropic, Yahoo, or other secrets.
- Full authorization headers.
- Passwords or password-reset material.
- Full player-news bodies when a stable classification or ID is sufficient.
- Unbounded user-entered text.
- Private league credentials.
- Raw payment-card data.

Use internal league IDs, platform names, counts, status categories, and latency values. Avoid storing private league names unless explicitly necessary and approved.

### 3.5 Retention and aggregation

- Retain raw product events long enough to support launch-season cohort analysis.
- Create daily aggregates for dashboard speed once volume justifies them.
- Do not prematurely build a large warehouse.
- Ensure timestamps are stored in UTC and displayed in the founder's configured timezone.
- Document deletion behavior and whether analytics records are anonymized or deleted when an account is deleted.

---

## 4. Canonical event taxonomy

The exact names may be adjusted to match existing conventions, but semantic coverage must remain.

### 4.1 Acquisition

| Event | Authority | Required properties |
|---|---|---|
| `landing_viewed` | Client | path, campaign fields, referrer host |
| `primary_cta_clicked` | Client | CTA ID, surface, campaign content |
| `demo_started` | Client | demo type, surface |
| `pricing_viewed` | Client | surface |
| `waitlist_submitted` | Server | source/campaign, platform interest |

### 4.2 Authentication and onboarding

| Event | Authority | Required properties |
|---|---|---|
| `account_creation_started` | Client | source surface |
| `account_created` | Server | auth method |
| `email_confirmed` | Server | time since account creation |
| `onboarding_step_viewed` | Client | step ID |
| `onboarding_step_completed` | Client or server | step ID, duration |
| `onboarding_abandoned` | Derived | last completed step |
| `mode_selected` | Server after persistence | Focused, Balanced, Savant |
| `notification_permission_requested` | Client | browser/platform |
| `notification_permission_result` | Client/server | enabled, denied, skipped, unsupported |

### 4.3 League connections

| Event | Authority | Required properties |
|---|---|---|
| `league_connection_started` | Client | platform |
| `league_connection_succeeded` | Server | platform, league count added, latency |
| `league_connection_failed` | Server | platform, normalized error class, latency |
| `league_connection_abandoned` | Derived | platform, last step |
| `league_disconnected` | Server | platform, remaining league count |
| `espn_unlock_guide_started` | Client | entry surface |
| `espn_unlock_guide_completed` | Server | duration |
| `yahoo_early_access_requested` | Server | source/campaign |

### 4.4 Pulse and product value

| Event | Authority | Required properties |
|---|---|---|
| `pulse_generated` | Server | item count, league count, generation latency, state |
| `pulse_generation_failed` | Server | normalized error class, fallback served |
| `pulse_viewed` | Client | item count, state |
| `pulse_item_opened` | Client | item type, priority, platform, affected league count |
| `pulse_item_completed` | Server | item type, time since generated |
| `pulse_item_snoozed` | Server | item type, snooze duration |
| `pulse_item_dismissed` | Server | item type |
| `pulse_deep_link_followed` | Server redirect preferred | item type, platform |
| `recommendation_feedback_submitted` | Server | helpful, irrelevant, incorrect; item type |

### 4.5 Feature engagement

| Event | Authority | Required properties |
|---|---|---|
| `draft_copilot_session_started` | Server | platform, connected/live mode |
| `draft_recommendation_opened` | Client | round, picks until turn |
| `start_sit_analysis_completed` | Server | league count considered, plan |
| `trade_analysis_completed` | Server | plan, saved to Notes boolean |
| `live_companion_opened` | Client | active game count, affected league count |
| `film_room_opened` | Client | completed league count, week |
| `share_card_generated` | Server | card type, state |
| `share_initiated` | Client | card type, destination when known |

### 4.6 Billing

| Event | Authority | Required properties |
|---|---|---|
| `trial_started` | Server | plan entitlement, expiry date |
| `pricing_gate_encountered` | Server/client | feature, current plan |
| `checkout_started` | Server | product/price ID, source surface |
| `purchase_completed` | Stripe webhook | product, amount, currency |
| `purchase_failed` | Stripe webhook | normalized failure class |
| `subscription_canceled` | Stripe webhook | tenure, cancellation timing |
| `season_pass_expired` | Server cron | season |

### 4.7 Reliability and Game Day

| Event | Authority | Required properties |
|---|---|---|
| `platform_sync_completed` | Server | platform, duration, league count, freshness |
| `platform_sync_failed` | Server | platform, error class, retry state |
| `cron_completed` | Server | job name, duration, records processed |
| `cron_failed` | Server | job name, error class |
| `push_queued` | Server | trigger type, affected league count |
| `push_sent` | Server | trigger type, provider response class |
| `push_opened` | Client | trigger type, delay since sent |
| `starter_scratch_detected` | Server | player ID, confidence, news age |
| `starter_scratch_alert_created` | Server | affected user count, affected league count |
| `starter_scratch_alert_suppressed` | Server | suppression reason |
| `interrupt_created` | Server | type, affected league count |
| `live_score_refresh_completed` | Server | duration, game count, data age |
| `degraded_mode_entered` | Server/client | subsystem, reason |

---

## 5. Founder Dashboard

### 5.1 Route and authorization

Create or extend a private founder/admin surface. Before choosing a new route, audit existing `/founder`, `/admin`, simulation, feedback, and settings authorization patterns.

Recommended route if no canonical admin shell exists: `/founder/dashboard`.

Authorization requirements:

- Server-side authentication on every page and data route.
- Founder allowlist based on the existing `ADMIN_EMAIL` pattern or a durable admin-role field.
- Client-side hiding is not authorization.
- No service-role secret or privileged raw records exposed to the browser.
- Every dashboard API returns aggregate or carefully scoped data.
- Access attempts by unauthorized users return an appropriate denial, not a partially rendered dashboard.

### 5.2 Default date controls

- Today
- Yesterday
- Last 7 days
- Last 14 days
- Last 30 days
- Season to date
- Custom range

Default: last 7 days. Display current comparison against the immediately preceding equal-length period where useful.

Global filters:

- Platform: Sleeper, ESPN, Yahoo, all
- Plan
- Marketing source
- Campaign
- Content/hook ID
- User mode
- Number of connected leagues
- New versus returning

### 5.3 Overview tab

Top cards:

1. Unique visitors
2. Confirmed accounts
3. Users with one or more connected leagues
4. Target activated users
5. WAMM
6. Day 7 retention
7. Paid users
8. Gross collected revenue

Secondary cards:

- Median time to first league connection
- Median time to first useful Pulse
- Average connected leagues per activated user
- Notification enable rate
- Pulse meaningful-action rate
- Current trial users
- Current live-system incident count

Every metric card must include:

- Exact definition tooltip.
- Current value.
- Comparison period where valid.
- Click-through to the underlying filtered view or user list when privacy and scale permit.

### 5.4 Acquisition tab

Show:

- Visitors by source, medium, campaign, and content.
- CTA click-through rate.
- Account-confirmation rate.
- Connected-user rate.
- Target-activation rate.
- Paid-conversion rate.
- Cost per activated user when manual spend is entered or ad cost becomes available.

Primary table:

| Campaign/content | Visitors | Accounts | Connected | Target activated | Paid | Activation rate |
|---|---:|---:|---:|---:|---:|---:|

The dashboard must make it possible to compare positioning experiments such as:

- `consolidation`
- `prioritization`
- `game_day`
- `founder_origin`
- `draft_copilot`
- `news_desk`

Use consistent UTM naming in every bio link, campaign, creator link, QR code, and launch page.

### 5.5 Funnel tab

Canonical funnel:

1. Landing viewed
2. Primary CTA clicked
3. Account creation started
4. Email confirmed
5. Onboarding completed
6. First league connected
7. First non-empty Pulse generated
8. First meaningful action
9. Second league connected
10. Target activated
11. Checkout started
12. Purchase completed

Requirements:

- Show count and conversion at every step.
- Show median time between steps.
- Segment by platform and acquisition source.
- Surface the largest absolute and percentage drop-offs.
- Provide a user-level diagnostic list for recent incomplete onboardings, limited to founder access.

### 5.6 Activation tab

Show:

- Basic, Target, and High-Intent activation rates.
- Time-to-value distribution.
- Connected-league distribution.
- Activation by first platform.
- Activation by mode.
- Activation by campaign/content.
- First meaningful action type.
- Users who connected but never received a useful Pulse.
- Users who received a Pulse but took no action.

This tab should answer: **what is the shortest reliable path from visitor to felt value?**

### 5.7 Retention and cohort tab

Show cohort retention based on account confirmation and separately based on Target Activation.

Required intervals:

- Day 1
- Day 7
- Day 14
- Day 28
- Week 1 through Week 8 during the season

Show both:

- Login/visit retention.
- Meaningful-action retention.

Meaningful-action retention is the more important measure.

Segment by:

- Number of connected leagues.
- Platform mix.
- Notification enabled versus disabled.
- Plan.
- First meaningful feature.
- Acquisition campaign.

### 5.8 Product engagement tab

Show:

- Pulse generation and viewing frequency.
- Pulse item completion, dismissal, and snooze rates by item type.
- Deep-link follow rate by platform.
- Draft Copilot sessions and recommendation opens.
- Trade and start/sit usage.
- LIVE companion sessions by active-game count.
- Film Room usage.
- Most-used and least-used surfaces.
- Free-plan quota encounters and resulting upgrade behavior.

### 5.9 Revenue tab

Show:

- Monthly subscriptions.
- Founder Season Pass purchases.
- Founding 500 purchases.
- Gross cash collected.
- Subscription MRR.
- Subscription ARR run rate.
- Trial-to-paid conversion.
- Checkout completion.
- Failed payments.
- Cancellations and tenure before cancellation.
- Revenue by acquisition source and activation type.

**Accounting rule:** Founding 500 lifetime purchases and Season Pass purchases are cash/bookings, not recurring MRR. Do not add lifetime revenue to ARR. Keep subscription recurring revenue, seasonal bookings, and lifetime cash visibly separate.

### 5.10 Reliability and Trust tab

This is a launch-critical operational surface, especially for Game Day.

Top status cards:

- Sleeper sync health and last successful sync.
- ESPN sync health and last successful sync.
- Yahoo sync health when live.
- Pulse cron health.
- Live-score refresh health and data age.
- Push delivery health.
- Starter Scratch pipeline health.
- Resend and Stripe webhook health.
- Users currently receiving stale or degraded data.

Required operational views:

1. Failed jobs by subsystem and normalized error class.
2. Sync latency percentiles.
3. Last successful run per cron.
4. Push events queued, sent, failed, and opened.
5. Scratch alerts detected, created, suppressed, reversed, and reported incorrect.
6. Interrupt events created and deduplicated.
7. Data freshness by platform.
8. Current feature-flag state for high-risk Game Day systems.
9. Recent incorrect or irrelevant recommendation feedback.
10. Recent account-level failures with safe diagnostic identifiers.

Use clear status levels:

- Healthy
- Delayed
- Degraded
- Failing
- Disabled by feature flag

Do not expose secrets or raw credentials in diagnostics.

### 5.11 Early-user and feedback tab

Support a small Founding Tester cohort with:

- Tester status/tag.
- Number of leagues and platform mix.
- Activation state.
- Last meaningful activity.
- Notification state.
- Feedback submitted.
- Interview completed date.
- Founder notes.
- Permission to request follow-up.

Do not turn this into a full CRM. It is a focused launch-learning tool.

### 5.12 Alerts to the founder

Create founder-only alerts for conditions that need intervention:

- Critical cron has not succeeded within its expected window.
- Live-score data is older than the acceptable threshold during games.
- Platform sync failure rate exceeds threshold.
- Push provider rejects a material share of sends.
- Payment webhook fails.
- A user connects leagues but repeatedly receives an empty or failed Pulse.
- A high-confidence starter scratch is detected but no affected-user alert is created.
- Multiple users mark the same recommendation or alert incorrect.

Initial delivery may be email. Do not build a separate notification infrastructure solely for founder alerts if Resend can safely handle the first version.

Thresholds must be configuration constants and documented. Avoid unexplained magic numbers.

---

## 6. Onboarding and platform changes

### 6.1 Sleeper-first onboarding

- Lead with Sleeper and state that it connects in seconds without a password.
- Measure connection time and failure class.
- Land the user on value as quickly as possible after the first successful league connection.
- Do not require every platform before showing the first Pulse.

### 6.2 ESPN trust treatment

ESPN remains an optional advanced unlock.

Add or verify:

- Why ESPN requires cookies.
- Exactly what Rostiro reads.
- Read-only limitation.
- Encryption statement.
- Never-logged statement if technically accurate.
- Visible disconnect/delete control.
- “Is this safe?” explanation beside the unlock flow.
- Clear failure and refresh states.

Measure every major ESPN guide step and abandonment point.

### 6.3 Yahoo availability state

Display exactly one honest state:

- Connect with Yahoo.
- Pending platform approval.
- Join Yahoo early access.

Do not display a control that appears functional when approval is pending.

### 6.4 Platform capability matrix

Add a concise explanation on the relevant marketing or FAQ surface:

| Platform | Read leagues | Rostiro recommendations | Direct actions inside Rostiro |
|---|---:|---:|---:|
| Sleeper | Yes | Yes | No; deep-link |
| ESPN | Yes after unlock | Yes | No; deep-link |
| Yahoo | According to live approval status | Yes when connected | Supported operations only when live |

Avoid implying Rostiro replaces the underlying fantasy platform.

---

## 7. Recommendation trust system

### 7.1 Trust metadata

Important recommendations and alerts should display, where applicable:

- What changed.
- Time detected or last updated.
- Data freshness.
- Affected leagues.
- Recommendation reasoning.
- Confidence category.
- Source category, without presenting unsupported authority.
- Direct action or deep link.

### 7.2 Feedback controls

Add lightweight controls to relevant Pulse and alert surfaces:

- Helpful
- Not relevant
- Incorrect

For `Incorrect`, collect a constrained reason category plus an optional short note. Escape and length-limit all text. Never allow feedback submission failure to block the underlying product action.

Use aggregated feedback in the Reliability and Trust tab. Alert the founder when the same underlying signal or recommendation receives repeated incorrect reports.

### 7.3 Freshness and degraded mode

- Always show freshness when data timeliness affects trust.
- Prefer “last confirmed at…” over silently stale data.
- Degrade to deterministic output when the AI explanation fails.
- Degrade to cached data with a visible timestamp when a platform fails.
- Never display a blank critical surface if a safe cached state exists.

---

## 8. Marketing experiment system

### 8.1 Initial message tests

Run three primary campaigns during the first two weeks:

| Campaign ID | Promise | Example hook |
|---|---|---|
| `consolidation` | Every league in one command center | “Managing five teams should not require ten tabs.” |
| `prioritization` | Know the next decision across all leagues | “Five leagues. Rostiro tells you which decision matters first.” |
| `game_day` | Understand every live event across the portfolio | “Your RB scored. Here is what it did to all four leagues.” |

Use `utm_content` for individual hook/creative IDs. Keep the underlying product moment consistent when testing hooks.

### 8.2 Content mix

Starting allocation:

- 40% evergreen pain and product education.
- 20% Game Day and emotional moments.
- 20% timely fantasy news.
- 10% founder story and build-in-public.
- 10% beta invitations and community proof.

Evergreen assets may be batched. Timely news must be verified and published while relevant.

### 8.3 Weekly review

The Founder Dashboard should support a weekly review answering:

1. Which content generated the most Target Activations?
2. Which message produced the best connected-user conversion?
3. Which platform produced the strongest retained users?
4. Where did users abandon onboarding?
5. Which product feature created the first meaningful action?
6. Which trust or reliability problems appeared?
7. What should the next Studio session produce more or less of?

Do not choose winning content based only on views, likes, or follower growth.

---

## 9. Early-user validation program

Recruit 20 to 30 Founding Testers before broad conversion pressure.

### Qualification

- Three or more leagues preferred.
- At least one Sleeper league preferred.
- Active 2026 drafter.
- Willing to give feedback.
- Willing to participate in an observed onboarding session when possible.

### Interview questions

1. What did you believe Rostiro did before connecting a league?
2. Where did onboarding create hesitation?
3. Which first screen felt valuable?
4. Which recommendation did you trust or distrust, and why?
5. How do you currently manage multiple leagues?
6. If Rostiro disappeared tomorrow, what would you return to using?
7. What would make the Season Pass worth $59?
8. What would stop you from paying?

### Evidence to capture

- Time to first connection.
- Time to first useful Pulse.
- Number of connected leagues.
- First meaningful action.
- Notification decision.
- Day 7 return.
- Willingness to pay.
- Verbatim explanation of Rostiro in the tester's own words.

---

## 10. Native distribution and sharing

Before Week 1, ship at least one shareable output if it can be done without jeopardizing reliability work.

High-leverage candidates:

1. Film Room weekly portfolio recap.
2. “My N-league Sunday” result card.
3. Cross-league touchdown-impact card.
4. Post-draft portfolio card.
5. League Health improvement card.

Requirements:

- Useful or entertaining without prior knowledge of Rostiro.
- No private league information without user confirmation.
- Discreet Rostiro branding and share link.
- Mobile-native dimensions.
- Track `share_card_generated` and `share_initiated`.
- No fabricated outcomes outside clearly labeled Simulation Studio marketing assets.

Referral infrastructure may follow after organic sharing behavior is observed. Do not build a complicated points or rewards program before users demonstrate a desire to share.

---

## 11. Game Day operational readiness

### 11.1 Required before Week 1

- Complete T-163 Starter Scratch Alerts.
- Apply the T-162 migration.
- Verify T-162 against the earliest appropriate live game environment.
- Enforce global notification preferences in every push path.
- Verify trigger-specific preferences.
- Test cross-league collapse and deduplication.
- Test reversal handling.
- Test false-positive suppression.
- Confirm all high-risk features have working kill switches.
- Expose job health and data freshness in the Founder Dashboard.
- Provide degraded states for live scores, platform sync, and AI explanation failures.
- Create founder incident alerts.

### 11.2 Preseason war-room test

Run at least one preseason slate as an operational rehearsal.

Record:

- Expected events.
- Detected events.
- Missed events.
- False alerts.
- Detection-to-alert delay.
- Duplicate alerts.
- Incorrect league associations.
- Live-score freshness.
- Mobile rendering problems.
- Provider or cron failures.

Create a written after-action report and convert every material failure into a tracked task, fix, deferral, or documented accepted risk.

### 11.3 Game Day runbook

Create `docs/ROSTIRO_GAME_DAY_RUNBOOK.md` covering:

- Dashboard checks before the first game.
- Expected cron intervals.
- Healthy freshness thresholds.
- How to disable each high-risk feature.
- How to identify platform-specific failure.
- How to verify notification delivery.
- How to enter and exit degraded mode.
- How to communicate a user-facing incident.
- How to preserve evidence for debugging.
- Post-slate review steps.

---

## 12. Pricing and revenue measurement

Keep current pricing unless user evidence supports a change:

- Free.
- Rostiro Pro: $9.99/month.
- 2026 Founder Season Pass: $59.
- Founding 500: $149 lifetime, capped at 500.

Provision reporting so that:

- Subscription MRR and ARR are calculated only from recurring subscriptions.
- Season Pass purchases are tracked as seasonal cash/bookings.
- Founding 500 purchases are tracked as lifetime cash/bookings.
- Total cash collected is shown separately.
- Trial, activation, and acquisition source are attached to conversion analysis.

Consider releasing Founding 500 access in honest waves while retaining the overall 500 cap. Do not use fake counters or fake scarcity.

---

## 13. NBA expansion guardrail

Do not abandon the October NBA objective. Protect it from undermining the NFL launch.

During NFL launch work, NBA scope should be limited to:

- Data-source and connector research.
- Sport-agnostic schema verification.
- User interviews with fantasy basketball managers.
- Defining the NBA Pulse wedge.
- A small prototype or Simulation Studio concept if low-risk.

Likely NBA wedge to validate:

> Tonight's lineup, rest, late-scratch, and streaming decisions across every league.

NBA must receive its own daily-state model because games occur throughout the week and lineup decisions are more frequent than NFL decisions. Do not blindly clone the NFL weekly rhythm.

Suggested evidence before committing the majority of founder time to the full NBA build:

- At least 100 connected NFL users.
- At least 30 to 50 meaningfully active weekly users.
- Multiple users willing to pay.
- Evidence that Pulse drives returns.
- No unresolved Week 1 reliability crisis.

These are decision inputs, not permanent success ceilings.

---

## 14. Proposed task additions

Claude Code should audit existing code and task IDs before inserting these into the PRD. T-163 is currently the latest known task. Preserve existing behavior and reuse existing auth, rate-limit, cron, Stripe, OneSignal, Supabase, and admin patterns.

| Proposed task | Priority | Description |
|---|---|---|
| T-164 | P0, before meaningful traffic | Analytics foundation: event schema, allowlist, ingestion, anonymous/session IDs, UTM capture, anonymous-to-user attribution |
| T-165 | P0 | Critical server events: auth, league connection, Pulse generation/action, billing, notification, and reliability events |
| T-166 | P0/P1 | Founder Dashboard shell, server authorization, Overview, Acquisition, and Funnel tabs |
| T-167 | P1, before August launch | Activation definitions, user milestone derivation, Activation tab, WAMM calculation |
| T-168 | P1 | Retention cohorts and Product Engagement tab |
| T-169 | P1, before paid launch | Revenue tab with correct recurring versus seasonal versus lifetime accounting |
| T-170 | P0, before preseason testing | Reliability and Trust tab, cron/provider health, freshness, failures, founder alerts |
| T-171 | P1 | Recommendation feedback controls and repeated-incorrect-signal alerting |
| T-172 | P1 | Sleeper-first onboarding analytics, ESPN trust treatment, Yahoo availability state, platform capability copy |
| T-173 | P1 | Founding Tester tagging, feedback/interview status, and recent-user diagnostic view |
| T-174 | P1 | Marketing experiment conventions, canonical campaign IDs, UTM link generation/reference document |
| T-175 | P2, before Week 1 if safe | One native share-card MVP with privacy controls and share instrumentation |
| T-176 | P0, before Week 1 | Game Day runbook and preseason war-room rehearsal report |

### Recommended implementation order

1. T-164: capture and attribution.
2. T-165: critical server-authoritative events.
3. T-166: minimal dashboard that proves the data is usable.
4. T-170: operational reliability before preseason Game Day testing.
5. T-167 and T-168: activation and retention.
6. T-172 and T-171: onboarding and trust improvements.
7. T-169: revenue reporting before paid conversion pressure.
8. T-173 and T-174: tester and marketing workflow.
9. T-175: sharing, only if reliability work remains on track.
10. T-176: rehearse and document Game Day operations.

---

## 15. Phased delivery gates

### Gate A: Before meaningful marketing traffic

- UTM capture works.
- Anonymous visitor/session identity works.
- Anonymous attribution is attached to the confirmed account.
- Account, confirmation, onboarding, league connection, first Pulse, and first action events are stored.
- Event ingestion is validated, rate-limited, and non-blocking.
- A basic internal query or dashboard verifies the events end to end.

### Gate B: Before broad August launch

- Founder Dashboard Overview, Acquisition, Funnel, and Activation tabs work.
- Sleeper-first onboarding is measured.
- ESPN abandonment is measurable.
- Yahoo status is honest.
- Basic, Target, and High-Intent activation are calculated.
- Founding Tester cohort is visible.
- Marketing campaign/content IDs are standardized.

### Gate C: Before preseason Game Day rehearsal

- Reliability and Trust tab works.
- Cron and provider health are visible.
- Live-score freshness is visible.
- Push failures and suppressions are visible.
- Founder alerts work.
- Feature-flag states are visible.
- T-163 is complete enough for controlled testing.

### Gate D: Before Week 1

- T-162 migration applied and verified when live conditions permit.
- T-163 verified.
- Global and trigger-level notification preferences enforced.
- Preseason rehearsal completed.
- Game Day runbook completed.
- Revenue reporting verified.
- Retention cohorts started.
- Degraded modes and kill switches tested.

---

## 16. Acceptance criteria

The system is ready when all of the following are true:

1. A visitor arriving from a tagged social link can be followed anonymously through account confirmation and attributed after authentication.
2. A successful league connection and a failed league connection produce distinct server-authoritative events without storing credentials.
3. The Founder Dashboard can show the conversion from campaign visitor to Target Activated user.
4. Lawrence can identify where recent users abandoned onboarding.
5. WAMM is calculated from documented conditions and matches a manual spot check.
6. Subscription recurring revenue is not mixed with Season Pass or lifetime cash.
7. A failed critical cron appears in the Reliability tab and triggers a founder alert.
8. Data freshness and degraded state are visible for Game Day systems.
9. Recommendation feedback appears in the Trust view and repeated incorrect reports are surfaced.
10. Dashboard access is enforced server-side and cannot be reached by an ordinary authenticated user.
11. Analytics failure does not block any core user or billing flow.
12. No secrets, OAuth tokens, ESPN cookies, passwords, or unbounded private text are stored in analytics.
13. The event schema and metric definitions are documented in the repository.
14. At least one complete acquisition-to-activation test is verified in production or a production-equivalent environment.
15. The Game Day runbook has been rehearsed against a live preseason slate before Week 1.

---

## 17. Claude Code implementation instructions

Before editing:

1. Read the current PRD, marketing system, migrations, auth callbacks, onboarding, Pulse, Stripe webhooks, OneSignal/push wrapper, cron routes, feature flags, founder/admin routes, and any existing analytics code.
2. Report existing capabilities that already satisfy this specification.
3. Identify conflicts with current schema, RLS, route naming, or task numbering.
4. Propose the smallest implementation sequence that captures launch history immediately.
5. Do not begin with dashboard visuals before the event contract and attribution flow are correct.

During implementation:

- Reuse existing primitives and authorization patterns.
- Make critical events server-authoritative.
- Add migrations idempotently where practical.
- Add RLS and grants deliberately.
- Add tests for attribution, idempotency, activation calculations, admin authorization, and revenue classification.
- Verify live or end to end where external integrations permit.
- Add a dashboard metric glossary.
- Update the PRD task list and changelog after each shipped task.
- Keep all marketing claims consistent with actual platform access and verified behavior.

Do not provision speculative infrastructure for a scale Rostiro has not reached. The objective is a trustworthy launch cockpit with clean historical data, not an enterprise analytics warehouse.

---

## 18. Founder operating cadence

### Daily during launch

- Check new visitors, accounts, connected users, and Target Activations.
- Review onboarding failures.
- Review incorrect recommendation feedback.
- Review platform and cron health.
- Respond to Founding Testers.

### Weekly

- Compare campaigns by Target Activation.
- Review activation and time-to-value.
- Review Day 7 retention as cohorts mature.
- Identify the first meaningful feature for retained users.
- Review subscription, Season Pass, and lifetime cash separately.
- Choose the next week's content based on activated users, not raw views.
- Convert repeated failures or questions into product, copy, or support tasks.

### Game Day

- Follow the Game Day runbook.
- Monitor freshness, cron success, push health, scratches, and interrupts.
- Record incidents and near-misses.
- Complete an after-action review after the slate.

---

*Rostiro Launch Validation & Founder Dashboard Specification v1.0*  
*Run Every League. | rostiro.com*
