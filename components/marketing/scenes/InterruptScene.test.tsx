import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { InterruptScene } from './InterruptScene'
import { loadFixtures } from '@/app/demo/lib/loadFixtures'

const { players, week } = loadFixtures()
const topScore = Object.values(week.boxScores).sort((a, b) => b.points - a.points)[0]
const topPlayerName = players.find((p) => p.id === topScore.playerId)?.name ?? ''

describe('InterruptScene', () => {
  it('renders game-day chrome and the interrupt caption', () => {
    render(<InterruptScene />)
    expect(screen.getByText('ROSTIRO')).toBeTruthy()
    expect(screen.getByText(/clears itself/i)).toBeTruthy()
  })

  it('shows game-day chrome but no TOUCHDOWN card before the enter frame', () => {
    render(<InterruptScene frame={60} />)
    expect(screen.getByText('MISSION CONTROL')).toBeTruthy()
    expect(screen.queryByText('TOUCHDOWN')).toBeNull()
  })

  it('shows the TOUCHDOWN card with the real top player line once entered', () => {
    render(<InterruptScene frame={150} />)
    const card = screen.getByRole('status')
    expect(within(card).getByText('TOUCHDOWN')).toBeTruthy()
    expect(within(card).getAllByText(new RegExp(topPlayerName)).length).toBeGreaterThan(0)
  })

  it('auto-dismisses the TOUCHDOWN card after the dismiss window', () => {
    render(<InterruptScene frame={345} />)
    expect(screen.queryByText('TOUCHDOWN')).toBeNull()
  })
})
