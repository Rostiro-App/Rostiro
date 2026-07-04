// T-95: Film Room's buy-low/sell-high signal — pure and deterministic, per
// PRD 10.1 (Claude narrates verdicts, never decides them). Reuses
// player_usage_snapshots (T-87) rather than inventing a new usage metric.
//
// A single roster-wide "most notable mover" rather than a per-player table —
// 6.13 calls Film Room's palette "the quietest" of all five states; a wall
// of every rostered player's snap-count delta would fight that on sight.

export interface RosterUsageRow {
  playerId: string
  name: string
  position: string | null
  currentPct: number | null
  previousPct: number | null
}

export interface UsageSignal {
  playerId: string
  name: string
  position: string | null
  direction: 'buy_low' | 'sell_high'
  deltaPct: number // percentage points, e.g. 18 for a 0.15 -> 0.33 jump
}

const SIGNAL_THRESHOLD = 0.12 // 12 percentage points of snap-share swing
const SKILL_POSITIONS = new Set(['RB', 'WR', 'TE'])

// Returns the single largest qualifying usage swing on the roster, or null
// if nothing crosses the threshold — "nothing notable" is a valid, common
// outcome and shouldn't be forced into a signal.
export function computeTopUsageSignal(rows: RosterUsageRow[]): UsageSignal | null {
  let best: UsageSignal | null = null

  for (const row of rows) {
    if (row.currentPct === null || row.previousPct === null) continue
    if (!row.position || !SKILL_POSITIONS.has(row.position)) continue

    const delta = row.currentPct - row.previousPct
    if (Math.abs(delta) < SIGNAL_THRESHOLD) continue

    const candidate: UsageSignal = {
      playerId: row.playerId,
      name: row.name,
      position: row.position,
      direction: delta > 0 ? 'buy_low' : 'sell_high',
      deltaPct: Math.round(Math.abs(delta) * 100),
    }

    if (!best || candidate.deltaPct > best.deltaPct) best = candidate
  }

  return best
}
