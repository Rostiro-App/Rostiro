import { demoHealth } from '@/app/demo/lib/demoHealth'
import { buildPulseFeed, type DemoPulseItem } from '@/app/demo/lib/pulseFeed'

// Scene-1 only: the founder's real league plus two mock league names, so the
// "one list, every league" claim is visibly unified. Names only — no invented
// stats; card bodies reuse the real fixture-derived buildPulseFeed output.
export const DEMO_LEAGUES = ["Lawrence's Legends League", 'Sunday Money', 'The Bit League'] as const

/** Real decision cards, re-tagged across the three demo leagues (one card
 *  uses the real "N leagues" label form to prove genuine aggregation). */
export function multiLeaguePulse(): DemoPulseItem[] {
  const base = buildPulseFeed(demoHealth())
  return base.slice(0, 4).map((card, i) => ({
    ...card,
    id: `ml-${card.id}`,
    leagueName: i === 3 ? '2 leagues' : DEMO_LEAGUES[i % DEMO_LEAGUES.length],
  }))
}
