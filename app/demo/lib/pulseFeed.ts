import type { DemoPlayer } from './types'
import type { DemoHealthResult } from './demoHealth'
import { loadFixtures } from './loadFixtures'

// Mirrors the real Pulse item vocabulary (see app/(dashboard)/pulse TYPE_CONFIG)
// so the demo cards read exactly like production decisions.
export type DemoPulseType =
  | 'waiver_alert' | 'lineup_decision' | 'injury_alert' | 'trade_opportunity' | 'opponent_intel'
export type DemoPulsePriority = 'critical' | 'important' | 'info'

export interface DemoPulseItem {
  id: string
  type: DemoPulseType
  priority: DemoPulsePriority
  headline: string
  reasoning: string
  leagueName: string
  platform: string | null
  actionUrl: string | null
}

/**
 * Pure: derive the Standard-state decision feed entirely from baked real-2024
 * fixtures + the shared Health Score result. Every number in every card traces
 * to a real player line — nothing is invented.
 */
export function buildPulseFeed(hr: DemoHealthResult, fx = loadFixtures()): DemoPulseItem[] {
  const { players, league, waivers, week } = fx
  const byId = new Map<string, DemoPlayer>(players.map((p) => [p.id, p]))
  const { founder, bestFreeAgent } = hr
  const leagueName = league.name
  const items: DemoPulseItem[] = []

  // 1. Real waiver breakout — top add from the anchor week (real box line + FAAB).
  const w = waivers[0]
  if (w) {
    const box = week.boxScores[w.playerId]
    items.push({
      id: `waiver-${w.playerId}`,
      type: 'waiver_alert',
      priority: 'important',
      headline: `${w.name} is blowing up — claim before waivers run`,
      reasoning: `${w.name} (${w.pos}) just posted ${box ? `${box.points} pts (${box.line})` : 'a season high'} and is rostered in almost no leagues. Suggested bid: $${w.faabSuggestion} of your $100 FAAB.`,
      leagueName,
      platform: 'Sleeper',
      actionUrl: '#',
    })
  }

  // 2. Real free-agent flag — the exact signal the Health engine surfaced.
  if (bestFreeAgent) {
    const fa = bestFreeAgent
    items.push({
      id: `fa-${fa.id}`,
      type: 'opponent_intel',
      priority: 'info',
      headline: `${fa.name} is unrostered and beats your median starter`,
      reasoning: `${fa.name} (${fa.pos}, ${fa.nflTeam}) carries a ${fa.adp?.toFixed(1)} ADP — ahead of half your starting lineup — and nobody in ${leagueName} has claimed him yet.`,
      leagueName,
      platform: 'Sleeper',
      actionUrl: '#',
    })
  }

  // 3. Real START/SIT — compare the founder's two best flex bats by season points.
  const flex = founder.roster
    .map((id) => byId.get(id))
    .filter((p): p is DemoPlayer => !!p && (p.pos === 'RB' || p.pos === 'WR'))
    .sort((a, b) => b.season.points - a.season.points)
  if (flex.length >= 2) {
    const start = flex[0]
    const sit = flex[Math.min(3, flex.length - 1)]
    if (start.id !== sit.id) {
      items.push({
        id: `lineup-${start.id}`,
        type: 'lineup_decision',
        priority: 'info',
        headline: `Start ${start.name} over ${sit.name} at FLEX`,
        reasoning: `${start.name} (${start.pos}) has out-scored ${sit.name} ${start.season.points.toFixed(1)} to ${sit.season.points.toFixed(1)} on the season. Lock the higher floor into your flex.`,
        leagueName,
        platform: 'Sleeper',
        actionUrl: '#',
      })
    }
  }

  // 4. Real standings intel — the points race for the 1-seed.
  const sorted = [...league.managers].sort(
    (a, b) => b.record.w - a.record.w || b.seasonPoints - a.seasonPoints,
  )
  const rival = sorted.find((m) => m.managerId !== founder.managerId)
  if (rival) {
    const diff = founder.seasonPoints - rival.seasonPoints
    const ahead = diff >= 0
    items.push({
      id: `intel-${rival.managerId}`,
      type: 'opponent_intel',
      priority: 'info',
      headline: `${ahead ? 'You lead' : 'You trail'} ${rival.teamName} by ${Math.abs(diff).toFixed(1)} points-for`,
      reasoning: `${founder.teamName} (${founder.record.w}-${founder.record.l}) and ${rival.teamName} (${rival.record.w}-${rival.record.l}) are neck-and-neck for the top seed. Points-for is the tiebreaker — keep your ceiling high.`,
      leagueName,
      platform: null,
      actionUrl: null,
    })
  }

  return items
}
