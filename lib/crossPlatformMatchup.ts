// Packet 03, P3-9: cross-platform matchup normalization — prep for
// Packet 04's live cross-league matchup feature, not a production
// consumer itself. Unlike roster/exposure (which read a stored
// roster_snapshots row), a matchup read is always LIVE — there is no
// snapshot table for it, so "freshness" doesn't apply the same way;
// instead each league gets an honest per-call status.
//
// lib/platforms/sleeper.ts's sleeperReadMatchup and lib/platforms/espn.ts's
// espnReadMatchup already produce the SAME NormalizedMatchup shape with
// identical honesty conventions (myProjectedScore/opponentProjectedScore
// null when the platform exposes no projection field, status: 'unknown'
// when no pregame/live/final flag is confirmed) — this file adds the
// per-user, per-week aggregation across every connected league, with the
// same failure-isolation discipline as lib/crossPlatformPortfolio.ts and
// lib/crossPlatformPulse.ts: one league's failure never blanks another's
// real matchup.

import { createAdminClient } from '@/lib/supabase'
import { getIntelligenceAdapter, type ConnectedLeagueContext, type NormalizedMatchup } from '@/lib/platforms'
import type { Platform } from '@/types'

type AdminClient = ReturnType<typeof createAdminClient>

interface ConnectedLeagueRow {
  id: string
  platform: Platform
  league_id: string
  league_name: string
  team_id: string | null
}

export type MatchupEntryStatus = 'ok' | 'failed' | 'unsupported' | 'approval_pending'

export interface LeagueMatchupEntry {
  connectedLeagueId: string
  leagueName: string
  platform: Platform
  week: number
  status: MatchupEntryStatus
  matchup: NormalizedMatchup | null
  reason: string | null
}

async function computeLeagueMatchup(
  league: ConnectedLeagueRow,
  userId: string,
  week: number
): Promise<LeagueMatchupEntry> {
  const base = { connectedLeagueId: league.id, leagueName: league.league_name, platform: league.platform, week }

  if (!league.team_id) {
    return { ...base, status: 'failed', matchup: null, reason: 'No team assigned yet' }
  }

  const adapter = getIntelligenceAdapter(league.platform)
  if (!adapter) {
    const status: MatchupEntryStatus = league.platform === 'yahoo' ? 'approval_pending' : 'unsupported'
    return { ...base, status, matchup: null, reason: `No intelligence adapter for platform '${league.platform}'` }
  }
  if (!adapter.readMatchup) {
    return { ...base, status: 'unsupported', matchup: null, reason: `Platform '${league.platform}' does not support matchup reads` }
  }

  const context: ConnectedLeagueContext = {
    connectedLeagueId: league.id,
    userId,
    platform: league.platform,
    externalLeagueId: league.league_id,
    externalTeamId: league.team_id,
  }

  const result = await adapter.readMatchup(context, week)
  if (result.status !== 'ok' || !result.data) {
    return { ...base, status: 'failed', matchup: null, reason: result.errorReason ?? `Matchup read failed (status: ${result.status})` }
  }
  return { ...base, status: 'ok', matchup: result.data, reason: null }
}

export interface UserCrossPlatformMatchups {
  week: number
  entries: LeagueMatchupEntry[]
}

/**
 * One pass across every connected league for a given week. Each league's
 * read is isolated via Promise.allSettled — a thrown exception (network
 * error, credential failure) becomes one 'failed' entry, never removing
 * another league's real matchup.
 */
export async function computeUserCrossPlatformMatchups(userId: string, week: number): Promise<UserCrossPlatformMatchups> {
  const admin: AdminClient = createAdminClient()
  const { data: leagues } = await admin
    .from('connected_leagues')
    .select('id, platform, league_id, league_name, team_id')
    .eq('user_id', userId)
  const rows = (leagues ?? []) as ConnectedLeagueRow[]

  const results = await Promise.allSettled(rows.map((league) => computeLeagueMatchup(league, userId, week)))
  const entries = results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : {
          connectedLeagueId: rows[i].id,
          leagueName: rows[i].league_name,
          platform: rows[i].platform,
          week,
          status: 'failed' as const,
          matchup: null,
          reason: r.reason instanceof Error ? r.reason.message : 'Unknown error computing this league\'s matchup',
        }
  )

  return { week, entries }
}

// ─── Weekly summary (groundwork for Packet 04's cross-league dashboard) ──

export type MatchupOutcome = 'winning' | 'losing' | 'tied' | 'unknown'

export interface MatchupOutcomeSummary {
  totalLeagues: number
  winning: number
  losing: number
  tied: number
  unknown: number // includes failed/unsupported/approval_pending AND 'ok' reads with a null score
}

function outcomeFor(entry: LeagueMatchupEntry): MatchupOutcome {
  if (entry.status !== 'ok' || !entry.matchup) return 'unknown'
  const { myScore, opponentScore } = entry.matchup
  if (myScore === null || opponentScore === null) return 'unknown'
  if (myScore > opponentScore) return 'winning'
  if (myScore < opponentScore) return 'losing'
  return 'tied'
}

/**
 * Never guesses an outcome from a missing score — a league whose real
 * score isn't available (platform gap, failed read, unsupported/
 * approval-pending platform) is counted as 'unknown', not silently
 * folded into 'tied' or dropped from the total.
 */
export function summarizeCrossPlatformWeek(entries: LeagueMatchupEntry[]): MatchupOutcomeSummary {
  const summary: MatchupOutcomeSummary = { totalLeagues: entries.length, winning: 0, losing: 0, tied: 0, unknown: 0 }
  for (const entry of entries) {
    const outcome = outcomeFor(entry)
    summary[outcome === 'winning' ? 'winning' : outcome === 'losing' ? 'losing' : outcome === 'tied' ? 'tied' : 'unknown']++
  }
  return summary
}
