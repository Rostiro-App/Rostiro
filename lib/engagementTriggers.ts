// T-93 / PRD 6.12: Game Day Engagement System — Momentum Triggers.
//
// Of the 7 triggers in 6.12's taxonomy, only 3 are buildable against data
// that actually exists today, and this file only builds those three:
//   - touchdown_swing: live_scores is a TEAM-level score cache (T-81), not
//     play-by-play, so this detects "your team just scored" and names your
//     rostered players *on that team* — never a specific scoring player.
//   - lineup_lock: deterministic from kickoff time + starters + injury
//     status, all of which already exist.
//   - mission_complete: all of a user's roster-relevant games hitting
//     'post', from the same live_scores rows T-90 already reads.
// Not built, and not faked: injury-during-play (needs a live injury feed —
// only daily snapshots exist), lead_change (needs a live *fantasy* scoring
// engine — doesn't exist), trade_offer_received (needs incoming-trade
// polling per platform — only outgoing trade-proposing exists, lib/yahoo.ts),
// opportunity_surge (needs T-87's nflverse usage cron, never built).
//
// Detection is a diff against the existing live_scores row (10.2's own
// engineering note) — called from the live-scores cron, no new polling
// loop. Sleeper-only, same honest scope limit as the rest of Game Day
// (T-79/T-90) until ESPN/Yahoo roster sync is live end-to-end.

import { getSleeperRosters } from '@/lib/sleeper'
import { toNflverseTeamCode } from '@/lib/liveScores'
import { sendPushNotification } from '@/lib/onesignal'
import { isFreePlan } from '@/lib/usageLimits'
import { buildLiveRoster } from '@/lib/liveRoster'
import { computeLeagueWinProbs } from '@/lib/liveWinProb'
import type { createAdminClient } from '@/lib/supabase'
import type { InterruptMetricRow } from '@/types'

// Was a minimal structural `{ from: (table: string) => any }` until this file
// started calling buildLiveRoster (T-115), which needs the real Supabase
// client shape — every real caller already passes createAdminClient()'s
// result, so this is a type-only tightening, not a behavior change.
type AdminClient = ReturnType<typeof createAdminClient>

interface SleeperLeagueRow {
  id: string
  user_id: string
  league_id: string
  league_name: string
  team_id: string | null
}

// A team score changing by one of these amounts in a single poll is a score
// play (safety/2pt=2, FG=3, TD=6, TD+XP=7, TD+2pt=8). Anything else (garbage
// clock ticks, a stat correction that nets to 0) isn't treated as a swing.
const SCORING_DELTAS = new Set([2, 3, 6, 7, 8])

async function loadSleeperLeagues(admin: AdminClient): Promise<SleeperLeagueRow[]> {
  const { data } = await admin
    .from('connected_leagues')
    .select('id, user_id, league_id, league_name, team_id')
    .eq('platform', 'sleeper')
  return (data ?? []) as SleeperLeagueRow[]
}

// The de-dup gate: an insert conflicting with the unique constraint means
// this exact event already fired for this user — skip silently rather than
// erroring, that's the whole point of the constraint.
async function claimTrigger(
  admin: AdminClient,
  userId: string,
  triggerType: 'touchdown_swing' | 'lineup_lock' | 'mission_complete',
  dedupeKey: string
): Promise<boolean> {
  const { error } = await admin
    .from('engagement_log')
    .insert({ user_id: userId, trigger_type: triggerType, dedupe_key: dedupeKey })
  if (error) {
    if (error.code === '23505') return false
    throw new Error(error.message)
  }
  return true
}

// Exported (T-111) so lib/pulse.ts's regular Pulse pipeline can reuse the
// exact same Pro-gate + subscription lookup, rather than a second copy of
// this logic — found while building LIVE that the regular pipeline
// (injury_alert, player_news, etc.) never pushed at all, only these three
// Game Day triggers did.
export async function pushToUser(admin: AdminClient, userId: string, title: string, message: string, url?: string) {
  // PRD 9: push notifications are a Pro feature — the in-app Pulse card
  // (inserted separately, unconditionally) is the free tier's "smell what's
  // cooking" layer; getting proactively pinged the instant it happens,
  // rather than finding out next time you open the app, is the upgrade
  // lever. This was already decided in Section 9 but never actually
  // enforced until now (UX Behavior Spec Gap, 2026-07-04). Routed through
  // the same isFreePlan every other gate uses so the promo window/trial
  // logic applies here too, instead of a second, independent plan check.
  if (await isFreePlan(admin, userId)) return

  const { data } = await admin.from('push_subscriptions').select('onesignal_player_id').eq('user_id', userId)
  const ids = ((data ?? []) as { onesignal_player_id: string }[]).map((r) => r.onesignal_player_id)
  if (ids.length === 0) return
  // A failed push should never break the caller's detection loop — same
  // resilience posture as every other external call in this codebase.
  await sendPushNotification({ subscriptionIds: ids, title, message, url }).catch(() => {})
}

async function insertPulseItem(
  admin: AdminClient,
  userId: string,
  item: {
    type: 'touchdown_swing' | 'lineup_lock' | 'mission_complete'
    priority: 'critical' | 'important' | 'info'
    headline: string
    reasoning: string
    affectedLeagues: { leagueId: string; leagueName: string; platform: 'sleeper' }[]
    metrics?: InterruptMetricRow[]
    // T-106 / PRD 7.1: 'interrupt' routes through components/InterruptStack.tsx
    // (transient, one slot at a time) instead of the persistent Action-layer
    // Pulse queue. Defaults to 'action' — mission_complete stays there,
    // matching 6.12's own "Pulse settles to a calm summary card" language.
    layer?: 'action' | 'interrupt'
  }
) {
  // Deliberately no fingerprint. lib/pulse.ts's syncPulseItems (the daily
  // Pulse rebuild) treats ANY open row with a non-null fingerprint that
  // isn't in that day's freshly-built injury/lineup/waiver set as stale and
  // deletes it — these rows come from a completely different code path
  // (engagement_log's unique constraint is the real dedup here, not a
  // fingerprint), so a fingerprint here would get them silently wiped out
  // by the next daily cron run rather than surviving until dismissed.
  await admin.from('pulse_items').insert({
    user_id: userId,
    type: item.type,
    priority: item.priority,
    headline: item.headline,
    reasoning: item.reasoning,
    affected_leagues_json: item.affectedLeagues,
    metrics_json: item.metrics ?? null,
    platform: 'sleeper',
    layer: item.layer ?? 'action',
    status: 'open',
  })
}

// ─── Touchdown swing ────────────────────────────────────────────────────────

export interface ScoreDelta {
  gameId: string
  homeTeam: string
  awayTeam: string
  prevHomeScore: number
  prevAwayScore: number
  newHomeScore: number
  newAwayScore: number
}

export async function detectTouchdownSwings(admin: AdminClient, deltas: ScoreDelta[]): Promise<void> {
  const scoringEvents = deltas
    .map((d) => {
      const homeDelta = d.newHomeScore - d.prevHomeScore
      const awayDelta = d.newAwayScore - d.prevAwayScore
      const team = SCORING_DELTAS.has(homeDelta) ? d.homeTeam : SCORING_DELTAS.has(awayDelta) ? d.awayTeam : null
      return team ? { ...d, team } : null
    })
    .filter((e): e is ScoreDelta & { team: string } => e !== null)
  if (scoringEvents.length === 0) return

  const leagues = await loadSleeperLeagues(admin)
  if (leagues.length === 0) return

  const rostersByLeagueId = new Map<string, Awaited<ReturnType<typeof getSleeperRosters>>>()
  for (const league of leagues) {
    if (!rostersByLeagueId.has(league.league_id)) {
      rostersByLeagueId.set(league.league_id, await getSleeperRosters(league.league_id).catch(() => []))
    }
  }

  for (const event of scoringEvents) {
    const { data: teamPlayers } = await admin
      .from('players_cache')
      .select('player_id, name')
      .eq('platform', 'sleeper')
      .eq('nfl_team', event.team)
    const teamPlayerIds = new Map(((teamPlayers ?? []) as { player_id: string; name: string }[]).map((p) => [p.player_id, p.name]))
    if (teamPlayerIds.size === 0) continue

    // Cross-league de-dup (6.12): one push per user naming every affected
    // league, never one push per league.
    const byUser = new Map<string, { leagueNames: string[]; leagues: SleeperLeagueRow[]; playerNames: Set<string> }>()
    for (const league of leagues) {
      const rosters = rostersByLeagueId.get(league.league_id) ?? []
      const myRoster = rosters.find((r) => String(r.roster_id) === league.team_id)
      if (!myRoster) continue
      const owned = (myRoster.players ?? []).filter((id: string) => teamPlayerIds.has(id))
      if (owned.length === 0) continue
      const entry = byUser.get(league.user_id) ?? { leagueNames: [], leagues: [], playerNames: new Set() }
      entry.leagueNames.push(league.league_name)
      entry.leagues.push(league)
      owned.forEach((id: string) => entry.playerNames.add(teamPlayerIds.get(id)!))
      byUser.set(league.user_id, entry)
    }

    for (const [userId, info] of byUser) {
      const dedupeKey = `${event.gameId}:${event.newHomeScore}-${event.newAwayScore}`
      const claimed = await claimTrigger(admin, userId, 'touchdown_swing', dedupeKey)
      if (!claimed) continue

      const players = [...info.playerNames].join(', ')
      const headline = `${event.team} scores — ${players} in the mix`
      const reasoning = `${event.team} just put points on the board (now ${event.newHomeScore}-${event.newAwayScore}). You roster ${players} across ${info.leagueNames.length} ${info.leagueNames.length === 1 ? 'league' : 'leagues'} — exact scoring player isn't available from the live scoreboard feed, only the team-level swing.`

      let metrics: InterruptMetricRow[] | undefined
      if (!(await isFreePlan(admin, userId))) {
        try {
          const { matchups } = await buildLiveRoster(admin, userId)
          const affectedIds = new Set(info.leagues.map((l) => l.id))
          const rows = computeLeagueWinProbs(matchups, affectedIds)
          if (rows.length > 0) metrics = rows
        } catch {
          // Win-prob is a garnish on the card — a failed matchup fetch just
          // omits the rows, never blocks the touchdown interrupt.
        }
      }

      await insertPulseItem(admin, userId, {
        type: 'touchdown_swing',
        priority: 'info',
        headline,
        reasoning,
        affectedLeagues: info.leagues.map((l) => ({ leagueId: l.id, leagueName: l.league_name, platform: 'sleeper' })),
        metrics,
        layer: 'interrupt',
      })
      await pushToUser(admin, userId, 'Touchdown!', headline)
    }
  }
}

// ─── Lineup-lock countdown ──────────────────────────────────────────────────

const LINEUP_LOCK_WINDOW_MS = 30 * 60 * 1000

export async function detectLineupLockUrgency(admin: AdminClient, todayEt: string): Promise<void> {
  const leagues = await loadSleeperLeagues(admin)
  if (leagues.length === 0) return

  const { data: todaysGames } = await admin
    .from('nfl_schedule')
    .select('home_team, away_team, kickoff_at')
    .eq('game_date', todayEt)
  const kickoffByTeam = new Map<string, number>()
  for (const g of (todaysGames ?? []) as { home_team: string; away_team: string; kickoff_at: string }[]) {
    const k = new Date(g.kickoff_at).getTime()
    kickoffByTeam.set(g.home_team, k)
    kickoffByTeam.set(g.away_team, k)
  }
  if (kickoffByTeam.size === 0) return

  const now = Date.now()

  for (const league of leagues) {
    const rosters = await getSleeperRosters(league.league_id).catch(() => [])
    const myRoster = rosters.find((r) => String(r.roster_id) === league.team_id)
    if (!myRoster || !myRoster.starters || myRoster.starters.length === 0) continue

    const starterIds = myRoster.starters.filter((id: string) => id !== '0')
    const emptySlots = myRoster.starters.length - starterIds.length

    const { data: starterRows } = starterIds.length > 0
      ? await admin.from('players_cache').select('player_id, name, nfl_team, injury_status').eq('platform', 'sleeper').in('player_id', starterIds)
      : { data: [] }
    const starters = (starterRows ?? []) as { player_id: string; name: string; nfl_team: string | null; injury_status: string | null }[]

    const kickoffs = starters
      .map((s) => (s.nfl_team ? kickoffByTeam.get(toNflverseTeamCode(s.nfl_team)) : undefined))
      .filter((k): k is number => k !== undefined)
    if (kickoffs.length === 0) continue
    const earliestKickoff = Math.min(...kickoffs)

    const insideWindow = now >= earliestKickoff - LINEUP_LOCK_WINDOW_MS && now < earliestKickoff
    if (!insideWindow) continue

    const flagged = starters.filter((s) => {
      const status = s.injury_status?.toLowerCase()
      return status === 'questionable' || status === 'doubtful'
    })
    if (flagged.length === 0 && emptySlots === 0) continue

    const dedupeKey = `${league.id}:${todayEt}`
    const claimed = await claimTrigger(admin, league.user_id, 'lineup_lock', dedupeKey)
    if (!claimed) continue

    const minutesLeft = Math.max(0, Math.round((earliestKickoff - now) / 60000))
    const issues = [
      ...flagged.map((s) => `${s.name} is ${s.injury_status}`),
      ...(emptySlots > 0 ? [`${emptySlots} empty starter ${emptySlots === 1 ? 'slot' : 'slots'}`] : []),
    ].join(', ')
    const headline = `Kickoff in ${minutesLeft} min — ${league.league_name} lineup needs a look`
    const reasoning = `${issues}. Last chance to fix this before the slot locks.`

    await insertPulseItem(admin, league.user_id, {
      type: 'lineup_lock',
      priority: 'critical',
      headline,
      reasoning,
      affectedLeagues: [{ leagueId: league.id, leagueName: league.league_name, platform: 'sleeper' }],
      layer: 'interrupt',
    })
    await pushToUser(admin, league.user_id, headline, reasoning)
  }
}

// ─── Mission Complete ───────────────────────────────────────────────────────

export async function detectMissionComplete(admin: AdminClient, todayEt: string): Promise<void> {
  const leagues = await loadSleeperLeagues(admin)
  if (leagues.length === 0) return

  const { data: todaysGames } = await admin
    .from('nfl_schedule')
    .select('game_id, home_team, away_team')
    .eq('game_date', todayEt)
  const schedule = (todaysGames ?? []) as { game_id: string; home_team: string; away_team: string }[]
  if (schedule.length === 0) return

  const { data: scoreRows } = await admin.from('live_scores').select('game_id, status_state').in('game_id', schedule.map((g) => g.game_id))
  const statusByGameId = new Map(((scoreRows ?? []) as { game_id: string; status_state: string }[]).map((r) => [r.game_id, r.status_state]))

  const byUser = new Map<string, SleeperLeagueRow[]>()
  for (const league of leagues) {
    byUser.set(league.user_id, [...(byUser.get(league.user_id) ?? []), league])
  }

  for (const [userId, userLeagues] of byUser) {
    const teams = new Set<string>()
    for (const league of userLeagues) {
      const rosters = await getSleeperRosters(league.league_id).catch(() => [])
      const myRoster = rosters.find((r) => String(r.roster_id) === league.team_id)
      if (!myRoster) continue
      const { data: playerRows } = myRoster.players?.length
        ? await admin.from('players_cache').select('nfl_team').eq('platform', 'sleeper').in('player_id', myRoster.players)
        : { data: [] }
      for (const p of (playerRows ?? []) as { nfl_team: string | null }[]) {
        if (p.nfl_team) teams.add(toNflverseTeamCode(p.nfl_team))
      }
    }

    const relevantGames = schedule.filter((g) => teams.has(g.home_team) || teams.has(g.away_team))
    if (relevantGames.length === 0) continue
    const allDone = relevantGames.every((g) => statusByGameId.get(g.game_id) === 'post')
    if (!allDone) continue

    const dedupeKey = todayEt
    const claimed = await claimTrigger(admin, userId, 'mission_complete', dedupeKey)
    if (!claimed) continue

    const headline = `All your games are final for today`
    const reasoning = `${relevantGames.length} relevant ${relevantGames.length === 1 ? 'game has' : 'games have'} wrapped up across ${userLeagues.length} ${userLeagues.length === 1 ? 'league' : 'leagues'}. Mission complete — check back for Film Room tomorrow.`

    await insertPulseItem(admin, userId, {
      type: 'mission_complete',
      priority: 'info',
      headline,
      reasoning,
      affectedLeagues: userLeagues.map((l) => ({ leagueId: l.id, leagueName: l.league_name, platform: 'sleeper' })),
    })
    await pushToUser(admin, userId, headline, reasoning)
  }
}
