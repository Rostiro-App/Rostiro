import { describe, it, expect } from 'vitest'
import { prefillLiveScenario } from './liveScenario'
import players from '@/app/demo/fixtures/players.json'
import week from '@/app/demo/fixtures/week.json'

describe('prefillLiveScenario', () => {
  const sc = prefillLiveScenario()
  it('features at least 6 real rostered players with real finals', () => {
    expect(sc.players.length).toBeGreaterThanOrEqual(6)
    const ids = new Set((players as { id: string }[]).map((p) => p.id))
    const box = (week as { boxScores: Record<string, { points: number }> }).boxScores
    for (const p of sc.players) {
      expect(ids.has(p.playerId)).toBe(true)
      expect(box[p.playerId].points).toBe(p.finalPoints)
      expect(p.gameId).toBeTruthy()
    }
  })
  it('groups players into 2-3 games that reference real team codes', () => {
    expect(sc.games.length).toBeGreaterThanOrEqual(2)
    expect(sc.games.length).toBeLessThanOrEqual(3)
    for (const p of sc.players) expect(sc.games.some((g) => g.id === p.gameId)).toBe(true)
  })
  it('has matchups with authored opponent finals', () => {
    expect(sc.matchups.length).toBeGreaterThanOrEqual(1)
    for (const m of sc.matchups) expect(m.oppFinal).toBeGreaterThan(0)
  })
})
