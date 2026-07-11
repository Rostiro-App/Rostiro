# Starter Scratch Alerts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a fantasy starter is ruled OUT close to kickoff, push a single cross-league-collapsed alert to the (Pro) user within ~15 minutes, and show a reversal-safe Pulse card — instead of the current ~24h-stale, push-less behavior.

**Architecture:** Extend the existing 15-min ESPN news cron with a deterministic scratch classifier that writes one fresh signal (`player_scratches`). That signal drives two independent, existing lanes: the Pulse `injury_alert` **card** (via the existing `injury:{lg}:{player}:{status}` fingerprint in `syncPulseItems`, giving reversal/no-resurrect for free) and a **push** (a new `detectStarterScratches` mirroring `detectTouchdownSwings`' per-user `byUser` grouping + `engagement_log` one-shot dedup).

**Tech Stack:** Next.js App Router (route handlers), TypeScript, Supabase (Postgres) via admin client, Vitest for pure-function tests, OneSignal (`lib/onesignal.ts`) for push delivery.

## Global Constraints

- **Deterministic only in the news cron** — no Claude call in the classify/push path (matches the cron's existing design).
- **Push is Pro + Sleeper only** — gate with the existing `isFreePlan(admin, userId)`; free tier still gets the in-app card. Game-day roster logic is Sleeper-only.
- **Starters only** — bench players never push.
- **High-confidence only pushes** — medium-confidence is card-only. A push cannot be unsent, so this gate is load-bearing.
- **No batching window** — fire per cron tick; cross-league collapse happens within a single tick via the `byUser` map.
- **One push per user** — never one-per-league.
- **Every push carries a "why you got this" league line** — e.g. `Starting in Lawrence's Legends +3 others`.
- **Reuse, don't reinvent dedup** — card uses the fingerprint lane; push uses `engagement_log` (`claimTrigger`). Both key on **status** so an escalation (questionable→out) re-fires but a flip-flop back does not.
- **Per-user dedup is the composite `unique (user_id, trigger_type, dedupe_key)`** — the `dedupe_key` string omits `userId` on purpose (the column carries it).
- **All external/DB calls best-effort** — a classifier miss, failed upsert, or failed push never breaks the news cron or Pulse build (`.catch()` / `continue`, matching the codebase).
- **Honesty:** ~15-min, headline-derived, high-confidence only. Never imply "instant/real-time."

---

### Task 1: Migration + type unions

**Files:**
- Create: `supabase/migration_scratch_alerts.sql`
- Modify: `supabase/grants.sql` (append a grant for `player_scratches`)
- Modify: `lib/engagementTriggers.ts` (extend the `claimTrigger` `triggerType` union — see Interfaces)

**Interfaces:**
- Produces: table `player_scratches (player_id text, platform text, status text, confidence text, source text, news_id text, headline text, detected_at timestamptz)`, PK `(player_id, platform)`; column `users.notify_scratches boolean not null default true`; `engagement_log.trigger_type` CHECK now includes `'starter_scratch'`.

- [ ] **Step 1: Write the migration**

Create `supabase/migration_scratch_alerts.sql`:

```sql
-- T-163: Starter Scratch Alerts. Fresh per-player injury signal derived from
-- ESPN news headlines (15-min cron), feeding both the Pulse injury_alert card
-- (existing injury: fingerprint) and a Pro-gated push (engagement_log).

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

alter table public.player_scratches enable row level security;
-- Admin-written by cron; no client read path needed today. No policy = deny-all
-- to anon/authenticated, which is correct (T-154 lesson: RLS on with no policy
-- is deny-all — intended here, unlike the founder_feedback bug).

-- Per-type push preference (T-163 principle 4). Default on.
alter table public.users add column if not exists notify_scratches boolean not null default true;

-- REQUIRED: the trigger_type CHECK is hardcoded; without this, claimTrigger's
-- insert for the new type fails 23514 (which claimTrigger throws on, not 23505).
alter table public.engagement_log drop constraint if exists engagement_log_trigger_type_check;
alter table public.engagement_log add constraint engagement_log_trigger_type_check
  check (trigger_type in ('touchdown_swing','lineup_lock','mission_complete','starter_scratch'));
```

- [ ] **Step 2: Add the grant**

Append to `supabase/grants.sql` (match the file's existing pattern for a cron/admin-written table):

```sql
grant select, insert, update, delete on public.player_scratches to service_role;
```

- [ ] **Step 3: Extend the `claimTrigger` trigger-type union**

In `lib/engagementTriggers.ts`, change the `claimTrigger` signature's `triggerType` union (currently `'touchdown_swing' | 'lineup_lock' | 'mission_complete'`) to add the new value:

```ts
  triggerType: 'touchdown_swing' | 'lineup_lock' | 'mission_complete' | 'starter_scratch',
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS (no type errors).

- [ ] **Step 5: Commit**

```bash
git add supabase/migration_scratch_alerts.sql supabase/grants.sql lib/engagementTriggers.ts
git commit -m "feat(scratch): migration + trigger-type union for starter scratch alerts"
```

> **Deploy note:** `migration_scratch_alerts.sql` must be applied to Supabase as a deploy step (this repo does not auto-apply migrations).

---

### Task 2: Deterministic scratch classifier

**Files:**
- Create: `lib/scratchClassifier.ts`
- Test: `lib/scratchClassifier.test.ts`

**Interfaces:**
- Produces:
```ts
export type ScratchStatus = 'out' | 'doubtful' | 'questionable'
export type ScratchConfidence = 'high' | 'medium'
export interface ScratchClassification { status: ScratchStatus; confidence: ScratchConfidence }
export function classifyScratch(headline: string, summary: string | null): ScratchClassification | null
```

- [ ] **Step 1: Write the failing test**

Create `lib/scratchClassifier.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { classifyScratch } from './scratchClassifier'

describe('classifyScratch', () => {
  it('flags "ruled out" as high-confidence out', () => {
    expect(classifyScratch('Josh Allen ruled out for Week 1', null)).toEqual({ status: 'out', confidence: 'high' })
  })
  it('flags "inactive" as high-confidence out', () => {
    expect(classifyScratch('Bijan Robinson inactive', 'Falcons announce inactives')).toEqual({ status: 'out', confidence: 'high' })
  })
  it('flags "will not play" as high-confidence out', () => {
    expect(classifyScratch('Report: CMC will not play Sunday', null)).toEqual({ status: 'out', confidence: 'high' })
  })
  it('flags "doubtful" as medium-confidence doubtful', () => {
    expect(classifyScratch('Star WR doubtful with hamstring', null)).toEqual({ status: 'doubtful', confidence: 'medium' })
  })
  it('flags "questionable" as medium-confidence questionable', () => {
    expect(classifyScratch('RB questionable, limited in practice', null)).toEqual({ status: 'questionable', confidence: 'medium' })
  })
  it('prefers high over medium when both present', () => {
    expect(classifyScratch('Was questionable, now ruled out', null)).toEqual({ status: 'out', confidence: 'high' })
  })
  it('returns null for reversal/positive language', () => {
    expect(classifyScratch('QB will play, upgraded to active', null)).toBeNull()
    expect(classifyScratch('WR expected to play, cleared from injury report', null)).toBeNull()
  })
  it('returns null when no injury language', () => {
    expect(classifyScratch('Chiefs sign veteran to practice squad', null)).toBeNull()
  })
  it('does not false-match on substrings', () => {
    expect(classifyScratch('An outstanding performance in questionably cold weather', null)).toBeNull()
  })
  it('is case-insensitive', () => {
    expect(classifyScratch('PLAYER RULED OUT', null)).toEqual({ status: 'out', confidence: 'high' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/scratchClassifier.test.ts`
Expected: FAIL ("Cannot find module './scratchClassifier'").

- [ ] **Step 3: Write the implementation**

Create `lib/scratchClassifier.ts`:

```ts
// T-163: deterministic scratch classifier. No network, no Claude — the news
// cron stays deterministic by design. Normalizes varied ESPN prose onto the
// Sleeper injury_status vocabulary (out/doubtful/questionable) so the card's
// injury:{lg}:{player}:{status} fingerprint reconciles instead of colliding.

export type ScratchStatus = 'out' | 'doubtful' | 'questionable'
export type ScratchConfidence = 'high' | 'medium'
export interface ScratchClassification { status: ScratchStatus; confidence: ScratchConfidence }

// Word-boundary matched, case-insensitive. Order matters: reversal first
// (a "now active" headline must not read as a scratch), then high, then medium.
const REVERSAL = [/\bwill play\b/, /\bexpected to play\b/, /\bupgraded\b/, /\bcleared\b/, /\bactivated\b/, /\bactive\b/]
const HIGH = [/\bruled out\b/, /\binactive\b/, /\bwill not play\b/, /\bwon['’]?t play\b/, /\bdeclared out\b/, /\bdowngraded to out\b/, /\bout (?:for|indefinitely)\b/]
const DOUBTFUL = [/\bdoubtful\b/]
const QUESTIONABLE = [/\bquestionable\b/, /\bgame[- ]time decision\b/, /\blimited (?:in )?practice\b/, /\bdid not practice\b/, /\bdnp\b/, /\btrending toward\b/]

export function classifyScratch(headline: string, summary: string | null): ScratchClassification | null {
  const text = `${headline} ${summary ?? ''}`.toLowerCase()
  if (REVERSAL.some((re) => re.test(text)) && !HIGH.some((re) => re.test(text))) return null
  if (HIGH.some((re) => re.test(text))) return { status: 'out', confidence: 'high' }
  if (DOUBTFUL.some((re) => re.test(text))) return { status: 'doubtful', confidence: 'medium' }
  if (QUESTIONABLE.some((re) => re.test(text))) return { status: 'questionable', confidence: 'medium' }
  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/scratchClassifier.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add lib/scratchClassifier.ts lib/scratchClassifier.test.ts
git commit -m "feat(scratch): deterministic scratch classifier (ESPN -> Sleeper vocab)"
```

---

### Task 3: Pure scratch-alert helpers (grouping, dedup key, merge, message)

**Files:**
- Create: `lib/scratchAlerts.ts`
- Test: `lib/scratchAlerts.test.ts`

**Interfaces:**
- Consumes: `ScratchStatus` from `lib/scratchClassifier`.
- Produces:
```ts
export interface UserLeagueRoster { userId: string; leagueId: string; leagueName: string; starterIds: string[] }
export interface ScratchedPlayer { playerId: string; playerName: string; status: ScratchStatus }
export interface UserScratchGroup { playerNames: string[]; leagueNames: string[]; scratched: ScratchedPlayer[] }
export function groupScratchedStartersByUser(rosters: UserLeagueRoster[], scratched: Map<string, ScratchedPlayer>): Map<string, UserScratchGroup>
export function scratchDedupeKey(playerId: string, status: ScratchStatus): string
export function resolveEffectiveInjury(sleeperStatus: string | null, scratchStatus: ScratchStatus | null): string | null
export function formatScratchPush(playerNames: string[], leagueNames: string[]): { title: string; message: string }
```

- [ ] **Step 1: Write the failing test**

Create `lib/scratchAlerts.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { groupScratchedStartersByUser, scratchDedupeKey, resolveEffectiveInjury, formatScratchPush, type UserLeagueRoster, type ScratchedPlayer } from './scratchAlerts'

const scratched = new Map<string, ScratchedPlayer>([
  ['p1', { playerId: 'p1', playerName: 'Josh Allen', status: 'out' }],
])

describe('groupScratchedStartersByUser', () => {
  it('collapses one scratched starter across a user\'s leagues into ONE group', () => {
    const rosters: UserLeagueRoster[] = [
      { userId: 'u1', leagueId: 'L1', leagueName: 'Legends', starterIds: ['p1', 'p9'] },
      { userId: 'u1', leagueId: 'L2', leagueName: 'Money', starterIds: ['p1'] },
      { userId: 'u1', leagueId: 'L3', leagueName: 'Bench', starterIds: ['p9'] }, // p1 not a starter here
    ]
    const out = groupScratchedStartersByUser(rosters, scratched)
    expect(out.size).toBe(1)
    expect(out.get('u1')!.playerNames).toEqual(['Josh Allen'])
    expect(out.get('u1')!.leagueNames.sort()).toEqual(['Legends', 'Money'])
  })
  it('ignores scratched players who are on the bench (not starters)', () => {
    const rosters: UserLeagueRoster[] = [{ userId: 'u1', leagueId: 'L1', leagueName: 'Legends', starterIds: ['p9'] }]
    expect(groupScratchedStartersByUser(rosters, scratched).size).toBe(0)
  })
  it('keeps different users separate', () => {
    const rosters: UserLeagueRoster[] = [
      { userId: 'u1', leagueId: 'L1', leagueName: 'A', starterIds: ['p1'] },
      { userId: 'u2', leagueId: 'L2', leagueName: 'B', starterIds: ['p1'] },
    ]
    expect(groupScratchedStartersByUser(rosters, scratched).size).toBe(2)
  })
})

describe('scratchDedupeKey', () => {
  it('keys on player + status so escalation is a new key', () => {
    expect(scratchDedupeKey('p1', 'questionable')).toBe('scratch:p1:questionable')
    expect(scratchDedupeKey('p1', 'out')).toBe('scratch:p1:out')
  })
})

describe('resolveEffectiveInjury', () => {
  it('takes the most severe of Sleeper vs scratch', () => {
    expect(resolveEffectiveInjury('Questionable', 'out')).toBe('Out')
    expect(resolveEffectiveInjury('Out', 'questionable')).toBe('Out')
  })
  it('returns Sleeper status when no scratch', () => {
    expect(resolveEffectiveInjury('Doubtful', null)).toBe('Doubtful')
  })
  it('returns the scratch when Sleeper is clean', () => {
    expect(resolveEffectiveInjury(null, 'out')).toBe('Out')
  })
  it('returns null when both clean', () => {
    expect(resolveEffectiveInjury(null, null)).toBeNull()
  })
})

describe('formatScratchPush', () => {
  it('one player, one league', () => {
    expect(formatScratchPush(['Josh Allen'], ['Legends'])).toEqual({
      title: 'Josh Allen — ruled OUT',
      message: 'Josh Allen ruled out. Starting in Legends.',
    })
  })
  it('one player, multiple leagues uses +N others', () => {
    expect(formatScratchPush(['Josh Allen'], ['Legends', 'Money', 'Dynasty'])).toEqual({
      title: 'Josh Allen — ruled OUT',
      message: 'Josh Allen ruled out. Starting in Legends +2 others.',
    })
  })
  it('multiple players', () => {
    expect(formatScratchPush(['Josh Allen', 'Bijan Robinson'], ['Legends', 'Money'])).toEqual({
      title: '2 starters ruled OUT',
      message: 'Josh Allen, Bijan Robinson ruled out. Starting in Legends +1 other.',
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/scratchAlerts.test.ts`
Expected: FAIL ("Cannot find module './scratchAlerts'").

- [ ] **Step 3: Write the implementation**

Create `lib/scratchAlerts.ts`:

```ts
// T-163: pure helpers shared by the push detector (detectStarterScratches) and
// the Pulse card builder. Kept side-effect-free so the grouping, dedup, merge,
// and message logic are unit-testable without DB/OneSignal.

import type { ScratchStatus } from './scratchClassifier'

export interface UserLeagueRoster { userId: string; leagueId: string; leagueName: string; starterIds: string[] }
export interface ScratchedPlayer { playerId: string; playerName: string; status: ScratchStatus }
export interface UserScratchGroup { playerNames: string[]; leagueNames: string[]; scratched: ScratchedPlayer[] }

// #1 + #2: one group per user, naming every affected league, starters only.
export function groupScratchedStartersByUser(
  rosters: UserLeagueRoster[],
  scratched: Map<string, ScratchedPlayer>,
): Map<string, UserScratchGroup> {
  const byUser = new Map<string, { players: Map<string, ScratchedPlayer>; leagues: Set<string> }>()
  for (const roster of rosters) {
    const hits = roster.starterIds.filter((id) => scratched.has(id))
    if (hits.length === 0) continue
    const entry = byUser.get(roster.userId) ?? { players: new Map(), leagues: new Set() }
    for (const id of hits) {
      const s = scratched.get(id)!
      entry.players.set(id, s)
      entry.leagues.add(roster.leagueName)
    }
    byUser.set(roster.userId, entry)
  }
  const out = new Map<string, UserScratchGroup>()
  for (const [userId, e] of byUser) {
    const scratchedList = [...e.players.values()]
    out.set(userId, {
      scratched: scratchedList,
      playerNames: scratchedList.map((s) => s.playerName),
      leagueNames: [...e.leagues],
    })
  }
  return out
}

// #6-push: status in the key so questionable->out escalates (new key -> fires),
// but a flip-flop back to a prior status re-uses a claimed key (no re-push).
export function scratchDedupeKey(playerId: string, status: ScratchStatus): string {
  return `scratch:${playerId}:${status}`
}

const SEVERITY: Record<string, number> = { out: 3, doubtful: 2, questionable: 1 }
const CANON: Record<string, string> = { out: 'Out', doubtful: 'Doubtful', questionable: 'Questionable' }

// Most-severe of the two valid signals wins; used by the card builder so a
// news scratch upgrades a stale Sleeper status but never masks a worse one.
export function resolveEffectiveInjury(sleeperStatus: string | null, scratchStatus: ScratchStatus | null): string | null {
  const candidates: string[] = []
  if (sleeperStatus) candidates.push(sleeperStatus.toLowerCase())
  if (scratchStatus) candidates.push(scratchStatus)
  const ranked = candidates.filter((c) => SEVERITY[c] !== undefined).sort((a, b) => SEVERITY[b] - SEVERITY[a])
  if (ranked.length === 0) return sleeperStatus // preserve non-scratch statuses (e.g. IR) untouched
  return CANON[ranked[0]]
}

// #5: "why you got this" league line.
export function formatScratchPush(playerNames: string[], leagueNames: string[]): { title: string; message: string } {
  const names = playerNames.join(', ')
  const first = leagueNames[0] ?? ''
  const extra = leagueNames.length - 1
  const leaguePart = extra > 0 ? `${first} +${extra} ${extra === 1 ? 'other' : 'others'}` : first
  const title = playerNames.length === 1 ? `${playerNames[0]} — ruled OUT` : `${playerNames.length} starters ruled OUT`
  return { title, message: `${names} ruled out. Starting in ${leaguePart}.` }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/scratchAlerts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/scratchAlerts.ts lib/scratchAlerts.test.ts
git commit -m "feat(scratch): pure grouping/dedup/merge/message helpers"
```

---

### Task 4: Enforce the global push_enabled toggle in pushToUser

**Files:**
- Modify: `lib/engagementTriggers.ts` (`pushToUser`, ~line 83)

**Interfaces:**
- Consumes: `users.push_enabled` (existing column).
- Produces: `pushToUser` now returns early when `push_enabled === false`, for **all** triggers.

> This fixes a latent bug: `push_enabled` is stored + toggled in settings but never read by the send path. Behavior change is intended and applies to every existing trigger.

- [ ] **Step 1: Read the current `pushToUser`**

Confirm the current gate reads only `isFreePlan` + `push_subscriptions`.

- [ ] **Step 2: Add the `push_enabled` check**

In `lib/engagementTriggers.ts`, inside `pushToUser`, immediately after the `isFreePlan` early-return, add:

```ts
  // T-163: honor the global push toggle (users.push_enabled) — stored and
  // shown in settings since T-71 but never actually enforced in the send
  // path until now. Applies to every trigger, not just scratches.
  const { data: prefRow } = await admin.from('users').select('push_enabled').eq('id', userId).maybeSingle()
  if (prefRow && prefRow.push_enabled === false) return
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/engagementTriggers.ts
git commit -m "fix(push): enforce the global push_enabled toggle in pushToUser"
```

---

### Task 5: Push detector — detectStarterScratches

**Files:**
- Modify: `lib/engagementTriggers.ts` (add `detectStarterScratches`)
- Test: covered by Task 3's pure helpers; this task adds an integration-shaped smoke test only if a Supabase test harness exists — otherwise verify by build + the manual check in Step 4.

**Interfaces:**
- Consumes: `groupScratchedStartersByUser`, `scratchDedupeKey`, `formatScratchPush` (Task 3); `loadSleeperLeagues`, `getSleeperRosters`, `claimTrigger`, `pushToUser`, `isFreePlan` (existing in this file / imports).
- Produces: `export async function detectStarterScratches(admin: AdminClient): Promise<void>`

- [ ] **Step 1: Add imports**

At the top of `lib/engagementTriggers.ts`, add:

```ts
import { groupScratchedStartersByUser, scratchDedupeKey, formatScratchPush, type UserLeagueRoster, type ScratchedPlayer } from './scratchAlerts'
```

- [ ] **Step 2: Implement the detector**

Append to `lib/engagementTriggers.ts`:

```ts
// ─── Starter scratch alerts (T-163) ─────────────────────────────────────────
// Mirrors detectTouchdownSwings: per-user byUser grouping, engagement_log
// one-shot dedup, Pro-gated push. Reads the fresh player_scratches signal the
// news cron writes. HIGH-confidence only pushes; medium is card-only (built in
// lib/pulse.ts). Sleeper-only, best-effort.
const SCRATCH_FRESHNESS_MS = 18 * 60 * 60 * 1000 // same-game-day window; stale scratches age out

export async function detectStarterScratches(admin: AdminClient): Promise<void> {
  const sinceIso = new Date(Date.now() - SCRATCH_FRESHNESS_MS).toISOString()
  const { data: scratchRows } = await admin
    .from('player_scratches')
    .select('player_id, status, confidence, headline')
    .eq('platform', 'sleeper')
    .eq('confidence', 'high')
    .gte('detected_at', sinceIso)
  if (!scratchRows || scratchRows.length === 0) return

  const scratchById = new Map((scratchRows as { player_id: string; status: string; headline: string | null }[]).map((r) => [r.player_id, r]))

  // Resolve player names once (for the message) from the cache.
  const { data: nameRows } = await admin
    .from('players_cache').select('player_id, name').eq('platform', 'sleeper').in('player_id', [...scratchById.keys()])
  const nameById = new Map(((nameRows ?? []) as { player_id: string; name: string }[]).map((r) => [r.player_id, r.name]))

  const scratched = new Map<string, ScratchedPlayer>()
  for (const [id, row] of scratchById) {
    scratched.set(id, { playerId: id, playerName: nameById.get(id) ?? id, status: row.status as ScratchedPlayer['status'] })
  }

  const leagues = await loadSleeperLeagues(admin)
  if (leagues.length === 0) return

  const rosterCache = new Map<string, Awaited<ReturnType<typeof getSleeperRosters>>>()
  const rosters: UserLeagueRoster[] = []
  for (const league of leagues) {
    if (!rosterCache.has(league.league_id)) {
      rosterCache.set(league.league_id, await getSleeperRosters(league.league_id).catch(() => []))
    }
    const myRoster = (rosterCache.get(league.league_id) ?? []).find((r) => String(r.roster_id) === league.team_id)
    const starterIds = (myRoster?.starters ?? []).filter((id: string) => id !== '0')
    rosters.push({ userId: league.user_id, leagueId: league.id, leagueName: league.league_name, starterIds })
  }

  const byUser = groupScratchedStartersByUser(rosters, scratched)

  for (const [userId, group] of byUser) {
    if (await isFreePlan(admin, userId)) continue // Pro-only push (card still exists)

    // notify_scratches gate (default true; column may be missing pre-migration -> treat as on)
    const { data: pref } = await admin.from('users').select('notify_scratches').eq('id', userId).maybeSingle()
    if (pref && pref.notify_scratches === false) continue

    // Claim per scratched starter+status; collect the newly-claimed ones so a
    // re-run in a later tick doesn't re-push the same scratch.
    const newlyClaimed: ScratchedPlayer[] = []
    for (const s of group.scratched) {
      if (await claimTrigger(admin, userId, 'starter_scratch', scratchDedupeKey(s.playerId, s.status))) {
        newlyClaimed.push(s)
      }
    }
    if (newlyClaimed.length === 0) continue

    const { title, message } = formatScratchPush(newlyClaimed.map((s) => s.playerName), group.leagueNames)
    await pushToUser(admin, userId, title, message, '/pulse')
  }
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS. If `AdminClient`, `loadSleeperLeagues`, `getSleeperRosters`, `claimTrigger`, `isFreePlan` are not already in scope, confirm they are defined/imported earlier in this file (they are — used by `detectTouchdownSwings`).

- [ ] **Step 4: Manual verification note**

Full end-to-end needs live data (a real scratch + a Pro user + a push subscription), unavailable in a preseason dev env — same constraint as T-148/T-162. Verify logic via Task 3's unit tests; verify wiring via build. Record as "not live-verified" in the PRD entry.

- [ ] **Step 5: Commit**

```bash
git add lib/engagementTriggers.ts
git commit -m "feat(scratch): detectStarterScratches push detector (Pro, starters, high-conf)"
```

---

### Task 6: Wire the news cron — classify + upsert + invoke detector

**Files:**
- Modify: `app/api/cron/news/route.ts`

**Interfaces:**
- Consumes: `classifyScratch` (Task 2), `detectStarterScratches` (Task 5).
- Produces: `player_scratches` rows written each 15-min tick; the detector invoked after.

- [ ] **Step 1: Add imports**

In `app/api/cron/news/route.ts`:

```ts
import { classifyScratch } from '@/lib/scratchClassifier'
import { detectStarterScratches } from '@/lib/engagementTriggers'
```

- [ ] **Step 2: Classify + upsert scratches after the news upsert**

After the existing `news_items` upsert block (where `relevantRows` are written), add — still deterministic, best-effort:

```ts
    // T-163: derive fresh scratch signals from the same tagged headlines. One
    // row per player (upsert). Best-effort: a failure here never breaks news.
    try {
      const scratchRows = relevantRows.flatMap((r) => {
        const cls = classifyScratch(r.headline, r.summary)
        if (!cls) return []
        return r.player_ids.map((pid) => ({
          player_id: pid,
          platform: 'sleeper' as const,
          status: cls.status,
          confidence: cls.confidence,
          source: 'espn_news' as const,
          news_id: r.id,
          headline: r.headline,
          detected_at: new Date().toISOString(),
        }))
      })
      if (scratchRows.length > 0) {
        await admin.from('player_scratches').upsert(scratchRows, { onConflict: 'player_id,platform' })
      }
      await detectStarterScratches(admin)
    } catch {
      // scratch derivation is additive to news ingestion — never fail the cron for it
    }
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Verify the cron route still builds**

Run: `npx eslint app/api/cron/news/route.ts`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/cron/news/route.ts
git commit -m "feat(scratch): classify + upsert scratches and fire detector in news cron"
```

---

### Task 7: Card path — merge player_scratches into the Pulse injury builder

**Files:**
- Modify: `lib/pulse.ts` (the injury loop, ~line 303-320, inside `buildLeagueItems`/`buildPulseItemsForUser`)

**Interfaces:**
- Consumes: `resolveEffectiveInjury` (Task 3); `player_scratches` table.
- Produces: `injury_alert` items whose status reflects a fresh news scratch, under the unchanged `injury:{league}:{player}:{status}` fingerprint (reversal/no-resurrect via existing `syncPulseItems`).

- [ ] **Step 1: Load fresh scratches for the user's rostered players**

In `buildPulseItemsForUser` (where `myPlayers`/rostered players are already resolved), add a fetch of active scratches keyed by player id. Near the top of the per-user build, after the rostered player set is known:

```ts
  // T-163: fresh news-derived scratches (< 18h) override the once-daily
  // injury_status cache when more severe. Best-effort; empty on missing table.
  const scratchSinceIso = new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString()
  const { data: scratchData } = await supabase
    .from('player_scratches')
    .select('player_id, status')
    .eq('platform', 'sleeper')
    .gte('detected_at', scratchSinceIso)
  const scratchStatusById = new Map(((scratchData ?? []) as { player_id: string; status: 'out' | 'doubtful' | 'questionable' }[]).map((r) => [r.player_id, r.status]))
```

> If `player_scratches` and the injury loop live in different functions (`buildLeagueItems`), thread `scratchStatusById` in as a parameter — follow the same threading the file already uses for `isFreePlan`/plan (see how `buildLeagueItems` receives its args).

- [ ] **Step 2: Apply the merge in the injury loop**

Add the import at the top of `lib/pulse.ts`:

```ts
import { resolveEffectiveInjury } from './scratchAlerts'
```

Replace the injury loop's status source. Change:

```ts
  for (const p of myPlayers) {
    if (!p.injury_status) continue
    const isStarter = starterSet.has(p.player_id)
    const priority = injuryPriority(p.injury_status, isStarter)
    ...
    fingerprint: `injury:${league.id}:${p.player_id}:${p.injury_status.toLowerCase()}`,
    headline: `${p.name} — ${formatInjuryStatus(p.injury_status)}`,
```

to use the effective status:

```ts
  for (const p of myPlayers) {
    const effectiveStatus = resolveEffectiveInjury(p.injury_status, scratchStatusById.get(p.player_id) ?? null)
    if (!effectiveStatus) continue
    const isStarter = starterSet.has(p.player_id)
    const priority = injuryPriority(effectiveStatus, isStarter)
    if (!priority) continue
    items.push({
      fingerprint: `injury:${league.id}:${p.player_id}:${effectiveStatus.toLowerCase()}`,
      type: 'injury_alert',
      priority,
      headline: `${p.name} — ${formatInjuryStatus(effectiveStatus)}`,
      reasoning: isStarter
        ? `${p.name} is in your starting lineup and listed as ${formatInjuryStatus(effectiveStatus).toLowerCase()}. Check for a bench replacement before kickoff.`
        : `${p.name} is on your bench and listed as ${formatInjuryStatus(effectiveStatus).toLowerCase()}.`,
      affectedLeagues: [affectedLeague],
      deadline: null,
      actionUrl: leagueLink,
    })
```

> Note: `myPlayers` iterated now includes players with no Sleeper `injury_status` but a fresh scratch — so the loop must iterate all rostered players, not only pre-filtered injured ones. Confirm `myPlayers` is the full rostered set (it is — it's the roster join); the old `if (!p.injury_status) continue` was the only filter and is now replaced by the `effectiveStatus` null check.

- [ ] **Step 3: Verify it compiles + existing pulse tests pass**

Run: `npx tsc --noEmit && npx vitest run lib/pulse` (if pulse tests exist) 
Expected: PASS. If no pulse unit tests exist, run `npx tsc --noEmit` only.

- [ ] **Step 4: Commit**

```bash
git add lib/pulse.ts
git commit -m "feat(scratch): merge fresh scratches into the Pulse injury_alert card"
```

---

### Task 8: Preference API + settings toggle

**Files:**
- Modify: `app/api/settings/route.ts` (accept + return `notifyScratches`)
- Modify: `app/(dashboard)/settings/page.tsx` (toggle row + handler)

**Interfaces:**
- Consumes: `users.notify_scratches` (Task 1).
- Produces: GET returns `notifyScratches`; PATCH accepts `{ notifyScratches: boolean }`.

- [ ] **Step 1: Extend the settings API Body + select + response**

In `app/api/settings/route.ts`:
- Add to the `Body` zod object: `notifyScratches: z.boolean().optional(),`
- Add to the `.refine` disjunction: `|| b.notifyScratches !== undefined`
- Add `notify_scratches` to both `.select('email, plan, push_enabled, ...')` lists.
- In the GET response mapping, add: `notifyScratches: row.notify_scratches,` (guard for a missing column the same way `push_enabled`/`mode` are guarded — return `true` as the default if the column read fails).
- In the PATCH handler, add: `if (parsed.data.notifyScratches !== undefined) update.notify_scratches = parsed.data.notifyScratches`

- [ ] **Step 2: Add `notifyScratches` to the settings page data type + toggle handler**

In `app/(dashboard)/settings/page.tsx`:
- Add `notifyScratches: boolean` to the settings data interface (next to `pushEnabled: boolean`).
- Add a handler mirroring `togglePush`:

```ts
  function toggleScratches() {
    if (!data) return
    const next = !data.notifyScratches
    setData({ ...data, notifyScratches: next })
    fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notifyScratches: next }),
    }).catch(() => setData((d) => (d ? { ...d, notifyScratches: !next } : d)))
  }
```

- [ ] **Step 3: Add the toggle row to the Notifications Section**

Inside the existing `Notifications` `<Section>` in `app/(dashboard)/settings/page.tsx`, below the existing "Push notifications" row, add a second row mirroring its markup:

```tsx
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm text-white">Starter ruled out</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--t3)' }}>
                  Get pinged within minutes when a starter is ruled out, one alert across all your leagues.
                </p>
              </div>
              <button
                role="switch"
                aria-checked={data.notifyScratches}
                onClick={toggleScratches}
                className="relative rounded-full transition-all flex-shrink-0"
                style={{ width: 40, height: 22, backgroundColor: data.notifyScratches ? 'var(--cta)' : 'var(--hairline)' }}
              >
                <span
                  className="absolute top-[3px] rounded-full transition-all"
                  style={{ width: 16, height: 16, left: data.notifyScratches ? 21 : 3, backgroundColor: '#fff' }}
                />
              </button>
            </div>
```

- [ ] **Step 4: Verify it compiles + lints**

Run: `npx tsc --noEmit && npx eslint app/api/settings/route.ts "app/(dashboard)/settings/page.tsx"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/settings/route.ts "app/(dashboard)/settings/page.tsx"
git commit -m "feat(scratch): notify_scratches preference (settings API + toggle)"
```

---

### Task 9: Onboarding surface for the preference

**Files:**
- Modify: `app/(auth)/onboarding/page.tsx`

**Interfaces:**
- Consumes: the settings PATCH `{ notifyScratches }` (Task 8).
- Produces: a plain, on-by-default awareness toggle during onboarding.

> The DB default is already `true`, so the feature works without this. This task is the opt-down affordance the spec requires. Keep it minimal — add a single toggle to the existing `mode` step screen (the first onboarding screen, `step === 'mode'`), not a new step in the `Step` machine.

- [ ] **Step 1: Add local state + handler**

In `app/(auth)/onboarding/page.tsx`, add near the other `useState` hooks:

```ts
  const [notifyScratches, setNotifyScratches] = useState(true)

  function toggleScratches() {
    const next = !notifyScratches
    setNotifyScratches(next)
    // Persist immediately; default is already true server-side, so this only
    // needs to fire on an opt-down, but firing either way is harmless.
    fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notifyScratches: next }),
    }).catch(() => {})
  }
```

- [ ] **Step 2: Render the toggle in the mode step**

Inside the `step === 'mode'` block's card (after the mode selection UI, before the continue affordance), add:

```tsx
        <div className="mt-6 flex items-center justify-between rounded-lg border p-3" style={{ borderColor: 'var(--hairline)' }}>
          <div>
            <p className="text-sm text-white">Notify me the moment a starter is ruled out</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--t3)' }}>One alert across all your leagues. You can change this later in Settings.</p>
          </div>
          <button
            role="switch"
            aria-checked={notifyScratches}
            onClick={toggleScratches}
            className="relative rounded-full transition-all flex-shrink-0"
            style={{ width: 40, height: 22, backgroundColor: notifyScratches ? 'var(--cta)' : 'var(--hairline)' }}
          >
            <span className="absolute top-[3px] rounded-full transition-all" style={{ width: 16, height: 16, left: notifyScratches ? 21 : 3, backgroundColor: '#fff' }} />
          </button>
        </div>
```

- [ ] **Step 3: Verify it compiles + lints**

Run: `npx tsc --noEmit && npx eslint "app/(auth)/onboarding/page.tsx"`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add "app/(auth)/onboarding/page.tsx"
git commit -m "feat(scratch): surface the scratch-alert preference at onboarding"
```

---

### Task 10: Final verification

- [ ] **Step 1: Full type + lint + test pass**

Run: `npx tsc --noEmit && npx eslint . && npx vitest run`
Expected: all PASS.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Confirm the honesty guardrails**

Grep the diff for any copy implying "instant/real-time." The onboarding + settings copy must say "within minutes," never "instant." Fix if any slipped in.

- [ ] **Step 4: Update the PRD T-163 entry**

Change T-163's status line from "Designed, not built" to "Code done, migration + live-verify pending" (mirror T-162's honest status), noting `migration_scratch_alerts.sql` must be applied and no live scratch has been observed in a preseason dev env.

- [ ] **Step 5: Commit**

```bash
git add Rostiro_PRD_v5.md
git commit -m "docs: mark T-163 code-complete (migration + live-verify pending)"
```

---

## Self-Review

**Spec coverage:**
- Classifier + normalization → Task 2. ✅
- `player_scratches` signal → Task 1 (table) + Task 6 (writes). ✅
- Card via fingerprint (#6) → Task 7. ✅
- Push via engagement_log (#6) + cross-league (#1) + starters (#2) + confidence (#3) + why-line (#5) → Tasks 3+5. ✅
- Preference (#4): global `push_enabled` enforcement → Task 4; `notify_scratches` + onboarding + settings → Tasks 1, 8, 9. ✅
- CHECK-constraint alter + per-user dedup → Task 1 + Task 5. ✅
- Freshness window → Tasks 5 & 7 (18h constant). ✅
- Honesty guardrails → Task 10 Step 3. ✅

**Placeholder scan:** every code step contains real code; the one deferred value (freshness window) is a concrete constant (18h). ✅

**Type consistency:** `ScratchStatus`/`ScratchConfidence`/`ScratchClassification` (Task 2) are consumed unchanged in Tasks 3, 5, 6, 7. `scratchDedupeKey`, `groupScratchedStartersByUser`, `resolveEffectiveInjury`, `formatScratchPush` signatures defined in Task 3 match their call sites in Tasks 5 and 7. `'starter_scratch'` trigger type added in Task 1 matches its use in Task 5. ✅

**One open threading detail flagged for the implementer (Task 7 Step 1):** whether the injury loop is in `buildPulseItemsForUser` or a nested `buildLeagueItems` determines whether `scratchStatusById` is a local or a threaded parameter. The task calls this out and points at the existing plan/`isFreePlan` threading as the pattern to follow.
