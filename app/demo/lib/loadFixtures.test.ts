import { describe, it, expect } from 'vitest'
import { loadFixtures } from './loadFixtures'

describe('loadFixtures', () => {
  it('loads all 10 locked managers with founder first', () => {
    const { league } = loadFixtures()
    expect(league.managers).toHaveLength(10)
    expect(league.managers[0].teamName).toBe("Lawrence's Legends")
    expect(league.managers[0].archetype).toBe('founder')
  })
  it('returns timeline beats sorted by timeOffset', () => {
    const { timeline } = loadFixtures()
    const offs = timeline.map((b) => b.timeOffset)
    expect(offs).toEqual([...offs].sort((a, b) => a - b))
  })
  it('every roster player id exists in players', () => {
    const { players, league } = loadFixtures()
    const ids = new Set(players.map((p) => p.id))
    for (const m of league.managers) for (const pid of m.roster) expect(ids.has(pid)).toBe(true)
  })
})
