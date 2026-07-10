import { describe, it, expect } from 'vitest'
import { liveSimAt } from './liveSim'
import type { LiveScenario } from './liveScenario'

const scenario: LiveScenario = {
  featuredLeagueName: 'Test League',
  games: [{ id: 'g0', away: 'BUF', home: 'MIA' }],
  players: [
    { playerId: 'a', name: 'Star RB', pos: 'RB', nflTeam: 'BUF', headshotUrl: null, finalPoints: 24, tdCount: 2, eventLabel: 'TD', gameId: 'g0', starting: true },
    { playerId: 'b', name: 'Bench WR', pos: 'WR', nflTeam: 'MIA', headshotUrl: null, finalPoints: 10, tdCount: 0, eventLabel: 'TD', gameId: 'g0', starting: false },
  ],
  matchups: [{ leagueName: 'Test League', oppFinal: 20, oppProjected: 20 }],
}

describe('liveSimAt', () => {
  it('points are 0 at t=0 and the final at t=1, monotonic', () => {
    expect(liveSimAt(0, scenario).games[0].players[0].points).toBe(0)
    expect(liveSimAt(1, scenario).games[0].players[0].points).toBe(24)
    expect(liveSimAt(0.5, scenario).games[0].players[0].points).toBe(12)
  })
  it('matchup myScore sums only STARTING players; oppScore ramps to oppFinal', () => {
    const f = liveSimAt(1, scenario)
    expect(f.matchups[0].myScore).toBe(24)   // only the starter
    expect(f.matchups[0].oppScore).toBe(20)
    expect(liveSimAt(0, scenario).matchups[0].oppScore).toBe(0)
  })
  it('a tdCount:2 player has exactly 2 event windows across t (custom label surfaces)', () => {
    const withLabel = { ...scenario, players: [{ ...scenario.players[0], eventLabel: 'HOUSE CALL' }, scenario.players[1]] }
    const labels = new Set<string>()
    let windows = 0
    let prev = false
    for (let i = 0; i <= 100; i++) {
      const ev = liveSimAt(i / 100, withLabel).games[0].players[0].event
      if (ev) { labels.add(ev); if (!prev) windows++; prev = true } else prev = false
    }
    expect(windows).toBe(2)
    expect(labels.has('HOUSE CALL')).toBe(true)
  })
  it('reads only the scenario — a custom finalPoints override is reflected', () => {
    const s2 = { ...scenario, players: [{ ...scenario.players[0], finalPoints: 40 }, scenario.players[1]] }
    expect(liveSimAt(1, s2).games[0].players[0].points).toBe(40)
  })
})
