// T-99: Opportunity Surge — "the positive mirror to injury shock" (PRD 7.1),
// named in the PRD but never built. The real insight: Sleeper's player
// payload already carries real NFL depth_chart_order/position per team
// (confirmed live, July 5, 2026 — lib/sleeper.ts), so "a starter goes down,
// who benefits" is a deterministic join over data Rostiro already caches,
// not a text-parsing or Claude-guessing problem. Claude's only job downstream
// is writing the one-sentence "why this matters" for the event this file
// detects — never deciding who the beneficiary is.

interface DepthPlayer {
  player_id: string
  name: string
  position: string | null
  nfl_team: string | null
  injury_status: string | null
  depth_chart_order: number | null
}

export interface SurgeEvent {
  outgoingPlayerId: string
  outgoingName: string
  outgoingStatus: string
  beneficiaryPlayerId: string
  beneficiaryName: string
  beneficiaryPosition: string
  nflTeam: string
}

const SIDELINED_STATUSES = new Set(['out', 'ir', 'doubtful'])

function isSidelined(status: string | null): boolean {
  return !!status && SIDELINED_STATUSES.has(status.toLowerCase())
}

// Scans every real NFL team+position group: if the depth chart's #1 is
// sidelined, the beneficiary is the next player down who isn't *also*
// sidelined (skips past a banged-up backup to whoever's actually next).
export function detectOpportunitySurges(allPlayers: DepthPlayer[]): SurgeEvent[] {
  const groups = new Map<string, DepthPlayer[]>()
  for (const p of allPlayers) {
    if (!p.nfl_team || !p.position || p.depth_chart_order === null) continue
    const key = `${p.nfl_team}:${p.position}`
    const list = groups.get(key) ?? []
    list.push(p)
    groups.set(key, list)
  }

  const events: SurgeEvent[] = []
  for (const group of groups.values()) {
    group.sort((a, b) => a.depth_chart_order! - b.depth_chart_order!)
    const starter = group[0]
    if (!starter || starter.depth_chart_order !== 1 || !isSidelined(starter.injury_status)) continue

    const beneficiary = group.slice(1).find((p) => !isSidelined(p.injury_status))
    if (!beneficiary) continue

    events.push({
      outgoingPlayerId: starter.player_id,
      outgoingName: starter.name,
      outgoingStatus: starter.injury_status!,
      beneficiaryPlayerId: beneficiary.player_id,
      beneficiaryName: beneficiary.name,
      beneficiaryPosition: beneficiary.position!,
      nflTeam: starter.nfl_team!,
    })
  }
  return events
}
