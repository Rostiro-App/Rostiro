import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Studio } from './Studio'

describe('Studio', () => {
  it('renders panel + canvas and fires an event onto the canvas', () => {
    render(<Studio />)
    // canvas OS present
    expect(screen.getByText('ROSTIRO')).toBeTruthy()
    // author: type + select, then Fire
    fireEvent.change(screen.getByPlaceholderText(/search player/i), { target: { value: 'Lamar' } })
    fireEvent.click(screen.getByText(/Lamar Jackson/))
    // Before firing, no interrupt card is on the canvas:
    expect(screen.queryByText(/OF YOUR LEAGUE/i)).toBeNull()
    fireEvent.click(screen.getByText(/Fire/))
    // After firing, the canvas card's cross-league divider is present:
    expect(screen.getByText(/OF YOUR LEAGUE/i)).toBeTruthy()
  })

  it('switching to Waiver Day shows the Mission Briefing surface with prefilled targets', () => {
    render(<Studio />)
    fireEvent.click(screen.getByText('Waiver Day'))
    expect(screen.getByText('MISSION BRIEFING')).toBeTruthy()
    expect(screen.getAllByText('WAIVER').length).toBeGreaterThan(0)
  })
  it('switching to Film Room shows the recap surface', () => {
    render(<Studio />)
    fireEvent.click(screen.getByText('Film Room'))
    expect(screen.getByText('FILM ROOM')).toBeTruthy()
  })
})
