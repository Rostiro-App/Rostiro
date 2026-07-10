import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { filmPack } from './filmPack'

describe('filmPack', () => {
  it('prefill result is consistent with demoLeagues scores', () => {
    const c = filmPack.prefill()
    expect(c.won).toBe(c.myScore > c.oppScore)
    expect(c.usage?.name.length).toBeGreaterThan(0)
  })
  it('FullSurface renders the FILM ROOM panel, score, and usage line', () => {
    const c = { ...filmPack.prefill(), leagueName: 'Bench Regret FC', won: true, usage: { name: 'Test Guy', position: 'WR', direction: 'buy_low' as const, deltaPct: 12 } }
    render(<filmPack.FullSurface content={c} />)
    expect(screen.getByText('FILM ROOM')).toBeTruthy()
    expect(screen.getByText(/You won this week — Bench Regret FC/)).toBeTruthy()
    expect(screen.getByText(/Test Guy \(WR\) — snap share up 12pts/)).toBeTruthy()
  })
})
