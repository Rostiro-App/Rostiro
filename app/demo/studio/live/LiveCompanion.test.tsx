import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LiveCompanion } from './LiveCompanion'
import type { LiveSimFrame } from '@/app/demo/lib/liveSim'

const frame: LiveSimFrame = {
  games: [{ away: 'BUF', home: 'MIA', awayScore: 14, homeScore: 10, period: 3, clock: '8:00', players: [
    { playerId: 'a', name: 'Star RB', pos: 'RB', nflTeam: 'BUF', headshotUrl: null, points: 18.4, projected: 24, event: 'TD', leagueChips: [{ leagueName: "Lawrence's Legends", starting: true }] },
  ] }],
  matchups: [{ leagueName: "Lawrence's Legends", myScore: 92.1, oppScore: 88.0, myProjected: 118, oppProjected: 114 }],
}

describe('LiveCompanion', () => {
  it('renders LIVE NOW, a game header, a player row, and the matchup rail', () => {
    render(<LiveCompanion frame={frame} />)
    expect(screen.getByText(/live now/i)).toBeTruthy()
    expect(screen.getByText(/BUF 14 – MIA 10 · Q3 8:00/)).toBeTruthy()
    expect(screen.getByText('Star RB')).toBeTruthy()
    expect(screen.getByText('18.4')).toBeTruthy()
    expect(screen.getByText(/Your matchups/i)).toBeTruthy()
    expect(screen.getByText('92.1')).toBeTruthy()
  })
  it('shows the event flash when a player has an active event', () => {
    render(<LiveCompanion frame={frame} />)
    expect(screen.getByText(/TD/)).toBeTruthy()
  })
})
