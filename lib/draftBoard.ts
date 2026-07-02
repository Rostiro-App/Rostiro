// T-64.1: Draft Copilot — pure computation. No network calls in this file —
// everything here operates on data already fetched (cached player pool,
// polled picks, draft settings), which is what makes the board "always
// current" without a per-view API round trip. See PRD 6.3.1.

import type { ADPPlayer, DraftPick, NFLPosition } from '@/types'

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

// Undrafted players, sorted so positions the roster still needs come first
// (each group internally sorted by ADP — best value first within the group).
export function computeBestAvailable(
  pool: ADPPlayer[],
  draftedPlayerIds: Set<string>,
  rosterNeeds: Partial<Record<NFLPosition, number>>,
  rosterCounts: Partial<Record<NFLPosition, number>>
): ADPPlayer[] {
  const available = pool.filter((p) => !draftedPlayerIds.has(p.playerId))

  const needed: ADPPlayer[] = []
  const filled: ADPPlayer[] = []
  for (const p of available) {
    const need = rosterNeeds[p.position] ?? 0
    const have = rosterCounts[p.position] ?? 0
    if (have < need) needed.push(p)
    else filled.push(p)
  }

  const byAdp = (a: ADPPlayer, b: ADPPlayer) => a.adpConsensus - b.adpConsensus
  return [...needed.sort(byAdp), ...filled.sort(byAdp)]
}
