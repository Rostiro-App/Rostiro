// T-68 (shared with T-67): League Health Score — PRD 6.2.
// Pure computation, no network calls, no Claude. The five factors and their
// weights come straight from the PRD table: starter injury risk 30%, bye
// exposure 20%, waiver opportunity 20%, matchup difficulty 20%, roster
// depth 10%. Bye and matchup need in-season data we don't have yet
// (schedule week + matchup projections), so they return score: null with an
// honest note and the overall score reweights across what's available —
// never a fake number (PRD: "don't show a number you can't back up").

import type { LeagueHealth, LeagueHealthFactor, LeagueHealthStatus } from '@/types'

export interface HealthPlayer {
  playerId: string
  adp: number | null
  injuryStatus: string | null
}

export interface HealthInput {
  // Everyone on my roster, cache-enriched. Empty = league hasn't drafted yet.
  myPlayers: HealthPlayer[]
  // Player IDs currently in starting slots. Often empty preseason — we fall
  // back to the top of the roster by ADP as the "core" in that case.
  starterIds: string[]
  // Best (lowest) ADP among players rostered by nobody in this league.
  bestFreeAgentAdp: number | null
  bestFreeAgentName: string | null
}

// How much of an injury each designation counts as, 0-1.
const INJURY_SEVERITY: Record<string, number> = {
  out: 1,
  ir: 1,
  pup: 1,
  sus: 1,
  doubtful: 0.75,
  questionable: 0.4,
}

const CORE_SIZE = 10 // preseason fallback when no starters are set

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n))
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

export function computeLeagueHealth(input: HealthInput): LeagueHealth {
  const { myPlayers, starterIds, bestFreeAgentAdp, bestFreeAgentName } = input

  // No roster yet (league created but not drafted): nothing to score.
  if (myPlayers.length === 0) {
    return {
      score: null,
      status: 'unknown',
      factors: allFactors({ injury: null, waiver: null, depth: null }),
      topFlag: 'No roster yet — league hasn’t drafted',
    }
  }

  // "Core" = the players whose availability actually decides weeks: real
  // starters when set, otherwise the top of the roster by ADP.
  const byAdp = [...myPlayers].sort(
    (a, b) => (a.adp ?? Number.MAX_SAFE_INTEGER) - (b.adp ?? Number.MAX_SAFE_INTEGER)
  )
  const starterSet = new Set(starterIds)
  const core = starterIds.length > 0
    ? myPlayers.filter((p) => starterSet.has(p.playerId))
    : byAdp.slice(0, CORE_SIZE)
  const bench = myPlayers.filter((p) => !core.includes(p))

  // ── Starter injury risk (30%) ──────────────────────────────────────────
  let injurySum = 0
  let injuredHardCount = 0
  for (const p of core) {
    const sev = INJURY_SEVERITY[(p.injuryStatus ?? '').toLowerCase()] ?? 0
    injurySum += sev
    if (sev >= 1) injuredHardCount++
  }
  const injuryScore = clamp(100 * (1 - injurySum / Math.max(core.length, 1)))

  // ── Waiver opportunity (20%) ───────────────────────────────────────────
  // A free agent with a better ADP than your median core player means the
  // wire has something you should be acting on — that lowers health (health
  // = "how settled is this league," not "how lucky are you").
  const coreAdps = core.map((p) => p.adp).filter((a): a is number => a !== null)
  const medianCoreAdp = median(coreAdps)
  let waiverScore: number | null = null
  if (medianCoreAdp !== null && bestFreeAgentAdp !== null) {
    waiverScore = bestFreeAgentAdp >= medianCoreAdp
      ? 100
      : clamp(100 * (bestFreeAgentAdp / medianCoreAdp))
  }

  // ── Roster depth (10%) ─────────────────────────────────────────────────
  // Bench quality relative to core: average ADP ratio. A bench that's close
  // to the core in ADP terms means injuries are survivable.
  const benchAdps = bench.map((p) => p.adp).filter((a): a is number => a !== null)
  const avg = (nums: number[]) => nums.reduce((s, n) => s + n, 0) / nums.length
  let depthScore: number | null = null
  if (coreAdps.length > 0 && benchAdps.length > 0) {
    depthScore = clamp(100 * (avg(coreAdps) / avg(benchAdps)))
  }

  const factors = allFactors({ injury: injuryScore, waiver: waiverScore, depth: depthScore })

  // Overall: weighted average across factors that have data, reweighted so
  // the available weights sum to 1. Two null factors preseason means the
  // score leans on injury/waiver/depth — that's disclosed in the factor list.
  const available = factors.filter((f) => f.score !== null)
  const totalWeight = available.reduce((s, f) => s + f.weight, 0)
  const score = totalWeight > 0
    ? Math.round(available.reduce((s, f) => s + (f.score as number) * f.weight, 0) / totalWeight)
    : null

  const status: LeagueHealthStatus =
    score === null ? 'unknown' : score >= 80 ? 'healthy' : score >= 60 ? 'monitor' : 'action'

  // Top flag: the single most actionable thing, worst first.
  let topFlag: string | null = null
  if (injuredHardCount > 0) {
    topFlag = `${injuredHardCount} core ${injuredHardCount === 1 ? 'player' : 'players'} OUT`
  } else if (waiverScore !== null && waiverScore < 70 && bestFreeAgentName) {
    topFlag = `${bestFreeAgentName} is unclaimed and beats your median starter`
  } else if (injurySum > 0) {
    topFlag = 'Questionable tags on your core — monitor'
  }

  return { score, status, factors, topFlag }
}

function allFactors(scores: {
  injury: number | null
  waiver: number | null
  depth: number | null
}): LeagueHealthFactor[] {
  return [
    {
      key: 'injury',
      label: 'Starter injury risk',
      weight: 30,
      score: scores.injury !== null ? Math.round(scores.injury) : null,
      note: scores.injury === null ? 'Needs a roster' : null,
    },
    { key: 'bye', label: 'Bye exposure', weight: 20, score: null, note: 'Loads Week 1' },
    {
      key: 'waiver',
      label: 'Waiver opportunity',
      weight: 20,
      score: scores.waiver !== null ? Math.round(scores.waiver) : null,
      note: scores.waiver === null ? 'Needs a roster' : null,
    },
    { key: 'matchup', label: 'Matchup difficulty', weight: 20, score: null, note: 'Loads Week 1' },
    {
      key: 'depth',
      label: 'Roster depth',
      weight: 10,
      score: scores.depth !== null ? Math.round(scores.depth) : null,
      note: scores.depth === null ? 'Needs a roster' : null,
    },
  ]
}
