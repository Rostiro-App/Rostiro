import { computeLeagueHealth, type HealthInput } from '@/lib/healthScore'
import type { LeagueHealth } from '@/types'
import { loadFixtures } from './loadFixtures'
import type { DemoPlayer, DemoManager } from './types'

export interface DemoHealthResult {
  health: LeagueHealth
  bestFreeAgent: DemoPlayer | null
  founder: DemoManager
}

/**
 * Shared, real Health Score computation for the demo — one source of truth so
 * the SystemBar health dot and the Pulse feed's free-agent card agree. Runs the
 * production `computeLeagueHealth` engine over baked fixtures (real 2024 ADP).
 */
export function demoHealth(fx = loadFixtures()): DemoHealthResult {
  const { players, league } = fx
  const byId = new Map(players.map((p) => [p.id, p]))
  const founder = league.managers[0]
  const rostered = new Set(league.managers.flatMap((m) => m.roster))
  const freeAgents = players
    .filter((p) => !rostered.has(p.id) && p.adp != null)
    .sort((a, b) => (a.adp! - b.adp!))
  const bestFreeAgent = freeAgents[0] ?? null

  const input: HealthInput = {
    myPlayers: founder.roster.map((id) => {
      const p = byId.get(id)
      return { playerId: id, adp: p?.adp ?? null, injuryStatus: null }
    }),
    starterIds: founder.roster.slice(0, 9),
    bestFreeAgentAdp: bestFreeAgent?.adp ?? null,
    bestFreeAgentName: bestFreeAgent?.name ?? null,
  }

  return { health: computeLeagueHealth(input), bestFreeAgent, founder }
}
