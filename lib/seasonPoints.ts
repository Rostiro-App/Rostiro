// T-148 sub-scope 1: real in-season fantasy points, to blend into the
// Trade Analyzer's value model alongside ADP. Founder's own words: "ADP
// doesnt matter after week 2-3 when the real pecking order is shown to the
// world" — before this, nothing tracking real in-season performance
// existed anywhere in this codebase (lib/sleeper.ts had zero stats/points
// references outside the live stat sheet's own in-week reads).
//
// Scored with a standard, disclosed 1-PPR baseline, not any specific
// league's real ScoringSettings — same generic-proxy posture ADP itself
// already has (adpValue in app/api/trades/analyze/route.ts is a transparent
// function of Sleeper-wide ADP, not a specific league's rules either).
// Wiring a real league's actual ScoringSettings into the value model is a
// separate, not-yet-built piece of T-148 (sub-scope 2) — deliberately kept
// out of this pass so the two don't get tangled together.

import { getSleeperWeekStats } from '@/lib/sleeper'
import { computeStatlinePoints } from '@/lib/scoring'
import { currentNflWeek } from '@/lib/liveMatchupPoints'
import { createAdminClient } from '@/lib/supabase'
import type { ScoringSettings } from '@/types'

type AdminClient = ReturnType<typeof createAdminClient>

// Standard, disclosed 1-PPR line — no TE premium, no superflex weighting.
// Not a claim that this is "the" correct scoring format, just a fixed,
// transparent baseline so every player is measured the same way (same
// transparency rule adpValue's own comment states for its curve).
export const STANDARD_SCORING: ScoringSettings = {
  ppr: 1,
  tePremium: 0,
  qbTouchdownPoints: 4,
  passingYardsPerPoint: 25,
  rushingYardsPerPoint: 10,
  receivingYardsPerPoint: 10,
  isSuperFlex: false,
  isHalfPpr: false,
  rushTouchdownPoints: 6,
  receivingTouchdownPoints: 6,
  fumbleLostPoints: -2,
  interceptionThrownPoints: -2,
}

export interface SeasonPointsRow {
  player_id: string
  platform: 'sleeper'
  season: number
  weeks_included: number
  games_played: number
  total_points: number
  points_per_game: number | null
  updated_at: string
}

// Recomputes from scratch every run rather than incrementing a running
// total — a corrected/updated Sleeper stat line for an earlier week (real,
// confirmed to happen) only ever takes effect this way. getSleeperWeekStats
// already caches each week's ~2MB payload for 30s in-process; a full daily
// re-sum across a season's completed weeks is an acceptable cost at this
// app's scale (same tradeoff every other cron-driven sync in this codebase
// makes), and only runs once/day, not per request.
export async function ingestSeasonPoints(admin: AdminClient, season: number): Promise<{ playersUpdated: number; weeksIncluded: number }> {
  const week = await currentNflWeek(admin)
  // Every week strictly before the current one has, at minimum, started —
  // "completed" here means "has real box scores to sum," not literally
  // finished; a week in progress still contributes partial, real stats.
  const weeksIncluded = week !== null ? Math.max(0, week - 1) : 0
  if (weeksIncluded === 0) return { playersUpdated: 0, weeksIncluded: 0 }

  const totals = new Map<string, { total: number; games: number }>()

  for (let w = 1; w <= weeksIncluded; w++) {
    const statsByPlayer = await getSleeperWeekStats(season, w).catch(() => new Map<string, Record<string, number>>())
    for (const [playerId, stats] of statsByPlayer) {
      // Position only ever affects TE premium above, which
      // STANDARD_SCORING sets to 0 — safe to pass null here.
      const points = computeStatlinePoints(stats, null, STANDARD_SCORING)
      if (points === null) continue
      const existing = totals.get(playerId) ?? { total: 0, games: 0 }
      existing.total += points
      existing.games += 1
      totals.set(playerId, existing)
    }
  }

  const rows: SeasonPointsRow[] = [...totals.entries()].map(([playerId, { total, games }]) => ({
    player_id: playerId,
    platform: 'sleeper',
    season,
    weeks_included: weeksIncluded,
    games_played: games,
    total_points: Math.round(total * 100) / 100,
    points_per_game: games > 0 ? Math.round((total / games) * 100) / 100 : null,
    updated_at: new Date().toISOString(),
  }))

  const CHUNK_SIZE = 1000
  let playersUpdated = 0
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE)
    const { error } = await admin.from('player_season_points').upsert(chunk, { onConflict: 'player_id,platform,season' })
    if (error) throw new Error(error.message)
    playersUpdated += chunk.length
  }

  return { playersUpdated, weeksIncluded }
}

// How much a player's real season-to-date scoring should count toward
// trade value, versus ADP — increases as weeks accumulate, capped well
// short of 100% since points-per-game is itself noisy on a small sample
// and ADP still carries real preseason signal. Both constants are just
// disclosed numbers, not a claim of statistical optimality — same posture
// as adpValue's own curve.
const WEIGHT_PER_WEEK = 0.15
const MAX_POINTS_WEIGHT = 0.75

export function pointsWeight(weeksIncluded: number): number {
  return Math.min(MAX_POINTS_WEIGHT, weeksIncluded * WEIGHT_PER_WEEK)
}

// Linear, disclosed scale putting points-per-game on roughly the same
// numeric range as adpValue's 0-260 draft-capital curve (an every-week
// ~20-point-per-game workhorse lands near 200, comparable to a very early
// pick) — not a claim that the two scales are equivalent, just close
// enough that a blend of the two doesn't produce nonsense at either
// extreme.
const POINTS_PER_GAME_SCALE = 10

export function pointsValue(pointsPerGame: number | null): number | null {
  if (pointsPerGame === null) return null
  return Math.max(0, pointsPerGame * POINTS_PER_GAME_SCALE)
}

// A player with no season-points row yet (bye/IR all season, or the
// migration hasn't run) falls back to pure ADP — never blocks a trade
// analysis, just means that one player's value is ADP-only.
export function blendValue(adpVal: number, seasonPointsPerGame: number | null, weeksIncluded: number): number {
  const pv = pointsValue(seasonPointsPerGame)
  if (pv === null || weeksIncluded === 0) return adpVal
  const w = pointsWeight(weeksIncluded)
  return adpVal * (1 - w) + pv * w
}
