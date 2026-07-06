// T-116: converts a raw per-category stat line (Sleeper's own stats/
// projections shape — pass_yd, rush_td, rec, etc.) into fantasy points
// using a league's real ScoringSettings. Same honesty rule as
// classifyPointDelta (lib/liveEvents.ts): only the fields ScoringSettings
// actually models are scored — never Sleeper's own generic pts_ppr/
// pts_half_ppr/pts_std, which assume standard modifiers a real league can
// override (custom TE premium, non-standard yards-per-point, etc.).

import type { ScoringSettings } from '@/types'

export function computeStatlinePoints(
  stats: Record<string, number> | undefined,
  position: string | null | undefined,
  scoring: ScoringSettings
): number | null {
  // Distinct from a genuine 0-point projection (e.g. a healthy-scratch
  // bench player) — no stats row at all means Sleeper has nothing for
  // this player this week, not "projected to score zero."
  if (!stats) return null

  const points =
    (stats.pass_yd ?? 0) / scoring.passingYardsPerPoint +
    (stats.pass_td ?? 0) * scoring.qbTouchdownPoints +
    (stats.pass_int ?? 0) * scoring.interceptionThrownPoints +
    (stats.rush_yd ?? 0) / scoring.rushingYardsPerPoint +
    (stats.rush_td ?? 0) * scoring.rushTouchdownPoints +
    (stats.rec_yd ?? 0) / scoring.receivingYardsPerPoint +
    (stats.rec_td ?? 0) * scoring.receivingTouchdownPoints +
    (stats.rec ?? 0) * scoring.ppr +
    (position === 'TE' ? (stats.rec ?? 0) * scoring.tePremium : 0) +
    (stats.fum_lost ?? 0) * scoring.fumbleLostPoints

  return Math.round(points * 100) / 100
}
