import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KickoffScene } from './KickoffScene'

describe('KickoffScene', () => {
  it('renders the OS chrome and caption', () => {
    render(<KickoffScene />)
    expect(screen.getByText('ROSTIRO')).toBeTruthy()
    expect(screen.getByText(/kickoff/i)).toBeTruthy()
  })

  it('renders the standard state without Mission Control before kickoff', () => {
    render(<KickoffScene frame={0} />)
    expect(screen.getByText('ROSTIRO')).toBeTruthy()
    expect(screen.queryByText('MISSION CONTROL')).toBeNull()
  })

  it('renders the Mission Control pill after the kickoff sweep', () => {
    render(<KickoffScene frame={260} />)
    expect(screen.getByText('MISSION CONTROL')).toBeTruthy()
  })
})
