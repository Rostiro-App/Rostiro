// T-69: Pulse generation + persistence sync (PRD 6.7 W3).
//
// buildPulseItemsForUser computes what deserves the user's attention right
// now — deterministic, no Claude call. syncPulseItems reconciles that
// against pulse_items using content fingerprints: a dismissed item never
// resurrects, a stale item disappears, a snoozed item wakes on time.
// Shared by GET /api/pulse/sleeper (on-demand) and /api/cron/pulse (daily).
//
// Fingerprints are the identity of a piece of intelligence, not of a DB row:
//   injury:{leagueRowId}:{playerId}:{status}   — status change = new item
//   waiver:{leagueRowId}:{playerId}            — different best FA = new item
//   deadline:draft:{leagueRowId}:{startTime}   — reschedule = new item
//   lineup:{leagueRowId}:{starterId}:{benchId} — specific swap suggestion

import { getSleeperDrafts, getSleeperLeague, getSleeperRosters } from '@/lib/sleeper'
import { computeLeagueHealth, type HealthPlayer } from '@/lib/healthScore'
import { detectOpportunitySurges, type SurgeEvent } from '@/lib/opportunitySurge'
import { generatePlayerNewsContext, generateOpportunitySurgeContext } from '@/lib/claude'
import { pushToUser } from '@/lib/engagementTriggers'
import { isFreePlan } from '@/lib/usageLimits'
import { resolveEffectiveInjury } from './scratchAlerts'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AffectedLeague, InterruptMetricRow, PulseItem, PulseItemStatus, PulseItemType, PulsePriority } from '@/types'

// Pulse generation isn't mode-scoped today (unlike Start/Sit, Draft Copilot)
// — matches toneInstruction's own 'balanced' default rather than plumbing a
// new parameter through every caller for a one-sentence tone difference.
const PULSE_MODE = 'balanced' as const

const DRAFT_REMINDER_WINDOW_MS = 14 * 24 * 60 * 60 * 1000
const DRAFT_CRITICAL_WINDOW_MS = 48 * 60 * 60 * 1000
// A bench player must beat the starter's ADP by this many picks before we
// suggest a swap — inside the margin it's noise, not a decision.
const LINEUP_ADP_MARGIN = 20
// News older than this stops being "what's new" — matches the injury/waiver
// cards' own implicit freshness (they're recomputed from current state
// every generation, not accumulated forever).
const NEWS_WINDOW_MS = 72 * 60 * 60 * 1000

interface LeagueRow {
  id: string
  league_id: string
  league_name: string
  team_id: string | null
}

interface CachedPlayer {
  player_id: string
  name: string
  position: string | null
  injury_status: string | null
  adp_sleeper: number | null
}

interface NewsRow {
  id: string
  headline: string
  summary: string | null
  link: string
  player_ids: string[]
}

interface DepthPlayer {
  player_id: string
  name: string
  position: string | null
  nfl_team: string | null
  injury_status: string | null
  depth_chart_order: number | null
}

export interface BuiltPulseItem {
  fingerprint: string
  type: PulseItemType
  priority: PulsePriority
  headline: string
  reasoning: string
  affectedLeagues: AffectedLeague[]
  deadline: string | null
  actionUrl: string | null
}

export interface PulseItemRow {
  id: string
  user_id: string
  type: PulseItemType
  priority: PulsePriority
  headline: string
  reasoning: string
  affected_leagues_json: AffectedLeague[]
  metrics_json?: InterruptMetricRow[] | null
  deadline: string | null
  action_url: string | null
  platform: 'espn' | 'yahoo' | 'sleeper' | null
  status: PulseItemStatus
  created_at: string
}

// ─── Generation ────────────────────────────────────────────────────────────────

export async function buildPulseItemsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<{ items: BuiltPulseItem[]; leagueCount: number }> {
  const { data: leagues, error } = await supabase
    .from('connected_leagues')
    .select('id, league_id, league_name, team_id')
    .eq('user_id', userId)
    .eq('platform', 'sleeper')

  if (error) throw new Error(error.message)
  const rows = (leagues ?? []) as LeagueRow[]
  if (rows.length === 0) return { items: [], leagueCount: 0 }

  // PRD Section 9: "full Waiver Day detail" is Pro's state depth — the
  // base waiver_alert (name/ADP/unrostered) below stays free for everyone;
  // only the FAAB-remaining and League Health projection deepening
  // (T-98/T-108) is gated. Fail open (assume not-free) on a metering
  // error — same posture as every other plan check in this codebase.
  const free = await isFreePlan(supabase, userId).catch(() => false)

  // One free-agent pool query serves every league (same pattern as
  // /api/system/status): top of the ADP board, filtered per league.
  const { data: topPlayers } = await supabase
    .from('players_cache')
    .select('player_id, name, position, injury_status, adp_sleeper')
    .eq('platform', 'sleeper')
    .not('adp_sleeper', 'is', null)
    .order('adp_sleeper', { ascending: true })
    .limit(200)
  const topPool = (topPlayers ?? []) as CachedPlayer[]

  // T-95 follow-up: recent ESPN news, already player-tagged at ingest
  // (lib/newsRelevance.ts) — fetched once and filtered per-league below to
  // rostered players only.
  const newsWindowStart = new Date(Date.now() - NEWS_WINDOW_MS).toISOString()
  const { data: newsRows } = await supabase
    .from('news_items')
    .select('id, headline, summary, link, player_ids')
    .gte('published_at', newsWindowStart)
    .order('published_at', { ascending: false })
  const recentNews = (newsRows ?? []) as NewsRow[]

  // T-99: real NFL depth chart data (every fantasy-relevant player who has
  // one), not fantasy-roster data — this is what lets
  // detectOpportunitySurges find "starter's out, who benefits" independent
  // of who owns whom in any particular league.
  const { data: depthRows } = await supabase
    .from('players_cache')
    .select('player_id, name, position, nfl_team, injury_status, depth_chart_order')
    .eq('platform', 'sleeper')
    .not('depth_chart_order', 'is', null)
  const surgeEvents = detectOpportunitySurges((depthRows ?? []) as DepthPlayer[])

  // T-143: general notes (T-141) feed back into the one Claude-written
  // signal in this file that's about a single player — a note left on a
  // rostered player becomes extra context for that player's opportunity-
  // surge reasoning. Best-effort: an empty result here (migration not run,
  // or a genuine query error) just means no notes feed in, never blocks
  // Pulse generation itself.
  const { data: noteRows } = await supabase
    .from('notes')
    .select('player_id, body')
    .eq('user_id', userId)
    .eq('type', 'general')
    .not('player_id', 'is', null)
  const notesByPlayerId = new Map<string, string>()
  for (const n of (noteRows ?? []) as { player_id: string; body: string }[]) {
    const existing = notesByPlayerId.get(n.player_id)
    notesByPlayerId.set(n.player_id, existing ? `${existing} ${n.body}` : n.body)
  }

  // T-163: fresh news-derived scratches (< 18h) override the once-daily
  // injury_status cache when more severe. Best-effort; empty on missing table.
  const scratchSinceIso = new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString()
  const { data: scratchData } = await supabase
    .from('player_scratches')
    .select('player_id, status')
    .eq('platform', 'sleeper')
    .gte('detected_at', scratchSinceIso)
  const scratchStatusById = new Map(((scratchData ?? []) as { player_id: string; status: 'out' | 'doubtful' | 'questionable' }[]).map((r) => [r.player_id, r.status]))

  const results = await Promise.allSettled(
    rows.map((league) => buildLeagueItems(supabase, league, topPool, recentNews, surgeEvents, notesByPlayerId, free, scratchStatusById))
  )

  // One league failing (Sleeper down, league deleted) shouldn't blank the
  // whole feed for the user's other leagues.
  const items = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))

  const PRIORITY_RANK: Record<PulsePriority, number> = { critical: 0, important: 1, info: 2 }
  items.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])

  return { items, leagueCount: rows.length }
}

async function buildLeagueItems(
  supabase: SupabaseClient,
  league: LeagueRow,
  topPool: CachedPlayer[],
  recentNews: NewsRow[],
  surgeEvents: SurgeEvent[],
  notesByPlayerId: Map<string, string>,
  free: boolean,
  scratchStatusById: Map<string, 'out' | 'doubtful' | 'questionable'>
): Promise<BuiltPulseItem[]> {
  const [rosters, drafts, sleeperLeague] = await Promise.all([
    getSleeperRosters(league.league_id),
    getSleeperDrafts(league.league_id).catch(() => []),
    // T-108: real FAAB budget context for the waiver_alert deepening below —
    // best-effort, a failed fetch just means that context is omitted, same
    // resilience posture as the draft fetch beside it.
    getSleeperLeague(league.league_id).catch(() => null),
  ])

  const affectedLeague: AffectedLeague = {
    leagueId: league.id,
    leagueName: league.league_name,
    platform: 'sleeper',
  }
  const leagueLink = `https://sleeper.com/leagues/${league.league_id}`
  const items: BuiltPulseItem[] = []
  const now = Date.now()

  // ─── Draft deadline reminders ────────────────────────────────────────────
  for (const draft of drafts) {
    if (draft.status !== 'pre_draft' || !draft.start_time) continue
    const untilStart = draft.start_time - now
    if (untilStart <= 0 || untilStart > DRAFT_REMINDER_WINDOW_MS) continue

    const startDate = new Date(draft.start_time)
    const when = startDate.toLocaleString('en-US', {
      weekday: 'long', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short',
    })
    items.push({
      fingerprint: `deadline:draft:${league.id}:${draft.start_time}`,
      type: 'deadline_reminder',
      priority: untilStart < DRAFT_CRITICAL_WINDOW_MS ? 'critical' : 'important',
      headline: `${league.league_name} drafts ${when}`,
      reasoning:
        untilStart < DRAFT_CRITICAL_WINDOW_MS
          ? 'Your draft starts in under 48 hours. Join Rostiro\'s Draft Copilot to track it live — always-current best available, a heads-up before your turn, an alert the moment a run starts.'
          : 'Your draft is on the calendar. Set your rankings and strategy in the Draft Kit before draft day.',
      affectedLeagues: [affectedLeague],
      deadline: startDate.toISOString(),
      // Found via a real live draft (July 4, 2026): this used to point
      // straight to Sleeper's own site, bouncing the user away from the
      // one surface built specifically to track a live draft. This item
      // only ever exists for an already-connected league (this whole loop
      // iterates connected_leagues), so /draft/join's one-click "join from
      // a connected league" list picks it up with zero further input —
      // no query params needed, unlike a cold link from outside the app.
      actionUrl: '/draft/join',
    })
  }

  const myRoster = rosters.find((r) => String(r.roster_id) === league.team_id)
  if (!myRoster) return items

  const myPlayerIds = Array.isArray(myRoster.players) ? myRoster.players : []
  // Sleeper pads unfilled starter slots with '0'.
  const starterIds = (Array.isArray(myRoster.starters) ? myRoster.starters : []).filter(
    (id) => id && id !== '0'
  )
  const starterSet = new Set(starterIds)

  let myPlayers: CachedPlayer[] = []
  if (myPlayerIds.length > 0) {
    const { data } = await supabase
      .from('players_cache')
      .select('player_id, name, position, injury_status, adp_sleeper')
      .eq('platform', 'sleeper')
      .in('player_id', myPlayerIds)
    myPlayers = (data ?? []) as CachedPlayer[]
  }

  // ─── Post-draft roster grade ─────────────────────────────────────────────
  // Found missing from a real account audit (July 4, 2026) — PRD line 737
  // promises "roster grade appears in Pulse even without a full Portfolio
  // product at MVP," never actually built. Reuses Health Score rather than
  // a new formula (confirmed with the founder for T-86, same call applies
  // here). Fingerprint is stable (no date/value baked in) so this fires
  // exactly once per league, right after its draft completes, and never
  // resurfaces once dismissed — a one-time "look what you built" moment,
  // not a recurring status card.
  const draftJustCompleted = drafts.some((d) => d.status === 'complete')
  if (draftJustCompleted && myPlayers.length > 0) {
    const healthPlayers: HealthPlayer[] = myPlayers.map((p) => ({
      playerId: p.player_id,
      adp: p.adp_sleeper,
      injuryStatus: p.injury_status,
    }))
    const grade = computeLeagueHealth({
      myPlayers: healthPlayers,
      starterIds,
      bestFreeAgentAdp: null,
      bestFreeAgentName: null,
    })
    if (grade.score !== null) {
      items.push({
        fingerprint: `roster_grade:${league.id}`,
        type: 'roster_grade',
        priority: 'info',
        headline: `${league.league_name} — your roster grades ${Math.round(grade.score)}`,
        reasoning: `Your draft is complete — Rostiro grades ${league.league_name}'s roster construction a ${Math.round(grade.score)}/100.${grade.topFlag ? ` ${grade.topFlag}.` : ''} Full breakdown on the Leagues page.`,
        affectedLeagues: [affectedLeague],
        deadline: null,
        actionUrl: '/leagues',
      })
    }
  }

  // ─── Injuries on my roster ───────────────────────────────────────────────
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
  }

  // ─── Lineup decisions — bench clearly outranks a starter ────────────────
  // Only when starters are actually set; preseason rosters skip this whole
  // block because starterIds is empty.
  const byId = new Map(myPlayers.map((p) => [p.player_id, p]))
  for (const starterId of starterIds) {
    const starter = byId.get(starterId)
    if (!starter || starter.adp_sleeper === null || !starter.position) continue

    const bestBench = myPlayers
      .filter(
        (p) =>
          !starterSet.has(p.player_id) &&
          p.position === starter.position &&
          p.adp_sleeper !== null &&
          p.adp_sleeper < starter.adp_sleeper! - LINEUP_ADP_MARGIN &&
          !isSidelined(p.injury_status)
      )
      .sort((a, b) => a.adp_sleeper! - b.adp_sleeper!)[0]
    if (!bestBench) continue

    const gap = Math.round(starter.adp_sleeper - bestBench.adp_sleeper!)
    items.push({
      fingerprint: `lineup:${league.id}:${starter.player_id}:${bestBench.player_id}`,
      type: 'lineup_decision',
      priority: gap > 40 ? 'important' : 'info',
      headline: `Start ${bestBench.name} over ${starter.name}?`,
      reasoning: `${bestBench.name} (ADP ${Math.round(bestBench.adp_sleeper!)}) is on your bench while ${starter.name} (ADP ${Math.round(starter.adp_sleeper)}) starts at ${starter.position}. A ${gap}-pick ADP gap says take a look.`,
      affectedLeagues: [affectedLeague],
      deadline: null,
      actionUrl: leagueLink,
    })
  }

  // ─── Waiver opportunity ──────────────────────────────────────────────────
  // T-108/T-98: deepened past the framing-and-reorder-only slice — real
  // FAAB remaining (Sleeper's actual waiver_budget/waiver_budget_used,
  // verified live) and a projected League Health delta, reusing
  // computeLeagueHealth (already-tested, PRD 6.2) rather than inventing new
  // scoring logic: simulate adding the candidate to the bench and compare.
  const rosteredIds = new Set(rosters.flatMap((r) => (Array.isArray(r.players) ? r.players : [])))
  const bestWaiver = topPool.find((p) => !rosteredIds.has(p.player_id))
  if (bestWaiver) {
    const secondBestWaiver = topPool.find(
      (p) => !rosteredIds.has(p.player_id) && p.player_id !== bestWaiver.player_id
    ) ?? null

    const healthPlayers: HealthPlayer[] = myPlayers.map((p) => ({
      playerId: p.player_id,
      adp: p.adp_sleeper,
      injuryStatus: p.injury_status,
    }))
    const currentHealth = computeLeagueHealth({
      myPlayers: healthPlayers,
      starterIds,
      bestFreeAgentAdp: bestWaiver.adp_sleeper,
      bestFreeAgentName: bestWaiver.name,
    })
    // The candidate is now "claimed" in this hypothetical, so the next-best
    // remaining free agent is whoever's second on the board today.
    const hypotheticalHealth = computeLeagueHealth({
      myPlayers: [
        ...healthPlayers,
        { playerId: bestWaiver.player_id, adp: bestWaiver.adp_sleeper, injuryStatus: bestWaiver.injury_status },
      ],
      starterIds,
      bestFreeAgentAdp: secondBestWaiver?.adp_sleeper ?? null,
      bestFreeAgentName: secondBestWaiver?.name ?? null,
    })
    const healthDelta =
      currentHealth.score !== null && hypotheticalHealth.score !== null
        ? hypotheticalHealth.score - currentHealth.score
        : null

    const myRosterFaab = rosters.find((r) => String(r.roster_id) === league.team_id)?.settings?.waiver_budget_used
    const totalBudget = sleeperLeague?.settings?.waiver_budget ?? null
    const remainingBudget = totalBudget !== null && myRosterFaab !== undefined ? totalBudget - myRosterFaab : null

    // PRD Section 9: FAAB-remaining and League Health projection are the
    // Pro-exclusive "full Waiver Day detail" — the base alert (name, ADP,
    // unrostered) above this block stays free either way.
    const faabNote = !free && remainingBudget !== null ? ` You have $${remainingBudget} of your $${totalBudget} FAAB budget left.` : ''
    const healthNote = !free && healthDelta !== null ? ` Adding them projects to ${healthDelta >= 0 ? '+' : ''}${healthDelta} on your League Health score.` : ''
    const upsellNote = free && (remainingBudget !== null || healthDelta !== null) ? ' Unlock FAAB and League Health impact with Pro.' : ''

    items.push({
      fingerprint: `waiver:${league.id}:${bestWaiver.player_id}`,
      type: 'waiver_alert',
      priority: bestWaiver.adp_sleeper! < 100 ? 'important' : 'info',
      headline: `${bestWaiver.name} is unrostered`,
      reasoning: `${bestWaiver.name} (${bestWaiver.position}) has an ADP of ${Math.round(bestWaiver.adp_sleeper!)} and isn't on any roster in this league yet.${faabNote}${healthNote}${upsellNote}`,
      affectedLeagues: [affectedLeague],
      deadline: null,
      actionUrl: leagueLink,
    })
  }

  // ─── Player news (rostered players only) ─────────────────────────────────
  // T-95 follow-up: recentNews is already tagged with every player_id it
  // mentions at ingest (lib/newsRelevance.ts) — this only ever surfaces the
  // ones actually on THIS league's roster, per the PRD's explicit
  // anti-pattern against unfiltered news blasts.
  const myPlayersById = new Map(myPlayers.map((p) => [p.player_id, p]))
  for (const news of recentNews) {
    for (const playerId of news.player_ids) {
      const player = myPlayersById.get(playerId)
      if (!player) continue

      const reasoning = await getOrGenerateNewsReasoning(supabase, player, news)
      if (!reasoning) continue // Claude found no real fantasy implication — don't surface it

      items.push({
        fingerprint: `news:${league.id}:${news.id}:${playerId}`,
        type: 'player_news',
        priority: 'info',
        headline: news.headline,
        reasoning,
        affectedLeagues: [affectedLeague],
        deadline: null,
        actionUrl: news.link,
      })
    }
  }

  // ─── Opportunity surge (T-99) ─────────────────────────────────────────────
  // surgeEvents is computed once, globally, from real NFL depth charts —
  // independent of any fantasy roster. Classify per league: a beneficiary
  // already on this league's bench is a start-them signal; one sitting
  // unrostered here is a waiver pickup signal; one already rostered by an
  // opponent in this league isn't actionable for this user here.
  for (const surge of surgeEvents) {
    const onMyBench = myPlayersById.has(surge.beneficiaryPlayerId) && !starterSet.has(surge.beneficiaryPlayerId)
    const isFreeAgentHere = !rosteredIds.has(surge.beneficiaryPlayerId)
    if (!onMyBench && !isFreeAgentHere) continue

    const reasoning = await getOrGenerateSurgeReasoning(supabase, surge, notesByPlayerId.get(surge.beneficiaryPlayerId))

    items.push({
      fingerprint: `surge:${league.id}:${surge.outgoingPlayerId}:${surge.outgoingStatus}:${surge.beneficiaryPlayerId}`,
      type: 'opportunity_surge',
      priority: 'important',
      headline: onMyBench ? `${surge.beneficiaryName} — start them?` : `${surge.beneficiaryName} is available on waivers`,
      reasoning,
      affectedLeagues: [affectedLeague],
      deadline: null,
      actionUrl: leagueLink,
    })
  }

  return items
}

// Cached once per (player x news item) — read-through so a repeat Pulse
// generation for the same event never re-spends a Claude call, whether it's
// a real sentence or Claude's own "not fantasy-relevant" decline (stored as
// an empty string sentinel, since the column is not-null).
async function getOrGenerateNewsReasoning(
  supabase: SupabaseClient,
  player: CachedPlayer,
  news: NewsRow
): Promise<string | null> {
  const { data: cached } = await supabase
    .from('player_context_cache')
    .select('reasoning')
    .eq('player_id', player.player_id)
    .eq('platform', 'sleeper')
    .eq('kind', 'news')
    .eq('source_id', news.id)
    .maybeSingle()
  if (cached) return cached.reasoning || null

  const reasoning = await generatePlayerNewsContext({
    playerName: player.name,
    playerPosition: player.position ?? '',
    headline: news.headline,
    summary: news.summary,
    mode: PULSE_MODE,
  }).catch(() => null)

  // Best-effort: a race with another of the user's leagues hitting this
  // same (player, news) pair concurrently just no-ops via the unique
  // constraint — never worth failing the request over.
  await supabase.from('player_context_cache').insert({
    player_id: player.player_id,
    platform: 'sleeper',
    kind: 'news',
    source_id: news.id,
    reasoning: reasoning ?? '',
  })

  return reasoning
}

// Same read-through cache pattern as above, keyed on the specific
// (outgoing player, status, beneficiary) triple so a status change (e.g.
// Doubtful -> Out) generates fresh reasoning rather than reusing stale text.
//
// T-143: player_context_cache is shared across every user who sees this
// exact surge event — writing a note-influenced sentence into it would
// leak one user's private note into every other user's identical card.
// So a userNote bypasses the shared cache entirely (no read, no write) and
// always asks Claude fresh; everyone else keeps hitting the shared,
// note-free cache as before.
async function getOrGenerateSurgeReasoning(supabase: SupabaseClient, surge: SurgeEvent, userNote?: string): Promise<string> {
  const fallback = `${surge.beneficiaryName} is next in line at ${surge.beneficiaryPosition} for the ${surge.nflTeam} with ${surge.outgoingName} listed as ${surge.outgoingStatus.toLowerCase()}.`

  if (userNote) {
    return generateOpportunitySurgeContext({
      outgoingName: surge.outgoingName,
      outgoingStatus: surge.outgoingStatus,
      beneficiaryName: surge.beneficiaryName,
      beneficiaryPosition: surge.beneficiaryPosition,
      nflTeam: surge.nflTeam,
      mode: PULSE_MODE,
      userNote,
    }).catch(() => fallback)
  }

  const sourceId = `${surge.outgoingPlayerId}:${surge.outgoingStatus}:${surge.beneficiaryPlayerId}`
  const { data: cached } = await supabase
    .from('player_context_cache')
    .select('reasoning')
    .eq('player_id', surge.beneficiaryPlayerId)
    .eq('platform', 'sleeper')
    .eq('kind', 'opportunity_surge')
    .eq('source_id', sourceId)
    .maybeSingle()
  if (cached) return cached.reasoning

  const reasoning = await generateOpportunitySurgeContext({
    outgoingName: surge.outgoingName,
    outgoingStatus: surge.outgoingStatus,
    beneficiaryName: surge.beneficiaryName,
    beneficiaryPosition: surge.beneficiaryPosition,
    nflTeam: surge.nflTeam,
    mode: PULSE_MODE,
  }).catch(() => fallback)

  await supabase.from('player_context_cache').insert({
    player_id: surge.beneficiaryPlayerId,
    platform: 'sleeper',
    kind: 'opportunity_surge',
    source_id: sourceId,
    reasoning,
  })

  return reasoning
}

function injuryPriority(status: string, isStarter: boolean): PulsePriority | null {
  const s = status.toLowerCase()
  if (s === 'out' || s === 'ir') return isStarter ? 'critical' : 'important'
  if (s === 'doubtful') return isStarter ? 'important' : 'info'
  if (s === 'questionable') return isStarter ? 'important' : 'info'
  return null
}

function isSidelined(status: string | null): boolean {
  const s = status?.toLowerCase()
  return s === 'out' || s === 'ir' || s === 'doubtful'
}

function formatInjuryStatus(status: string): string {
  const s = status.toLowerCase()
  if (s === 'ir') return 'IR'
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ─── Persistence sync ──────────────────────────────────────────────────────────

// Reconciles freshly built items against the DB. Returns false when the
// pulse persistence columns don't exist yet (migration_os_shell.sql not run) —
// callers degrade to serving the built items live, exactly like before T-69.
export async function syncPulseItems(
  admin: SupabaseClient,
  userId: string,
  built: BuiltPulseItem[]
): Promise<boolean> {
  const { data: existing, error } = await admin
    .from('pulse_items')
    .select('id, fingerprint, status, snoozed_until')
    .eq('user_id', userId)
    .not('fingerprint', 'is', null)

  if (error) return false

  const rows = (existing ?? []) as Array<{
    id: string
    fingerprint: string
    status: PulseItemStatus
    snoozed_until: string | null
  }>

  // Wake snoozes that have expired.
  const nowIso = new Date().toISOString()
  const wakeIds = rows
    .filter((r) => r.status === 'snoozed' && r.snoozed_until && r.snoozed_until <= nowIso)
    .map((r) => r.id)
  if (wakeIds.length > 0) {
    await admin
      .from('pulse_items')
      .update({ status: 'open', snoozed_until: null })
      .in('id', wakeIds)
    for (const r of rows) {
      if (wakeIds.includes(r.id)) r.status = 'open'
    }
  }

  const byFingerprint = new Map(rows.map((r) => [r.fingerprint, r]))
  const builtFingerprints = new Set(built.map((b) => b.fingerprint))

  // Insert genuinely new intelligence.
  const toInsert = built.filter((b) => !byFingerprint.has(b.fingerprint))
  if (toInsert.length > 0) {
    await admin.from('pulse_items').insert(
      toInsert.map((b) => ({
        user_id: userId,
        type: b.type,
        priority: b.priority,
        headline: b.headline,
        reasoning: b.reasoning,
        affected_leagues_json: b.affectedLeagues,
        deadline: b.deadline,
        action_url: b.actionUrl,
        platform: 'sleeper',
        fingerprint: b.fingerprint,
        status: 'open',
      }))
    )

    // T-111: found while building LIVE that this pipeline never pushed at
    // all — only the 3 Game Day engagement triggers did. injury_alert is
    // the one PRD 6.6 explicitly calls "the core retention mechanic";
    // player_news is what LIVE's own updates digest surfaces, so it
    // deserves the same "catch someone not looking" treatment. Scoped to
    // just these two, not every Pulse type — the rest stay in-app-only,
    // same as before.
    for (const b of toInsert) {
      if (b.type !== 'injury_alert' && b.type !== 'player_news') continue
      await pushToUser(admin, userId, b.headline, b.reasoning, b.actionUrl ?? undefined).catch(() => {})
    }
  }

  // Refresh content on still-open items — a draft reminder's priority
  // escalates to critical inside 48h under the same fingerprint.
  for (const b of built) {
    const row = byFingerprint.get(b.fingerprint)
    if (!row || row.status !== 'open') continue
    await admin
      .from('pulse_items')
      .update({
        priority: b.priority,
        headline: b.headline,
        reasoning: b.reasoning,
        deadline: b.deadline,
        action_url: b.actionUrl,
      })
      .eq('id', row.id)
  }

  // Drop open items whose underlying signal vanished (player healthy again,
  // FA got claimed). Done/dismissed/snoozed rows are never touched — that's
  // the user's history and their explicit choices.
  const staleIds = rows
    .filter((r) => r.status === 'open' && !builtFingerprints.has(r.fingerprint))
    .map((r) => r.id)
  if (staleIds.length > 0) {
    await admin.from('pulse_items').delete().in('id', staleIds)
  }

  return true
}

// ─── Shaping ───────────────────────────────────────────────────────────────────

export function rowToPulseItem(row: PulseItemRow): PulseItem {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    priority: row.priority,
    headline: row.headline,
    reasoning: row.reasoning,
    affectedLeagues: row.affected_leagues_json ?? [],
    metrics: row.metrics_json ?? undefined,
    deadline: row.deadline,
    actionUrl: row.action_url,
    platform: row.platform,
    isDismissed: row.status === 'dismissed',
    status: row.status,
    createdAt: row.created_at,
  }
}

// Fallback shape when persistence isn't available yet: the built item served
// directly, fingerprint doubling as the id (stable across refreshes).
export function builtToPulseItem(built: BuiltPulseItem, userId: string): PulseItem {
  return {
    id: built.fingerprint,
    userId,
    type: built.type,
    priority: built.priority,
    headline: built.headline,
    reasoning: built.reasoning,
    affectedLeagues: built.affectedLeagues,
    deadline: built.deadline,
    actionUrl: built.actionUrl,
    platform: 'sleeper',
    isDismissed: false,
    status: 'open',
    createdAt: new Date().toISOString(),
  }
}
