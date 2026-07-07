// T-83: personal playoff-intensity ladder — "Rostiro changes as the
// fantasy season does, and when you make the championship, Rostiro gains
// a level of intensity with you" (founder, July 7, 2026). Deliberately
// personal, not calendar-flat: Tier 1 is real per-league playoff timing
// (Sleeper's own playoff_week_start, not a hardcoded weeks 15-17), Tiers
// 2-3 are this specific roster's real bracket status, from Sleeper's own
// winners_bracket endpoint — no data invented, same discipline as every
// other deterministic computation in this codebase (computeFilmRoomResult,
// computeBestAvailable).

import type { SleeperBracketMatch } from '@/lib/sleeper'

export type PlayoffTier = 'none' | 'league_playoffs' | 'alive' | 'championship'

// A round's side is either seeded directly (t1/t2 already a real roster_id)
// or resolved from an earlier match's real outcome (t1_from/t2_from) — a
// match with a pending earlier round resolves to null, same as Sleeper's
// own "not decided yet" state.
function resolveBracketSide(
  matches: SleeperBracketMatch[],
  match: SleeperBracketMatch,
  side: 't1' | 't2'
): number | null {
  const direct = match[side]
  if (direct !== null) return direct

  const from = side === 't1' ? match.t1_from : match.t2_from
  if (!from) return null

  const sourceMatch = matches.find((m) => m.m === (from.w ?? from.l))
  if (!sourceMatch) return null
  return from.w !== undefined ? sourceMatch.w : sourceMatch.l
}

// Highest round in the championship-path bracket where this roster is
// either a direct or resolved participant, and whether it's already lost.
// A roster with zero appearances anywhere in the bracket didn't make the
// playoffs at all (a real, common outcome — not every roster in the
// league qualifies).
export function computeBracketTier(bracket: SleeperBracketMatch[], myRosterId: number): 'none' | 'alive' | 'championship' {
  if (bracket.length === 0) return 'none'
  const maxRound = Math.max(...bracket.map((m) => m.r))

  const finalMatch = bracket.find((m) => m.r === maxRound)
  if (finalMatch) {
    const t1 = resolveBracketSide(bracket, finalMatch, 't1')
    const t2 = resolveBracketSide(bracket, finalMatch, 't2')
    if (t1 === myRosterId || t2 === myRosterId) return 'championship'
  }

  let participated = false
  for (const match of bracket) {
    const t1 = resolveBracketSide(bracket, match, 't1')
    const t2 = resolveBracketSide(bracket, match, 't2')
    if (t1 !== myRosterId && t2 !== myRosterId) continue
    participated = true
    // Eliminated the moment this roster is recorded as a loser anywhere —
    // stays at 'none' rather than a separate 'eliminated' tier, since a
    // knocked-out roster reverts to the ordinary Standard-state feel
    // (Section 7's non-punitive framing — no special "you lost" tier).
    if (match.l === myRosterId) return 'none'
  }

  return participated ? 'alive' : 'none'
}

// The full ladder: league-wide playoff timing (Tier 1) first, then this
// roster's real bracket standing (Tiers 2-3) only once it's actually
// possible to know one (the bracket is empty until the league's playoff
// week genuinely starts).
export function computePlayoffTier(input: {
  currentWeek: number | null
  playoffWeekStart: number | null
  bracket: SleeperBracketMatch[]
  myRosterId: number
}): PlayoffTier {
  const { currentWeek, playoffWeekStart, bracket, myRosterId } = input
  if (currentWeek === null || playoffWeekStart === null || currentWeek < playoffWeekStart) return 'none'

  const bracketTier = computeBracketTier(bracket, myRosterId)
  if (bracketTier === 'championship') return 'championship'
  if (bracketTier === 'alive') return 'alive'
  return 'league_playoffs'
}
