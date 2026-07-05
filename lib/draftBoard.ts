// T-64.1: Draft Copilot — pure computation. No network calls in this file —
// everything here operates on data already fetched (cached player pool,
// polled picks, draft settings), which is what makes the board "always
// current" without a per-view API round trip. See PRD 6.3.1.

import type { ADPPlayer, DraftPick, DraftStrategy, NFLPosition } from '@/types'

// ─── Draft strategy ─────────────────────────────────────────────────────────────
// A stated strategy changes what "need" means at a given point in the draft —
// Zero-RB says RB isn't a real need until the mid-rounds; Hero-RB says draft
// exactly one elite RB early then pivot hard to WR. This is a real override
// on top of pure roster-slot need, not just a tiebreaker — see the scoring in
// computeBestAvailable below for why the two have to be unified into one
// signal rather than kept as separate sort passes.

export const STRATEGY_LABELS: Record<DraftStrategy, string> = {
  balanced: 'Balanced (BPA)',
  zero_rb: 'Zero-RB',
  zero_wr: 'Zero-WR',
  hero_rb: 'Hero-RB',
  hero_wr: 'Hero-WR',
  robust_rb: 'Robust RB',
  late_qb: 'Late-Round QB',
  te_premium: 'TE Premium',
}

export const STRATEGY_DESCRIPTIONS: Record<DraftStrategy, string> = {
  balanced: 'Best player available, weighted by roster need only.',
  zero_rb: 'Avoid RB early, stack WR depth, catch up on RB from the mid-rounds on.',
  zero_wr: 'Avoid WR early, stack RB depth, catch up on WR from the mid-rounds on.',
  hero_rb: 'Take one elite RB early, then pivot hard to WR before circling back for RB depth.',
  hero_wr: 'Take one elite WR early, then prioritize RB before circling back for WR depth.',
  robust_rb: 'Commit to RB across the first three rounds, building a two- or three-deep RB core before WR.',
  late_qb: 'Punt QB entirely until the double-digit rounds — the position is deep enough to wait, so bank the early picks on RB/WR/TE.',
  te_premium: 'Prioritize an elite pass-catching TE in the first three rounds, then leave the position alone until the very late, replacement-level rounds.',
}

interface StrategyRule {
  position: NFLPosition
  roundStart: number
  roundEnd: number
  weight: number // negative = deprioritize, positive = prioritize; 0 = neutral
}

const STRATEGY_RULES: Record<DraftStrategy, StrategyRule[]> = {
  balanced: [],
  zero_rb: [
    { position: 'RB', roundStart: 1, roundEnd: 4, weight: -2 },
    { position: 'WR', roundStart: 1, roundEnd: 5, weight: 1 },
    { position: 'RB', roundStart: 5, roundEnd: 8, weight: 1 },
  ],
  zero_wr: [
    { position: 'WR', roundStart: 1, roundEnd: 4, weight: -2 },
    { position: 'RB', roundStart: 1, roundEnd: 5, weight: 1 },
    { position: 'WR', roundStart: 5, roundEnd: 8, weight: 1 },
  ],
  hero_rb: [
    { position: 'RB', roundStart: 1, roundEnd: 1, weight: 2 },
    { position: 'RB', roundStart: 2, roundEnd: 5, weight: -2 },
    { position: 'WR', roundStart: 2, roundEnd: 5, weight: 1 },
    { position: 'RB', roundStart: 6, roundEnd: 9, weight: 1 },
  ],
  hero_wr: [
    { position: 'WR', roundStart: 1, roundEnd: 1, weight: 2 },
    { position: 'WR', roundStart: 2, roundEnd: 4, weight: -1 },
    { position: 'RB', roundStart: 2, roundEnd: 5, weight: 2 },
  ],
  robust_rb: [
    { position: 'RB', roundStart: 1, roundEnd: 3, weight: 2 },
    { position: 'WR', roundStart: 1, roundEnd: 3, weight: -1 },
    { position: 'RB', roundStart: 4, roundEnd: 6, weight: 1 },
  ],
  late_qb: [
    { position: 'QB', roundStart: 1, roundEnd: 9, weight: -2 },
    { position: 'QB', roundStart: 10, roundEnd: 20, weight: 1 },
  ],
  te_premium: [
    { position: 'TE', roundStart: 1, roundEnd: 3, weight: 2 },
    { position: 'TE', roundStart: 4, roundEnd: 8, weight: -1 },
  ],
}

// Raw weight (-2..+2, 0 = neutral) — exposed so the UI can show *why* a
// player's rank shifted, not just present a reordered list silently.
export function getStrategyWeight(strategy: DraftStrategy, position: NFLPosition, round: number): number {
  const rules = STRATEGY_RULES[strategy]
  const match = rules.find((r) => r.position === position && round >= r.roundStart && round <= r.roundEnd)
  return match?.weight ?? 0
}

// ─── Turn prediction ───────────────────────────────────────────────────────────

// Every absolute pick number (1-indexed) that belongs to `mySlot` across a
// standard snake draft. Even rounds reverse the pick order.
export function computeMyPickNumbers(mySlot: number, teamCount: number, totalRounds: number): number[] {
  const picks: number[] = []
  for (let round = 1; round <= totalRounds; round++) {
    const positionInRound = round % 2 === 1 ? mySlot : teamCount - mySlot + 1
    picks.push((round - 1) * teamCount + positionInRound)
  }
  return picks
}

// null when the draft has no more picks belonging to this slot (draft over,
// or this was the last pick).
export function picksUntilMyTurn(myPickNumbers: number[], currentPickNumber: number): number | null {
  const next = myPickNumbers.find((n) => n >= currentPickNumber)
  return next === undefined ? null : next - currentPickNumber
}

// ─── Run detection ─────────────────────────────────────────────────────────────

export interface PositionRun {
  position: NFLPosition
  count: number
  windowSize: number
}

// Looks at the most recent `windowSize` picks (any team, not just mine) and
// flags when `threshold` or more share a position — the "a run just started"
// signal from PRD 6.3.1.
export function detectPositionRun(
  picks: DraftPick[],
  windowSize = 4,
  threshold = 3
): PositionRun | null {
  if (picks.length === 0) return null

  const recent = [...picks].sort((a, b) => b.pickNumber - a.pickNumber).slice(0, windowSize)
  const counts = new Map<NFLPosition, number>()
  for (const p of recent) {
    counts.set(p.position, (counts.get(p.position) ?? 0) + 1)
  }

  let top: PositionRun | null = null
  for (const [position, count] of counts) {
    if (count >= threshold && (!top || count > top.count)) {
      top = { position, count, windowSize: recent.length }
    }
  }
  return top
}

// ─── Snipe detection ───────────────────────────────────────────────────────────

// Queued (starred) player IDs that have just been drafted by someone else.
// Caller diffs the result against what it already showed the user to avoid
// re-alerting on the same snipe every poll.
export function findSnipedQueueTargets(queue: string[], draftedPlayerIds: Set<string>): string[] {
  return queue.filter((id) => draftedPlayerIds.has(id))
}

// ─── Best available ────────────────────────────────────────────────────────────

export interface RankedPlayer {
  player: ADPPlayer
  isNeeded: boolean
  strategyWeight: number // same scale as getStrategyWeight — 0 when strategy is 'balanced' or no rule applies
}

// A flat need-before-filled partition (the original design) can't let a
// strategy override "need" — Zero-RB's whole point is to deprioritize RB
// despite an empty RB slot, which a hard partition would never allow. So
// need and strategy are combined into one adjusted-ADP score instead: each
// shifts a player's effective ADP by a fixed amount, and the list sorts on
// that. Constants below are tuned to feel like a strong nudge, not an
// absolute override — a truly elite player one tier above the field can
// still outrank a same-position "needed" scrub.
const NEED_ADP_BONUS = 50
const STRATEGY_ADP_UNIT = 20

export function computeBestAvailable(
  pool: ADPPlayer[],
  draftedPlayerIds: Set<string>,
  rosterNeeds: Partial<Record<NFLPosition, number>>,
  rosterCounts: Partial<Record<NFLPosition, number>>,
  strategy: DraftStrategy = 'balanced',
  round = 1
): RankedPlayer[] {
  const available = pool.filter((p) => !draftedPlayerIds.has(p.playerId))

  const ranked: RankedPlayer[] = available.map((player) => {
    const need = rosterNeeds[player.position] ?? 0
    const have = rosterCounts[player.position] ?? 0
    const isNeeded = have < need
    const strategyWeight = getStrategyWeight(strategy, player.position, round)
    return { player, isNeeded, strategyWeight }
  })

  // overallRank, not adpConsensus — the latter (Sleeper's search_rank) has
  // frequent exact ties across positions (e.g. the top RB and top QB both
  // at "1"), which would otherwise leave tie-breaking to sort() stability
  // rather than the actual overall order.
  const adjustedAdp = (r: RankedPlayer) =>
    r.player.overallRank - (r.isNeeded ? NEED_ADP_BONUS : 0) - r.strategyWeight * STRATEGY_ADP_UNIT

  return ranked.sort((a, b) => adjustedAdp(a) - adjustedAdp(b))
}
